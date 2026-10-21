import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { enforceAssessmentRules } from "@/lib/research/assess";
import type { SafeFetcher } from "@/lib/research/fetch";
import { classifyChanges } from "@/lib/research/materiality";
import { MemoryResearchStore } from "@/lib/research/memory-store";
import { advancePipeline, beginPipeline, runPipeline } from "@/lib/research/pipeline";
import type { ModelUsage, ResearchModel } from "@/lib/research/provider";
import { resolveCandidate } from "@/lib/research/resolve";
import { assessmentSchema, candidateSchema, extractionSchema, homeStorySchema, type AssessmentOutput, type Candidate, type Extraction } from "@/lib/research/schemas";
import { sanitiseCandidate } from "@/lib/research/verify";
import { ImportedResearchModel } from "@/lib/research/imported-model";

// ---------------------------------------------------------------------------
// Fixtures: a fake model that "cites" pages, a fetcher that serves some of them
// ---------------------------------------------------------------------------
const PAGES: Record<string, string> = {
  "https://example-company.test/": "<html><head><title>Example Photonics — retinal imaging</title></head><body>Example Photonics builds photonic-chip retinal scanners. We are raising a seed round. Apply via our investor page.</body></html>",
  "https://example-company.test/investors": "<html><head><title>Invest in Example Photonics</title></head><body>Seed round open. Minimum ticket £10,000. Closes 31 October.</body></html>",
  "https://news.example.test/example-photonics-seed": "<html><head><title>Example Photonics targets £2m seed</title><meta property=\"article:published_time\" content=\"2026-10-15T08:00:00Z\"></head><body>The Bristol company is targeting a £2m seed at a £9m pre-money valuation, led by Specialist Health Ventures.</body></html>",
};

const fetcher: SafeFetcher = async (url) => {
  const html = PAGES[url];
  if (!html) return { ok: false, status: 404, finalUrl: url, contentType: null, text: null, error: "HTTP 404" };
  return { ok: true, status: 200, finalUrl: url, contentType: "text/html", text: html };
};

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return candidateSchema.parse({
    name: "Example Photonics",
    website: "https://example-company.test/",
    legalName: "Example Photonics Ltd",
    sector: "Medtech",
    subSector: "Ophthalmology",
    city: "Bristol",
    country: "UK",
    stage: "Seed",
    teaser: "Photonic-chip retinal scanners.",
    description: "Builds photonic-chip retinal scanners.",
    discoverySignal: "Investor page found",
    researchRuleMatched: "Priority 1",
    founders: [{ name: "A. Founder", role: "CEO", bio: "Photonics researcher.", profileUrl: null, sourceUrls: ["https://example-company.test/"], evidenceStatus: "official_company_claim" }],
    round: {
      stage: "Seed",
      target: { amount: 2_000_000, currency: "GBP", asOf: "2026-10-15", sourceUrls: ["https://news.example.test/example-photonics-seed"], evidenceStatus: "third_party_report" },
      preMoney: { amount: 9_000_000, currency: "GBP", asOf: "2026-10-15", sourceUrls: ["https://news.example.test/example-photonics-seed"], evidenceStatus: "third_party_report" },
      postMoney: null,
      reportedCommitted: { amount: 1_000_000, currency: "GBP", asOf: null, sourceUrls: ["https://nowhere.example.test/missing"], evidenceStatus: "third_party_report" },
      claimedStatus: "open",
      closesAt: "2026-10-31",
      leadInvestors: ["Specialist Health Ventures"],
      sourceUrls: ["https://news.example.test/example-photonics-seed"],
      evidenceStatus: "third_party_report",
    },
    access: { status: "verified_open", routeType: "official_application", contactOrUrl: "https://example-company.test/investors", minCheque: 10_000, maxCheque: null, currency: "GBP", notes: "Investor page live with minimum ticket.", sourceUrls: ["https://example-company.test/investors"], evidenceStatus: "official_company_claim" },
    eis: { status: "confirmed_documented", note: null, sourceUrls: [], evidenceStatus: "unknown" },
    facts: [{ key: "team_size", label: "Team size", value: "8", currency: null, asOf: null, sourceUrls: ["https://nowhere.example.test/missing"], evidenceStatus: "third_party_report" }],
    signals: [{ headline: "Seed round opened", summary: "Investor page shows an open round with a stated minimum.", type: "funding", materiality: "high", effectiveAt: "2026-10-15", sourceUrls: ["https://example-company.test/investors"], evidenceStatus: "official_company_claim" }],
    openQuestions: ["Post-money?"],
    ...overrides,
  });
}

function fakeModel(extraction: Extraction, assessment: AssessmentOutput, opts: { citations?: { url: string; title: string }[]; costPerCall?: number; pendingChecks?: number; jobFails?: boolean } = {}): ResearchModel & { checks: number } {
  let pending = opts.pendingChecks ?? 0;
  const usage: ModelUsage = { inputTokens: 0, outputTokens: 0, webSearchCalls: 0, estimatedCostUsd: 0 };
  const bump = () => {
    usage.inputTokens += 1000;
    usage.outputTokens += 500;
    usage.estimatedCostUsd += opts.costPerCall ?? 0.01;
  };
  return {
    name: "fixture-model",
    usage,
    checks: 0,
    async startResearch() {
      return "job-1";
    },
    async checkResearch() {
      this.checks += 1;
      if (pending > 0) {
        pending -= 1;
        return { state: "pending" as const };
      }
      bump();
      if (opts.jobFails) return { state: "failed" as const, error: "Research job failed: provider error" };
      return { state: "done" as const, text: "Example Photonics is raising a seed round (see investor page). News coverage reports a £2m target.", citations: (opts.citations ?? Object.keys(PAGES).map((url) => ({ url, title: url }))).map((c) => ({ ...c, origin: "cited" as const })), searchCalls: 3 };
    },
    async structured<T>({ schema, schemaName }: { schema: z.ZodType<T>; schemaName: string }): Promise<T | null> {
      bump();
      if (schemaName === "research_extraction") return schema.parse(extraction);
      if (schemaName === "company_assessment") return schema.parse(assessment);
      if (schemaName === "home_stories") return schema.parse({ stories: [{ storyType: "access", companyName: "Example Photonics", headline: "Example Photonics: route verified", teaser: "Investor page live.", priority: 90, sourceUrl: null }] });
      return null;
    },
  };
}

const goodAssessment = (): AssessmentOutput =>
  assessmentSchema.parse({
    aiPriority: "high",
    aiScore: 7.4,
    confidence: "medium",
    summary: "Credible early-stage photonics play with a live route.",
    whyInterested: ["Live application route."],
    risks: ["Clinical validation early."],
    bullCase: "Bull.",
    bearCase: "Bear.",
    whyNow: "Round open now.",
    nextAction: "Request the deck.",
    breakdown: [
      { key: "team", label: "Team", score: 7, note: "ok", sourceUrls: [] },
      { key: "product", label: "Product", score: 7, note: "ok", sourceUrls: [] },
      { key: "traction", label: "Traction", score: 5, note: "ok", sourceUrls: [] },
      { key: "market", label: "Market", score: 8, note: "ok", sourceUrls: [] },
      { key: "valuation", label: "Valuation", score: 6, note: "pre-money stated", sourceUrls: [] },
      { key: "access", label: "Access", score: 9, note: "verified", sourceUrls: [] },
    ],
    changeExplanation: null,
  });

// ---------------------------------------------------------------------------
describe("evidence rules", () => {
  it("drops claims whose only sources failed verification and never upgrades access", () => {
    const verified = new Set(["https://example-company.test/", "https://example-company.test/investors", "https://news.example.test/example-photonics-seed"]);
    const { candidate: c, removed } = sanitiseCandidate(candidate(), verified);
    expect(c.round?.reportedCommitted?.amount).toBeNull(); // source missing → amount dropped
    expect(c.round?.preMoney?.amount).toBe(9_000_000); // sourced → kept
    expect(c.facts).toHaveLength(0); // unsourced fact removed
    expect(c.eis.status).toBe("company_claimed"); // documented claim without evidence downgraded
    expect(c.access.status).toBe("verified_open"); // sourced route kept
    expect(removed.join("\n")).toMatch(/committed/);
  });

  it("downgrades a verified_open claim with no verified route", () => {
    const { candidate: c } = sanitiseCandidate(candidate(), new Set(["https://news.example.test/example-photonics-seed"]));
    expect(c.access.status).toBe("contactable");
    expect(c.founders).toHaveLength(0);
  });
});

describe("assessment rules", () => {
  it("refuses a score with fewer than two verified sources and leaves valuation unrated when undisclosed", () => {
    const c = candidate({ round: null });
    const out = enforceAssessmentRules(goodAssessment(), c, 1);
    expect(out.aiScore).toBeNull();
    expect(out.aiPriority).toBe("insufficient_evidence");
    expect(out.breakdown.find((d) => d.key === "valuation")?.score).toBeNull();
  });
  it("caps the access dimension without a live route", () => {
    const c = candidate({ access: { ...candidate().access, status: "fundraising_reported" } });
    const out = enforceAssessmentRules(goodAssessment(), c, 3);
    expect(out.breakdown.find((d) => d.key === "access")?.score).toBe(6);
    expect(out.aiScore).toBe(7.4);
  });
});

describe("entity resolution", () => {
  const known = [{ id: "k1", name: "Example Photonics", slug: "example-photonics", domain: "example-company.test", legalName: null, aliases: [] }];
  it("matches on canonical domain", () => {
    expect(resolveCandidate({ name: "Example Photonics Ltd", website: "https://www.example-company.test/about" }, known, new Set())).toMatchObject({ kind: "existing", companyId: "k1" });
  });
  it("never merges a different company that shares a name but not a domain", () => {
    const r = resolveCandidate({ name: "Example Photonics", website: "https://other-example.test" }, known, new Set());
    expect(r.kind).toBe("ambiguous");
  });
  it("flags similar names for review instead of merging", () => {
    const r = resolveCandidate({ name: "Example Robotics", website: null }, known, new Set());
    expect(r.kind).toBe("ambiguous");
  });
  it("creates a unique slug for genuinely new companies", () => {
    const r = resolveCandidate({ name: "Quillon Verify", website: "https://quillon.test" }, known, new Set(["quillon-verify"]));
    expect(r).toEqual({ kind: "new", slug: "quillon-verify-2" });
  });
});

describe("materiality", () => {
  it("notifies on first discovery and on access changes, not on routine re-checks", () => {
    const c = candidate();
    const first = classifyChanges(c, null);
    expect(first.map((x) => x.notify)).toContain("new_company");
    const unchanged = classifyChanges({ ...c, signals: [] }, { accessStatus: "verified_open", claimedRoundStatus: "open", preMoney: 9_000_000, targetAmount: 2_000_000, lastSignalHeadlines: ["Seed round opened"] });
    expect(unchanged).toHaveLength(0);
    const closed = classifyChanges({ ...c, signals: [], access: { ...c.access, status: "closed" } }, { accessStatus: "verified_open", claimedRoundStatus: "open", preMoney: 9_000_000, targetAmount: 2_000_000, lastSignalHeadlines: [] });
    expect(closed[0]).toMatchObject({ notify: "round_closed", materiality: "high" });
  });
});

describe("end-to-end pipeline with fixtures", () => {
  const extraction = (): Extraction =>
    extractionSchema.parse({
      candidates: [candidate()],
      events: [{ name: "Bristol Founders Night", organiser: "Example Angels", eventType: "Pitch night", startAtIso: "2026-11-05T18:00:00Z", endAtIso: null, venue: "Engine Shed", city: "Bristol", isOnline: false, registrationUrl: "https://example-company.test/", accessStatus: "open", audienceFit: "Angels", significance: "Two tracked companies pitching.", nextAction: "Register", sourceUrls: ["https://example-company.test/"], evidenceStatus: "official_company_claim" }],
      executiveFindings: ["One new company with a live route."],
    });

  it("publishes a sourced company, verifies citations, records changes and notifies once", async () => {
    const store = new MemoryResearchStore();
    const model = fakeModel(extraction(), goodAssessment());
    const result = await runPipeline({ model, fetcher, store, now: new Date("2026-10-19T06:00:00Z") }, { householdId: "h1", runKind: "scheduled", triggeredBy: null });
    expect(result.status).toBe("published");
    expect(result.publishedCount).toBe(1);
    expect(result.sourceCount).toBe(3);
    expect(store.companies[0].candidate.round?.reportedCommitted?.amount).toBeNull();
    expect(store.companies[0].assessment?.aiScore).toBe(7.4);
    expect(store.reviews.some((r) => r.kind === "dropped_claims")).toBe(true);
    expect(store.events).toHaveLength(1);
    expect(store.stories.length).toBeGreaterThan(0);
    const newCompanyNotes = store.notifications.filter((n) => n.type === "new_company");
    expect(newCompanyNotes).toHaveLength(3); // one per member
    expect(store.runs[0]).toMatchObject({ status: "published", estimatedCostUsd: expect.any(Number) });
    expect(homeStorySchema.safeParse({ stories: [] }).success).toBe(true);
    // Live progress walks every step in order for the UI tracker.
    expect([...new Set(store.progressLog.map((p) => p.stage))]).toEqual(["searching", "verifying", "reading", "assessing", "publishing"]);
  });

  it("allows repeat manual runs on the same day while scheduled runs stay once per day", async () => {
    const store = new MemoryResearchStore();
    const now = new Date("2026-10-19T09:00:00Z");
    const a = await runPipeline({ model: fakeModel(extraction(), goodAssessment()), fetcher, store, now }, { householdId: "h1", runKind: "manual", triggeredBy: "u1" });
    const b = await runPipeline({ model: fakeModel(extraction(), goodAssessment()), fetcher, store, now }, { householdId: "h1", runKind: "manual", triggeredBy: "u1" });
    expect(a.runId).not.toBeNull();
    expect(b.runId).not.toBeNull();
    expect(b.status).not.toBe("skipped");
  });

  it("is idempotent for the same London day and skips unchanged companies on re-run", async () => {
    const store = new MemoryResearchStore();
    const model = fakeModel(extraction(), goodAssessment());
    const first = await runPipeline({ model, fetcher, store, now: new Date("2026-10-19T06:00:00Z") }, { householdId: "h1", runKind: "scheduled", triggeredBy: null });
    expect(first.status).toBe("published");
    const again = await runPipeline({ model, fetcher, store, now: new Date("2026-10-19T07:00:00Z") }, { householdId: "h1", runKind: "scheduled", triggeredBy: null });
    expect(again.status).toBe("skipped");
    expect(store.runs).toHaveLength(1);

    // Next day, identical sources and no new signals → nothing re-published, no duplicate notifications.
    const unchangedExtraction = extraction();
    unchangedExtraction.candidates[0].signals = [];
    const nextDay = await runPipeline({ model: fakeModel(unchangedExtraction, goodAssessment()), fetcher, store, now: new Date("2026-10-20T06:00:00Z") }, { householdId: "h1", runKind: "scheduled", triggeredBy: null });
    expect(nextDay.status).toBe("no_new_research");
    expect(store.companies).toHaveLength(1);
    expect(store.notifications.filter((n) => n.type === "new_company")).toHaveLength(3);
  });

  it("starts research as a background job and publishes only once it has finished", async () => {
    const store = new MemoryResearchStore();
    const model = fakeModel(extraction(), goodAssessment(), { pendingChecks: 2 });
    const deps = { model, fetcher, store, now: new Date("2026-10-19T06:00:00Z") };
    const begun = await beginPipeline(deps, { householdId: "h1", runKind: "scheduled", triggeredBy: null });
    expect(begun.status).toBe("running");
    expect(store.runs[0]).toMatchObject({ status: "running", phase: "discovering", responseHandle: "job-1" });
    expect((await advancePipeline(deps, begun.runId!)).status).toBe("running");
    expect((await advancePipeline(deps, begun.runId!)).status).toBe("running");
    expect(store.companies).toHaveLength(0);
    const done = await advancePipeline(deps, begun.runId!);
    expect(done.status).toBe("published");
    expect(store.companies).toHaveLength(1);
    // Advancing a finished run just reports it again; nothing is re-processed.
    const again = await advancePipeline(deps, begun.runId!);
    expect(again).toMatchObject({ status: "published", publishedCount: 1 });
    expect(store.companies).toHaveLength(1);
  });

  it("lets only one caller process a finished research job", async () => {
    const store = new MemoryResearchStore();
    const model = fakeModel(extraction(), goodAssessment());
    const deps = { model, fetcher, store, now: new Date("2026-10-19T06:00:00Z") };
    const begun = await beginPipeline(deps, { householdId: "h1", runKind: "manual", triggeredBy: "u1" });
    const [a, b] = await Promise.all([advancePipeline(deps, begun.runId!), advancePipeline(deps, begun.runId!)]);
    expect([a.status, b.status].sort()).toEqual(["published", "running"]);
    expect(store.companies).toHaveLength(1);
    expect(store.notifications.filter((n) => n.type === "new_company")).toHaveLength(3);
  });

  it("records a failed research job as a failed run and tells the family", async () => {
    const store = new MemoryResearchStore();
    const model = fakeModel(extraction(), goodAssessment(), { jobFails: true });
    const result = await runPipeline({ model, fetcher, store, now: new Date("2026-10-19T06:00:00Z") }, { householdId: "h1", runKind: "manual", triggeredBy: "u1" });
    expect(result).toMatchObject({ status: "failed", errorSummary: "Research job failed: provider error" });
    expect(store.notifications.some((n) => n.type === "research_failed")).toBe(true);
  });

  it("a first-fill run searches deeper and allows up to 8 new companies; daily runs keep the default", async () => {
    const store = new MemoryResearchStore();
    let brief = "";
    const model = fakeModel(extraction(), goodAssessment());
    const start = model.startResearch.bind(model);
    model.startResearch = async (args) => ((brief = args.input), start(args));
    const deps = { model, fetcher, store, now: new Date("2026-10-19T06:00:00Z") };
    const first = await beginPipeline(deps, { householdId: "h1", runKind: "manual", triggeredBy: null, firstFill: true });
    expect(store.runs.find((r) => r.id === first.runId)?.newCompanyLimit).toBe(8);
    expect(brief).toMatch(/up to 8 genuinely new/);
    expect(brief).toMatch(/first research run/);
    const daily = await beginPipeline(deps, { householdId: "h1", runKind: "scheduled", triggeredBy: null });
    expect(store.runs.find((r) => r.id === daily.runId)?.newCompanyLimit).toBeNull();
    expect(brief).not.toMatch(/first research run/);
  });

  it("skips a company that fails to save, logs why, and still publishes the others", async () => {
    const store = new MemoryResearchStore();
    const two = extraction();
    two.candidates.push({ ...two.candidates[0], name: "Second Photonics", website: "https://second-photonics.test" });
    const publish = store.publishCompany.bind(store);
    store.publishCompany = async (input) => {
      if (input.candidate.name === "Example Photonics") throw new Error('invalid input syntax for type date: "2024-11"');
      return publish(input);
    };
    const result = await runPipeline({ model: fakeModel(two, goodAssessment()), fetcher, store, now: new Date("2026-10-19T06:00:00Z") }, { householdId: "h1", runKind: "manual", triggeredBy: "u1" });
    expect(result.status).toBe("published");
    expect(store.companies.map((c) => c.candidate.name)).toEqual(["Second Photonics"]);
    expect(store.reviews.some((r) => r.kind === "rejected_candidate" && JSON.stringify(r.detail).includes("could not be saved"))).toBe(true);
    expect(result.summary).toMatch(/Skipped: Example Photonics/);
  });

  it("publishes imported (hand-researched) companies through the same verification, at no provider cost", async () => {
    const store = new MemoryResearchStore();
    const ex = extraction();
    const model = new ImportedResearchModel({ writeUp: "Hand-researched first set.", companies: ex.candidates.map((candidate) => ({ candidate, assessment: { ...goodAssessment(), aiScore: 9.6 } })), events: ex.events, executiveFindings: ["One"] }, "claude chat research");
    const deps = { model, fetcher, store, now: new Date("2026-10-21T09:00:00Z") };
    const runRecord = await store.startRun({ householdId: "h1", localDate: "2026-10-21", runKind: "manual", promptVersionId: "pv-1", model: model.name, newCompanyLimit: 12 });
    await store.setDiscovery(runRecord!.id, "import:abc");
    const result = await advancePipeline(deps, runRecord!.id);
    expect(result.status).toBe("published");
    expect(result.estimatedCostUsd).toBe(0);
    expect(store.companies).toHaveLength(1);
    // The unverifiable fact (missing page) is stripped exactly as for provider research.
    expect(store.reviews.some((r) => r.kind === "dropped_claims")).toBe(true);
    // Hard assessment rules still apply to an imported assessment (valuation unrated without terms is enforced elsewhere; score kept only with >=2 verified sources).
    expect(store.companies[0].assessment?.aiScore).toBe(9.6);
  });

  it("publishes nothing when the provider returns no citations", async () => {
    const store = new MemoryResearchStore();
    const model = fakeModel(extraction(), goodAssessment(), { citations: [] });
    const result = await runPipeline({ model, fetcher, store, now: new Date("2026-10-19T06:00:00Z") }, { householdId: "h1", runKind: "scheduled", triggeredBy: null });
    expect(result.status).toBe("no_new_research");
    expect(store.companies).toHaveLength(0);
  });

  it("publishes nothing when every cited page fails verification", async () => {
    const store = new MemoryResearchStore();
    const model = fakeModel(extraction(), goodAssessment(), { citations: [{ url: "https://nowhere.example.test/missing", title: "missing" }] });
    const result = await runPipeline({ model, fetcher, store, now: new Date("2026-10-19T06:00:00Z") }, { householdId: "h1", runKind: "scheduled", triggeredBy: null });
    expect(result.status).toBe("no_new_research");
    expect(store.companies).toHaveLength(0);
  });

  it("stops and records a failure when the daily budget is exceeded", async () => {
    const store = new MemoryResearchStore();
    store.preferences = { ...store.preferences, dailyBudgetUsd: 0.015 };
    const model = fakeModel(extraction(), goodAssessment(), { costPerCall: 0.01 });
    const result = await runPipeline({ model, fetcher, store, now: new Date("2026-10-19T06:00:00Z") }, { householdId: "h1", runKind: "manual", triggeredBy: "user-a" });
    expect(result.status).toBe("failed");
    expect(result.errorSummary).toMatch(/budget/);
    expect(store.notifications.some((n) => n.type === "research_failed")).toBe(true);
  });

  it("does not merge a similarly named company; logs it for review", async () => {
    const store = new MemoryResearchStore();
    store.known = [{ id: "k1", name: "Example Robotics", slug: "example-robotics", domain: null, legalName: null, aliases: [] }];
    const ex = extraction();
    ex.candidates[0].website = null;
    const model = fakeModel(ex, goodAssessment());
    const result = await runPipeline({ model, fetcher, store, now: new Date("2026-10-19T06:00:00Z") }, { householdId: "h1", runKind: "scheduled", triggeredBy: null });
    expect(store.reviews.some((r) => r.kind === "ambiguous_entity")).toBe(true);
    expect(store.companies).toHaveLength(0);
    expect(result.status).toBe("no_new_research");
  });
});
