import { createClient } from "@supabase/supabase-js";
import { createAIProvider, estimateUsageCost, isAIProviderConfigured, selectedAIProvider, hasFamilyCapability } from "@compa/server";
import { ageAt, validateUpload, type Snapshot } from "@compa/domain";
import { RecoverableDocumentError, type PageText } from "./extract";
import { runMaterialPipeline, type MaterialWorkStore } from "./pipeline";

for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
  if (!process.env[key]) throw Error("Falta configurar " + key);
const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
console.log(JSON.stringify({ event: "worker_boot", pipeline: 2,
  ai_configured: isAIProviderConfigured(process.env), provider: selectedAIProvider(process.env) }));

class LostMaterialLease extends Error {}
let stopping = false;
let active: AbortController | null = null;
const bootId = crypto.randomUUID();
let heartbeatBusy = false;
const heartbeat = async () => {
  if (heartbeatBusy) return;
  heartbeatBusy = true;
  try {
    const { error } = await db.rpc("worker_heartbeat", { p_worker: "materials",
      p_boot: bootId, p_pipeline: 2, p_state: stopping ? "stopping" : active ? "processing" : "idle" });
    if (error) throw error;
  } catch {
    console.error(JSON.stringify({ event: "worker_heartbeat_failed", pipeline: 2 }));
  } finally { heartbeatBusy = false; }
};
void heartbeat();
const heartbeatTimer = setInterval(() => { void heartbeat(); }, 60000);
const stop = () => { stopping = true; active?.abort(new LostMaterialLease("WORKER_STOPPING")); };
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function privacySafeId(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("kusiy:" + value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
type Job = { msg_id: number; read_ct: number; message: { user_id: string; material_id: string; generation: number } };
async function processOne(job: Job) {
  const { user_id, material_id, generation } = job.message;
  const lease = crypto.randomUUID();
  const controller = new AbortController();
  active = controller;
  const event = async (type: string, data: Record<string, unknown> = {}) => {
    controller.signal.throwIfAborted();
    const result = await db.rpc("material_job_event", { p_user: user_id, p_material: material_id,
      p_generation: generation, p_lease: lease, p_event: type, p_data: data });
    if (result.error) throw result.error;
    if (!result.data?.accepted) throw new LostMaterialLease("MATERIAL_LEASE_LOST");
    return result.data;
  };
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await event("CLAIM");
    const assertService = async () => {
      const [{ data: row, error }, { data: control, error: controlError }] = await Promise.all([
        db.from("student_states").select("state").eq("user_id", user_id).maybeSingle(),
        db.from("account_controls").select("deleting").eq("user_id", user_id).maybeSingle(),
      ]);
      if (error) throw error;
      if (controlError) throw controlError;
      const state = row?.state as Snapshot | undefined;
      if (!state?.profile || !state.materials.some((material) => material.id === material_id) || control?.deleting)
        throw new LostMaterialLease("MATERIAL_REMOVED");
      const age = ageAt(state.profile.birth_date);
      if (age < 18 && (process.env.MINOR_BETA_APPROVED !== "true" || !await hasFamilyCapability(db, user_id, "service")))
        throw new RecoverableDocumentError("Falta autorizar el servicio para procesar este material.");
      return { state, age };
    };
    const { state } = await assertService();
    let heartbeatBusy = false;
    heartbeat = setInterval(() => {
      if (heartbeatBusy) return;
      heartbeatBusy = true;
      void assertService().then(() => event("HEARTBEAT"))
        .catch(() => controller.abort(new LostMaterialLease("HEARTBEAT_FAILED")))
        .finally(() => { heartbeatBusy = false; });
    }, 30000);
    timeout = setTimeout(() => controller.abort(new Error("MATERIAL_TIMEOUT")), 20 * 60000);
    const material = state.materials.find((item) => item.id === material_id)!;
    validateUpload(material.title, material.mime_type, material.size);
    const { data: file, error: downloadError } = await db.storage.from("materials").download(material.path);
    if (downloadError || !file || file.size !== material.size)
      throw new RecoverableDocumentError("El original no está disponible o la carga está incompleta. Volvé a subirlo.");
    const getAI = async () => {
      controller.signal.throwIfAborted();
      const { age } = await assertService();
      if (!isAIProviderConfigured(process.env)) return null;
      if (age < 18 && (!await hasFamilyCapability(db, user_id, "ai") ||
        (age < Math.max(13, Number(process.env.DIGITAL_CONSENT_AGE ?? 18)) &&
          process.env.AI_MINOR_DATA_APPROVED !== "true" && process.env.OPENAI_ZDR_VERIFIED !== "true"))) return null;
      const budget = Number(process.env.AI_MONTHLY_BUDGET_USD ?? 50);
      if (Number.isFinite(budget) && budget > 0) {
        const month = new Date(); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);
        const { data: usage, error } = await db.from("ai_usage").select("cost_usd").gte("created_at", month.toISOString());
        if (error) throw error;
        if ((usage ?? []).reduce((sum, item) => sum + Number(item.cost_usd ?? 0), 0) >= budget) return null;
      }
      return createAIProvider(process.env, {
        safetyIdentifier: await privacySafeId(user_id),
        onUsage: async (usage) => {
          const { error } = await db.from("ai_usage").insert({ user_id, ...usage, cost_usd: estimateUsageCost(usage, process.env) });
          if (error) throw error;
        },
      });
    };
    const store: MaterialWorkStore = {
      event: async (type, data) => { await event(type, data); },
      pages: async () => {
        const { data, error } = await db.from("material_page_checkpoints").select("ordinal,label,content,needs_ocr")
          .eq("user_id", user_id).eq("material_id", material_id).order("ordinal");
        if (error) throw error;
        const pages: PageText[] = [];
        for (const page of data ?? []) pages[page.ordinal] = { label: page.label, text: page.content, needs_ocr: page.needs_ocr };
        return pages;
      },
      chunks: async () => {
        const { data, error } = await db.from("study_material_chunks").select("id,content,embedding")
          .eq("user_id", user_id).eq("material_id", material_id).order("ordinal");
        if (error) throw error;
        return data ?? [];
      },
    };
    await runMaterialPipeline(Buffer.from(await file.arrayBuffer()), material.mime_type, store, getAI, controller.signal);
    console.info(JSON.stringify({ event: "material_completed", pipeline: 2 }));
  } catch (error) {
    if (error instanceof LostMaterialLease || controller.signal.reason instanceof LostMaterialLease) {
      console.info(JSON.stringify({ event: "material_released" }));
    } else {
      const failed = await db.rpc("material_job_event", { p_user: user_id, p_material: material_id,
        p_generation: generation, p_lease: lease, p_event: "FAIL", p_data: {
          terminal: error instanceof RecoverableDocumentError,
          error: error instanceof RecoverableDocumentError ? error.message : "No pudimos terminar este paso. Se conserva el original y el texto ya extraído; podés reintentar.",
        } });
      if (failed.error) throw failed.error;
      console.error(JSON.stringify({ event: "material_attempt_failed", recoverable: true }));
    }
  } finally {
    clearInterval(heartbeat); clearTimeout(timeout);
    if (active === controller) active = null;
  }
}
while (!stopping) {
  try {
    const cleanup = await db.from("material_object_deletions").select("user_id,path").order("created_at").limit(10);
    if (cleanup.error) throw cleanup.error;
    for (const item of cleanup.data ?? []) {
      if (!item.path.startsWith(item.user_id + "/")) throw Error("INVALID_CLEANUP_OWNER");
      const removed = await db.storage.from("materials").remove([item.path]);
      if (!removed.error) {
        const result = await db.from("material_object_deletions").delete().eq("user_id", item.user_id).eq("path", item.path);
        if (result.error) throw result.error;
      }
    }
    const { data, error } = await db.rpc("read_material_job_v2");
    if (error) throw error;
    if (data?.[0]) await processOne(data[0]);
    else await sleep(5000);
  } catch {
    console.error(JSON.stringify({ event: "queue_unavailable", pipeline: 2 }));
    if (!stopping) await sleep(10000);
  }
}
clearInterval(heartbeatTimer);
await heartbeat();
