import "server-only";
import type { ResearchRun } from "@/lib/domain/types";
import { londonDate } from "@/lib/domain/format";
import { runPipeline, type PipelineDeps } from "./pipeline";

/**
 * Entry point used by the cron route and the manual "Run research now"
 * action. Wires the production dependencies (OpenAI adapter, SSRF-safe
 * fetcher, Supabase service-role store) into the pure pipeline.
 */
export async function runResearch(input: { runKind: ResearchRun["runKind"]; triggeredBy: string | null; householdId?: string; companyIds?: string[]; now?: Date }): Promise<ResearchRun> {
  const [{ getResearchModel }, { safeFetch }, { createSupabaseResearchStore }] = await Promise.all([import("./provider"), import("./fetch"), import("./supabase-store")]);
  const householdId = input.householdId ?? process.env.RESEARCH_HOUSEHOLD_ID;
  if (!householdId) throw new Error("RESEARCH_HOUSEHOLD_ID is not configured");
  const deps: PipelineDeps = { model: getResearchModel(), fetcher: safeFetch, store: createSupabaseResearchStore(), now: input.now ?? new Date() };
  const result = await runPipeline(deps, { householdId, runKind: input.runKind, triggeredBy: input.triggeredBy, companyIds: input.companyIds });
  return {
    id: result.runId ?? "",
    localDate: londonDate(deps.now),
    runKind: input.runKind,
    promptVersionId: result.promptVersionId ?? "",
    status: result.status === "skipped" ? "no_new_research" : result.status,
    startedAt: deps.now.toISOString(),
    finishedAt: new Date().toISOString(),
    model: deps.model.name,
    sourceCount: result.sourceCount,
    candidatesCount: result.candidatesCount,
    publishedCount: result.publishedCount,
    estimatedCostUsd: result.estimatedCostUsd,
    summary: result.summary,
    errorSummary: result.errorSummary,
  };
}
