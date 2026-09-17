import {
  collaborationCommandSchema,
  type CollaborationCommand,
  type CollaborationOverview,
  type CollaborationReceipt,
  type GroupSessionDetail,
} from "@compa/domain";
import type { AsyncStorage } from "./index";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CollaborationRepository {
  overview(): Promise<CollaborationOverview>;
  session(id: string): Promise<GroupSessionDetail>;
  command(command: CollaborationCommand): Promise<CollaborationReceipt>;
  subscribe?(
    changed: () => void,
    status: (value: "connected" | "reconnecting") => void,
  ): () => void;
}
export function createCollaborationRepository(
  request: (body: Record<string, unknown>) => Promise<unknown>,
  cache: AsyncStorage,
  userId: string,
  client?: SupabaseClient,
): CollaborationRepository & { clear(): Promise<void> } {
  const key = "compa-collaboration:" + userId + ":pending";
  // Only unconfirmed commands are persisted, scoped to the authenticated user.
  // Rosters and access state are fetched online, never served from an offline cache.
  type Pending = { fingerprint: string; operationId: string };
  // Serialize mutations per repository to avoid overwriting another pending receipt.
  let tail: Promise<unknown> = Promise.resolve();
  const mutate = async (
    input: CollaborationCommand,
  ): Promise<CollaborationReceipt> => {
    const command = collaborationCommandSchema.parse(input);
    if (command.action === "room.heartbeat")
      return (await request({
        type: "collaboration.command",
        payload: command,
        operationId: crypto.randomUUID(),
      })) as CollaborationReceipt;
    const fingerprint = JSON.stringify(command);
    const entries: Pending[] = JSON.parse((await cache.getItem(key)) ?? "[]");
    const entry = entries.find((x) => x.fingerprint === fingerprint) ?? {
      fingerprint,
      operationId: crypto.randomUUID(),
    };
    if (!entries.includes(entry)) {
      if (entries.length >= 32)
        throw Error(
          "Hay cambios pendientes de confirmar. Reintentá los anteriores antes de crear otros.",
        );
      await cache.setItem(key, JSON.stringify([...entries, entry]));
    }
    const forget = async () =>
      cache.setItem(
        key,
        JSON.stringify(
          entries.filter((x) => x.operationId !== entry.operationId),
        ),
      );
    try {
      const result = await request({
        type: "collaboration.command",
        payload: command,
        operationId: entry.operationId,
      });
      await forget();
      return result as CollaborationReceipt;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status && status >= 400 && status < 500) await forget();
      throw error;
    }
  };
  return {
    subscribe: client
      ? (changed, status) => {
          const channel = client
            .channel("compa-social:" + userId, { config: { private: true } })
            .on("broadcast", { event: "changed" }, changed)
            .subscribe((value) => {
              status(value === "SUBSCRIBED" ? "connected" : "reconnecting");
              if (value === "SUBSCRIBED") changed();
            });
          return () => {
            void client.removeChannel(channel);
          };
        }
      : undefined,
    overview: async () =>
      (await request({
        type: "collaboration.overview",
      })) as CollaborationOverview,
    session: async (id) =>
      (await request({
        type: "collaboration.session",
        payload: { session_id: id },
      })) as GroupSessionDetail,
    command: (command) => {
      const next = tail.then(() => mutate(command));
      tail = next.catch(() => {});
      return next;
    },
    clear: async () => {
      await tail;
      await cache.removeItem(key);
    },
  };
}
