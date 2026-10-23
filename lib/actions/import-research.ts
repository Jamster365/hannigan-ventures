"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/current-member";
import { dataMode } from "@/lib/config";
import { planImport } from "@/lib/research/import-batch";

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

  const [{ getSessionContext }, { queueImport }, { londonDate }] = await Promise.all([import("@/lib/supabase/member"), import("@/lib/research/queue-import"), import("@/lib/domain/format")]);
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const label = (input.label.trim() || `Upload ${londonDate(new Date())}`).slice(0, 80);
  const queued = await queueImport({ householdId: ctx.householdId, label, raw, triggeredBy: member.userId });
  if (!queued.ok) return { ok: false, error: queued.error, rejected: queued.rejected };

  revalidatePath("/research/history");
  revalidatePath("/research/upload");
  return { ok: true, queued: plan.accepted.length, runs: plan.batches.length, accepted: plan.accepted, rejected: plan.rejected, notes: plan.notes };
}

/** Accepts the raw JSON or a pasted chat reply with the JSON inside a ``` block. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}
