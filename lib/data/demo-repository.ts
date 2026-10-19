import { applyVote, computeFamilyStage } from "@/lib/domain/family-consensus";
import type {
  AuditEvent,
  Comment,
  CompanyBundle,
  Notification,
  PromptSuggestion,
  PromptVersion,
  ResearchFeedback,
} from "@/lib/domain/types";
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

  async setVote({ userId, companyId, vote, score }: { userId: string; companyId: string; vote: import("@/lib/domain/types").VoteValue | null; score?: number | null }) {
    const bundle = this.companies.find((c) => c.company.id === companyId);
    if (!bundle) throw new Error("Company not found");
    const before = bundle.votes.find((v) => v.userId === userId);
    const { votes, transition } = applyVote(bundle.votes, { userId, vote, score });
    bundle.votes = votes.map((v) => ({ ...v, companyId }));
    this.record("vote.set", "company", companyId, userId, before ?? null, bundle.votes.find((v) => v.userId === userId) ?? null);
    const others = DEMO_MEMBERS.filter((m) => m.userId !== userId).map((m) => m.userId);
    const actor = DEMO_MEMBERS.find((m) => m.userId === userId)?.displayName ?? "A member";
    const now = new Date().toISOString();
    if (transition.promoted) {
      bundle.updates.unshift({ id: this.nextId("u"), companyId, updateType: "family", headline: "Promoted to shortlist", summary: `${actor}'s Interested vote brought the count to 2 of 3.`, materiality: "medium", sourceId: null, runId: null, effectiveAt: now, detectedAt: now });
      this.pushNotification(others, { notificationType: "shortlist_promoted", companyId, updateId: null, commentId: null, title: `${bundle.company.name} promoted to shortlist`, body: `${actor}'s Interested vote brought the count to 2 of 3.`, importance: "high", href: `/companies/${bundle.company.slug}?tab=family`, dedupe: `promote:${companyId}:${now}` });
    } else if (transition.demoted) {
      bundle.updates.unshift({ id: this.nextId("u"), companyId, updateType: "family", headline: "Left the shortlist", summary: `${actor} changed their vote; fewer than 2 members are Interested.`, materiality: "medium", sourceId: null, runId: null, effectiveAt: now, detectedAt: now });
      this.pushNotification(others, { notificationType: "shortlist_demoted", companyId, updateId: null, commentId: null, title: `${bundle.company.name} left the shortlist`, body: `${actor} changed their vote; fewer than 2 members are Interested.`, importance: "high", href: `/companies/${bundle.company.slug}?tab=family`, dedupe: `demote:${companyId}:${now}` });
    } else if (before && vote && before.vote !== vote) {
      this.pushNotification(others, { notificationType: "vote_changed", companyId, updateId: null, commentId: null, title: `${actor} changed their view on ${bundle.company.name}`, body: `Now ${vote}.`, importance: "normal", href: `/companies/${bundle.company.slug}?tab=family`, dedupe: `vote:${companyId}:${userId}:${now}` });
    }
    return { transition };
  }

  async addComment({ userId, companyId, body }: { userId: string; companyId: string; body: string }) {
    const bundle = this.companies.find((c) => c.company.id === companyId);
    if (!bundle) throw new Error("Company not found");
    const comment: Comment = { id: this.nextId("c"), companyId, authorUserId: userId, body, createdAt: new Date().toISOString(), editedAt: null, deletedAt: null, likedBy: [] };
    bundle.comments.push(comment);
    const actor = DEMO_MEMBERS.find((m) => m.userId === userId)?.displayName ?? "A member";
    const others = DEMO_MEMBERS.filter((m) => m.userId !== userId).map((m) => m.userId);
    this.pushNotification(others, { notificationType: "comment", companyId, updateId: null, commentId: comment.id, title: `${actor} commented`, body: `On ${bundle.company.name}: “${body.slice(0, 90)}${body.length > 90 ? "…" : ""}”`, importance: "normal", href: `/companies/${bundle.company.slug}?tab=family`, dedupe: `comment:${comment.id}` });
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
