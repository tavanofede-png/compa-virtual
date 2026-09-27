import { describe, expect, it } from "vitest";
import { linkedServiceConfig } from "../scripts/supabase-linked-service.mjs";

describe("linked local service credentials", () => {
  const ref = "oaravhmdvcwcvjnyweig";

  it("selects only the legacy service role key for the linked project", () => {
    const result = linkedServiceConfig(ref, { keys: [
      { type: "legacy", name: "anon", api_key: "eyJanon" },
      { type: "secret", name: "service_role", api_key: "eyJwrong" },
      { type: "legacy", name: "service_role", api_key: "eyJlocal-test-only" },
    ] });
    expect(result).toEqual({ url: `https://${ref}.supabase.co`, key: "eyJlocal-test-only" });
  });

  it("rejects an invalid project or missing service key", () => {
    expect(() => linkedServiceConfig("../another", { keys: [] })).toThrow();
    expect(() => linkedServiceConfig(ref, { keys: [{ type: "legacy", name: "anon", api_key: "eyJanon" }] })).toThrow();
  });
});
