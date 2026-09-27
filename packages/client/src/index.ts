import {
  createClient,
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type SupabaseClient,
  type SupportedStorage,
} from "@supabase/supabase-js";
import {
  createCollaborationRepository,
  type CollaborationRepository,
} from "./collaboration";
export * from "./collaboration";
import {
  demoSnapshot,
  emptySnapshot,
  transition,
  publicSnapshot,
  validateUpload,
  materialCanRetry,
  chooseFirstPet,
  emptyConsentStatus,
  consentRequirement,
  prepareConsentRecord,
  CONSENT_POLICY_VERSION,
  IA_UNAVAILABLE,
  type Snapshot,
  type Command,
  type ConsentStatus,
  type VoiceAvailability,
} from "@compa/domain";
export interface AsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
export interface Envelope {
  state: Snapshot;
  version: number;
  deviceId?: string;
  offline?: boolean;
  pendingSessionFinish?: {
    sessionId: string;
    finishedAt: string;
    status: "pending" | "conflict";
  };
  consent?: ConsentStatus;
}
export type SupportCategory = "access" | "study" | "materials" | "rooms" | "voice" | "safety" | "other";
export interface SupportMessage {
  id: string;
  author_kind: "student" | "operator";
  body: string;
  created_at: string;
}
export interface SupportTicket {
  id: string;
  category: SupportCategory;
  subject: string;
  status: "open" | "in_progress" | "waiting_student" | "resolved";
  priority: "normal" | "urgent";
  created_at: string;
  updated_at: string;
  messages: SupportMessage[];
}
export class StateConflictError extends Error {
  constructor(message: string, readonly latest?: Envelope) {
    super(message);
    this.name = "StateConflictError";
  }
}
export interface Repository {
  mode: "demo" | "live";
  collaboration?: CollaborationRepository;
  load(): Promise<Envelope>;
  command(
    command: Command,
    version: number,
    operationId?: string,
  ): Promise<Envelope>;
  finishSession(
    payload: { id: string; feedback?: string; reflection?: string },
    version: number,
  ): Promise<Envelope>;
  syncPendingSessionFinish(): Promise<Envelope | null>;
  dismissPendingSessionFinish(): Promise<Envelope | null>;
  recordConsent(payload: {
    guardian_name?: string;
    attestation: true;
    basis?: "parental-guardian" | "self-adult";
  }): Promise<Envelope>;
  ai(
    type: "chat" | "extract" | "quiz",
    payload: unknown,
    version: number,
  ): Promise<Envelope & { proposal?: unknown }>;
  upload(
    file: Blob,
    name: string,
    subjectId: string,
    version: number,
  ): Promise<Envelope>;
  processMaterial(id: string): Promise<Envelope>;
  materialText(id: string, after?: number): Promise<MaterialTextPage>;
  voiceStatus(): Promise<VoiceAvailability>;
  transcribeVoice(audio: ArrayBuffer, operationId: string, signal?: AbortSignal): Promise<{ text: string; seconds: number }>;
  signedUrl(path: string): Promise<string>;
  exportData(): Promise<unknown>;
  deleteAccount(): Promise<void>;
  signOut(): Promise<void>;
  registerDevice(token: string, platform: string): Promise<void>;
  supportTickets(before?: { updated_at: string; id: string }): Promise<SupportTicket[]>;
  createSupportTicket(input: { category: SupportCategory; subject: string; body: string }, operationId: string): Promise<void>;
  replySupportTicket(ticketId: string, body: string, operationId: string): Promise<void>;
}
export interface MaterialTextPage {
  title: string;
  complete: boolean;
  chunks: { ordinal: number; label: string; content: string }[];
  nextCursor: number | null;
}
export function createDemo(
  storage: AsyncStorage,
  options?: { onboarding?: boolean },
): Repository {
  const key = options?.onboarding
    ? "compa-onboarding-demo-v2"
    : "compa-demo-v2";
  const deviceKey = key + ":session-device";
  const deviceId = async () => {
    const existing = await storage.getItem(deviceKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    await storage.setItem(deviceKey, created);
    return created;
  };
  const get = async (): Promise<Envelope> => {
    const raw = await storage.getItem(key);
    const envelope: Envelope = raw
      ? JSON.parse(raw)
      : {
          state: options?.onboarding ? emptySnapshot() : demoSnapshot(),
          version: 0,
        };
    if (
      !options?.onboarding &&
      envelope.state.profile?.onboarding_complete &&
      !envelope.state.ownedPets?.length
    )
      chooseFirstPet(
        envelope.state,
        "Miel",
        new Date().toISOString(),
        "demo-golden",
      );
    if (!envelope.consent) envelope.consent = emptyConsentStatus();
    return { ...envelope, deviceId: await deviceId() };
  };
  const unavailable = async (): Promise<never> => {
    throw Error(
      IA_UNAVAILABLE + " La demostración no usa IA ni sube archivos.",
    );
  };
  return {
    mode: "demo",
    load: async () => {
      const s = await get();
      return { ...s, state: publicSnapshot(s.state) };
    },
    command: async (command, version) => {
      const before = await get();
      if (before.version !== version)
        throw Error("Los datos cambiaron. Actualizá la pantalla.");
      const scopedCommand = command.type.startsWith("session.")
        ? {
            ...command,
            payload: {
              ...(command.payload as Record<string, unknown>),
              device_id: before.deviceId,
            },
          }
        : command;
      const after = {
        state: transition(before.state, scopedCommand, new Date().toISOString()),
        version: version + 1,
        deviceId: before.deviceId,
        consent: before.consent ?? emptyConsentStatus(),
      };
      await storage.setItem(key, JSON.stringify(after));
      return { ...after, state: publicSnapshot(after.state) };
    },
    finishSession: async (payload, version) =>
      createDemo(storage, options).command({ type: "session.finish", payload }, version),
    syncPendingSessionFinish: async () => null,
    dismissPendingSessionFinish: async () => null,
    recordConsent: async (payload) => {
      const before = await get();
      if (!before.state.profile) throw Error("Completá tu perfil primero.");
      prepareConsentRecord(
        {
          ...payload,
          policy_version: CONSENT_POLICY_VERSION,
          basis: payload.basis ?? "parental-guardian",
        },
        before.state.profile.birth_date,
        true,
      );
      const need = consentRequirement(before.state.profile.birth_date);
      const after = {
        ...before,
        consent: {
          ...emptyConsentStatus(),
          ...need,
          recorded: !need.required,
          pending: need.required,
          capabilities: { service: !need.required, ai: !need.required, social: !need.required },
        },
      };
      await storage.setItem(key, JSON.stringify(after));
      return { ...after, state: publicSnapshot(after.state) };
    },
    ai: unavailable,
    upload: unavailable,
    processMaterial: unavailable,
    voiceStatus: async () => ({ available: false, remainingSeconds: 0, resetsAt: "", reason: "La demostración no envía audio. Ingresá a tu cuenta para usar el micrófono cuando esté habilitado." }),
    transcribeVoice: unavailable,
    materialText: unavailable,
    signedUrl: unavailable,
    registerDevice: unavailable,
    supportTickets: async () => [],
    createSupportTicket: unavailable,
    replySupportTicket: unavailable,
    exportData: async () => (await get()).state,
    deleteAccount: async () => {
      await storage.removeItem(key);
      await storage.removeItem(deviceKey);
    },
    signOut: async () => {},
  };
}
export function createBackend(
  url: string,
  key: string,
  storage?: SupportedStorage,
): SupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      flowType: "pkce",
      detectSessionInUrl: !storage && typeof window !== "undefined",
      ...(storage ? { storage } : {}),
    },
  });
}
export function createRepository(
  client: SupabaseClient,
  cache: AsyncStorage,
  userId: string,
): Repository {
  const cacheKey = "compa-cache:" + userId;
  const deviceKey = cacheKey + ":session-device";
  const pendingFinishKey = cacheKey + ":session-finish";
  type PendingFinish = {
    sessionId: string;
    finishedAt: string;
    command: Command;
    version: number;
    operationId: string;
    status: "pending" | "conflict";
  };
  const readPendingFinish = async (): Promise<PendingFinish | null> => {
    const raw = await cache.getItem(pendingFinishKey);
    return raw ? (JSON.parse(raw) as PendingFinish) : null;
  };
  const withPendingFinish = async (envelope: Envelope): Promise<Envelope> => {
    const entry = await readPendingFinish();
    if (!entry) return { ...envelope, pendingSessionFinish: undefined };
    return {
      ...envelope,
      pendingSessionFinish: {
        sessionId: entry.sessionId,
        finishedAt: entry.finishedAt,
        status: entry.status,
      },
    };
  };
  let deviceIdPromise: Promise<string> | undefined;
  const deviceId = () =>
    (deviceIdPromise ??= (async () => {
      const existing = await cache.getItem(deviceKey);
      if (existing) return existing;
      const created = crypto.randomUUID();
      await cache.setItem(deviceKey, created);
      return created;
    })());
  class RequestError extends Error {
    constructor(
      message: string,
      readonly status?: number,
    ) {
      super(message);
    }
  }
  const request = async (body: unknown, name = "api", signal?: AbortSignal, headers?: Record<string, string>) => {
    const { data, error } = await client.functions.invoke(name, {
      body: body as Record<string, unknown>,
      signal,
      headers,
    });
    if (error) {
      const context = (error as { context?: Response }).context;
      if (error instanceof FunctionsHttpError || context?.status) {
        const status = context?.status;
        let detail = `El servidor rechazó la operación (HTTP ${status}).`;
        try {
          const body = await context?.json();
          if (typeof body?.error === "string") detail = body.error;
        } catch {}
        throw new RequestError(detail, status);
      }
      if (error instanceof FunctionsFetchError)
        throw new RequestError(
          "No pudimos conectar con el servidor. Revisá tu conexión y reintentá.",
        );
      if (error instanceof FunctionsRelayError)
        throw new RequestError(
          "El servidor está temporalmente ocupado. Reintentá en unos segundos.",
          503,
        );
      throw new RequestError(
        "No pudimos confirmar el resultado. Reintentá para comprobar si se guardó.",
      );
    }
    if (data.error) throw Error(data.error);
    return data;
  };
  const collaboration = createCollaborationRepository(
    request,
    cache,
    userId,
    client,
  );
  const save = async (data: Envelope) => {
    const { pendingSessionFinish: _pendingSessionFinish, ...rest } = data;
    const local = { ...rest, deviceId: await deviceId() };
    await cache.setItem(cacheKey, JSON.stringify(local));
    return withPendingFinish(local);
  };
  // Persist a receipt before sending. A retry after a lost response must reuse the
  // original operation and version, including after the application restarts.
  const pendingKey = cacheKey + ":pending";
  type Pending = { fingerprint: string; operationId: string; version: number };
  const pending = async (
    fingerprint: string,
    version: number,
    supplied?: string,
  ) => {
    const entries: Pending[] = JSON.parse(
      (await cache.getItem(pendingKey)) ?? "[]",
    );
    const found = entries.find(
      (x) =>
        x.fingerprint === fingerprint &&
        (!supplied || supplied === x.operationId),
    );
    if (found) return found;
    const entry = {
      fingerprint,
      operationId: supplied ?? crypto.randomUUID(),
      version,
    };
    await cache.setItem(
      pendingKey,
      JSON.stringify([...entries.slice(-31), entry]),
    );
    return entry;
  };
  const forget = async (operationId: string) => {
    const entries: Pending[] = JSON.parse(
      (await cache.getItem(pendingKey)) ?? "[]",
    );
    await cache.setItem(
      pendingKey,
      JSON.stringify(entries.filter((x) => x.operationId !== operationId)),
    );
  };
  const mutate = async (
    command: { type: string; payload: unknown },
    version: number,
    operationId?: string,
    refreshOnConflict = true,
  ) => {
    if (command.type.startsWith("session."))
      command = {
        ...command,
        payload: {
          ...(command.payload as Record<string, unknown>),
          device_id: await deviceId(),
        },
      };
    const entry = await pending(JSON.stringify(command), version, operationId);
    try {
      const body = {
        ...command,
        version: entry.version,
        operationId: entry.operationId,
      };
      let result: Envelope;
      try {
        result = await request(body);
      } catch (error) {
        const retryable =
          error instanceof RequestError &&
          (error.status === undefined || error.status >= 500) &&
          !command.type.startsWith("ai.");
        if (!retryable) throw error;
        await new Promise((resolve) => setTimeout(resolve, 300));
        result = await request(body);
      }
      if (result.state) result = await save(result);
      await forget(entry.operationId);
      return result;
    } catch (error) {
      if (error instanceof RequestError && error.status === 409) {
        await forget(entry.operationId);
        const createsNewRecord =
          (command.type === "item.save" || command.type === "subject.save") &&
          !(command.payload as { id?: string } | null)?.id;
        if (
          refreshOnConflict &&
          (createsNewRecord || command.type === "studySpace.select")
        ) {
          const latest = await request({ type: "snapshot" });
          await save(latest);
          return mutate(command, latest.version, undefined, false);
        }
        let latest: Envelope | undefined;
        try {
          const fetched: Envelope = await request({ type: "snapshot" });
          latest = await save(fetched);
        } catch {
          // Keep the original conflict visible if the refresh is unavailable.
        }
        throw new StateConflictError(
          latest
            ? command.type.startsWith("session.")
              ? "La sesión cambió en otro dispositivo. Revisá el estado actualizado antes de continuar."
              : "Los datos cambiaron en otro dispositivo. Revisá el estado actualizado antes de continuar."
            : error.message,
          latest,
        );
      }
      throw error;
    }
  };
  const processMaterial = async (id: string) => {
    const latest = (await request({ type: "snapshot" })) as Envelope;
    const material = latest.state.materials.find((item) => item.id === id);
    if (!material) throw Error("Material no encontrado.");
    if (material.status === "READY" && !materialCanRetry(material)) return save(latest);
    return mutate(
      { type: "material.enqueue", payload: { id } },
      latest.version,
    );
  };
  const cachedWithPendingFinish = async (): Promise<Envelope> => {
    const raw = await cache.getItem(cacheKey);
    if (!raw) throw Error("No encontramos la sesión guardada en este dispositivo.");
    return withPendingFinish({ ...JSON.parse(raw), deviceId: await deviceId(), offline: true });
  };
  const syncPendingSessionFinish = async (): Promise<Envelope | null> => {
    let entry = await readPendingFinish();
    if (!entry) return null;
    if (entry.status === "conflict" ||
        (typeof navigator !== "undefined" && navigator.onLine === false))
      return cachedWithPendingFinish();
    for (let attempt = 0; attempt < 2; attempt++) {
      const currentEntry: PendingFinish = entry;
      try {
        const result = await mutate(currentEntry.command, currentEntry.version, currentEntry.operationId);
        await cache.removeItem(pendingFinishKey);
        return { ...result, pendingSessionFinish: undefined, offline: false };
      } catch (error) {
        if (error instanceof StateConflictError && error.latest) {
          const latest = error.latest;
          if (latest.state.sessions.some((session) => session.id === currentEntry.sessionId)) {
            await cache.removeItem(pendingFinishKey);
            return { ...latest, pendingSessionFinish: undefined };
          }
          const active = latest.state.activeSession;
          if (attempt === 0 && active && active.id === currentEntry.sessionId &&
              (!active.controller_device_id || active.controller_device_id === await deviceId())) {
            entry = { ...currentEntry, version: latest.version, operationId: crypto.randomUUID() };
            await cache.setItem(pendingFinishKey, JSON.stringify(entry));
            continue;
          }
          entry = { ...currentEntry, status: "conflict" };
          await cache.setItem(pendingFinishKey, JSON.stringify(entry));
          return withPendingFinish(latest);
        }
        if (error instanceof RequestError &&
            (error.status === undefined || error.status >= 500))
          return cachedWithPendingFinish();
        if (error instanceof RequestError && error.status === 400) {
          entry = { ...currentEntry, status: "conflict" };
          await cache.setItem(pendingFinishKey, JSON.stringify(entry));
          return { ...await cachedWithPendingFinish(), offline: false };
        }
        throw error;
      }
    }
    return cachedWithPendingFinish();
  };
  const finishSession = async (
    payload: { id: string; feedback?: string; reflection?: string },
    version: number,
  ): Promise<Envelope> => {
    const existing = await readPendingFinish();
    if (existing) {
      if (existing.sessionId !== payload.id)
        throw Error("Primero revisá el cierre pendiente de la sesión anterior.");
      return (await syncPendingSessionFinish()) ?? cachedWithPendingFinish();
    }
    const finishedAt = new Date().toISOString();
    const entry: PendingFinish = {
      sessionId: payload.id,
      finishedAt,
      command: { type: "session.finish", payload: { ...payload, finished_at: finishedAt } },
      version,
      operationId: crypto.randomUUID(),
      status: "pending",
    };
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await cache.setItem(pendingFinishKey, JSON.stringify(entry));
      return cachedWithPendingFinish();
    }
    try {
      return await mutate(entry.command, version, entry.operationId);
    } catch (error) {
      if (error instanceof RequestError &&
          (error.status === undefined || error.status >= 500)) {
        await cache.setItem(pendingFinishKey, JSON.stringify(entry));
        return cachedWithPendingFinish();
      }
      throw error;
    }
  };
  return {
    mode: "live",
    collaboration,
    load: async () => {
      try {
        const latest = await save(await request({ type: "snapshot" }));
        const queued = await readPendingFinish();
        if (queued && latest.state.sessions.some((session) => session.id === queued.sessionId)) {
          await cache.removeItem(pendingFinishKey);
          return { ...latest, pendingSessionFinish: undefined };
        }
        return (await syncPendingSessionFinish()) ?? latest;
      } catch (error) {
        if (typeof navigator !== "undefined" && navigator.onLine) throw error;
        const cached = await cache.getItem(cacheKey);
        if (cached) return withPendingFinish({ ...JSON.parse(cached), offline: true });
        throw error;
      }
    },
    command: async (command, version, operationId) =>
      mutate(command, version, operationId),
    finishSession,
    syncPendingSessionFinish,
    dismissPendingSessionFinish: async () => {
      await cache.removeItem(pendingFinishKey);
      const raw = await cache.getItem(cacheKey);
      return raw ? { ...JSON.parse(raw), pendingSessionFinish: undefined } : null;
    },
    recordConsent: async (payload) => {
      const result = await request({
        type: "consent.record",
        payload: {
          ...payload,
          policy_version: CONSENT_POLICY_VERSION,
          basis: payload.basis ?? "parental-guardian",
        },
      });
      return result.state ? await save(result) : result;
    },
    ai: async (type, payload, version) => {
      const result = await mutate(
        {
          type: "ai." + type,
          payload,
        },
        version,
      );
      if (result.state) await save(result);
      return result;
    },
    upload: async (file, name, subjectId, version) => {
      validateUpload(name, file.type, file.size);
      const bytes = await file.arrayBuffer();
      // This checksum distinguishes upload retries; it is not an integrity/security hash.
      let checksum = 2166136261;
      for (const byte of new Uint8Array(bytes))
        checksum = Math.imul(checksum ^ byte, 16777619);
      const receipt = await pending(
        JSON.stringify({ upload: name, subjectId, size: file.size, checksum }),
        version,
      );
      const prepared = await request({
        type: "material.prepare",
        payload: {
          name,
          mime_type: file.type,
          size: file.size,
          subject_id: subjectId,
        },
        version: receipt.version,
        operationId: receipt.operationId,
      });
      await save({ state: prepared.state, version: prepared.version });
      const { error } = await client.storage
        .from("materials")
        .uploadToSignedUrl(prepared.path, prepared.token, bytes, {
          contentType: file.type,
        });
      if (
        error &&
        !["409", "400"].includes(
          String((error as { statusCode?: string }).statusCode),
        )
      )
        throw Error(
          "No se pudo confirmar la carga. Reintentá con el mismo archivo.",
        );
      // enqueue checks that the private object exists with the expected size;
      // an 'already exists' upload response is safe on a retry.
      const queued = await mutate(
        {
          type: "material.enqueue",
          payload: { id: prepared.id },
        },
        prepared.version,
      );
      await forget(receipt.operationId);
      return queued;
    },
    processMaterial,
    voiceStatus: () => request({ type: "status" }, "voice"),
    transcribeVoice: (audio, operationId, signal) => request(audio, "voice", signal, { "Content-Type": "audio/wav", "x-operation-id": operationId }),
    materialText: async (id, after = -1) => request({ type: "material.text", payload: { id, after } }),
    signedUrl: async (path) => {
      const result = await request({ type: "material.original", payload: { path } });
      return result.url;
    },
    exportData: () => request({ type: "privacy.export" }),
    deleteAccount: async () => {
      await request({
        type: "privacy.delete",
        payload: { confirmation: "ELIMINAR" },
      });
      await cache.removeItem(cacheKey);
      await cache.removeItem(pendingKey);
      await cache.removeItem(pendingFinishKey);
      await cache.removeItem(deviceKey);
      await collaboration.clear();
      await client.auth.signOut();
    },
    signOut: async () => {
      const token = await cache.getItem(cacheKey + ":device");
      if (token)
        await request({ type: "device.unregister", payload: { token } });
      await cache.removeItem(cacheKey + ":device");
      await cache.removeItem(cacheKey);
      await cache.removeItem(pendingKey);
      await cache.removeItem(pendingFinishKey);
      await cache.removeItem(deviceKey);
      await collaboration.clear();
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },
    supportTickets: async (before) => {
      const result = await request({ type: "support.list", payload: before ? { before } : {} });
      return result.tickets as SupportTicket[];
    },
    createSupportTicket: async (input, operationId) => {
      await request({ type: "support.create", payload: input, operationId });
    },
    replySupportTicket: async (ticketId, body, operationId) => {
      await request({ type: "support.reply", payload: { ticket_id: ticketId, body }, operationId });
    },
    registerDevice: async (token, platform) => {
      const previous = await cache.getItem(cacheKey + ":device");
      if (previous && previous !== token)
        await request({
          type: "device.unregister",
          payload: { token: previous },
        });
      await request({ type: "device.register", payload: { token, platform } });
      await cache.setItem(cacheKey + ":device", token);
    },
  };
}
export * from "./shared-room";
