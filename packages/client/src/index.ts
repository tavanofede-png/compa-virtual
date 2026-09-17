import {
  createClient,
  type SupabaseClient,
  type SupportedStorage,
} from "@supabase/supabase-js";
import { createCollaborationRepository, type CollaborationRepository } from "./collaboration";
export * from "./collaboration";
import {
  demoSnapshot,
  emptySnapshot,
  transition,
  publicSnapshot,
  validateUpload,
  chooseFirstPet,
  type Snapshot,
  type Command,
} from "@compa/domain";
export interface AsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
export interface Envelope {
  state: Snapshot;
  version: number;
  offline?: boolean;
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
  signedUrl(path: string): Promise<string>;
  exportData(): Promise<unknown>;
  deleteAccount(): Promise<void>;
  signOut(): Promise<void>;
  registerDevice(token: string, platform: string): Promise<void>;
}
export function createDemo(storage: AsyncStorage, options?: { onboarding?: boolean }): Repository {
  const key = options?.onboarding ? "compa-onboarding-demo-v2" : "compa-demo-v2";
  const get = async (): Promise<Envelope> => {
    const raw = await storage.getItem(key);
    const envelope: Envelope = raw ? JSON.parse(raw) : { state: options?.onboarding ? emptySnapshot() : demoSnapshot(), version: 0 };
    if (!options?.onboarding && envelope.state.profile?.onboarding_complete && !envelope.state.ownedPets?.length)
      chooseFirstPet(envelope.state, "Miel", new Date().toISOString(), "demo-golden");
    return envelope;
  };
  const unavailable = async (): Promise<never> => {
    throw Error(
      "Esta función requiere una cuenta conectada. La demostración no usa IA ni sube archivos.",
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
      const after = {
        state: transition(before.state, command, new Date().toISOString()),
        version: version + 1,
      };
      await storage.setItem(key, JSON.stringify(after));
      return { ...after, state: publicSnapshot(after.state) };
    },
    ai: unavailable,
    upload: unavailable,
    signedUrl: unavailable,
    registerDevice: unavailable,
    exportData: async () => (await get()).state,
    deleteAccount: async () => {
      await storage.removeItem(key);
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
  class RequestError extends Error {
    constructor(
      message: string,
      readonly status?: number,
    ) {
      super(message);
    }
  }
  const request = async (body: unknown) => {
    const { data, error } = await client.functions.invoke("api", {
      body: body as Record<string, unknown>,
    });
    if (error) {
      let detail =
        "No pudimos confirmar el resultado. Reintentá para comprobar si se guardó.";
      try {
        detail = (await error.context.json()).error ?? detail;
      } catch {}
      throw new RequestError(detail, error.context?.status);
    }
    if (data.error) throw Error(data.error);
    return data;
  };
  const collaboration = createCollaborationRepository(request, cache, userId, client);
  const save = async (data: Envelope) => {
    await cache.setItem(cacheKey, JSON.stringify(data));
    return data;
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
  ) => {
    const entry = await pending(JSON.stringify(command), version, operationId);
    try {
      const result = await request({
        ...command,
        version: entry.version,
        operationId: entry.operationId,
      });
      if (result.state) await save(result);
      await forget(entry.operationId);
      return result;
    } catch (error) {
      if (error instanceof RequestError && error.status === 409)
        await forget(entry.operationId);
      throw error;
    }
  };
  return {
    mode: "live",
    collaboration,
    load: async () => {
      try {
        return await save(await request({ type: "snapshot" }));
      } catch (error) {
        if (typeof navigator !== "undefined" && navigator.onLine) throw error;
        const cached = await cache.getItem(cacheKey);
        if (cached) return { ...JSON.parse(cached), offline: true };
        throw error;
      }
    },
    command: async (command, version, operationId) =>
      mutate(command, version, operationId),
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
      const result = await mutate(
        {
          type: "material.enqueue",
          payload: { id: prepared.id },
        },
        prepared.version,
      );
      await forget(receipt.operationId);
      return result;
    },
    signedUrl: async (path) => {
      const { data, error } = await client.storage
        .from("materials")
        .createSignedUrl(path, 60);
      if (error) throw error;
      return data.signedUrl;
    },
    exportData: () => request({ type: "privacy.export" }),
    deleteAccount: async () => {
      await request({
        type: "privacy.delete",
        payload: { confirmation: "ELIMINAR" },
      });
      await cache.removeItem(cacheKey);
      await cache.removeItem(pendingKey);
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
      await collaboration.clear();
      const { error } = await client.auth.signOut();
      if (error) throw error;
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
