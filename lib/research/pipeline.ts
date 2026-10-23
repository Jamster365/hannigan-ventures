import { londonDate } from "@/lib/domain/format";
import { assessCandidate } from "./assess";
import { discoveryBrief, extractCandidates, pickDailyRechecks } from "./discover";
import type { SafeFetcher } from "./fetch";
import { canonicaliseUrl } from "./fetch";
import { findCompanyImagery } from "./imagery";
import { classifyChanges } from "./materiality";
import { POLICY_VERSION, composeSystemPrompt } from "./policy";
import type { ResearchCheck, ResearchModel } from "./provider";
import { resolveCandidate, type KnownCompany } from "./resolve";
import { homeStorySchema, type Candidate } from "./schemas";
import type { ResearchStore, RunConfig, StoredRun } from "./store";
import { sanitiseCandidate, verifySources, type VerifiedSource } from "./verify";

export interface PipelineDeps {
  model: ResearchModel;
  fetcher: SafeFetcher;
  store: ResearchStore;
  now: Date;
}

export interface PipelineInput {
  householdId: string;
  runKind: "scheduled" | "manual" | "recheck";
  triggeredBy: string | null;
  companyIds?: string[];
  /** One-off first run: deep discovery, a longer write-up and up to FIRST_FILL_NEW_DOSSIERS new companies. */
  firstFill?: boolean;
  /** Re-check a rotating set of tracked companies (pickDailyRechecks) and add no new ones. */
  updateOnly?: boolean;
}

export interface PipelineResult {
  /** "running": the web research is still in progress at the provider; advance again later. */
  status: "published" | "failed" | "no_new_research" | "skipped" | "running";
  runId: string | null;
  promptVersionId: string | null;
  sourceCount: number;
  candidatesCount: number;
  publishedCount: number;
  estimatedCostUsd: number;
  summary: string;
  errorSummary: string | null;
}

const MAX_NEW_DOSSIERS = 3;
const FIRST_FILL_NEW_DOSSIERS = 8;
/** The one-off first fill gets its own spend ceiling (at least this), separate from the daily budget. */
const FIRST_FILL_BUDGET_USD = 5;

/**
 * The daily research pipeline (SPEC §8.2), in two steps so no single request
 * runs longer than the hosting limit:
 *
 *  - `beginPipeline` records the run and starts the web-grounded research as a
 *    background job at the provider.
 *  - `advancePipeline` checks that job; once it has finished, one caller claims
 *    the run and verifies sources, extracts, assesses and publishes.
 *
 * Both are pure with respect to their dependencies (fixture model, stub
 * fetcher, in-memory store in tests). `runPipeline` drives both to completion.
 */
export async function runPipeline(deps: PipelineDeps, input: PipelineInput): Promise<PipelineResult> {
  let result = await beginPipeline(deps, input);
  for (let i = 0; i < 100 && result.status === "running" && result.runId; i++) result = await advancePipeline(deps, result.runId);
  return result;
}

export async function beginPipeline(deps: PipelineDeps, input: PipelineInput): Promise<PipelineResult> {
  const { model, store, now } = deps;
  const localDate = londonDate(now);
  const config = await store.loadConfig(input.householdId);
  const rotation = input.updateOnly && !input.companyIds?.length ? pickDailyRechecks(config.known) : null;
  if (rotation && rotation.length === 0) {
    return { ...emptyCounts(null, config.promptVersionId), status: "skipped", summary: "No tracked companies to update yet.", errorSummary: null };
  }
  const run = await store.startRun({ householdId: input.householdId, localDate, runKind: input.runKind, promptVersionId: config.promptVersionId, model: model.name, triggeredBy: input.triggeredBy, newCompanyLimit: input.firstFill ? FIRST_FILL_NEW_DOSSIERS : input.updateOnly ? 0 : undefined });
  if (!run) {
    return { status: "skipped", runId: null, promptVersionId: config.promptVersionId, sourceCount: 0, candidatesCount: 0, publishedCount: 0, estimatedCostUsd: 0, summary: `A ${input.runKind} run already exists for ${localDate}.`, errorSummary: null };
  }
  const finish = finisher(deps, { id: run.id, householdId: input.householdId }, config);
  try {
    const system = composeSystemPrompt(config.promptText, config.preferences);
    const recheck = input.companyIds?.length ? config.known.filter((k) => input.companyIds!.includes(k.id)) : (rotation ?? undefined);
    const brief = discoveryBrief({ localDate, known: config.known, recheckCompanies: recheck, depth: input.firstFill ? "deep" : config.preferences.discoveryDepth, firstFill: input.firstFill });
    // 2. Source discovery (web-grounded, cited), as a background job
    await store.progress(run.id, "searching", recheck ? `Re-checking ${recheck.length} tracked compan${recheck.length === 1 ? "y" : "ies"} on the web` : "Searching the web for new companies, updates and events");
    const handle = await model.startResearch({ system, input: brief, maxOutputTokens: input.firstFill ? 16_000 : undefined });
    await store.setDiscovery(run.id, handle);
    return { ...emptyCounts(run.id, config.promptVersionId), status: "running", summary: "Searching the web.", errorSummary: null };
  } catch (e) {
    return finish("failed", "Research run failed to start; nothing was published.", errorText(e));
  }
}

export async function advancePipeline(deps: PipelineDeps, runId: string): Promise<PipelineResult> {
  const { model, store } = deps;
  const run = await store.getRun(runId);
  if (!run) return { ...emptyCounts(null, null), status: "failed", summary: "Research run not found.", errorSummary: "unknown run" };
  if (run.status !== "running") return fromStored(run);
  // Another caller is processing it, or it has not started its discovery job.
  if (run.phase !== "discovering" || !run.responseHandle) return fromStored(run);

  let check: ResearchCheck;
  try {
    check = await model.checkResearch(run.responseHandle);
  } catch {
    return fromStored(run); // transient provider error: try again on the next advance
  }
  if (check.state === "pending") return fromStored(run);
  if (!(await store.claimProcessing(run.id))) return fromStored(await store.getRun(run.id) ?? run);

  const config = await store.loadConfig(run.householdId);
  const finish = finisher(deps, run, config);
  try {
    if (check.state === "failed") return finish("failed", "The web research job failed; nothing was published.", check.error);
    return await processDiscovery(deps, run, config, check, finish, run.newCompanyLimit ?? MAX_NEW_DOSSIERS);
  } catch (e) {
    return finish("failed", "Research run failed; no new research was published.", errorText(e));
  }
}

type Finish = (status: "published" | "failed" | "no_new_research", summary: string, errorSummary: string | null, counts?: Partial<Pick<PipelineResult, "sourceCount" | "candidatesCount" | "publishedCount">>) => Promise<PipelineResult>;

function finisher(deps: PipelineDeps, run: { id: string; householdId: string }, config: RunConfig): Finish {
  return async (status, summary, errorSummary, counts = {}) => {
    const result: PipelineResult = { ...emptyCounts(run.id, config.promptVersionId), ...counts, estimatedCostUsd: round4(deps.model.usage.estimatedCostUsd), status, summary, errorSummary };
    await deps.store.finishRun({ runId: run.id, status, sourceCount: result.sourceCount, candidatesCount: result.candidatesCount, publishedCount: result.publishedCount, estimatedCostUsd: result.estimatedCostUsd, summary, errorSummary });
    if (status === "failed") {
      await deps.store.notifyMembers({ householdId: run.householdId, memberIds: config.memberIds, type: "research_failed", title: "Research run failed", body: errorSummary ?? summary, importance: "normal", href: "/research/history", dedupeKey: `run_failed:${run.id}` });
    }
    return result;
  };
}

async function processDiscovery(deps: PipelineDeps, run: { id: string; householdId: string }, config: RunConfig, research: Extract<ResearchCheck, { state: "done" }>, finish: Finish, newCompanyLimit: number): Promise<PipelineResult> {
  const { model, fetcher, store } = deps;
  const system = composeSystemPrompt(config.promptText, config.preferences);
  const budgetUsd = newCompanyLimit > MAX_NEW_DOSSIERS ? Math.max(config.preferences.dailyBudgetUsd, FIRST_FILL_BUDGET_USD) : config.preferences.dailyBudgetUsd;
  // Keep the provider's write-up and where its URLs came from, for review in the audit log.
  const origins = { cited: 0, linked: 0, searched: 0 };
  for (const c of research.citations) origins[c.origin] += 1;
  await store.audit({ householdId: run.householdId, runId: run.id, action: "research.discovery", objectType: "research_run", objectId: run.id, after: { searchCalls: research.searchCalls, urls: origins, writeUp: research.text.slice(0, 6000) } });
  if (research.citations.length === 0) {
    return finish("no_new_research", "The research provider returned no cited findings; nothing was published.", research.text.trim() ? "No citations returned" : "Provider returned nothing");
  }
  if (overBudget(model, budgetUsd)) return finish("failed", "Stopped: daily research budget reached during discovery.", "budget exceeded");

  // 5a. Verify every cited URL ourselves
  await store.progress(run.id, "verifying", `Opening and checking ${research.citations.length} cited page${research.citations.length === 1 ? "" : "s"}`);
  const citationTitles = new Map(research.citations.map((c) => [canonicaliseUrl(c.url), c.title]));
  const verification = await verifySources(
    research.citations.map((c) => c.url),
    fetcher,
    { citationTitles },
  );
  const verified = [...verification.sources.values()];
  if (verification.dropped.length) await store.logReview({ householdId: run.householdId, runId: run.id, kind: "dropped_claims", detail: { droppedSources: verification.dropped } });
  if (verified.length === 0) return finish("no_new_research", "None of the cited sources could be retrieved and verified; nothing was published.", `${verification.dropped.length} sources failed verification`);

  // 3. Structured extraction over research text + verified excerpts
  await store.progress(run.id, "reading", `${verified.length} source${verified.length === 1 ? "" : "s"} verified · pulling out companies and evidence`);
  // Room for up to ~3k tokens of structured output per allowed company.
  const extraction = await extractCandidates(model, system, research.text, verified, { maxOutputTokens: Math.max(12_000, newCompanyLimit * 3_000) });
  if (!extraction) return finish("failed", "Extraction output failed schema validation; nothing was published.", `invalid extraction: ${model.lastError ?? "unknown reason"}`);
  if (model.lastNotes?.length) await store.audit({ householdId: run.householdId, runId: run.id, action: "research.extraction_repairs", objectType: "research_run", objectId: run.id, after: { notes: model.lastNotes.slice(0, 50) } });
  if (overBudget(model, budgetUsd)) return finish("failed", "Stopped: daily research budget reached during extraction.", "budget exceeded");

  const verifiedSet = new Set(verified.map((s) => s.url));
  const taken = new Set(config.known.map((k) => k.slug));
  const known = [...config.known];
  let published = 0;
  let newDossiers = 0;
  const summaryLines: string[] = [];
  const storyInputs: { storyType: "financing" | "access" | "deadline" | "signal" | "research"; companyId: string | null; headline: string; teaser: string; priority: number; sourceId: string | null }[] = [];

  // 8. Assess every plausible candidate in parallel (each is an independent model call),
  // so the processing step stays well inside one request's time limit.
  const prepared = extraction.candidates.map((raw) => {
    const { candidate, removed } = sanitiseCandidate(raw, verifiedSet);
    const candidateUrls = collectUrls(candidate);
    return { raw, candidate, removed, candidateUrls, candidateSources: verified.filter((s) => candidateUrls.includes(s.url)) };
  });
  const worthAssessing = prepared.filter((c) => c.candidateUrls.length > 0 && resolveCandidate(c.candidate, config.known, new Set(config.known.map((k) => k.slug))).kind !== "ambiguous");
  await store.progress(run.id, "assessing", `Assessing ${worthAssessing.length} compan${worthAssessing.length === 1 ? "y" : "ies"} against the evidence`);
  const assessments = new Map(await Promise.all(worthAssessing.map(async (c) => [c.raw, await assessCandidate(model, system, c.candidate, c.candidateSources, null)] as const)));
  if (overBudget(model, budgetUsd)) return finish("failed", "Stopped: daily research budget reached during assessment.", "budget exceeded", { candidatesCount: extraction.candidates.length, sourceCount: verified.length });

  for (const [index, { raw, candidate, removed, candidateUrls, candidateSources }] of prepared.entries()) {
    await store.progress(run.id, "publishing", `Saving ${candidate.name} (${index + 1} of ${prepared.length})`);
    // 5b. Evidence rules
    if (candidateUrls.length === 0) {
      await store.logReview({ householdId: run.householdId, runId: run.id, kind: "rejected_candidate", detail: { name: raw.name, reason: "no verified sources", removed } });
      continue;
    }
    // 4. Entity resolution
    const resolution = resolveCandidate(candidate, known, taken);
    if (resolution.kind === "ambiguous") {
      await store.logReview({ householdId: run.householdId, runId: run.id, kind: "ambiguous_entity", detail: { name: candidate.name, website: candidate.website, ...resolution } });
      continue;
    }
    if (resolution.kind === "new" && newDossiers >= newCompanyLimit) {
      await store.logReview({ householdId: run.householdId, runId: run.id, kind: "rejected_candidate", detail: { name: candidate.name, reason: "daily new-dossier limit reached" } });
      continue;
    }
    // Skip unchanged existing companies whose sources were all seen before.
    const allSeen = candidateSources.every((s) => s.contentHash && config.seenHashes.has(s.contentHash));
    const previous = resolution.kind === "existing" ? await store.previousState(resolution.companyId) : null;
    if (resolution.kind === "existing" && allSeen && candidate.signals.length === 0) continue;

    // 7–8. Upsert facts with provenance, then assess
    const companyIdForSources = resolution.kind === "existing" ? resolution.companyId : null;
    const sourceIds = await store.upsertSources(run.householdId, companyIdForSources, candidateSources, sourceTypeFor);
    const assessment = assessments.get(raw) ?? null;
    let companyRecord: Awaited<ReturnType<typeof store.publishCompany>>;
    try {
      companyRecord = await store.publishCompany({ householdId: run.householdId, runId: run.id, candidate, resolution, sourceIds, assessment, policyVersion: POLICY_VERSION, model: model.name, promptVersion: config.promptVersionId });
    } catch (e) {
      // One company failing to save must not stop the others (the store removes any half-written new company).
      await store.logReview({ householdId: run.householdId, runId: run.id, kind: "rejected_candidate", detail: { name: candidate.name, reason: `could not be saved: ${errorText(e)}` } });
      summaryLines.push(`Skipped: ${candidate.name} (could not be saved)`);
      continue;
    }
    if (resolution.kind === "new") {
      newDossiers += 1;
      known.push({ id: companyRecord.companyId, name: candidate.name, slug: companyRecord.slug, domain: candidate.website, legalName: candidate.legalName, aliases: [] });
      taken.add(companyRecord.slug);
      // Sources inserted before the company existed now get linked.
      await store.upsertSources(run.householdId, companyRecord.companyId, candidateSources, sourceTypeFor);
    }
    // Imagery from the company's own (verified) website; never blocks publishing.
    if (candidate.website && !(await store.hasImagery(companyRecord.companyId))) {
      try {
        const images = await findCompanyImagery({ website: candidate.website, verifiedUrls: candidateSources.map((s) => s.url) }, fetcher);
        if (images.length) await store.saveImagery({ householdId: run.householdId, companyId: companyRecord.companyId, companyName: candidate.name, images });
      } catch {
        // Best-effort: the designed artwork remains the fallback.
      }
    }
    // 9–10. Materiality → timeline, notifications
    const changes = classifyChanges(candidate, previous);
    const notified = await store.recordChanges({ householdId: run.householdId, runId: run.id, company: companyRecord, changes, sourceIds, memberIds: config.memberIds });
    published += 1;
    if (removed.length) await store.logReview({ householdId: run.householdId, runId: run.id, kind: "dropped_claims", detail: { company: candidate.name, removed } });
    summaryLines.push(`${companyRecord.isNew ? "New" : "Updated"}: ${candidate.name}${changes.length ? ` (${changes.length} change${changes.length === 1 ? "" : "s"}, ${notified} notified)` : ""}`);
    for (const ch of changes.filter((c) => c.materiality === "high").slice(0, 2)) {
      storyInputs.push({ storyType: ch.updateType === "funding" ? (ch.notify === "deadline" ? "deadline" : ch.notify === "access_changed" ? "access" : "financing") : "signal", companyId: companyRecord.companyId, headline: `${candidate.name}: ${ch.headline}`, teaser: ch.summary, priority: 80, sourceId: ch.sourceUrl ? (sourceIds.get(canonicaliseUrl(ch.sourceUrl)) ?? null) : null });
    }
    if (companyRecord.isNew) storyInputs.push({ storyType: "research", companyId: companyRecord.companyId, headline: `New: ${candidate.name}`, teaser: candidate.teaser, priority: 60, sourceId: sourceIds.get(candidateUrls[0]) ?? null });
  }

  await store.progress(run.id, "publishing", "Saving events and Home highlights");
  // Events (only with a verified source)
  const events = extraction.events
    .map((e) => ({ ...e, sourceUrls: e.sourceUrls.map(canonicaliseUrl).filter((u) => verifiedSet.has(u)) }))
    .filter((e) => e.sourceUrls.length > 0 && !Number.isNaN(new Date(e.startAtIso).getTime()));
  if (events.length) {
    const eventSourceIds = await store.upsertSources(run.householdId, null, verified.filter((s) => events.some((e) => e.sourceUrls.includes(s.url))), sourceTypeFor);
    await store.publishEvents({ householdId: run.householdId, events: events.map((e) => ({ name: e.name, organiser: e.organiser, eventType: e.eventType, startAt: new Date(e.startAtIso).toISOString(), endAt: e.endAtIso ? new Date(e.endAtIso).toISOString() : null, venue: e.venue, city: e.city, isOnline: e.isOnline, registrationUrl: e.registrationUrl, accessStatus: e.registrationUrl ? e.accessStatus : "unknown", audienceFit: e.audienceFit, significance: e.significance, nextAction: e.nextAction, sourceId: eventSourceIds.get(e.sourceUrls[0]) ?? null })) });
  }

  // 10. Editorial Home stories, curated by the model from what was actually published
  if (storyInputs.length) {
    const curated = await model.structured({ schema: homeStorySchema, schemaName: "home_stories", system, input: `Pick at most 4 of these published findings as concise Home highlights (headline ≤ 110 chars, teaser ≤ 200 chars). Do not add facts.\n${JSON.stringify(storyInputs.map((s) => ({ companyName: s.headline.split(":")[0], storyType: s.storyType, headline: s.headline, teaser: s.teaser })))}`, maxOutputTokens: 1500 });
    const stories = (curated?.stories ?? []).map((s) => {
      const match = storyInputs.find((i) => i.headline.startsWith(s.companyName ?? "")) ?? storyInputs[0];
      return { storyType: s.storyType, companyId: match.companyId, headline: s.headline, teaser: s.teaser, priority: s.priority, sourceId: match.sourceId };
    });
    await store.publishStories({ householdId: run.householdId, runId: run.id, stories: stories.length ? stories : storyInputs.slice(0, 4) });
  }

  const summary = published === 0 ? `Research ran but nothing new or material was verified; no companies published.${summaryLines.length ? ` ${summaryLines.join("; ")}.` : ""}` : `${published} compan${published === 1 ? "y" : "ies"} published (${newDossiers} new). ${summaryLines.slice(0, 8).join("; ")}.`;
  await store.audit({ householdId: run.householdId, runId: run.id, action: "research.publish", objectType: "research_run", objectId: run.id, after: { published, newDossiers, policyVersion: POLICY_VERSION, findings: extraction.executiveFindings } });
  return finish(published === 0 ? "no_new_research" : "published", summary, null, { sourceCount: verified.length, candidatesCount: extraction.candidates.length, publishedCount: published });
}

function emptyCounts(runId: string | null, promptVersionId: string | null) {
  return { runId, promptVersionId, sourceCount: 0, candidatesCount: 0, publishedCount: 0, estimatedCostUsd: 0 };
}

function fromStored(run: StoredRun): PipelineResult {
  return { runId: run.id, promptVersionId: null, sourceCount: run.sourceCount, candidatesCount: run.candidatesCount, publishedCount: run.publishedCount, estimatedCostUsd: run.estimatedCostUsd, status: run.status === "queued" ? "running" : run.status, summary: run.summary, errorSummary: run.errorSummary };
}

function errorText(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 500);
}

function collectUrls(c: Candidate): string[] {
  const urls = new Set<string>();
  const add = (list?: string[]) => list?.forEach((u) => urls.add(canonicaliseUrl(u)));
  add(c.access.sourceUrls);
  add(c.eis.sourceUrls);
  c.founders.forEach((f) => add(f.sourceUrls));
  c.facts.forEach((f) => add(f.sourceUrls));
  c.signals.forEach((s) => add(s.sourceUrls));
  if (c.round) {
    add(c.round.sourceUrls);
    add(c.round.target?.sourceUrls);
    add(c.round.preMoney?.sourceUrls);
    add(c.round.postMoney?.sourceUrls);
    add(c.round.reportedCommitted?.sourceUrls);
  }
  return [...urls];
}

export function sourceTypeFor(url: string): "news" | "official" | "filing" | "research" | "media" | "other" {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (/companieshouse|gov\.uk|sec\.gov|find-and-update/.test(host)) return "filing";
  if (/\.(ac\.uk|edu)$|arxiv|nature\.com|science\.org/.test(host)) return "research";
  if (/youtube|vimeo|podcast|spotify/.test(host)) return "media";
  if (/techcrunch|sifted|ft\.com|bbc|guardian|reuters|bloomberg|businessinsider|uktech|eu-startups|tech\.eu|news/.test(host)) return "news";
  if (host) return "official";
  return "other";
}

function overBudget(model: ResearchModel, budgetUsd: number): boolean {
  return budgetUsd > 0 && model.usage.estimatedCostUsd > budgetUsd;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export type { VerifiedSource };
