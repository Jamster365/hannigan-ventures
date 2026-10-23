import "server-only";
import { londonDate } from "@/lib/domain/format";
import { IMPORT_BATCH_SIZE, planImport, type ImportPlan } from "./import-batch";

export type QueueResult = { ok: true; plan: ImportPlan; runs: number } | { ok: false; error: string; rejected?: ImportPlan["rejected"] };

/**
 * Queues prepared research (an upload, or a batch shipped with the app) as
 * runs of IMPORT_BATCH_SIZE companies. The research heartbeat then puts one
 * run every few minutes through the normal pipeline: every source fetched and
 * verified, unsupported claims stripped, assessment rules applied.
 */
export async function queueImport(input: { householdId: string; label: string; raw: unknown; triggeredBy: string | null }): Promise<QueueResult> {
  const planned = planImport(input.raw);
  if (!planned.ok) return { ok: false, error: planned.error };
  const { plan } = planned;
  if (plan.batches.length === 0) return { ok: false, error: "None of the companies could be read.", rejected: plan.rejected };

  const [{ createSupabaseAdminClient }, { createSupabaseResearchStore }] = await Promise.all([import("@/lib/supabase/admin"), import("./supabase-store")]);
  const admin = createSupabaseAdminClient();
  const store = createSupabaseResearchStore();
  const config = await store.loadConfig(input.householdId);
  const label = input.label.slice(0, 80);

  for (const [i, batch] of plan.batches.entries()) {
    const part = plan.batches.length > 1 ? `${label}, part ${i + 1} of ${plan.batches.length}` : label;
    // A label is queued once: a second heartbeat racing this one gets no row back and moves on.
    const { data: imp, error } = await admin.from("research_imports").upsert({ household_id: input.householdId, label: part, payload: batch }, { onConflict: "household_id,label", ignoreDuplicates: true }).select("id").maybeSingle<{ id: string }>();
    if (error) return { ok: false, error: `Saving part ${i + 1} failed: ${error.message}. Earlier parts were queued.` };
    if (!imp) continue;
    const run = await store.startRun({ householdId: input.householdId, localDate: londonDate(new Date()), runKind: "manual", promptVersionId: config.promptVersionId, model: `Upload: ${label}`.slice(0, 120), triggeredBy: input.triggeredBy, newCompanyLimit: IMPORT_BATCH_SIZE });
    if (!run) {
      await admin.from("research_imports").delete().eq("id", imp.id);
      return { ok: false, error: `Could not queue part ${i + 1}.` };
    }
    await store.setDiscovery(run.id, `import:${imp.id}`);
    await store.progress(run.id, "searching", `Queued: ${batch.companies.length} uploaded compan${batch.companies.length === 1 ? "y" : "ies"} (${part})`);
  }
  return { ok: true, plan, runs: plan.batches.length };
}

/**
 * Research batches shipped with the app (data/research-pool/*.json, listed in
 * ./research-pool.ts). Each is queued once: the heartbeat skips any batch
 * whose label already appears in research_imports.
 */
export async function queueBundledPool(householdId: string): Promise<string[]> {
  const [{ RESEARCH_POOL }, { createSupabaseAdminClient }] = await Promise.all([import("./research-pool"), import("@/lib/supabase/admin")]);
  if (RESEARCH_POOL.length === 0) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("research_imports").select("label").eq("household_id", householdId).like("label", "Research pool%").returns<{ label: string }[]>();
  const done = new Set((data ?? []).map((r) => r.label.replace(/, part \d+ of \d+$/, "")));
  const queued: string[] = [];
  for (const batch of RESEARCH_POOL) {
    if (done.has(batch.label)) continue;
    const res = await queueImport({ householdId, label: batch.label, raw: batch.data, triggeredBy: null });
    queued.push(res.ok ? batch.label : `${batch.label}: ${res.error}`);
  }
  return queued;
}
