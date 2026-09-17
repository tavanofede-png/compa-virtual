import { afterEach, describe, expect, it, vi } from "vitest";
import { createSharedRoomSession } from "../packages/client/src/shared-room";
import type { CollaborationRepository } from "../packages/client/src/collaboration";
import type { GroupSessionDetail } from "../packages/domain/src/collaboration";

const initial = { session: { id: "10000000-0000-4000-8000-000000000001", status: "active" }, server_time: new Date().toISOString() } as GroupSessionDetail;
const deferred = () => { let resolve!: (v: any) => void; const promise = new Promise<any>(r => { resolve = r; }); return { promise, resolve }; };
afterEach(() => vi.useRealTimers());
describe("shared room lifecycle", () => {
  it("does not hammer the server while offline", async () => {
    vi.useFakeTimers();
    const repo = { session: vi.fn().mockRejectedValue(Error("Sin conexión")), command: vi.fn() };
    const runtime = createSharedRoomSession(repo as unknown as CollaborationRepository, initial, () => {});
    await vi.advanceTimersByTimeAsync(14000);
    expect(repo.session).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(repo.session).toHaveBeenCalledTimes(2);
    runtime.dispose();
  });
  it.each(["dispose", "background"])("releases an enter response that arrives after %s", async (mode) => {
    const pending = deferred(), changes = vi.fn();
    const repo = { session: vi.fn().mockResolvedValue(initial), command: vi.fn().mockImplementation(c => c.action === "room.enter" ? pending.promise : Promise.resolve({})) };
    const runtime = createSharedRoomSession(repo as unknown as CollaborationRepository, initial, changes);
    const entering = runtime.enter();
    if (mode === "dispose") runtime.dispose(); else runtime.visible(false);
    pending.resolve({}); await entering;
    expect(repo.command.mock.calls.map(([c]) => c.action)).toEqual(["room.enter", "room.leave"]);
    expect(changes.mock.calls.every(([s]) => !s.entered)).toBe(true);
    runtime.dispose();
  });
  it("clears the shared details immediately when membership is revoked", async () => {
    const changes=vi.fn();
    const repo={session:vi.fn().mockRejectedValue(Object.assign(Error("Sin acceso"),{status:404})),command:vi.fn()};
    const runtime=createSharedRoomSession(repo as unknown as CollaborationRepository,initial,changes);
    await new Promise(resolve=>setTimeout(resolve,0));
    expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({detail:null,entered:false,accessRevoked:true}));
    runtime.dispose();
  });
});
