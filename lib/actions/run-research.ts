"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/current-member";
import { dataMode, isResearchConfigured } from "@/lib/config";

/**
 * Manual "Run research now", gated by configuration, membership and daily
 * budget. It only starts the run: the web research continues as a background
 * job, and the page (or the scheduler, if the page is closed) advances it.
 */
export async function runResearchNowAction(): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  const member = await requireMember();
  if (dataMode() !== "supabase") return { ok: false, error: "Research runs require Supabase." };
  if (!isResearchConfigured()) return { ok: false, error: "OPENAI_API_KEY is not configured on the server." };
  const blocked = await manualRunBlocked();
  if (blocked) return { ok: false, error: blocked };
  const { beginResearch } = await import("@/lib/research/run");
  const res = await beginResearch({ runKind: "manual", triggeredBy: member.userId });
  if (res.status === "failed" || !res.runId) return { ok: false, error: res.errorSummary ?? "Run failed to start." };
  return { ok: true, runId: res.runId };
}

/** Moves an in-progress run on (or just reports it); returns the final outcome once it has finished. */
export async function advanceResearchAction(runId: string): Promise<{ done: false } | { done: true; ok: boolean; message: string }> {
  await requireMember();
  if (dataMode() !== "supabase" || !isResearchConfigured()) return { done: true, ok: false, message: "Research is not configured." };
  const { getSessionContext } = await import("@/lib/supabase/member");
  const { advanceResearch, getResearchRun } = await import("@/lib/research/run");
  const [ctx, run] = await Promise.all([getSessionContext(), getResearchRun(runId)]);
  if (!run || !ctx || run.householdId !== ctx.householdId) return { done: true, ok: false, message: "Research run not found." };
  const res = await advanceResearch(runId);
  if (res.status === "running") return { done: false };
  revalidatePath("/", "layout");
  if (res.status === "failed") return { done: true, ok: false, message: res.errorSummary ?? res.summary };
  return { done: true, ok: true, message: `${res.status.replace("_", " ")}: ${res.summary}` };
}

/**
 * Manual runs may repeat within a day (only scheduled runs are one per day),
 * so guard them here: no overlapping run, and today's spend under the budget.
 */
async function manualRunBlocked(): Promise<string | null> {
  const householdId = process.env.RESEARCH_HOUSEHOLD_ID;
  if (!householdId) return "RESEARCH_HOUSEHOLD_ID is not configured on the server.";
  const [{ createSupabaseAdminClient }, { DEFAULT_PREFERENCES }, { londonDate }] = await Promise.all([import("@/lib/supabase/admin"), import("@/lib/research/default-prompt"), import("@/lib/domain/format")]);
  const admin = createSupabaseAdminClient();
  const [{ data: runs }, { data: prompt }] = await Promise.all([
    admin.from("research_runs").select("status, started_at, estimated_cost").eq("household_id", householdId).eq("local_date", londonDate(new Date())).returns<{ status: string; started_at: string; estimated_cost: string | null }[]>(),
    admin.from("research_prompts").select("config_jsonb").eq("household_id", householdId).eq("active", true).maybeSingle<{ config_jsonb: { dailyBudgetUsd?: number } }>(),
  ]);
  const threeHoursAgo = Date.now() - 3 * 60 * 60_000;
  if ((runs ?? []).some((r) => r.status === "running" && Date.parse(r.started_at) > threeHoursAgo)) return "A research run is already in progress. It will finish on its own; check Research history.";
  const budget = prompt?.config_jsonb?.dailyBudgetUsd ?? DEFAULT_PREFERENCES.dailyBudgetUsd;
  const spent = (runs ?? []).reduce((sum, r) => sum + Number(r.estimated_cost ?? 0), 0);
  if (budget > 0 && spent >= budget) return `Today's research budget ($${budget.toFixed(2)}) has been used ($${spent.toFixed(2)} spent). Raise it in Preferences or try tomorrow.`;
  return null;
}
