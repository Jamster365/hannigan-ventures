import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StageTransition } from "@/lib/domain/family-consensus";
import type {
  AngelNetwork,
  AuditEvent,
  Comment,
  CompanyBundle,
  EventRecord,
  HomeStory,
  Member,
  Notification,
  PromptSuggestion,
  PromptVersion,
  ResearchFeedback,
  ResearchPreferences,
  ResearchRun,
  Vote,
  VoteValue,
} from "@/lib/domain/types";
import { RESEARCH_AUTHOR_ID } from "@/lib/domain/types";
import { DEFAULT_PREFERENCES } from "@/lib/research/default-prompt";
import { applyPatch } from "@/lib/research/patch";
import { requireSessionContext } from "@/lib/supabase/member";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  num,
  type AccessRow,
  type AssessmentRow,
  type AuditRow,
  type BookmarkRow,
  type CommentRow,
  type CompanyRow,
  type EventRow,
  type EventStatusRow,
  type FactRow,
  type FounderRow,
  type HighlightRow,
  type HouseholdMemberRow,
  type MediaRow,
  type NetworkRow,
  type NotificationRow,
  type ProfileRow,
  type PromptRow,
  type RoundRow,
  type RunRow,
  type SourceRow,
  type StoryRow,
  type SuggestionRow,
  type UpdateRow,
  type VoteRow,
} from "@/lib/supabase/rows";
import type { Repository } from "./repository";

/**
 * Postgres-backed repository. Reads and member writes go through the
 * per-request Supabase client, so Row Level Security is always enforced;
 * family stage transitions and notifications are produced by database
 * triggers, never computed in JavaScript here.
 */
class SupabaseRepository implements Repository {
  readonly mode = "supabase" as const;

  private async ctx() {
    const [supabase, session] = await Promise.all([createSupabaseServerClient(), requireSessionContext()]);
    return { supabase, ...session };
  }

  private fail(error: { message: string } | null, what: string): never | void {
    if (error) throw new Error(`${what}: ${error.message}`);
  }

  async getMembers(): Promise<Member[]> {
    const { supabase, householdId } = await this.ctx();
    const { data: members } = await supabase.from("household_members").select("*").eq("household_id", householdId).eq("status", "active").order("joined_at").returns<HouseholdMemberRow[]>();
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", ids).returns<ProfileRow[]>();
    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    return (members ?? []).map((m) => {
      const p = byId.get(m.user_id);
      return { userId: m.user_id, displayName: p?.display_name ?? "Member", initial: p?.avatar_initial ?? "M", accent: p?.accent ?? "blue", role: m.role, joinedAt: m.joined_at };
    });
  }

  async listCompanies(): Promise<CompanyBundle[]> {
    const { supabase, householdId } = await this.ctx();
    const { data: companies, error } = await supabase.from("companies").select("*").eq("household_id", householdId).order("updated_at", { ascending: false }).returns<CompanyRow[]>();
    this.fail(error, "listCompanies");
    if (!companies?.length) return [];
    return this.assemble(supabase, householdId, companies);
  }

  async getCompanyBySlug(slug: string): Promise<CompanyBundle | null> {
    const { supabase, householdId } = await this.ctx();
    const { data } = await supabase.from("companies").select("*").eq("household_id", householdId).eq("slug", slug).maybeSingle<CompanyRow>();
    if (!data) return null;
    return (await this.assemble(supabase, householdId, [data]))[0] ?? null;
  }

  async getCompanyById(id: string): Promise<CompanyBundle | null> {
    const { supabase, householdId } = await this.ctx();
    const { data } = await supabase.from("companies").select("*").eq("household_id", householdId).eq("id", id).maybeSingle<CompanyRow>();
    if (!data) return null;
    return (await this.assemble(supabase, householdId, [data]))[0] ?? null;
  }

  private async assemble(supabase: SupabaseClient, householdId: string, companies: CompanyRow[]): Promise<CompanyBundle[]> {
    const ids = companies.map((c) => c.id);
    const [media, facts, rounds, access, assessments, founders, highlights, votes, bookmarks, comments, updates, sources] = await Promise.all([
      supabase.from("company_media").select("*").in("company_id", ids).returns<MediaRow[]>(),
      supabase.from("company_facts").select("*").in("company_id", ids).is("effective_to", null).returns<FactRow[]>(),
      supabase.from("funding_rounds").select("*").in("company_id", ids).returns<RoundRow[]>(),
      supabase.from("investment_access_checks").select("*").in("company_id", ids).order("checked_at", { ascending: false }).returns<AccessRow[]>(),
      supabase.from("company_assessments").select("*").in("company_id", ids).order("created_at", { ascending: false }).returns<AssessmentRow[]>(),
      supabase.from("founders").select("*").in("company_id", ids).returns<FounderRow[]>(),
      supabase.from("team_highlights").select("*").in("company_id", ids).returns<HighlightRow[]>(),
      supabase.from("member_votes").select("*").in("company_id", ids).returns<VoteRow[]>(),
      supabase.from("member_bookmarks").select("*").in("company_id", ids).returns<BookmarkRow[]>(),
      supabase.from("comments").select("*").in("company_id", ids).order("created_at").returns<CommentRow[]>(),
      supabase.from("company_updates").select("*").in("company_id", ids).order("effective_at", { ascending: false }).returns<UpdateRow[]>(),
      supabase.from("sources").select("*").eq("household_id", householdId).in("company_id", ids).order("published_at", { ascending: false }).returns<SourceRow[]>(),
    ]);
    const group = <T extends { company_id: string | null }>(rows: T[] | null) => {
      const m = new Map<string, T[]>();
      for (const r of rows ?? []) {
        if (!r.company_id) continue;
        const list = m.get(r.company_id) ?? [];
        list.push(r);
        m.set(r.company_id, list);
      }
      return m;
    };
    const gm = group(media.data), gf = group(facts.data), gr = group(rounds.data), ga = group(access.data), gas = group(assessments.data), gfo = group(founders.data), gh = group(highlights.data), gv = group(votes.data), gb = group(bookmarks.data), gc = group(comments.data), gu = group(updates.data), gs = group(sources.data);

    return companies.map((c) => {
      const a = gas.get(c.id)?.[0];
      return {
        company: {
          id: c.id,
          slug: c.slug,
          name: c.name,
          legalName: c.legal_name ?? undefined,
          domain: c.domain ?? undefined,
          sector: c.sector,
          subSector: c.sub_sector ?? undefined,
          city: c.city,
          country: c.country,
          stage: c.stage,
          teaser: c.teaser,
          description: c.description,
          isDemo: c.is_demo,
          firstDiscoveredAt: c.first_discovered_at,
          lastResearchedAt: c.last_researched_at,
          discoverySignal: c.discovery_signal ?? undefined,
          researchRuleMatched: c.research_rule_matched ?? undefined,
          tags: c.tags ?? [],
          eisStatus: c.eis_status,
          eisNote: c.eis_note ?? undefined,
          artwork: { hue: c.artwork_hue, motif: (c.artwork_motif as CompanyBundle["company"]["artwork"]["motif"]) ?? "orbit" },
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        },
        media: (gm.get(c.id) ?? []).map((m) => ({ id: m.id, companyId: c.id, kind: m.kind, url: m.url, isPrimary: m.is_primary, rightsStatus: m.rights_status, originUrl: m.origin_url ?? undefined, attribution: m.attribution ?? undefined, altText: m.alt_text, checkedAt: m.checked_at ?? undefined })),
        facts: (gf.get(c.id) ?? []).map((f) => ({ id: f.id, companyId: c.id, fieldKey: f.field_key, label: f.label, value: (f.value_jsonb as string | number | null) ?? null, unit: f.unit ?? undefined, currency: f.currency ?? undefined, asOfDate: f.as_of_date, evidenceStatus: f.evidence_status, sourceId: f.source_id, recordedAt: f.recorded_at })),
        rounds: (gr.get(c.id) ?? []).map((r) => ({ id: r.id, companyId: c.id, stage: r.stage, targetAmount: num(r.target_amount), currency: r.currency, preMoney: num(r.pre_money), postMoney: num(r.post_money), reportedCommitted: num(r.reported_committed), openedAt: r.opened_at, closesAt: r.closes_at, claimedStatus: r.claimed_status, leadInvestors: r.lead_investors ?? [], evidenceStatus: r.evidence_status, sourceId: r.source_id, isCurrent: r.is_current })),
        accessChecks: (ga.get(c.id) ?? []).map((x) => ({ id: x.id, companyId: c.id, accessStatus: x.access_status, routeType: x.route_type, contactOrUrl: x.contact_or_url, minCheque: num(x.min_cheque), maxCheque: num(x.max_cheque), currency: x.currency, checkedAt: x.checked_at, expiresAt: x.expires_at, verifier: x.verifier, sourceId: x.source_id, notes: x.notes })),
        assessment: a
          ? { id: a.id, companyId: c.id, runId: a.run_id, aiPriority: a.ai_priority, aiScore: num(a.ai_score), confidence: a.confidence, summary: a.summary, whyInterested: a.why_interested ?? [], risks: a.risks ?? [], bullCase: a.bull_case, bearCase: a.bear_case, whyNow: a.why_now, assumptions: a.assumptions ?? [], openQuestions: a.open_questions ?? [], diligenceChecklist: a.diligence_checklist ?? [], nextAction: a.next_action, breakdown: a.score_breakdown_jsonb ?? [], modelVersion: a.model_version, promptVersion: a.prompt_version, createdAt: a.created_at, sourceIds: a.source_ids ?? [] }
          : null,
        founders: (gfo.get(c.id) ?? []).map((f) => ({ id: f.id, companyId: c.id, name: f.name, role: f.role, bio: f.bio, profileUrl: f.profile_url, evidenceStatus: f.evidence_status, sourceId: f.source_id })),
        teamHighlights: (gh.get(c.id) ?? []).map((h) => ({ text: h.text, evidenceStatus: h.evidence_status, sourceId: h.source_id })),
        votes: (gv.get(c.id) ?? []).map((v) => ({ companyId: c.id, userId: v.user_id, vote: v.vote, score: v.score, note: v.note ?? undefined, updatedAt: v.updated_at })),
        comments: (gc.get(c.id) ?? []).map((x) => ({ id: x.id, companyId: c.id, authorUserId: x.author_user_id ?? RESEARCH_AUTHOR_ID, body: x.body, createdAt: x.created_at, editedAt: x.edited_at, deletedAt: x.deleted_at })),
        updates: (gu.get(c.id) ?? []).map((u) => ({ id: u.id, companyId: c.id, updateType: u.update_type, headline: u.headline, summary: u.summary, change: u.change_jsonb ?? undefined, materiality: u.materiality, sourceId: u.source_id, runId: u.run_id, effectiveAt: u.effective_at, detectedAt: u.detected_at })),
        sources: (gs.get(c.id) ?? []).map(mapSource),
        bookmarkedBy: (gb.get(c.id) ?? []).map((b) => b.user_id),
      };
    });
  }

  async listHomeStories(): Promise<HomeStory[]> {
    const { supabase, householdId } = await this.ctx();
    const { data } = await supabase.from("home_stories").select("*").eq("household_id", householdId).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order("priority", { ascending: false }).limit(8).returns<StoryRow[]>();
    return (data ?? []).map((s) => ({ id: s.id, runId: s.run_id, storyType: s.story_type, companyId: s.company_id, headline: s.headline, teaser: s.teaser, priority: s.priority, sourceId: s.source_id, createdAt: s.created_at, expiresAt: s.expires_at }));
  }

  async listNotifications(userId: string): Promise<Notification[]> {
    const { supabase } = await this.ctx();
    const { data } = await supabase.from("notifications").select("*").eq("recipient_user_id", userId).order("created_at", { ascending: false }).limit(100).returns<NotificationRow[]>();
    return (data ?? []).map((n) => ({ id: n.id, recipientUserId: n.recipient_user_id, notificationType: n.notification_type, companyId: n.company_id, updateId: n.update_id, commentId: n.comment_id, title: n.title, body: n.body, importance: n.importance, readAt: n.read_at, createdAt: n.created_at, dedupeKey: n.dedupe_key, href: n.href }));
  }

  async markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
    const { supabase } = await this.ctx();
    let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_user_id", userId).is("read_at", null);
    if (ids?.length) q = q.in("id", ids);
    const { error } = await q;
    this.fail(error, "markNotificationsRead");
  }

  async listEvents(): Promise<EventRecord[]> {
    const { supabase, householdId } = await this.ctx();
    const { data } = await supabase.from("events").select("*").eq("household_id", householdId).order("start_at").returns<EventRow[]>();
    const ids = (data ?? []).map((e) => e.id);
    const { data: statuses } = ids.length ? await supabase.from("event_member_status").select("*").in("event_id", ids).returns<EventStatusRow[]>() : { data: [] as EventStatusRow[] };
    return (data ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      organiser: e.organiser,
      eventType: e.event_type,
      startAt: e.start_at,
      endAt: e.end_at,
      timezone: e.timezone,
      venue: e.venue,
      city: e.city,
      isOnline: e.is_online,
      registrationUrl: e.registration_url,
      accessStatus: e.access_status,
      registrationCheckedAt: e.registration_checked_at,
      audienceFit: e.audience_fit,
      significance: e.significance,
      nextAction: e.next_action,
      relatedCompanyIds: e.related_company_ids ?? [],
      sourceId: e.source_id,
      importance: e.importance,
      memberStatus: Object.fromEntries((statuses ?? []).filter((s) => s.event_id === e.id).map((s) => [s.user_id, s.status])),
    }));
  }

  async listNetworks(): Promise<AngelNetwork[]> {
    const { supabase, householdId } = await this.ctx();
    const { data } = await supabase.from("angel_networks").select("*").eq("household_id", householdId).order("name").returns<NetworkRow[]>();
    return (data ?? []).map((n) => ({ id: n.id, name: n.name, website: n.website, focus: n.focus, region: n.region, eligibility: n.eligibility, joiningUrl: n.joining_url, fees: n.fees, chequeRequirements: n.cheque_requirements, coInvestRoute: n.co_invest_route, contact: n.contact, verificationStatus: n.verification_status, accessibilityConfidence: n.accessibility_confidence, lastCheckedAt: n.last_checked_at, notes: n.notes, portfolioCompanyIds: n.portfolio_company_ids ?? [] }));
  }

  async listVotes(companyId: string): Promise<Vote[]> {
    const { supabase } = await this.ctx();
    const { data, error } = await supabase.from("member_votes").select("*").eq("company_id", companyId).returns<VoteRow[]>();
    this.fail(error, "load votes");
    return (data ?? []).map((v) => ({ companyId, userId: v.user_id, vote: v.vote, score: v.score, note: v.note ?? undefined, updatedAt: v.updated_at }));
  }

  async setVote({ userId, companyId, vote, score }: { userId: string; companyId: string; vote: VoteValue | null; score?: number | null }): Promise<{ transition: StageTransition }> {
    const { supabase, member } = await this.ctx();
    if (member.userId !== userId) throw new Error("You can only change your own vote");
    const stageOf = async () => (await supabase.from("companies").select("family_stage").eq("id", companyId).single<{ family_stage: CompanyRow["family_stage"] }>()).data?.family_stage ?? "unreviewed";
    const from = await stageOf();
    if (vote === null) {
      const { error } = await supabase.from("member_votes").delete().eq("company_id", companyId).eq("user_id", userId);
      this.fail(error, "clear vote");
    } else {
      const payload: Record<string, unknown> = { company_id: companyId, user_id: userId, vote, updated_at: new Date().toISOString() };
      if (score !== undefined) payload.score = score;
      const { error } = await supabase.from("member_votes").upsert(payload, { onConflict: "company_id,user_id" });
      this.fail(error, "save vote");
    }
    const to = await stageOf();
    return { transition: { from, to, promoted: to === "shortlisted" && from !== "shortlisted", demoted: from === "shortlisted" && to !== "shortlisted" } };
  }

  async addComment({ userId, companyId, body }: { userId: string; companyId: string; body: string }): Promise<Comment> {
    const { supabase } = await this.ctx();
    const { data, error } = await supabase.from("comments").insert({ company_id: companyId, author_user_id: userId, body }).select("*").single<CommentRow>();
    this.fail(error, "add comment");
    return { id: data!.id, companyId, authorUserId: userId, body: data!.body, createdAt: data!.created_at, editedAt: null, deletedAt: null };
  }

  async editComment({ userId, commentId, body }: { userId: string; commentId: string; body: string }): Promise<Comment> {
    const { supabase } = await this.ctx();
    const { data, error } = await supabase.from("comments").update({ body, edited_at: new Date().toISOString() }).eq("id", commentId).eq("author_user_id", userId).select("*").maybeSingle<CommentRow>();
    this.fail(error, "edit comment");
    if (!data) throw new Error("You can only edit your own comments");
    return { id: data.id, companyId: data.company_id, authorUserId: data.author_user_id ?? RESEARCH_AUTHOR_ID, body: data.body, createdAt: data.created_at, editedAt: data.edited_at, deletedAt: data.deleted_at };
  }

  async deleteComment({ userId, commentId }: { userId: string; commentId: string }): Promise<void> {
    const { supabase } = await this.ctx();
    const { data, error } = await supabase.from("comments").update({ deleted_at: new Date().toISOString() }).eq("id", commentId).eq("author_user_id", userId).select("id");
    this.fail(error, "delete comment");
    if (!data?.length) throw new Error("You can only delete your own comments");
  }

  async toggleBookmark({ userId, companyId }: { userId: string; companyId: string }): Promise<{ bookmarked: boolean }> {
    const { supabase } = await this.ctx();
    const { data: existing } = await supabase.from("member_bookmarks").select("company_id").eq("company_id", companyId).eq("user_id", userId).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("member_bookmarks").delete().eq("company_id", companyId).eq("user_id", userId);
      this.fail(error, "remove bookmark");
      return { bookmarked: false };
    }
    const { error } = await supabase.from("member_bookmarks").insert({ company_id: companyId, user_id: userId });
    this.fail(error, "add bookmark");
    return { bookmarked: true };
  }

  async listPromptVersions(): Promise<PromptVersion[]> {
    const { supabase, householdId } = await this.ctx();
    const { data } = await supabase.from("research_prompts").select("*").eq("household_id", householdId).order("version", { ascending: false }).returns<PromptRow[]>();
    return (data ?? []).map(mapPrompt);
  }

  async getActivePrompt(): Promise<PromptVersion> {
    const { supabase, householdId } = await this.ctx();
    const { data } = await supabase.from("research_prompts").select("*").eq("household_id", householdId).eq("active", true).maybeSingle<PromptRow>();
    if (!data) throw new Error("No active research instructions. Run the seed script to create the default prompt.");
    return mapPrompt(data);
  }

  async savePromptVersion({ userId, promptText, config, changeNote, basedOnVersionId }: Parameters<Repository["savePromptVersion"]>[0]) {
    const { supabase, householdId } = await this.ctx();
    const { data, error } = await supabase.rpc("activate_prompt_version", { hid: householdId, p_prompt_text: promptText, p_config: config, p_change_note: changeNote, p_based_on: basedOnVersionId, p_user: userId });
    if (error) {
      if (error.message.includes("prompt_conflict")) return { ok: false as const, conflict: await this.getActivePrompt() };
      throw new Error(`save prompt: ${error.message}`);
    }
    const { data: row } = await supabase.from("research_prompts").select("*").eq("id", data as string).single<PromptRow>();
    return { ok: true as const, version: mapPrompt(row!) };
  }

  async restorePromptVersion({ userId, versionId }: { userId: string; versionId: string }): Promise<PromptVersion> {
    const { supabase } = await this.ctx();
    const { data: source } = await supabase.from("research_prompts").select("*").eq("id", versionId).single<PromptRow>();
    if (!source) throw new Error("Version not found");
    const active = await this.getActivePrompt();
    const res = await this.savePromptVersion({ userId, promptText: source.prompt_text, config: mapPrompt(source).config, changeNote: `Restored v${source.version}.`, basedOnVersionId: active.id });
    if (!res.ok) throw new Error("Instructions changed while restoring; reload and try again.");
    return res.version;
  }

  async listSuggestions(): Promise<PromptSuggestion[]> {
    const { supabase, householdId } = await this.ctx();
    const { data } = await supabase.from("prompt_suggestions").select("*").eq("household_id", householdId).order("created_at", { ascending: false }).limit(50).returns<SuggestionRow[]>();
    return (data ?? []).map((s) => ({ id: s.id, feedbackId: s.feedback_id, basePromptVersionId: s.base_prompt_version_id, suggestedPatch: s.suggested_patch ?? [], suggestedText: s.suggested_text ?? undefined, rationale: s.rationale, expectedImpact: s.expected_impact, status: s.status, suggestedBy: s.suggested_by, approvedBy: s.approved_by, appliedVersionId: s.applied_version_id, createdAt: s.created_at }));
  }

  async createFeedback(input: Omit<ResearchFeedback, "id" | "createdAt">): Promise<ResearchFeedback> {
    const { supabase, householdId } = await this.ctx();
    const { data, error } = await supabase.from("research_feedback").insert({ household_id: householdId, company_id: input.companyId, author_user_id: input.authorUserId, feedback_type: input.feedbackType, body: input.body }).select("*").single();
    this.fail(error, "create feedback");
    return { id: data!.id, companyId: data!.company_id, authorUserId: data!.author_user_id, feedbackType: data!.feedback_type, body: data!.body, createdAt: data!.created_at };
  }

  async createSuggestion(input: Omit<PromptSuggestion, "id" | "createdAt" | "status" | "approvedBy" | "appliedVersionId">): Promise<PromptSuggestion> {
    const { supabase, householdId } = await this.ctx();
    const { data, error } = await supabase
      .from("prompt_suggestions")
      .insert({ household_id: householdId, feedback_id: input.feedbackId, base_prompt_version_id: input.basePromptVersionId, suggested_patch: input.suggestedPatch, suggested_text: input.suggestedText ?? null, rationale: input.rationale, expected_impact: input.expectedImpact, suggested_by: input.suggestedBy })
      .select("*")
      .single<SuggestionRow>();
    this.fail(error, "create suggestion");
    const s = data!;
    return { id: s.id, feedbackId: s.feedback_id, basePromptVersionId: s.base_prompt_version_id, suggestedPatch: s.suggested_patch, suggestedText: s.suggested_text ?? undefined, rationale: s.rationale, expectedImpact: s.expected_impact, status: s.status, suggestedBy: s.suggested_by, approvedBy: s.approved_by, appliedVersionId: s.applied_version_id, createdAt: s.created_at };
  }

  async applySuggestion({ userId, suggestionId }: { userId: string; suggestionId: string }) {
    const { supabase } = await this.ctx();
    const { data: s } = await supabase.from("prompt_suggestions").select("*").eq("id", suggestionId).single<SuggestionRow>();
    if (!s || s.status !== "proposed") return { ok: false as const, reason: "Suggestion is no longer open." };
    const active = await this.getActivePrompt();
    const patched = s.suggested_text ?? applyPatch(active.promptText, s.suggested_patch ?? []);
    if (patched === null) return { ok: false as const, reason: "The suggestion no longer matches the current instructions. Dismiss it and ask for a fresh proposal." };
    const res = await this.savePromptVersion({ userId, promptText: patched, config: active.config, changeNote: `Applied suggestion: ${s.rationale.slice(0, 80)}`, basedOnVersionId: active.id });
    if (!res.ok) return { ok: false as const, reason: "Instructions changed while applying; reload and try again." };
    const { error } = await supabase.from("prompt_suggestions").update({ status: "applied", approved_by: userId, applied_version_id: res.version.id }).eq("id", suggestionId);
    this.fail(error, "mark suggestion applied");
    return { ok: true as const, version: res.version };
  }

  async dismissSuggestion({ userId, suggestionId }: { userId: string; suggestionId: string }): Promise<void> {
    const { supabase } = await this.ctx();
    const { error } = await supabase.from("prompt_suggestions").update({ status: "dismissed", approved_by: userId }).eq("id", suggestionId).eq("status", "proposed");
    this.fail(error, "dismiss suggestion");
  }

  async listRuns(): Promise<ResearchRun[]> {
    const { supabase, householdId } = await this.ctx();
    const { data } = await supabase.from("research_runs").select("*").eq("household_id", householdId).order("started_at", { ascending: false }).limit(60).returns<RunRow[]>();
    return (data ?? []).map((r) => ({ id: r.id, localDate: r.local_date, runKind: r.run_kind, promptVersionId: r.prompt_version_id ?? "", status: r.status, startedAt: r.started_at, finishedAt: r.finished_at, model: r.model, sourceCount: r.source_count, candidatesCount: r.candidates_count, publishedCount: r.published_count, estimatedCostUsd: num(r.estimated_cost), summary: r.summary, errorSummary: r.error_summary }));
  }

  async listAuditEvents(limit = 50): Promise<AuditEvent[]> {
    const { supabase, householdId } = await this.ctx();
    const { data } = await supabase.from("audit_events").select("*").eq("household_id", householdId).order("created_at", { ascending: false }).limit(limit).returns<AuditRow[]>();
    return (data ?? []).map((a) => ({ id: a.id, actorType: a.actor_type, actorId: a.actor_id, action: a.action, objectType: a.object_type, objectId: a.object_id, before: a.before_jsonb, after: a.after_jsonb, createdAt: a.created_at }));
  }
}

function mapPrompt(p: PromptRow): PromptVersion {
  return { id: p.id, version: p.version, promptText: p.prompt_text, config: { ...DEFAULT_PREFERENCES, ...(p.config_jsonb as Partial<ResearchPreferences>) }, createdBy: p.created_by ?? "", createdAt: p.created_at, active: p.active, changeNote: p.change_note, parentVersionId: p.parent_version_id };
}

export function mapSource(s: SourceRow) {
  return { id: s.id, companyId: s.company_id, canonicalUrl: s.canonical_url, title: s.title, publisher: s.publisher, sourceType: s.source_type, publishedAt: s.published_at, retrievedAt: s.retrieved_at, trustTier: s.trust_tier, excerpt: s.excerpt ?? undefined, claimType: s.claim_type ?? undefined };
}

let singleton: SupabaseRepository | null = null;
export function getSupabaseRepository(): Repository {
  if (!singleton) singleton = new SupabaseRepository();
  return singleton;
}
