import type { NotificationType, ResearchPreferences } from "@/lib/domain/types";
import { DEFAULT_PREFERENCES, DEFAULT_RESEARCH_PROMPT } from "./default-prompt";
import type { MaterialChange, PreviousState } from "./materiality";
import type { KnownCompany } from "./resolve";
import type { AssessmentOutput, Candidate } from "./schemas";
import type { PublishedCompany, ResearchStore, RunConfig, RunRecord, RunStage, StoredRun } from "./store";
import type { VerifiedSource } from "./verify";
import type { FoundImage } from "./imagery";

/**
 * In-memory ResearchStore for tests and dry runs. Mirrors the uniqueness rules
 * of the database (one scheduled/recheck run per household/date, one source per URL,
 * one notification per recipient/dedupe key).
 */
export class MemoryResearchStore implements ResearchStore {
  runs: StoredRun[] = [];
  progressLog: { runId: string; stage: RunStage; detail: string }[] = [];
  imagery: { companyId: string; kind: "hero" | "logo"; originUrl: string }[] = [];
  sources = new Map<string, { id: string; companyId: string | null; url: string; hash: string | null }>();
  companies: { id: string; slug: string; name: string; candidate: Candidate; assessment: AssessmentOutput | null; runId: string }[] = [];
  updates: { companyId: string; change: MaterialChange }[] = [];
  notifications: { recipient: string; type: NotificationType; dedupeKey: string; title: string }[] = [];
  stories: { headline: string; companyId: string | null }[] = [];
  events: { name: string; startAt: string }[] = [];
  reviews: { kind: string; detail: unknown }[] = [];
  audits: { action: string; objectId: string }[] = [];
  known: KnownCompany[] = [];
  memberIds = ["user-a", "user-b", "user-c"];
  preferences: ResearchPreferences = { ...DEFAULT_PREFERENCES };
  promptText = DEFAULT_RESEARCH_PROMPT;
  seenHashes = new Set<string>();
  private seq = 0;
  private id(prefix: string) {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  async loadConfig(householdId: string): Promise<RunConfig> {
    return { householdId, promptVersionId: "pv-1", promptText: this.promptText, preferences: this.preferences, known: this.known, memberIds: this.memberIds, seenHashes: new Set(this.seenHashes) };
  }
  async startRun(input: { householdId: string; localDate: string; runKind: RunRecord["runKind"]; promptVersionId: string; model: string }): Promise<RunRecord | null> {
    // Mirrors the DB: one scheduled/recheck run per day; manual runs may repeat.
    if (input.runKind !== "manual" && this.runs.some((r) => r.householdId === input.householdId && r.localDate === input.localDate && r.runKind === input.runKind)) return null;
    const run: StoredRun = { id: this.id("run"), householdId: input.householdId, localDate: input.localDate, runKind: input.runKind, status: "running", phase: null, responseHandle: null, startedAt: new Date().toISOString(), progressAt: null, summary: "", errorSummary: null, sourceCount: 0, candidatesCount: 0, publishedCount: 0, estimatedCostUsd: 0 };
    this.runs.push(run);
    return { id: run.id, localDate: run.localDate, runKind: input.runKind };
  }
  async setDiscovery(runId: string, handle: string) {
    Object.assign(this.runs.find((r) => r.id === runId)!, { phase: "discovering", responseHandle: handle });
  }
  async getRun(runId: string) {
    const run = this.runs.find((r) => r.id === runId);
    return run ? { ...run } : null;
  }
  async listActiveRuns(householdId: string) {
    return this.runs.filter((r) => r.householdId === householdId && r.status === "running").map((r) => ({ ...r }));
  }
  async claimProcessing(runId: string) {
    const run = this.runs.find((r) => r.id === runId);
    if (!run || run.phase !== "discovering") return false;
    run.phase = "processing";
    return true;
  }
  async progress(runId: string, stage: RunStage, detail: string) {
    this.progressLog.push({ runId, stage, detail });
  }
  async hasImagery(companyId: string) {
    return this.imagery.some((i) => i.companyId === companyId);
  }
  async saveImagery(input: { householdId: string; companyId: string; companyName: string; images: FoundImage[] }) {
    for (const img of input.images) this.imagery.push({ companyId: input.companyId, kind: img.kind, originUrl: img.originUrl });
    return input.images.length;
  }
  async finishRun(input: { runId: string; status: StoredRun["status"]; sourceCount: number; candidatesCount: number; publishedCount: number; estimatedCostUsd: number; summary: string; errorSummary: string | null }) {
    const run = this.runs.find((r) => r.id === input.runId)!;
    Object.assign(run, { status: input.status, summary: input.summary, errorSummary: input.errorSummary, sourceCount: input.sourceCount, candidatesCount: input.candidatesCount, publishedCount: input.publishedCount, estimatedCostUsd: input.estimatedCostUsd });
  }
  async upsertSources(_hid: string, companyId: string | null, sources: VerifiedSource[]) {
    const out = new Map<string, string>();
    for (const s of sources) {
      const existing = this.sources.get(s.url);
      if (existing) {
        if (companyId && !existing.companyId) existing.companyId = companyId;
        out.set(s.url, existing.id);
      } else {
        const id = this.id("src");
        this.sources.set(s.url, { id, companyId, url: s.url, hash: s.contentHash });
        out.set(s.url, id);
      }
      if (s.contentHash) this.seenHashes.add(s.contentHash);
    }
    return out;
  }
  async previousState(companyId: string): Promise<PreviousState | null> {
    const c = this.companies.find((x) => x.id === companyId);
    if (!c) return null;
    return { accessStatus: c.candidate.access.status, claimedRoundStatus: c.candidate.round?.claimedStatus ?? null, preMoney: c.candidate.round?.preMoney?.amount ?? null, targetAmount: c.candidate.round?.target?.amount ?? null, lastSignalHeadlines: this.updates.filter((u) => u.companyId === companyId).map((u) => u.change.headline) };
  }
  async publishCompany(input: Parameters<ResearchStore["publishCompany"]>[0]): Promise<PublishedCompany> {
    if (input.resolution.kind === "existing") {
      const existingId = input.resolution.companyId;
      const c = this.companies.find((x) => x.id === existingId)!;
      c.candidate = input.candidate;
      c.assessment = input.assessment;
      c.runId = input.runId;
      return { companyId: c.id, slug: c.slug, name: c.name, isNew: false };
    }
    const id = this.id("co");
    this.companies.push({ id, slug: input.resolution.slug, name: input.candidate.name, candidate: input.candidate, assessment: input.assessment, runId: input.runId });
    this.known.push({ id, name: input.candidate.name, slug: input.resolution.slug, domain: input.candidate.website, legalName: input.candidate.legalName, aliases: [] });
    return { companyId: id, slug: input.resolution.slug, name: input.candidate.name, isNew: true };
  }
  async recordChanges(input: Parameters<ResearchStore["recordChanges"]>[0]) {
    let notified = 0;
    for (const change of input.changes) {
      this.updates.push({ companyId: input.company.companyId, change });
      if (change.notify) {
        for (const m of input.memberIds) {
          const dedupeKey = `${change.notify}:${input.company.companyId}:${change.headline}`;
          if (this.notifications.some((n) => n.recipient === m && n.dedupeKey === dedupeKey)) continue;
          this.notifications.push({ recipient: m, type: change.notify, dedupeKey, title: change.headline });
          notified += 1;
        }
      }
    }
    return notified;
  }
  async publishStories(input: Parameters<ResearchStore["publishStories"]>[0]) {
    this.stories.push(...input.stories.map((s) => ({ headline: s.headline, companyId: s.companyId })));
  }
  async publishEvents(input: Parameters<ResearchStore["publishEvents"]>[0]) {
    for (const e of input.events) if (!this.events.some((x) => x.name === e.name && x.startAt === e.startAt)) this.events.push({ name: e.name, startAt: e.startAt });
  }
  async notifyMembers(input: Parameters<ResearchStore["notifyMembers"]>[0]) {
    for (const m of input.memberIds) {
      if (this.notifications.some((n) => n.recipient === m && n.dedupeKey === input.dedupeKey)) continue;
      this.notifications.push({ recipient: m, type: input.type, dedupeKey: input.dedupeKey, title: input.title });
    }
  }
  async logReview(input: { kind: string; detail: unknown }) {
    this.reviews.push({ kind: input.kind, detail: input.detail });
  }
  async audit(input: { action: string; objectId: string }) {
    this.audits.push({ action: input.action, objectId: input.objectId });
  }
}
