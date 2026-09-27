import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createApplicationDataFilter } from "../scripts/backup-restore-filter.mjs";

describe("local backup restore filter", () => {
  it("omits hosted Auth, Storage and pgmq rows while preserving application COPY blocks", async () => {
    const input = [
      "SET client_encoding = 'UTF8';\n",
      'COPY "auth"."users" (id) FROM stdin;\nsecret-user\n\\.\n',
      'COPY "public"."student_states" (state) FROM stdin;\nniño\n\\.\n',
      'COPY "storage"."objects" (name) FROM stdin;\nsecret-file\n\\.\n',
      'COPY "pgmq"."a_materials" (msg_id) FROM stdin;\nsecret-job\n\\.\n',
      'COPY "private"."ai_leases" (id) FROM stdin;\n1\n\\.\n',
      `SELECT pg_catalog.setval('"pgmq"."q_materials_msg_id_seq"', 3, true);\n`,
      `SELECT pg_catalog.setval('"public"."student_id_seq"', 3, true);\n`,
    ];
    const filter = createApplicationDataFilter();
    const output = [];
    const bytes = Buffer.from(input.join(""));
    for await (const chunk of Readable.from([...bytes].map((byte) => Buffer.from([byte]))).pipe(filter)) output.push(chunk);
    const text = Buffer.concat(output).toString("utf8");
    expect(text).toContain('COPY "public"."student_states"');
    expect(text).toContain("niño");
    expect(text).toContain('COPY "private"."ai_leases"');
    expect(text).not.toContain("secret-user");
    expect(text).not.toContain("secret-file");
    expect(text).not.toContain("secret-job");
    expect(text).not.toContain('"pgmq"."q_materials_msg_id_seq"');
    expect(text).toContain('"public"."student_id_seq"');
    expect(filter.skippedPlatformTables()).toBe(3);
  });
});
