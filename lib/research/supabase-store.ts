import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PREFERENCES } from "./default-prompt";
import type { MaterialChange, PreviousState } from "./materiality";
import { canonicaliseUrl } from "./fetch";
import type { PublishedCompany, ResearchStore, RunConfig, RunRecord } from "./store";
import type { VerifiedSource } from "./verify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ResearchPreferences } from "@/lib/domain/types";

/**
 * Service-role implementation of ResearchStore. Runs server-side only, targets
 * one explicit household, validates nothing itself (the pipeline already
 * validated every payload with zod) and never destructively overwrites
 * facts: superseded facts get effective_to set instead of being deleted.
 */
class SupabaseResearchStore implements ResearchStore {
  constructor(private admin: SupabaseClient) {}

  private must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
    if (res.error) throw new Error(`${what}: ${res.error.message}`);
    return res.data as T;
  }

  async loadConfig(householdId: string): Promise<RunConfig> {
    const prompt = this.must(await this.admin.from("research_prompts").select("id, prompt_text, config_jsonb").eq("household_id", householdId).eq("active", true).maybeSingle<{ id: string; prompt_text: string; config_jsonb: Partial<ResearchPreferences> }>(), "active prompt");
    if (!prompt) throw new Error("No active research instructions for this household");
    const companies = this.must(await this.admin.from("companies").select("id, name, slug, domain, legal_name").eq("household_id", householdId).returns<{ id: string; name: string; slug: string; domain: string | null; legal_name: string | null }[]>(), "companies") ?? [];
    const aliases = this.must(await this.admin.from("company_aliases").select("company_id, alias").in("company_id", companies.map((c) => c.id)).returns<{ company_id: string; alias: string }[]>(), "aliases") ?? [];
    const members = this.must(await this.admin.from("household_members").select("user_id").eq("household_id", householdId).eq("status", "active").returns<{ user_id: string }[]>(), "members") ?? [];
    const hashes = this.must(await this.admin.from("sources").select("content_hash").eq("household_id", householdId).not("content_hash", "is", null).returns<{ content_hash: string }[]>(), "hashes") ?? [];
    return {
      householdId,
      promptVersionId: prompt.id,
      promptText: prompt.prompt_text,
      preferences: { ...DEFAULT_PREFERENCES, ...prompt.config_jsonb },
      known: companies.map((c) => ({ id: c.id, name: c.name, slug: c.slug, domain: c.domain, legalName: c.legal_name, aliases: aliases.filter((a) => a.company_id === c.id).map((a) => a.alias) })),
      memberIds: members.map((m) => m.user_id),
      seenHashes: new Set(hashes.map((h) => h.content_hash)),
    };
  }

  async startRun(input: { householdId: string; localDate: string; runKind: RunRecord["runKind"]; promptVersionId: string; model: string; triggeredBy: string | null }): Promise<RunRecord | null> {
    const { data, error } = await this.admin.from("research_runs").insert({ household_id: input.householdId, local_date: input.localDate, run_kind: input.runKind, prompt_version_id: input.promptVersionId, status: "running", model: input.model, triggered_by: input.triggeredBy }).select("id").single<{ id: string }>();
    if (error) {
      if (error.code === "23505") return null; // unique (household, date, kind): already ran
      throw new Error(`start run: ${error.message}`);
    }
    return { id: data.id, localDate: input.localDate, runKind: input.runKind };
  }

  async finishRun(input: { runId: string; status: "published" | "failed" | "no_new_research"; sourceCount: number; candidatesCount: number; publishedCount: number; estimatedCostUsd: number; summary: string; errorSummary: string | null }) {
    this.must(await this.admin.from("research_runs").update({ status: input.status, finished_at: new Date().toISOString(), source_count: input.sourceCount, candidates_count: input.candidatesCount, published_count: input.publishedCount, estimated_cost: input.estimatedCostUsd, summary: input.summary, error_summary: input.errorSummary }).eq("id", input.runId), "finish run");
  }

  async upsertSources(householdId: string, companyId: string | null, sources: VerifiedSource[], sourceTypeFor: (url: string) => "news" | "official" | "filing" | "research" | "media" | "other") {
    const out = new Map<string, string>();
    for (const s of sources) {
      const kind = sourceTypeFor(s.url);
      const row: Record<string, unknown> = { household_id: householdId, canonical_url: s.url, title: s.title.slice(0, 300), publisher: s.publisher, source_type: kind, published_at: s.publishedAt, retrieved_at: new Date().toISOString(), content_hash: s.contentHash, trust_tier: kind === "filing" || kind === "official" ? "primary" : "reputable", excerpt: s.excerpt };
      if (companyId) row.company_id = companyId;
      const { data, error } = await this.admin.from("sources").upsert(row, { onConflict: "household_id,canonical_url" }).select("id").single<{ id: string }>();
      if (error) throw new Error(`upsert source: ${error.message}`);
      out.set(s.url, data.id);
    }
    return out;
  }

  async previousState(companyId: string): Promise<PreviousState | null> {
    const company = this.must(await this.admin.from("companies").select("id").eq("id", companyId).maybeSingle<{ id: string }>(), "company");
    if (!company) return null;
    const access = this.must(await this.admin.from("investment_access_checks").select("access_status").eq("company_id", companyId).order("checked_at", { ascending: false }).limit(1).maybeSingle<{ access_status: string }>(), "access");
    const round = this.must(await this.admin.from("funding_rounds").select("claimed_status, pre_money, target_amount").eq("company_id", companyId).eq("is_current", true).limit(1).maybeSingle<{ claimed_status: string; pre_money: string | null; target_amount: string | null }>(), "round");
    const updates = this.must(await this.admin.from("company_updates").select("headline").eq("company_id", companyId).order("effective_at", { ascending: false }).limit(50).returns<{ headline: string }[]>(), "updates") ?? [];
    return { accessStatus: access?.access_status ?? null, claimedRoundStatus: round?.claimed_status ?? null, preMoney: round?.pre_money ? Number(round.pre_money) : null, targetAmount: round?.target_amount ? Number(round.target_amount) : null, lastSignalHeadlines: updates.map((u) => u.headline) };
  }

  async publishCompany(input: Parameters<ResearchStore["publishCompany"]>[0]): Promise<PublishedCompany> {
    const { candidate: c, sourceIds } = input;
    const src = (urls: string[] | undefined) => (urls?.length ? (sourceIds.get(canonicaliseUrl(urls[0])) ?? null) : null);
    const now = new Date().toISOString();
    const base = {
      name: c.name,
      domain: c.website ? new URL(c.website).hostname.replace(/^www\./, "") : null,
      legal_name: c.legalName,
      sector: c.sector,
      sub_sector: c.subSector,
      city: c.city ?? "Unknown",
      country: c.country ?? "Unknown",
      stage: c.stage ?? "Unknown",
      teaser: c.teaser,
      description: c.description,
      is_demo: false,
      last_researched_at: now,
      discovery_signal: c.discoverySignal,
      research_rule_matched: c.researchRuleMatched,
      tags: c.tags,
      eis_status: c.eis.status,
      eis_note: c.eis.note,
    };
    let companyId: string;
    let slug: string;
    let isNew = false;
    if (input.resolution.kind === "existing") {
      companyId = input.resolution.companyId;
      const row = this.must(await this.admin.from("companies").update(base).eq("id", companyId).select("slug").single<{ slug: string }>(), "update company");
      slug = row.slug;
    } else {
      slug = input.resolution.slug;
      const hue = Math.abs(hash(c.name)) % 360;
      const motifs = ["orbit", "grid", "wave", "facet", "ring", "field"];
      const row = this.must(await this.admin.from("companies").insert({ ...base, household_id: input.householdId, slug, first_discovered_at: now, artwork_hue: hue, artwork_motif: motifs[Math.abs(hash(slug)) % motifs.length] }).select("id").single<{ id: string }>(), "insert company");
      companyId = row.id;
      isNew = true;
      this.must(await this.admin.from("company_media").insert({ company_id: companyId, kind: "hero", url: null, is_primary: true, rights_status: "fallback", alt_text: `${c.name} artwork`, checked_at: now }), "media");
    }

    // Facts: supersede, never delete.
    for (const f of c.facts) {
      await this.admin.from("company_facts").update({ effective_to: now }).eq("company_id", companyId).eq("field_key", f.key).is("effective_to", null);
      this.must(await this.admin.from("company_facts").insert({ company_id: companyId, field_key: f.key, label: f.label, value_jsonb: f.value, currency: f.currency, as_of_date: f.asOf?.slice(0, 10) ?? null, evidence_status: f.evidenceStatus, source_id: src(f.sourceUrls) }), "fact");
    }
    if (c.round) {
      await this.admin.from("funding_rounds").update({ is_current: false }).eq("company_id", companyId).eq("is_current", true);
      this.must(await this.admin.from("funding_rounds").insert({ company_id: companyId, stage: c.round.stage ?? c.stage ?? "Unknown", target_amount: c.round.target?.amount ?? null, currency: c.round.target?.currency ?? c.round.preMoney?.currency ?? null, pre_money: c.round.preMoney?.amount ?? null, post_money: c.round.postMoney?.amount ?? null, reported_committed: c.round.reportedCommitted?.amount ?? null, closes_at: c.round.closesAt, claimed_status: c.round.claimedStatus, lead_investors: c.round.leadInvestors, evidence_status: c.round.evidenceStatus, source_id: src(c.round.sourceUrls), is_current: true }), "round");
    }
    this.must(await this.admin.from("investment_access_checks").insert({ company_id: companyId, access_status: c.access.status, route_type: c.access.routeType, contact_or_url: c.access.contactOrUrl, min_cheque: c.access.minCheque, max_cheque: c.access.maxCheque, currency: c.access.currency, checked_at: now, expires_at: c.access.status === "verified_open" || c.access.status === "closing_soon" ? new Date(Date.now() + 48 * 3600_000).toISOString() : null, verifier: `research ${input.model}`, source_id: src(c.access.sourceUrls), notes: c.access.notes }), "access check");
    if (c.founders.length) {
      await this.admin.from("founders").delete().eq("company_id", companyId);
      this.must(await this.admin.from("founders").insert(c.founders.map((f) => ({ company_id: companyId, name: f.name, role: f.role, bio: f.bio, profile_url: f.profileUrl, evidence_status: f.evidenceStatus, source_id: src(f.sourceUrls) }))), "founders");
    }
    if (input.assessment) {
      const a = input.assessment;
      this.must(await this.admin.from("company_assessments").insert({ company_id: companyId, run_id: input.runId, ai_priority: a.aiPriority, ai_score: a.aiScore, confidence: a.confidence, summary: a.summary, why_interested: a.whyInterested, risks: a.risks, bull_case: a.bullCase, bear_case: a.bearCase, why_now: a.whyNow, assumptions: a.assumptions, open_questions: [...a.openQuestions, ...c.openQuestions].slice(0, 8), diligence_checklist: a.diligenceChecklist, next_action: a.nextAction, score_breakdown_jsonb: a.breakdown.map((d) => ({ key: d.key, label: d.label, score: d.score, note: d.note, sourceIds: d.sourceUrls.map((u) => sourceIds.get(canonicaliseUrl(u))).filter(Boolean) })), source_ids: [...sourceIds.values()], model_version: `${input.model} · ${input.policyVersion}`, prompt_version: input.promptVersion }), "assessment");
    }
    return { companyId, slug, name: c.name, isNew };
  }

  async recordChanges(input: Parameters<ResearchStore["recordChanges"]>[0]) {
    let notified = 0;
    const { data: company } = await this.admin.from("companies").select("slug, name").eq("id", input.company.companyId).single<{ slug: string; name: string }>();
    for (const change of input.changes) {
      const dedupeKey = `${change.updateType}:${change.headline}:${change.change ? JSON.stringify(change.change) : ""}`.slice(0, 200);
      const { data: upd, error } = await this.admin.from("company_updates").upsert({ company_id: input.company.companyId, update_type: change.updateType, headline: change.headline, summary: change.summary, materiality: change.materiality, source_id: change.sourceUrl ? (input.sourceIds.get(canonicaliseUrl(change.sourceUrl)) ?? null) : null, run_id: input.runId, change_jsonb: change.change ?? null, dedupe_key: dedupeKey }, { onConflict: "company_id,dedupe_key", ignoreDuplicates: true }).select("id").maybeSingle<{ id: string }>();
      if (error) throw new Error(`update: ${error.message}`);
      if (!upd || !change.notify) continue; // duplicate of an earlier run → no second notification
      const href = `/companies/${company?.slug ?? input.company.slug}?tab=${change.updateType === "funding" ? "funding" : "updates"}`;
      const rows = input.memberIds.map((m) => ({ household_id: input.householdId, recipient_user_id: m, notification_type: change.notify, company_id: input.company.companyId, update_id: upd.id, title: `${company?.name ?? input.company.name}: ${change.headline}`, body: change.summary, importance: change.materiality === "high" ? "high" : "normal", href, dedupe_key: `update:${upd.id}` }));
      const { data: inserted, error: nErr } = await this.admin.from("notifications").upsert(rows, { onConflict: "recipient_user_id,dedupe_key", ignoreDuplicates: true }).select("id");
      if (nErr) throw new Error(`notify: ${nErr.message}`);
      notified += inserted?.length ?? 0;
    }
    return notified;
  }

  async publishStories(input: Parameters<ResearchStore["publishStories"]>[0]) {
    const expires = new Date(Date.now() + 3 * 86_400_000).toISOString();
    this.must(await this.admin.from("home_stories").insert(input.stories.map((s) => ({ household_id: input.householdId, run_id: input.runId, story_type: s.storyType, company_id: s.companyId, headline: s.headline, teaser: s.teaser, priority: s.priority, source_id: s.sourceId, expires_at: expires }))), "stories");
  }

  async publishEvents(input: Parameters<ResearchStore["publishEvents"]>[0]) {
    for (const e of input.events) {
      this.must(await this.admin.from("events").upsert({ household_id: input.householdId, name: e.name, organiser: e.organiser, event_type: e.eventType, start_at: e.startAt, end_at: e.endAt, venue: e.venue, city: e.city, is_online: e.isOnline, registration_url: e.registrationUrl, access_status: e.accessStatus, registration_checked_at: e.registrationUrl ? new Date().toISOString() : null, audience_fit: e.audienceFit, significance: e.significance, next_action: e.nextAction, source_id: e.sourceId }, { onConflict: "household_id,name,start_at" }), "event");
    }
  }

  async notifyMembers(input: Parameters<ResearchStore["notifyMembers"]>[0]) {
    const rows = input.memberIds.map((m) => ({ household_id: input.householdId, recipient_user_id: m, notification_type: input.type, company_id: input.companyId ?? null, title: input.title, body: input.body, importance: input.importance, href: input.href, dedupe_key: input.dedupeKey }));
    this.must(await this.admin.from("notifications").upsert(rows, { onConflict: "recipient_user_id,dedupe_key", ignoreDuplicates: true }), "notify");
  }

  async logReview(input: { householdId: string; runId: string; kind: string; detail: unknown }) {
    this.must(await this.admin.from("audit_events").insert({ household_id: input.householdId, actor_type: "research", actor_id: input.runId, action: `review.${input.kind}`, object_type: "research_run", object_id: input.runId, after_jsonb: input.detail }), "review log");
  }

  async audit(input: { householdId: string; runId: string; action: string; objectType: string; objectId: string; after?: unknown }) {
    this.must(await this.admin.from("audit_events").insert({ household_id: input.householdId, actor_type: "research", actor_id: input.runId, action: input.action, object_type: input.objectType, object_id: input.objectId, after_jsonb: input.after ?? null }), "audit");
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function createSupabaseResearchStore(): ResearchStore {
  return new SupabaseResearchStore(createSupabaseAdminClient());
}
