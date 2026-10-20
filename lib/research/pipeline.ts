import { londonDate } from "@/lib/domain/format";
import { assessCandidate } from "./assess";
import { discoverAndExtract, discoveryBrief, extractCandidates } from "./discover";
import type { SafeFetcher } from "./fetch";
import { canonicaliseUrl } from "./fetch";
import { classifyChanges } from "./materiality";
import { POLICY_VERSION, composeSystemPrompt } from "./policy";
import type { ResearchModel } from "./provider";
import { resolveCandidate, type KnownCompany } from "./resolve";
import { homeStorySchema, type Candidate } from "./schemas";
import type { ResearchStore } from "./store";
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
}

export interface PipelineResult {
  status: "published" | "failed" | "no_new_research" | "skipped";
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

/**
 * The daily research pipeline (SPEC §8.2). Pure with respect to its
 * dependencies, so it can be tested with a fixture model, a stub fetcher and
 * an in-memory store.
 */
export async function runPipeline(deps: PipelineDeps, input: PipelineInput): Promise<PipelineResult> {
  const { model, fetcher, store, now } = deps;
  const localDate = londonDate(now);
  const config = await store.loadConfig(input.householdId);
  const run = await store.startRun({ householdId: input.householdId, localDate, runKind: input.runKind, promptVersionId: config.promptVersionId, model: model.name, triggeredBy: input.triggeredBy });
  if (!run) {
    return { status: "skipped", runId: null, promptVersionId: config.promptVersionId, sourceCount: 0, candidatesCount: 0, publishedCount: 0, estimatedCostUsd: 0, summary: `A ${input.runKind} run already exists for ${localDate}.`, errorSummary: null };
  }
  const base: Omit<PipelineResult, "status" | "summary" | "errorSummary"> = { runId: run.id, promptVersionId: config.promptVersionId, sourceCount: 0, candidatesCount: 0, publishedCount: 0, estimatedCostUsd: 0 };
  const finish = async (status: "published" | "failed" | "no_new_research", summary: string, errorSummary: string | null, counts: Partial<typeof base> = {}): Promise<PipelineResult> => {
    const result = { ...base, ...counts, estimatedCostUsd: round4(model.usage.estimatedCostUsd), status, summary, errorSummary };
    await store.finishRun({ runId: run.id, status, sourceCount: result.sourceCount, candidatesCount: result.candidatesCount, publishedCount: result.publishedCount, estimatedCostUsd: result.estimatedCostUsd, summary, errorSummary });
    if (status === "failed") {
      await store.notifyMembers({ householdId: input.householdId, memberIds: config.memberIds, type: "research_failed", title: "Research run failed", body: errorSummary ?? summary, importance: "normal", href: "/research/history", dedupeKey: `run_failed:${run.id}` });
    }
    return result;
  };

  try {
    const system = composeSystemPrompt(config.promptText, config.preferences);
    const recheck = input.companyIds?.length ? config.known.filter((k) => input.companyIds!.includes(k.id)) : undefined;
    const brief = discoveryBrief({ localDate, known: config.known, recheckCompanies: recheck, depth: config.preferences.discoveryDepth });

    // 2. Source discovery (web-grounded, cited)
    await store.progress(run.id, "searching", recheck ? `Re-checking ${recheck.length} tracked compan${recheck.length === 1 ? "y" : "ies"} on the web` : "Searching the web for new companies, updates and events");
    const research = await discoverAndExtract(model, system, brief);
    if (!research || research.citations.length === 0) {
      return finish("no_new_research", "The research provider returned no cited findings; nothing was published.", research ? "No citations returned" : "Provider returned nothing");
    }
    if (overBudget(model, config.preferences.dailyBudgetUsd)) return finish("failed", "Stopped: daily research budget reached during discovery.", "budget exceeded");

    // 5a. Verify every cited URL ourselves
    await store.progress(run.id, "verifying", `Opening and checking ${research.citations.length} cited page${research.citations.length === 1 ? "" : "s"}`);
    const citationTitles = new Map(research.citations.map((c) => [canonicaliseUrl(c.url), c.title]));
    const verification = await verifySources(
      research.citations.map((c) => c.url),
      fetcher,
      { citationTitles },
    );
    const verified = [...verification.sources.values()];
    if (verification.dropped.length) await store.logReview({ householdId: input.householdId, runId: run.id, kind: "dropped_claims", detail: { droppedSources: verification.dropped } });
    if (verified.length === 0) return finish("no_new_research", "None of the cited sources could be retrieved and verified; nothing was published.", `${verification.dropped.length} sources failed verification`);

    // 3. Structured extraction over research text + verified excerpts
    await store.progress(run.id, "reading", `${verified.length} source${verified.length === 1 ? "" : "s"} verified · pulling out companies and evidence`);
    const extraction = await extractCandidates(model, system, research.text, verified);
    if (!extraction) return finish("failed", "Extraction output failed schema validation; nothing was published.", "invalid extraction");
    if (overBudget(model, config.preferences.dailyBudgetUsd)) return finish("failed", "Stopped: daily research budget reached during extraction.", "budget exceeded");

    const verifiedSet = new Set(verified.map((s) => s.url));
    const taken = new Set(config.known.map((k) => k.slug));
    const known = [...config.known];
    let published = 0;
    let newDossiers = 0;
    const summaryLines: string[] = [];
    const storyInputs: { storyType: "financing" | "access" | "deadline" | "signal" | "research"; companyId: string | null; headline: string; teaser: string; priority: number; sourceId: string | null }[] = [];

    for (const [index, raw] of extraction.candidates.entries()) {
      await store.progress(run.id, "assessing", `Checking ${raw.name} (${index + 1} of ${extraction.candidates.length})`);
      // 5b. Evidence rules
      const { candidate, removed } = sanitiseCandidate(raw, verifiedSet);
      const candidateUrls = collectUrls(candidate);
      if (candidateUrls.length === 0) {
        await store.logReview({ householdId: input.householdId, runId: run.id, kind: "rejected_candidate", detail: { name: raw.name, reason: "no verified sources", removed } });
        continue;
      }
      // 4. Entity resolution
      const resolution = resolveCandidate(candidate, known, taken);
      if (resolution.kind === "ambiguous") {
        await store.logReview({ householdId: input.householdId, runId: run.id, kind: "ambiguous_entity", detail: { name: candidate.name, website: candidate.website, ...resolution } });
        continue;
      }
      if (resolution.kind === "new" && newDossiers >= MAX_NEW_DOSSIERS) {
        await store.logReview({ householdId: input.householdId, runId: run.id, kind: "rejected_candidate", detail: { name: candidate.name, reason: "daily new-dossier limit reached" } });
        continue;
      }
      // Skip unchanged existing companies whose sources were all seen before.
      const candidateSources = verified.filter((s) => candidateUrls.includes(s.url));
      const allSeen = candidateSources.every((s) => s.contentHash && config.seenHashes.has(s.contentHash));
      const previous = resolution.kind === "existing" ? await store.previousState(resolution.companyId) : null;
      if (resolution.kind === "existing" && allSeen && candidate.signals.length === 0) continue;

      // 7–8. Upsert facts with provenance, then assess
      const companyIdForSources = resolution.kind === "existing" ? resolution.companyId : null;
      const sourceIds = await store.upsertSources(input.householdId, companyIdForSources, candidateSources, sourceTypeFor);
      const assessment = await assessCandidate(model, system, candidate, candidateSources, previous ? null : null);
      if (overBudget(model, config.preferences.dailyBudgetUsd)) return finish("failed", "Stopped: daily research budget reached during assessment.", "budget exceeded", { candidatesCount: extraction.candidates.length, publishedCount: published, sourceCount: verified.length });
      const companyRecord = await store.publishCompany({ householdId: input.householdId, runId: run.id, candidate, resolution, sourceIds, assessment, policyVersion: POLICY_VERSION, model: model.name, promptVersion: config.promptVersionId });
      if (resolution.kind === "new") {
        newDossiers += 1;
        known.push({ id: companyRecord.companyId, name: candidate.name, slug: companyRecord.slug, domain: candidate.website, legalName: candidate.legalName, aliases: [] });
        taken.add(companyRecord.slug);
        // Sources inserted before the company existed now get linked.
        await store.upsertSources(input.householdId, companyRecord.companyId, candidateSources, sourceTypeFor);
      }
      // 9–10. Materiality → timeline, notifications
      const changes = classifyChanges(candidate, previous);
      const notified = await store.recordChanges({ householdId: input.householdId, runId: run.id, company: companyRecord, changes, sourceIds, memberIds: config.memberIds });
      published += 1;
      if (removed.length) await store.logReview({ householdId: input.householdId, runId: run.id, kind: "dropped_claims", detail: { company: candidate.name, removed } });
      summaryLines.push(`${companyRecord.isNew ? "New" : "Updated"}: ${candidate.name}${changes.length ? ` (${changes.length} change${changes.length === 1 ? "" : "s"}, ${notified} notified)` : ""}`);
      for (const ch of changes.filter((c) => c.materiality === "high").slice(0, 2)) {
        storyInputs.push({ storyType: ch.updateType === "funding" ? (ch.notify === "deadline" ? "deadline" : ch.notify === "access_changed" ? "access" : "financing") : "signal", companyId: companyRecord.companyId, headline: `${candidate.name}: ${ch.headline}`, teaser: ch.summary, priority: 80, sourceId: ch.sourceUrl ? (sourceIds.get(canonicaliseUrl(ch.sourceUrl)) ?? null) : null });
      }
      if (companyRecord.isNew) storyInputs.push({ storyType: "research", companyId: companyRecord.companyId, headline: `New: ${candidate.name}`, teaser: candidate.teaser, priority: 60, sourceId: sourceIds.get(candidateUrls[0]) ?? null });
    }

    await store.progress(run.id, "publishing", "Saving companies, events and Home highlights");
    // Events (only with a verified source)
    const events = extraction.events
      .map((e) => ({ ...e, sourceUrls: e.sourceUrls.map(canonicaliseUrl).filter((u) => verifiedSet.has(u)) }))
      .filter((e) => e.sourceUrls.length > 0 && !Number.isNaN(new Date(e.startAtIso).getTime()));
    if (events.length) {
      const eventSourceIds = await store.upsertSources(input.householdId, null, verified.filter((s) => events.some((e) => e.sourceUrls.includes(s.url))), sourceTypeFor);
      await store.publishEvents({ householdId: input.householdId, events: events.map((e) => ({ name: e.name, organiser: e.organiser, eventType: e.eventType, startAt: new Date(e.startAtIso).toISOString(), endAt: e.endAtIso ? new Date(e.endAtIso).toISOString() : null, venue: e.venue, city: e.city, isOnline: e.isOnline, registrationUrl: e.registrationUrl, accessStatus: e.registrationUrl ? e.accessStatus : "unknown", audienceFit: e.audienceFit, significance: e.significance, nextAction: e.nextAction, sourceId: eventSourceIds.get(e.sourceUrls[0]) ?? null })) });
    }

    // 10. Editorial Home stories, curated by the model from what was actually published
    if (storyInputs.length) {
      const curated = await model.structured({ schema: homeStorySchema, schemaName: "home_stories", system, input: `Pick at most 4 of these published findings as concise Home highlights (headline ≤ 110 chars, teaser ≤ 200 chars). Do not add facts.\n${JSON.stringify(storyInputs.map((s) => ({ companyName: s.headline.split(":")[0], storyType: s.storyType, headline: s.headline, teaser: s.teaser })))}`, maxOutputTokens: 1500 });
      const stories = (curated?.stories ?? []).map((s) => {
        const match = storyInputs.find((i) => i.headline.startsWith(s.companyName ?? "")) ?? storyInputs[0];
        return { storyType: s.storyType, companyId: match.companyId, headline: s.headline, teaser: s.teaser, priority: s.priority, sourceId: match.sourceId };
      });
      await store.publishStories({ householdId: input.householdId, runId: run.id, stories: stories.length ? stories : storyInputs.slice(0, 4) });
    }

    const summary = published === 0 ? "Research ran but nothing new or material was verified; no companies published." : `${published} compan${published === 1 ? "y" : "ies"} published (${newDossiers} new). ${summaryLines.slice(0, 5).join("; ")}.`;
    await store.audit({ householdId: input.householdId, runId: run.id, action: "research.publish", objectType: "research_run", objectId: run.id, after: { published, newDossiers, policyVersion: POLICY_VERSION, findings: extraction.executiveFindings } });
    return finish(published === 0 ? "no_new_research" : "published", summary, null, { sourceCount: verified.length, candidatesCount: extraction.candidates.length, publishedCount: published });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return finish("failed", "Research run failed; no new research was published.", message.slice(0, 500));
  }
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
