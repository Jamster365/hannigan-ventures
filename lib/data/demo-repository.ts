import { DEFAULT_MEMBER_PREFERENCES, type MemberPreferences } from "@/lib/domain/learning";
import { safeDocumentName, type Deal, type DealCheck, type DealCheckStatus, type DealDecision, type DealDocument } from "@/lib/domain/deal";
import { almostMatch, applyVote, computeFamilyStage } from "@/lib/domain/family-consensus";
import type {
  DealLead,
  AuditEvent,
  Comment,
  CompanyBundle,
  Notification,
  PromptSuggestion,
  PromptVersion,
  ResearchFeedback,
} from "@/lib/domain/types";
import { RESEARCH_AUTHOR_ID } from "@/lib/domain/types";
import { DEMO_AUDIT, DEMO_COMPANIES, DEMO_EVENTS, DEMO_NETWORKS, DEMO_NOTIFICATIONS, DEMO_STORIES } from "@/lib/demo/dataset";
import { DEMO_MEMBERS } from "@/lib/demo/members";
import { DEMO_FEEDBACK, DEMO_PROMPT_VERSIONS, DEMO_RUNS, DEMO_SUGGESTIONS } from "@/lib/demo/research";
import { applyPatch } from "@/lib/research/patch";
import type { Repository } from "./repository";

/**
 * In-memory repository over the labelled demo dataset. State lives for the
 * lifetime of the server process so that voting, commenting and prompt edits
 * can be exercised end-to-end without Supabase. The UI shows a persistent
 * "Demo mode" banner so nobody mistakes this for persistence.
 */
class DemoRepository implements Repository {
  readonly mode = "demo" as const;
  private companies: CompanyBundle[] = structuredClone(DEMO_COMPANIES);
  private notifications: Notification[] = structuredClone(DEMO_NOTIFICATIONS);
  private prompts: PromptVersion[] = structuredClone(DEMO_PROMPT_VERSIONS);
  private suggestions: PromptSuggestion[] = structuredClone(DEMO_SUGGESTIONS);
  private feedback: ResearchFeedback[] = structuredClone(DEMO_FEEDBACK);
  private audit: AuditEvent[] = structuredClone(DEMO_AUDIT);
  private seq = 1000;

  private nextId(prefix: string) {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  private record(action: string, objectType: string, objectId: string, actorId: string | null, before?: unknown, after?: unknown) {
    this.audit.unshift({ id: this.nextId("au"), actorType: actorId ? "member" : "system", actorId, action, objectType, objectId, before, after, createdAt: new Date().toISOString() });
  }

  private pushNotification(recipients: string[], n: Omit<Notification, "id" | "recipientUserId" | "readAt" | "createdAt" | "dedupeKey"> & { dedupe: string }) {
    for (const r of recipients) {
      const dedupeKey = `${n.dedupe}:${r}`;
      if (this.notifications.some((x) => x.dedupeKey === dedupeKey)) continue;
      this.notifications.unshift({
        id: this.nextId("n"),
        recipientUserId: r,
        notificationType: n.notificationType,
        companyId: n.companyId,
        updateId: n.updateId,
        commentId: n.commentId,
        title: n.title,
        body: n.body,
        importance: n.importance,
        href: n.href,
        readAt: null,
        createdAt: new Date().toISOString(),
        dedupeKey,
      });
    }
  }

  async getMembers() {
    return DEMO_MEMBERS;
  }

  async listCompanies() {
    return this.companies;
  }
  async getCompanyBySlug(slug: string) {
    return this.companies.find((c) => c.company.slug === slug) ?? null;
  }
  async getCompanyById(id: string) {
    return this.companies.find((c) => c.company.id === id) ?? null;
  }

  async listHomeStories() {
    const now = Date.now();
    return DEMO_STORIES.filter((s) => !s.expiresAt || new Date(s.expiresAt).getTime() > now).sort((a, b) => b.priority - a.priority);
  }

  async listNotifications(userId: string) {
    return this.notifications.filter((n) => n.recipientUserId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async markNotificationsRead(userId: string, ids?: string[]) {
    const now = new Date().toISOString();
    for (const n of this.notifications) {
      if (n.recipientUserId === userId && !n.readAt && (!ids || ids.includes(n.id))) n.readAt = now;
    }
  }

  async listEvents() {
    return [...DEMO_EVENTS].sort((a, b) => a.startAt.localeCompare(b.startAt));
  }
  async listNetworks() {
    return DEMO_NETWORKS;
  }

  async listVotes(companyId: string) {
    return structuredClone(this.companies.find((c) => c.company.id === companyId)?.votes ?? []);
  }

  async setVote({ userId, companyId, vote, score }: { userId: string; companyId: string; vote: import("@/lib/domain/types").VoteValue | null; score?: number | null }) {
    const bundle = this.companies.find((c) => c.company.id === companyId);
    if (!bundle) throw new Error("Company not found");
    const before = bundle.votes.find((v) => v.userId === userId);
    const { votes, transition } = applyVote(bundle.votes, { userId, vote, score }, DEMO_MEMBERS.length);
    bundle.votes = votes.map((v) => ({ ...v, companyId }));
    this.record("vote.set", "company", companyId, userId, before ?? null, bundle.votes.find((v) => v.userId === userId) ?? null);
    const others = DEMO_MEMBERS.filter((m) => m.userId !== userId).map((m) => m.userId);
    const actor = DEMO_MEMBERS.find((m) => m.userId === userId)?.displayName ?? "A member";
    const now = new Date().toISOString();
    const tickers = bundle.votes.filter((v) => v.vote === "interested").map((v) => DEMO_MEMBERS.find((m) => m.userId === v.userId)?.displayName ?? "A member").join(" and ");
    if (transition.promoted) {
      bundle.updates.unshift({ id: this.nextId("u"), companyId, updateType: "family", headline: "It's a match", summary: `${tickers} are interested in ${bundle.company.name}.`, materiality: "medium", sourceId: null, runId: null, effectiveAt: now, detectedAt: now });
      if (!bundle.comments.some((c) => c.authorUserId === RESEARCH_AUTHOR_ID)) {
        const latest = bundle.assessment?.summary;
        const opener = `I'm Research, the family's AI analyst. I'll post here whenever something changes for ${bundle.company.name}: the round, the team, risks or how to invest.${latest ? `\n\nWhere things stand: ${latest.slice(0, 700)}` : ""}`;
        bundle.comments.push({ id: this.nextId("c"), companyId, authorUserId: RESEARCH_AUTHOR_ID, body: opener, createdAt: now, editedAt: null, deletedAt: null, likedBy: [] });
      }
      this.pushNotification(others, { notificationType: "shortlist_promoted", companyId, updateId: null, commentId: null, title: `It's a match: ${bundle.company.name}`, body: `${tickers} are interested in ${bundle.company.name}. The chat is open.`, importance: "high", href: `/matches/${bundle.company.slug}`, dedupe: `promote:${companyId}:${now}` });
    } else if (transition.demoted) {
      // The chat has closed: unread match and chat notifications would point at nothing.
      for (const n of this.notifications) {
        if (n.companyId === companyId && !n.readAt && (n.notificationType === "shortlist_promoted" || n.notificationType === "comment")) n.readAt = now;
      }
      bundle.updates.unshift({ id: this.nextId("u"), companyId, updateType: "family", headline: "No longer a match", summary: `${actor} changed their mind.`, materiality: "medium", sourceId: null, runId: null, effectiveAt: now, detectedAt: now });
      this.pushNotification(others, { notificationType: "shortlist_demoted", companyId, updateId: null, commentId: null, title: `${bundle.company.name} is no longer a match`, body: `${actor} changed their mind.`, importance: "high", href: "/matches", dedupe: `demote:${companyId}:${now}` });
    }
    // Votes stay private until a match, so changed views are not announced.
    return { transition };
  }

  async almostMatch({ userId, companyId }: { userId: string; companyId: string }) {
    const bundle = this.companies.find((c) => c.company.id === companyId);
    return bundle ? almostMatch(bundle.votes, DEMO_MEMBERS, userId) !== null : false;
  }

  async setVoteNote({ userId, companyId, note }: { userId: string; companyId: string; note: string | null }) {
    const v = this.companies.find((c) => c.company.id === companyId)?.votes.find((x) => x.userId === userId);
    if (v) v.note = note ?? undefined;
  }

  private prefs = new Map<string, MemberPreferences>();
  private deals = new Map<string, Deal>();
  private leads: DealLead[] = [];

  async listLeads(): Promise<DealLead[]> {
    return structuredClone(this.leads);
  }

  async addLead(input: { userId: string; name: string; website: string | null; source: string; notes: string }): Promise<DealLead> {
    const lead: DealLead = { id: this.nextId("lead"), name: input.name, website: input.website, source: input.source, notes: input.notes, status: "new", companyId: null, addedBy: input.userId, createdAt: new Date().toISOString() };
    this.leads.unshift(lead);
    return structuredClone(lead);
  }

  async setLeadStatus({ leadId, status }: { userId: string; leadId: string; status: DealLead["status"] }): Promise<void> {
    const l = this.leads.find((x) => x.id === leadId);
    if (l) l.status = status;
  }

  private dealOf(companyId: string): Deal {
    let d = this.deals.get(companyId);
    if (!d) this.deals.set(companyId, (d = { checks: [], documents: [], decision: null }));
    return d;
  }

  async getDeal(companyId: string): Promise<Deal> {
    return structuredClone(this.dealOf(companyId));
  }

  async listDeals(): Promise<Record<string, Deal>> {
    return Object.fromEntries([...this.deals.entries()].map(([k, v]) => [k, structuredClone(v)]));
  }

  async setDealCheck({ userId, companyId, key, status, note, label }: { userId: string; companyId: string; key: string; status: DealCheckStatus; note?: string; label?: string }): Promise<DealCheck> {
    const deal = this.dealOf(companyId);
    const existing = deal.checks.find((c) => c.key === key);
    const next: DealCheck = { companyId, key, status, note: note ?? existing?.note ?? "", label: label ?? existing?.label, updatedBy: userId, updatedAt: new Date().toISOString() };
    if (existing) Object.assign(existing, next);
    else deal.checks.push(next);
    return structuredClone(next);
  }

  async saveDealDecision({ userId, companyId, decision }: { userId: string; companyId: string; decision: Omit<DealDecision, "companyId" | "updatedBy" | "updatedAt"> }): Promise<DealDecision> {
    const deal = this.dealOf(companyId);
    deal.decision = { ...decision, companyId, updatedBy: userId, updatedAt: new Date().toISOString() };
    return structuredClone(deal.decision);
  }

  async addDealDocument({ userId, companyId, name, mime, bytes }: { userId: string; companyId: string; name: string; mime: string; bytes: Uint8Array }): Promise<DealDocument> {
    const deal = this.dealOf(companyId);
    const doc: DealDocument = { id: this.nextId("doc"), companyId, name: safeDocumentName(name), mime, sizeBytes: bytes.byteLength, uploadedBy: userId, createdAt: new Date().toISOString(), url: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}` };
    deal.documents.unshift(doc);
    return structuredClone(doc);
  }

  async removeDealDocument({ companyId, documentId }: { userId: string; companyId: string; documentId: string }): Promise<void> {
    const deal = this.dealOf(companyId);
    deal.documents = deal.documents.filter((d) => d.id !== documentId);
  }

  async getPreferences(userId: string): Promise<MemberPreferences> {
    return { ...DEFAULT_MEMBER_PREFERENCES, ...(this.prefs.get(userId) ?? {}) };
  }

  async savePreferences({ userId, prefs }: { userId: string; prefs: MemberPreferences }) {
    this.prefs.set(userId, prefs);
  }

  async recordMemberRoundCheck({ userId, companyId, open, details }: { userId: string; companyId: string; open: boolean; details?: string }) {
    const bundle = this.companies.find((c) => c.company.id === companyId);
    if (!bundle) throw new Error("Company not found");
    const last = [...bundle.accessChecks].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
    const now = new Date();
    const name = DEMO_MEMBERS.find((m) => m.userId === userId)?.displayName ?? "A member";
    bundle.accessChecks.push({
      id: this.nextId("ac"),
      companyId,
      accessStatus: open ? "verified_open" : "closed",
      routeType: last?.routeType && last.routeType !== "none" ? last.routeType : "platform",
      contactOrUrl: last?.contactOrUrl ?? null,
      minCheque: last?.minCheque ?? null,
      maxCheque: last?.maxCheque ?? null,
      currency: last?.currency ?? null,
      checkedAt: now.toISOString(),
      expiresAt: open ? new Date(now.getTime() + 48 * 3600_000).toISOString() : null,
      verifier: `member:${userId}`,
      sourceId: null,
      notes: `${name} checked the page: ${open ? "the round is live" : "the round has closed"}.${details ? ` ${details.trim()}` : ""}`,
    });
  }

  async addComment({ userId, companyId, body }: { userId: string; companyId: string; body: string }) {
    const bundle = this.companies.find((c) => c.company.id === companyId);
    if (!bundle) throw new Error("Company not found");
    const comment: Comment = { id: this.nextId("c"), companyId, authorUserId: userId, body, createdAt: new Date().toISOString(), editedAt: null, deletedAt: null, likedBy: [] };
    bundle.comments.push(comment);
    const actor = DEMO_MEMBERS.find((m) => m.userId === userId)?.displayName ?? "A member";
    const others = DEMO_MEMBERS.filter((m) => m.userId !== userId).map((m) => m.userId);
    this.pushNotification(others, { notificationType: "comment", companyId, updateId: null, commentId: comment.id, title: `${actor} · ${bundle.company.name}`, body: `${body.slice(0, 140)}${body.length > 140 ? "…" : ""}`, importance: "normal", href: computeFamilyStage(bundle.votes, DEMO_MEMBERS.length) === "shortlisted" ? `/matches/${bundle.company.slug}` : `/companies/${bundle.company.slug}?tab=family`, dedupe: `comment:${comment.id}` });
    return comment;
  }
  async editComment({ userId, commentId, body }: { userId: string; commentId: string; body: string }) {
    for (const b of this.companies) {
      const c = b.comments.find((x) => x.id === commentId);
      if (c) {
        if (c.authorUserId !== userId) throw new Error("You can only edit your own comments");
        c.body = body;
        c.editedAt = new Date().toISOString();
        return c;
      }
    }
    throw new Error("Comment not found");
  }
  async deleteComment({ userId, commentId }: { userId: string; commentId: string }) {
    for (const b of this.companies) {
      const c = b.comments.find((x) => x.id === commentId);
      if (c) {
        if (c.authorUserId !== userId) throw new Error("You can only delete your own comments");
        c.deletedAt = new Date().toISOString();
        return;
      }
    }
    throw new Error("Comment not found");
  }
  async toggleBookmark({ userId, companyId }: { userId: string; companyId: string }) {
    const bundle = this.companies.find((c) => c.company.id === companyId);
    if (!bundle) throw new Error("Company not found");
    if (bundle.bookmarkedBy.includes(userId)) {
      bundle.bookmarkedBy = bundle.bookmarkedBy.filter((u) => u !== userId);
      return { bookmarked: false };
    }
    bundle.bookmarkedBy.push(userId);
    return { bookmarked: true };
  }

  async listPromptVersions() {
    return [...this.prompts].sort((a, b) => b.version - a.version);
  }
  async getActivePrompt() {
    const active = this.prompts.find((p) => p.active);
    if (!active) throw new Error("No active prompt");
    return active;
  }
  async savePromptVersion({ userId, promptText, config, changeNote, basedOnVersionId }: Parameters<Repository["savePromptVersion"]>[0]) {
    const active = await this.getActivePrompt();
    if (active.id !== basedOnVersionId) return { ok: false as const, conflict: active };
    const version: PromptVersion = {
      id: this.nextId("pv"),
      version: Math.max(...this.prompts.map((p) => p.version)) + 1,
      promptText,
      config,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      active: true,
      changeNote,
      parentVersionId: active.id,
    };
    for (const p of this.prompts) p.active = false;
    this.prompts.push(version);
    this.record("prompt.activate", "research_prompt", version.id, userId, { version: active.version }, { version: version.version });
    return { ok: true as const, version };
  }
  async restorePromptVersion({ userId, versionId }: { userId: string; versionId: string }) {
    const source = this.prompts.find((p) => p.id === versionId);
    if (!source) throw new Error("Version not found");
    const active = await this.getActivePrompt();
    const res = await this.savePromptVersion({ userId, promptText: source.promptText, config: source.config, changeNote: `Restored v${source.version}.`, basedOnVersionId: active.id });
    if (!res.ok) throw new Error("Conflict while restoring");
    return res.version;
  }

  async listSuggestions() {
    return [...this.suggestions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async createFeedback(input: Omit<ResearchFeedback, "id" | "createdAt">) {
    const fb: ResearchFeedback = { ...input, id: this.nextId("fb"), createdAt: new Date().toISOString() };
    this.feedback.push(fb);
    return fb;
  }
  async createSuggestion(input: Omit<PromptSuggestion, "id" | "createdAt" | "status" | "approvedBy" | "appliedVersionId">) {
    const s: PromptSuggestion = { ...input, id: this.nextId("sg"), status: "proposed", approvedBy: null, appliedVersionId: null, createdAt: new Date().toISOString() };
    this.suggestions.unshift(s);
    return s;
  }
  async applySuggestion({ userId, suggestionId }: { userId: string; suggestionId: string }) {
    const s = this.suggestions.find((x) => x.id === suggestionId);
    if (!s || s.status !== "proposed") return { ok: false as const, reason: "Suggestion is no longer open." };
    const active = await this.getActivePrompt();
    if (s.suggestedText && s.basePromptVersionId !== active.id) return { ok: false as const, reason: "The instructions changed after this was drafted. Dismiss it and draft a fresh one." };
    const patched = s.suggestedText ?? applyPatch(active.promptText, s.suggestedPatch);
    if (patched === null) return { ok: false as const, reason: "The suggestion no longer matches the current instructions. Dismiss it and ask for a fresh proposal." };
    const res = await this.savePromptVersion({ userId, promptText: patched, config: active.config, changeNote: `Applied suggestion: ${s.rationale.slice(0, 80)}`, basedOnVersionId: active.id });
    if (!res.ok) return { ok: false as const, reason: "Instructions changed while applying." };
    s.status = "applied";
    s.approvedBy = userId;
    s.appliedVersionId = res.version.id;
    return { ok: true as const, version: res.version };
  }
  async dismissSuggestion({ userId, suggestionId }: { userId: string; suggestionId: string }) {
    const s = this.suggestions.find((x) => x.id === suggestionId);
    if (!s) return;
    s.status = "dismissed";
    s.approvedBy = userId;
    this.record("suggestion.dismiss", "prompt_suggestion", s.id, userId);
  }

  async listRuns() {
    return [...DEMO_RUNS].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  async listAuditEvents(limit = 50) {
    return this.audit.slice(0, limit);
  }

  /** Test helper: family stage of a company by id. */
  stageOf(companyId: string) {
    const b = this.companies.find((c) => c.company.id === companyId);
    return b ? computeFamilyStage(b.votes) : null;
  }
}

declare global {
  var __dealRoomDemoRepo: DemoRepository | undefined;
}

/** Singleton per server process (survives HMR in dev). */
export function getDemoRepository(): DemoRepository {
  if (!globalThis.__dealRoomDemoRepo) globalThis.__dealRoomDemoRepo = new DemoRepository();
  return globalThis.__dealRoomDemoRepo;
}

export function createDemoRepository(): DemoRepository {
  return new DemoRepository();
}

export type { DemoRepository };
