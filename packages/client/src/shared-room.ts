import type { CollaborationCommand, GroupSessionDetail } from "@compa/domain";
import type { CollaborationRepository } from "./collaboration";

export interface SharedRoomConnection {
  detail: GroupSessionDetail | null;
  entered: boolean;
  busy: boolean;
  error: string;
  connected: boolean;
  accessRevoked?: boolean;
  serverOffset: number;
}
/** One visual lease per device. No roster cache and no animation/frame writes. */
export function createSharedRoomSession(
  repo: CollaborationRepository,
  initial: GroupSessionDetail,
  changed: (state: SharedRoomConnection) => void,
) {
  const id = initial.session.id,
    connection = crypto.randomUUID();
  let state: SharedRoomConnection = {
    detail: initial,
    entered: false,
    busy: false,
    error: "",
    connected: false,
    serverOffset: Date.parse(initial.server_time) - Date.now(),
  };
  let alive = true,
    visible = true,
    reading = false,
    again = false,
    lastHeartbeat = 0,
    lastRead = 0;
  const emit = (patch: Partial<SharedRoomConnection>) => {
    state = { ...state, ...patch };
    if (alive) changed({ ...state });
  };
  async function refresh() {
    if (!alive || !visible) return;
    if (reading) {
      again = true;
      return;
    }
    reading = true;
    const start = Date.now();
    lastRead = start;
    try {
      const detail = await repo.session(id);
      if (!alive || !visible) return;
      lastRead = Date.now();
      emit({
        detail,
        connected: true,
        accessRevoked: false,
        serverOffset: Date.parse(detail.server_time) - (start + Date.now()) / 2,
      });
      if (!["scheduled", "active"].includes(detail.session.status))
        emit({ entered: false });
    } catch (error) {
      const e = error as Error & { status?: number };
      emit({
        detail: null,
        connected: false,
        error: e.message,
        ...(e.status === 403 || e.status === 404 ? { entered: false, accessRevoked: true } : {}),
      });
    } finally {
      reading = false;
      if (again) {
        again = false;
        void refresh();
      }
    }
  }
  async function send(command: CollaborationCommand) {
    if (state.busy || !alive || !visible) return false;
    emit({ busy: true, error: "" });
    try {
      await repo.command(command);
      await refresh();
      return true;
    } catch (error) {
      emit({ error: (error as Error).message });
      await refresh();
      return false;
    } finally {
      emit({ busy: false });
    }
  }
  async function leave() {
    if (!state.entered) return;
    emit({ entered: false });
    try {
      await repo.command({
        action: "room.leave",
        session_id: id,
        connection_id: connection,
      });
    } catch {
      /* Lease expires if offline. */
    }
    if (alive) void refresh();
  }
  const unsubscribe = repo.subscribe?.(
    () => void refresh(),
    () => {},
  );
  const interval = setInterval(async () => {
    if (!alive || !visible) return;
    const now = Date.now();
    if (state.entered && now - lastHeartbeat >= 25000) {
      lastHeartbeat = now;
      try {
        await repo.command({
          action: "room.heartbeat",
          session_id: id,
          connection_id: connection,
        });
      } catch (error) {
        emit({
          entered: false,
          connected: false,
          error: (error as Error).message,
        });
      }
    }
    if (now - lastRead >= 15000) void refresh();
  }, 1000);
  void refresh();
  return {
    refresh,
    async enter(takeover = false) {
      if (
        await send({
          action: "room.enter",
          session_id: id,
          connection_id: connection,
          takeover,
        })
      ) {
        // An enter request can finish after navigation/backgrounding disposed us.
        // Release that late lease rather than reviving an invisible controller.
        if (!alive || !visible || state.accessRevoked) {
          try {
            await repo.command({ action: "room.leave", session_id: id, connection_id: connection });
          } catch { /* The server expires the lease if offline. */ }
          return;
        }
        lastHeartbeat = Date.now();
        emit({ entered: true });
      }
    },
    leave,
    command: send,
    seat: (seat_id: string) =>
      send({
        action: "room.seat",
        session_id: id,
        connection_id: connection,
        seat_id,
      }),
    activity: (activity: "available" | "focused" | "break") =>
      send({
        action: "room.activity",
        session_id: id,
        connection_id: connection,
        activity,
      }),
    hand: (raised: boolean) =>
      send({
        action: "room.hand",
        session_id: id,
        connection_id: connection,
        raised,
      }),
    react: (
      reaction:
        "hello" | "thanks" | "idea" | "agree" | "celebrate" | "question",
    ) =>
      send({
        action: "room.react",
        session_id: id,
        connection_id: connection,
        reaction,
      }),
    visible(value: boolean) {
      visible = value;
      if (!value) void leave();
      else void refresh();
    },
    dispose() {
      alive = false;
      unsubscribe?.();
      clearInterval(interval);
      void leave();
    },
  };
}
