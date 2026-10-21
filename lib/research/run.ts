import "server-only";
import type { ResearchRun } from "@/lib/domain/types";
import { londonDate, londonHour } from "@/lib/domain/format";
import { advancePipeline, beginPipeline, type PipelineDeps, type PipelineResult } from "./pipeline";
import type { StoredRun } from "./store";

/**
 * Entry points used by the scheduler tick, the cron route and the manual
 * "Run research now" actions. They wire the production dependencies (OpenAI
 * adapter, SSRF-safe fetcher, Supabase service-role store) into the pipeline.
 * A fresh model per call keeps each run's cost accounting separate.
 */
async function productionDeps(now = new Date(), model?: PipelineDeps["model"]): Promise<PipelineDeps> {
  const [{ getResearchModel }, { safeFetch }, { createSupabaseResearchStore }] = await Promise.all([import("./provider"), import("./fetch"), import("./supabase-store")]);
  return { model: model ?? getResearchModel(), fetcher: safeFetch, store: createSupabaseResearchStore(), now };
}

const IMPORT_PREFIX = "import:";

/** Runs whose handle is "import:<id>" read prepared research from research_imports instead of calling the provider. */
async function importedModelFor(run: StoredRun | null): Promise<PipelineDeps["model"] | undefined> {
  if (!run?.responseHandle?.startsWith(IMPORT_PREFIX)) return undefined;
  const [{ createSupabaseAdminClient }, { ImportedResearchModel }] = await Promise.all([import("@/lib/supabase/admin"), import("./imported-model")]);
  const { data } = await createSupabaseAdminClient().from("research_imports").select("label, payload").eq("id", run.responseHandle.slice(IMPORT_PREFIX.length)).maybeSingle<{ label: string; payload: import("./imported-model").ResearchImportPayload }>();
  if (!data) throw new Error("Imported research payload not found");
  return new ImportedResearchModel(data.payload, data.label);
}

function householdFromEnv(householdId?: string): string {
  const id = householdId ?? process.env.RESEARCH_HOUSEHOLD_ID;
  if (!id) throw new Error("RESEARCH_HOUSEHOLD_ID is not configured");
  return id;
}

export async function beginResearch(input: { runKind: ResearchRun["runKind"]; triggeredBy: string | null; householdId?: string; companyIds?: string[]; firstFill?: boolean }): Promise<PipelineResult> {
  const deps = await productionDeps();
  return beginPipeline(deps, { householdId: householdFromEnv(input.householdId), runKind: input.runKind, triggeredBy: input.triggeredBy, companyIds: input.companyIds, firstFill: input.firstFill });
}

export async function advanceResearch(runId: string): Promise<PipelineResult> {
  const model = await importedModelFor(await getResearchRun(runId));
  return advancePipeline(await productionDeps(new Date(), model), runId);
}

export async function getResearchRun(runId: string): Promise<StoredRun | null> {
  const { createSupabaseResearchStore } = await import("./supabase-store");
  return createSupabaseResearchStore().getRun(runId);
}

const MINUTE = 60_000;

/** Why an in-progress run should be given up on, or null if it is still healthy. */
export function staleReason(run: StoredRun, now: Date): string | null {
  const since = (iso: string | null) => now.getTime() - Date.parse(iso ?? run.startedAt);
  if (run.phase === null && since(run.startedAt) > 10 * MINUTE) return "Run stopped before its web research started (likely the hosting time limit).";
  if (run.phase === "processing" && since(run.progressAt) > 10 * MINUTE) return "Run stopped while verifying and publishing (likely the hosting time limit).";
  if (run.phase === "discovering" && since(run.startedAt) > 3 * 60 * MINUTE) return "The web research job did not finish within 3 hours.";
  return null;
}

/**
 * Scheduler heartbeat (every few minutes, from Supabase pg_cron; Vercel's daily
 * cron is a fallback). Gives up on stuck runs, advances runs whose background
 * research may have finished, and starts the day's scheduled run in the
 * configured Europe/London hour (the database allows one per day).
 */
export async function tickResearch(opts: { now?: Date; forceStart?: boolean; firstFill?: boolean } = {}) {
  const now = opts.now ?? new Date();
  const householdId = householdFromEnv();
  const { createSupabaseResearchStore } = await import("./supabase-store");
  const store = createSupabaseResearchStore();
  const report: { advanced: { runId: string; status: string }[]; failedStale: string[]; started: PipelineResult | null; localDate: string } = { advanced: [], failedStale: [], started: null, localDate: londonDate(now) };

  for (const run of await store.listActiveRuns(householdId)) {
    const stale = staleReason(run, now);
    if (stale) {
      await store.finishRun({ runId: run.id, status: "failed", sourceCount: run.sourceCount, candidatesCount: run.candidatesCount, publishedCount: run.publishedCount, estimatedCostUsd: run.estimatedCostUsd, summary: "Research run did not complete; nothing new was published.", errorSummary: stale });
      report.failedStale.push(run.id);
      continue;
    }
    const result = await advanceResearch(run.id);
    report.advanced.push({ runId: run.id, status: result.status });
  }

  // Operator-triggered one-off first fill: a manual run with deep discovery and a larger cap.
  if (opts.firstFill) {
    report.started = await beginResearch({ runKind: "manual", triggeredBy: null, householdId, firstFill: true });
    return report;
  }

  const config = await store.loadConfig(householdId);
  const configuredHour = Number((config.preferences.researchTimeLocal ?? "07:00").split(":")[0]);
  if (opts.forceStart || londonHour(now) === configuredHour) {
    report.started = await beginResearch({ runKind: "scheduled", triggeredBy: null, householdId });
  }
  return report;
}
