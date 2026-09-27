import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { demoSnapshot, encodeVoiceWav, monoVoiceSamples, validateVoiceWav, VoicePhraseDetector } from "../packages/domain/src/index";
import { createVoiceHandler } from "../packages/server/src/voice-input";

describe("voice input", () => {
  it("derives duration from canonical samples and rejects forged headers and extra chunks", () => {
    const wav = encodeVoiceWav(new Int16Array(16000));
    expect(validateVoiceWav(wav).seconds).toBe(1);
    const forged = wav.slice(0); new DataView(forged).setUint32(24, 8000, true);
    expect(() => validateVoiceWav(forged)).toThrow(/formato/);
    const extra = new ArrayBuffer(wav.byteLength + 2); new Uint8Array(extra).set(new Uint8Array(wav));
    expect(() => validateVoiceWav(extra)).toThrow(/formato/);
    expect(() => encodeVoiceWav(new Int16Array(16000 * 26))).toThrow();
    expect(() => validateVoiceWav(encodeVoiceWav(new Int16Array(100)))).toThrow();
  });
  it("converts actual hardware stereo/rate and suppresses aliasing with sample averaging", () => {
    const pcm = new Int16Array(4800 * 2);
    for (let i = 0; i < 4800; i++) { pcm[i * 2] = 3000; pcm[i * 2 + 1] = 1000; }
    const mono = monoVoiceSamples(pcm.buffer, 48000, 2);
    expect(mono.length).toBe(1600); expect([...mono].every((sample) => sample === 2000)).toBe(true);
    expect(() => monoVoiceSamples(pcm.buffer, 48000, 5)).toThrow();
  });
  it("does not submit silence or a short click, retains initial speech and ends on pause", () => {
    const detector = new VoicePhraseDetector(), silence = new Int16Array(1600), voice = new Int16Array(1600).fill(6000);
    for (let i = 0; i < 100; i++) expect(detector.push(silence)).toBeNull();
    expect(detector.push(voice)).toBeNull();
    for (let i = 0; i < 14; i++) expect(detector.push(silence)).toBeNull();
    for (let i = 0; i < 8; i++) expect(detector.push(voice)).toBeNull();
    let phrase: Int16Array | null = null;
    for (let i = 0; i < 13 && !phrase; i++) phrase = detector.push(silence);
    expect(phrase).not.toBeNull();
    expect([...phrase!].filter((sample) => sample === 6000).length).toBe(8 * 1600);
    expect(validateVoiceWav(encodeVoiceWav(phrase!)).seconds).toBeLessThan(4);
    for (let i = 0; i < 20; i++) expect(detector.push(silence)).toBeNull();
  });
  it("caps a continuous phrase and discards partial audio on reset", () => {
    const detector = new VoicePhraseDetector(), voice = new Int16Array(1600).fill(6000);
    let phrase: Int16Array | null = null;
    for (let i = 0; i < 220 && !phrase; i++) phrase = detector.push(voice);
    expect(phrase?.length).toBeLessThanOrEqual(16000 * 21);
    detector.push(voice); detector.push(voice); detector.reset();
    expect(detector.push(new Int16Array(16000))).toBeNull();
  });
});

function fixture(options: { reservation?: string; birth?: string; allowed?: boolean; enabled?: boolean } = {}) {
  const snapshot = demoSnapshot(); snapshot.profile!.birth_date = options.birth ?? "2000-01-01";
  const update = vi.fn();
  const db = { auth: { getUser: async () => ({ data: { user: { id: "adult" } }, error: null }) },
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = () => chain; chain.eq = () => chain;
      chain.update = (data: unknown) => { update(data); return chain; };
      chain.maybeSingle = async () => ({ data: table === "student_states" ? { state: snapshot } : null, error: null });
      // Supabase query builders are intentionally thenable; emulate their await contract.
      // eslint-disable-next-line unicorn/no-thenable
      chain.then = (resolve: (result: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve);
      return chain;
    },
    rpc: vi.fn(async (name: string) => ({ error: null, data: name === "family_capability_allowed" ? options.allowed ?? false : options.reservation ?? "RESERVED" })),
  };
  const provider = vi.fn(async () => new Response(JSON.stringify({ success: true, result: { text: "Repasar Biología" } }), { status: 200 }));
  const handler = createVoiceHandler({ VOICE_ENABLED: String(options.enabled ?? true), CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
    CLOUDFLARE_API_TOKEN: "test", MINOR_BETA_APPROVED: "true", VOICE_MINOR_DATA_APPROVED: "true" },
  { db: db as unknown as SupabaseClient, fetch: provider as typeof fetch });
  const request = (body = encodeVoiceWav(new Int16Array(16000))) => new Request("https://example.test/voice", {
    method: "POST", headers: { authorization: "Bearer test", "Content-Type": "audio/wav", "x-operation-id": crypto.randomUUID() }, body,
  });
  return { provider, handler, request, db, update };
}
describe("Whisper admission", () => {
  it.each(["BUDGET_UNVERIFIED", "GLOBAL_LIMIT", "STUDENT_LIMIT", "BUSY", "ALREADY_USED", "FORBIDDEN"])("does not call any provider when reservation is %s", async (reservation) => {
    const test = fixture({ reservation });
    const response = await test.handler(test.request());
    expect(response.status).toBeGreaterThanOrEqual(400); expect(test.provider).not.toHaveBeenCalled();
  });
  it("rejects missing family AI permission and malformed audio before reserving", async () => {
    const minor = fixture({ birth: "2011-01-01" });
    expect((await minor.handler(minor.request())).status).toBe(403); expect(minor.provider).not.toHaveBeenCalled();
    const invalid = fixture();
    expect((await invalid.handler(invalid.request(new ArrayBuffer(50)))).status).toBe(400);
    expect(invalid.db.rpc).not.toHaveBeenCalled(); expect(invalid.provider).not.toHaveBeenCalled();
  });
  it("transcribes only reserved PCM, returns text and never writes audio or transcript", async () => {
    const test = fixture(); const response = await test.handler(test.request());
    expect(await response.json()).toEqual({ text: "Repasar Biología", seconds: 1 });
    const call = test.provider.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toContain("@cf/openai/whisper-large-v3-turbo");
    const body = JSON.parse(call[1].body as string);
    expect(body).toMatchObject({ language: "es", vad_filter: true, task: "transcribe" });
    expect(test.update.mock.calls[0][0]).toEqual({ status: "DONE", finished_at: expect.any(String) });
  });
  it("does not fall back to a paid model on provider error or when voice is disabled", async () => {
    const test = fixture(); test.provider.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    expect((await test.handler(test.request())).status).toBe(503);
    expect(test.provider).toHaveBeenCalledTimes(1);
    expect(test.update).toHaveBeenCalledWith({ status: "FAILED", finished_at: expect.any(String) });
    const disabled = fixture({ enabled: false }); expect((await disabled.handler(disabled.request())).status).toBe(503);
    expect(disabled.provider).not.toHaveBeenCalled();
  });
  it("does not release a transcript when permission was revoked during transcription", async () => {
    const test = fixture({ birth: "2011-01-01", allowed: true });
    const original = test.db.rpc;
    let permissions = 0;
    test.db.rpc = vi.fn(async (name: string) => name === "family_capability_allowed" ?
      { error: null, data: ++permissions === 1 } : original(name));
    const response = await test.handler(test.request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "El permiso de micrófono fue revocado." });
    expect(test.update).toHaveBeenCalledWith({ status: "FAILED", finished_at: expect.any(String) });
  });
});
