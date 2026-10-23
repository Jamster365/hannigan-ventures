"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/current-member";
import { dataMode } from "@/lib/config";
import { IMPORT_BATCH_SIZE, planImport } from "@/lib/research/import-batch";

export type UploadResult =
  | { ok: true; queued: number; runs: number; accepted: string[]; rejected: { name: string; reason: string }[]; notes: string[] }
  | { ok: false; error: string; rejected?: { name: string; reason: string }[] };

/**
 * Owner-only: queues research prepared in a Claude chat. The upload is split
 * into runs of IMPORT_BATCH_SIZE companies; the research heartbeat then puts
 * one run every few minutes through the normal pipeline (every source fetched
 * and verified, unsupported claims stripped, assessment rules applied).
 */
export async function uploadResearchAction(input: { text: string; label: string }): Promise<UploadResult> {
  const member = await requireMember();
  if (member.role !== "owner") return { ok: false, error: "Only the household owner can upload research." };
  if (input.text.length > 3_000_000) return { ok: false, error: "That file is too large (3 MB maximum)." };

  let raw: unknown;
  try {
    raw = JSON.parse(extractJson(input.text));
  } catch {
    return { ok: false, error: "That isn't valid JSON. Paste only the JSON block from the Claude chat." };
  }
  const planned = planImport(raw);
  if (!planned.ok) return { ok: false, error: planned.error };
  const { plan } = planned;
  if (plan.batches.length === 0) return { ok: false, error: "None of the companies could be read.", rejected: plan.rejected };
  if (dataMode() !== "supabase") return { ok: false, error: `Checked: ${plan.accepted.length} companies would be queued in ${plan.batches.length} run(s). Uploading works in the live app, not the demo.`, rejected: plan.rejected };

  const [{ getSessionContext }, { createSupabaseAdminClient }, { createSupabaseResearchStore }, { londonDate }] = await Promise.all([import("@/lib/supabase/member"), import("@/lib/supabase/admin"), import("@/lib/research/supabase-store"), import("@/lib/domain/format")]);
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const admin = createSupabaseAdminClient();
  const store = createSupabaseResearchStore();
  const config = await store.loadConfig(ctx.householdId);
  const label = (input.label.trim() || `Upload ${londonDate(new Date())}`).slice(0, 80);

  for (const [i, batch] of plan.batches.entries()) {
    const part = plan.batches.length > 1 ? `${label}, part ${i + 1} of ${plan.batches.length}` : label;
    const { data: imp, error } = await admin.from("research_imports").insert({ household_id: ctx.householdId, label: part, payload: batch }).select("id").single<{ id: string }>();
    if (error || !imp) return { ok: false, error: `Saving part ${i + 1} failed: ${error?.message ?? "unknown error"}. Earlier parts were queued.` };
    const run = await store.startRun({ householdId: ctx.householdId, localDate: londonDate(new Date()), runKind: "manual", promptVersionId: config.promptVersionId, model: `Upload: ${label}`.slice(0, 120), triggeredBy: member.userId, newCompanyLimit: IMPORT_BATCH_SIZE });
    if (!run) return { ok: false, error: `Could not queue part ${i + 1}.` };
    await store.setDiscovery(run.id, `import:${imp.id}`);
    await store.progress(run.id, "searching", `Queued: ${batch.companies.length} uploaded compan${batch.companies.length === 1 ? "y" : "ies"} (${part})`);
  }
  revalidatePath("/research/history");
  revalidatePath("/research/upload");
  return { ok: true, queued: plan.accepted.length, runs: plan.batches.length, accepted: plan.accepted, rejected: plan.rejected, notes: plan.notes };
}

/** Accepts the raw JSON or a pasted chat reply with the JSON inside a ``` block. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}
