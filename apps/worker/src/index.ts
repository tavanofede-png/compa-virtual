import { createClient } from "@supabase/supabase-js";
import { OpenAIProvider, estimateUsageCost } from "@compa/server";
import { ageAt, type Snapshot } from "@compa/domain";
import {
  extractDocument,
  chunkPages,
  RecoverableDocumentError,
} from "./extract";
const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
] as const;
for (const key of required)
  if (!process.env[key]) throw Error("Falta configurar " + key);
const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function processOne(job: {
  msg_id: number;
  read_ct: number;
  message: { user_id: string; material_id: string };
}) {
  const { user_id, material_id } = job.message;
  const { data: row, error } = await db
    .from("student_states")
    .select("state")
    .eq("user_id", user_id)
    .maybeSingle();
  if (error) throw error;
  if (!row) {
    await db.rpc("ack_material_job", { p_id: job.msg_id });
    return;
  }
  const state = row.state as Snapshot,
    material = state.materials.find((m) => m.id === material_id);
  if (!material || material.status === "READY") {
    await db.rpc("ack_material_job", { p_id: job.msg_id });
    return;
  }
  const heartbeat = setInterval(() => {
    void db.rpc("extend_material_job", { p_id: job.msg_id });
  }, 60000);
  const finish = async (
    status: string,
    error: string | null,
    chunks: unknown[] = [],
  ) => {
    const result = await db.rpc("finish_material", {
      p_user: user_id,
      p_material: material_id,
      p_status: status,
      p_error: error,
      p_chunks: chunks,
    });
    if (result.error) throw result.error;
  };
  try {
    if (!state.profile)
      throw new RecoverableDocumentError("Completá tu perfil.");
    const age = ageAt(state.profile.birth_date);
    if (age < 18) {
      const { data: consent } = await db
        .from("consents")
        .select("id")
        .eq("user_id", user_id)
        .not("verified_at", "is", null)
        .limit(1);
      if (
        process.env.MINOR_BETA_APPROVED !== "true" ||
        !consent?.length ||
        (age < Math.max(13, Number(process.env.DIGITAL_CONSENT_AGE ?? 18)) &&
          process.env.OPENAI_ZDR_VERIFIED !== "true")
      )
        throw new RecoverableDocumentError(
          "Falta habilitar el procesamiento para esta cuenta.",
        );
    }
    const { data: control } = await db
      .from("account_controls")
      .select("deleting")
      .eq("user_id", user_id)
      .maybeSingle();
    if (control?.deleting) {
      await db.rpc("ack_material_job", { p_id: job.msg_id });
      return;
    }
    await finish("PROCESSING", null);
    const { data: file, error: downloadError } = await db.storage
      .from("materials")
      .download(material.path);
    if (downloadError || !file)
      throw new RecoverableDocumentError(
        "El archivo no está disponible. Volvé a subirlo.",
      );
    const ai = new OpenAIProvider({
      key: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL ?? "gpt-6-astra",
      embeddingModel:
        process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      onUsage: async (usage) => {
        const { error } = await db.from("ai_usage").insert({
          user_id,
          ...usage,
          cost_usd: estimateUsageCost(usage, process.env),
        });
        if (error) throw error;
      },
    });
    const pages = await extractDocument(
        Buffer.from(await file.arrayBuffer()),
        material.mime_type,
        ai,
      ),
      chunks = chunkPages(pages),
      enriched = [];
    for (let i = 0; i < chunks.length; i += 24) {
      const { data: alive } = await db
        .from("student_states")
        .select("user_id")
        .eq("user_id", user_id)
        .maybeSingle();
      const { data: control } = await db
        .from("account_controls")
        .select("deleting")
        .eq("user_id", user_id)
        .maybeSingle();
      if (!alive || control?.deleting) {
        await db.rpc("ack_material_job", { p_id: job.msg_id });
        return;
      }
      const batch = chunks.slice(i, i + 24),
        vectors = await ai.embed(batch.map((x) => x.content));
      enriched.push(
        ...batch.map((c, index) => ({
          ...c,
          embedding: JSON.stringify(vectors[index]),
        })),
      );
    }
    await finish("READY", null, enriched);
    await db.rpc("ack_material_job", { p_id: job.msg_id });
    console.info(
      JSON.stringify({ event: "material_completed", chunks: chunks.length }),
    ); // No student IDs or document content.
  } catch (error) {
    const terminal =
      error instanceof RecoverableDocumentError || job.read_ct >= 3;
    if (terminal) {
      await finish(
        "FAILED",
        error instanceof RecoverableDocumentError
          ? error.message
          : "No pudimos procesar el archivo después de tres intentos. Volvé a subirlo.",
      );
      await db.rpc("ack_material_job", { p_id: job.msg_id });
    }
    console.error(
      JSON.stringify({ event: "material_failed", recoverable: true, terminal }),
    );
  } finally {
    clearInterval(heartbeat);
  }
}
while (!stopping) {
  try {
    const { data, error } = await db.rpc("read_material_job");
    if (error) throw error;
    if (data?.[0]) await processOne(data[0]);
    else await sleep(5000);
  } catch {
    console.error(JSON.stringify({ event: "queue_unavailable" }));
    await sleep(10000);
  }
}
