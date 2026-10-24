import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PREFERENCES } from "./default-prompt";
import type { MaterialChange, PreviousState } from "./materiality";
import { toIsoDate } from "./dates";
import { canonicaliseUrl } from "./fetch";
import type { PublishedCompany, ResearchStore, RunConfig, RunRecord, RunStage, StoredRun } from "./store";
import type { VerifiedSource } from "./verify";
import type { FoundImage } from "./imagery";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ResearchPreferences } from "@/lib/domain/types";

/**
 * Service-role implementation of ResearchStore. Runs server-side only, targets
 * one explicit household, validates nothing itself (the pipeline already
 * validated every payload with zod) and never destructively overwrites
 * facts: superseded facts get effective_to set instead of being deleted.
 */
export class SupabaseResearchStore implements ResearchStore {
  constructor(private admin: SupabaseClient) {}

  private must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
    if (res.error) throw new Error(`${what}: ${res.error.message}`);
    return res.data as T;
  }

  async loadConfig(householdId: string): Promise<RunConfig> {
    const prompt = this.must(await this.admin.from("research_prompts").select("id, prompt_text, config_jsonb").eq("household_id", householdId).eq("active", true).maybeSingle<{ id: string; prompt_text: string; config_jsonb: Partial<ResearchPreferences> }>(), "active prompt");
    if (!prompt) throw new Error("No active research instructions for this household");
    // Labelled sample companies are fictional: never research them or match real findings onto them.
    const companies = this.must(await this.admin.from("companies").select("id, name, slug, domain, legal_name, family_stage").eq("household_id", householdId).eq("is_demo", false).returns<{ id: string; name: string; slug: string; domain: string | null; legal_name: string | null; family_stage: string }[]>(), "companies") ?? [];
    const checks = this.must(await this.admin.from("investment_access_checks").select("company_id, checked_at").in("company_id", companies.map((c) => c.id)).returns<{ company_id: string; checked_at: string }[]>(), "access checks") ?? [];
    const lastChecked = new Map<string, string>();
    for (const k of checks) if ((lastChecked.get(k.company_id) ?? "") < k.checked_at) lastChecked.set(k.company_id, k.checked_at);
    const aliases = this.must(await this.admin.from("company_aliases").select("company_id, alias").in("company_id", companies.map((c) => c.id)).returns<{ company_id: string; alias: string }[]>(), "aliases") ?? [];
    const members = this.must(await this.admin.from("household_members").select("user_id").eq("household_id", householdId).eq("status", "active").returns<{ user_id: string }[]>(), "members") ?? [];
    const hashes = this.must(await this.admin.from("sources").select("content_hash").eq("household_id", householdId).not("content_hash", "is", null).returns<{ content_hash: string }[]>(), "hashes") ?? [];
    return {
      householdId,
      promptVersionId: prompt.id,
      promptText: prompt.prompt_text,
      preferences: { ...DEFAULT_PREFERENCES, ...prompt.config_jsonb },
      known: companies.map((c) => ({ id: c.id, name: c.name, slug: c.slug, domain: c.domain, legalName: c.legal_name, aliases: aliases.filter((a) => a.company_id === c.id).map((a) => a.alias), lastCheckedAt: lastChecked.get(c.id) ?? null, matched: c.family_stage === "shortlisted" })),
      memberIds: members.map((m) => m.user_id),
      seenHashes: new Set(hashes.map((h) => h.content_hash)),
    };
  }

  async startRun(input: { householdId: string; localDate: string; runKind: RunRecord["runKind"]; promptVersionId: string; model: string; triggeredBy: string | null; newCompanyLimit?: number }): Promise<RunRecord | null> {
    const { data, error } = await this.admin.from("research_runs").insert({ household_id: input.householdId, local_date: input.localDate, run_kind: input.runKind, prompt_version_id: input.promptVersionId, status: "running", model: input.model, triggered_by: input.triggeredBy, new_company_limit: input.newCompanyLimit ?? null }).select("id").single<{ id: string }>();
    if (error) {
      if (error.code === "23505") return null; // unique (household, date, kind): already ran
      throw new Error(`start run: ${error.message}`);
    }
    return { id: data.id, localDate: input.localDate, runKind: input.runKind };
  }

  async setDiscovery(runId: string, handle: string) {
    this.must(await this.admin.from("research_runs").update({ phase: "discovering", provider_response_id: handle }).eq("id", runId), "set discovery");
  }

  async getRun(runId: string) {
    const { data } = await this.admin.from("research_runs").select(RUN_COLUMNS).eq("id", runId).maybeSingle<RunRow>();
    return data ? mapRun(data) : null;
  }

  async listActiveRuns(householdId: string) {
    const { data } = await this.admin.from("research_runs").select(RUN_COLUMNS).eq("household_id", householdId).eq("status", "running").order("started_at").returns<RunRow[]>();
    return (data ?? []).map(mapRun);
  }

  async claimProcessing(runId: string) {
    const { data } = await this.admin.from("research_runs").update({ phase: "processing", progress_at: new Date().toISOString() }).eq("id", runId).eq("phase", "discovering").eq("status", "running").select("id");
    return (data?.length ?? 0) === 1;
  }

  async progress(runId: string, stage: RunStage, detail: string) {
    await this.admin.from("research_runs").update({ progress_stage: stage, progress_detail: detail, progress_at: new Date().toISOString() }).eq("id", runId);
  }

  async hasImagery(companyId: string) {
    const { count } = await this.admin.from("company_media").select("id", { count: "exact", head: true }).eq("company_id", companyId).neq("rights_status", "fallback").not("url", "is", null);
    return (count ?? 0) > 0;
  }

  /** Real companies with a website but no picture yet, not retried in the last week. */
  async companiesMissingHero(householdId: string, limit: number) {
    const companies = this.must(await this.admin.from("companies").select("id, name, domain").eq("household_id", householdId).eq("is_demo", false).not("domain", "is", null).returns<{ id: string; name: string; domain: string }[]>(), "companies") ?? [];
    const ids = companies.map((c) => c.id);
    if (!ids.length) return [];
    const [heroes, tried, sources] = await Promise.all([
      this.admin.from("company_media").select("company_id").in("company_id", ids).eq("kind", "hero").neq("rights_status", "fallback").not("url", "is", null).returns<{ company_id: string }[]>(),
      this.admin.from("audit_events").select("object_id").eq("household_id", householdId).eq("action", "imagery.backfill").gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()).returns<{ object_id: string }[]>(),
      this.admin.from("sources").select("company_id, url").in("company_id", ids).returns<{ company_id: string; url: string }[]>(),
    ]);
    const has = new Set((heroes.data ?? []).map((h) => h.company_id));
    const recent = new Set((tried.data ?? []).map((t) => t.object_id));
    return companies
      .filter((c) => !has.has(c.id) && !recent.has(c.id))
      .slice(0, limit)
      .map((c) => ({ companyId: c.id, name: c.name, website: `https://${c.domain}`, verifiedUrls: (sources.data ?? []).filter((s) => s.company_id === c.id).map((s) => s.url) }));
  }

  async saveImagery(input: { householdId: string; companyId: string; companyName: string; images: FoundImage[] }) {
    const { createHash } = await import("node:crypto");
    let saved = 0;
    for (const img of input.images) {
      const ext = img.type === "jpeg" ? "jpg" : img.type;
      const path = `${input.householdId}/${input.companyId}/${img.kind}-${createHash("sha1").update(img.bytes).digest("hex").slice(0, 16)}.${ext}`;
      const up = await this.admin.storage.from("company-media").upload(path, img.bytes, { contentType: `image/${img.type}`, upsert: true, cacheControl: "604800" });
      if (up.error) continue;
      const url = this.admin.storage.from("company-media").getPublicUrl(path).data.publicUrl;
      const host = new URL(img.pageUrl).hostname.replace(/^www\./, "");
      if (img.kind === "hero") await this.admin.from("company_media").update({ is_primary: false }).eq("company_id", input.companyId);
      this.must(
        await this.admin.from("company_media").insert({
          company_id: input.companyId,
          kind: img.kind,
          storage_path: path,
          url,
          is_primary: img.kind === "hero",
          rights_status: "attributed",
          origin_url: img.originUrl,
          creator_or_owner: input.companyName,
          license_or_permission: img.kind === "hero" ? (img.fromPage ? "Picture published by the company on its own homepage; shown with attribution" : "Published by the company on its website for link previews; shown with attribution") : "Company logo from its own website; shown with attribution",
          attribution: `Image: ${host}`,
          alt_text: img.kind === "hero" ? `${input.companyName}, image from ${host}` : `${input.companyName} logo`,
          checked_at: new Date().toISOString(),
        }),
        "media",
      );
      saved += 1;
    }
    return saved;
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
    try {
      await this.writeCompanyDetail(input, companyId, now, src);
    } catch (e) {
      // Never leave a half-written new company behind; the run logs the reason and carries on.
      if (isNew) await this.admin.from("companies").delete().eq("id", companyId);
      throw e;
    }
    return { companyId, slug, name: c.name, isNew };
  }

  private async writeCompanyDetail(input: Parameters<ResearchStore["publishCompany"]>[0], companyId: string, now: string, src: (urls: string[] | undefined) => string | null) {
    const { candidate: c, sourceIds } = input;

    // Facts: supersede, never delete.
    for (const f of c.facts) {
      await this.admin.from("company_facts").update({ effective_to: now }).eq("company_id", companyId).eq("field_key", f.key).is("effective_to", null);
      this.must(await this.admin.from("company_facts").insert({ company_id: companyId, field_key: f.key, label: f.label, value_jsonb: f.value, currency: f.currency, as_of_date: toIsoDate(f.asOf), evidence_status: f.evidenceStatus, source_id: src(f.sourceUrls) }), "fact");
    }
    if (c.round) {
      await this.admin.from("funding_rounds").update({ is_current: false }).eq("company_id", companyId).eq("is_current", true);
      this.must(await this.admin.from("funding_rounds").insert({ company_id: companyId, stage: c.round.stage ?? c.stage ?? "Unknown", target_amount: c.round.target?.amount ?? null, currency: c.round.target?.currency ?? c.round.preMoney?.currency ?? c.round.postMoney?.currency ?? c.round.reportedCommitted?.currency ?? null, pre_money: c.round.preMoney?.amount ?? null, post_money: c.round.postMoney?.amount ?? null, reported_committed: c.round.reportedCommitted?.amount ?? null, closes_at: toIsoDate(c.round.closesAt), claimed_status: c.round.claimedStatus, lead_investors: c.round.leadInvestors, evidence_status: c.round.evidenceStatus, source_id: src(c.round.sourceUrls), is_current: true }), "round");
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

  /** True when an audit row with this action was written in the last `hours`. */
  async auditedWithin(householdId: string, action: string, hours: number): Promise<boolean> {
    const { count } = await this.admin.from("audit_events").select("id", { count: "exact", head: true }).eq("household_id", householdId).eq("action", action).gte("created_at", new Date(Date.now() - hours * 3600_000).toISOString());
    return (count ?? 0) > 0;
  }

  async importQueued(householdId: string, label: string): Promise<boolean> {
    const { count } = await this.admin.from("research_imports").select("id", { count: "exact", head: true }).eq("household_id", householdId).eq("label", label);
    return (count ?? 0) > 0;
  }

  /**
   * Companies due a Companies House look (none in the last 7 days), with the
   * company number if a fact already holds it and the newest allotment recorded.
   */
  async companiesForFilingCheck(householdId: string, limit: number) {
    const companies = this.must(await this.admin.from("companies").select("id, name, legal_name").eq("household_id", householdId).eq("is_demo", false).returns<{ id: string; name: string; legal_name: string | null }[]>(), "companies") ?? [];
    const ids = companies.map((c) => c.id);
    if (!ids.length) return [];
    const [recent, facts] = await Promise.all([
      this.admin.from("audit_events").select("object_id").eq("household_id", householdId).eq("action", "companies_house.check").gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()).returns<{ object_id: string }[]>(),
      this.admin.from("company_facts").select("company_id, field_key, value_jsonb").in("company_id", ids).in("field_key", ["company_number", "latest_sh01"]).is("effective_to", null).returns<{ company_id: string; field_key: string; value_jsonb: unknown }[]>(),
    ]);
    const skip = new Set((recent.data ?? []).map((r) => r.object_id));
    const factOf = (id: string, key: string) => {
      const v = (facts.data ?? []).find((f) => f.company_id === id && f.field_key === key)?.value_jsonb;
      return typeof v === "string" ? v : v && typeof v === "object" && "value" in v ? String((v as { value: unknown }).value) : null;
    };
    return companies
      .filter((c) => !skip.has(c.id))
      .slice(0, limit)
      .map((c) => ({ companyId: c.id, name: c.name, legalName: c.legal_name, companyNumber: factOf(c.id, "company_number")?.match(/[0-9A-Z]{8}/)?.[0] ?? null, lastSh01: factOf(c.id, "latest_sh01") }));
  }

  /** Records a company number and/or a newer share allotment as facts, with the filing-history page as the source and a timeline entry. */
  async recordFiling(input: { householdId: string; companyId: string; companyName: string; companyNumber: string; url: string; allotment: { allottedOn: string | null; date: string; capital: string | null } | null; newAllotment: boolean }) {
    const now = new Date().toISOString();
    const existing = this.must(await this.admin.from("sources").select("id").eq("household_id", input.householdId).eq("canonical_url", input.url).maybeSingle<{ id: string }>(), "source");
    let sourceId = existing?.id ?? null;
    if (!sourceId) {
      const ins = this.must(await this.admin.from("sources").insert({ household_id: input.householdId, company_id: input.companyId, canonical_url: input.url, title: `${input.companyName}: filing history (Companies House)`, publisher: "Companies House", source_type: "filing", retrieved_at: now, trust_tier: "primary", claim_type: "filing" }).select("id").single<{ id: string }>(), "source insert");
      sourceId = ins.id;
    }
    const setFact = async (key: string, label: string, value: string, asOf: string | null) => {
      await this.admin.from("company_facts").update({ effective_to: now }).eq("company_id", input.companyId).eq("field_key", key).is("effective_to", null);
      this.must(await this.admin.from("company_facts").insert({ company_id: input.companyId, field_key: key, label, value_jsonb: value, as_of_date: asOf, evidence_status: "verified_independent", source_id: sourceId }), "fact");
    };
    await setFact("company_number", "Company number", input.companyNumber, null);
    if (input.allotment) {
      const when = input.allotment.allottedOn ?? input.allotment.date;
      await setFact("latest_sh01", "Latest share allotment (SH01)", `${when}${input.allotment.capital ? ` · capital ${input.allotment.capital}` : ""}`, when);
      if (input.newAllotment) {
        // A recent allotment is news (a round just completed); an old one is history for the timeline only.
        const recent = Date.now() - new Date(when).getTime() < 180 * 86_400_000;
        await this.admin.from("company_updates").upsert(
          { company_id: input.companyId, update_type: "funding", headline: "Shares allotted (Companies House)", summary: `An SH01 statement of capital was filed for an allotment of shares on ${new Date(when).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}${input.allotment.capital ? ` (nominal capital now ${input.allotment.capital})` : ""}. A round, or a tranche of one, ${recent ? "has completed" : "completed then"}.`, materiality: recent ? "high" : "low", source_id: sourceId, effective_at: `${when}T00:00:00Z`, detected_at: now, dedupe_key: `sh01:${when}` },
          { onConflict: "company_id,dedupe_key", ignoreDuplicates: true },
        );
      }
    }
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

export function createSupabaseResearchStore(): SupabaseResearchStore {
  return new SupabaseResearchStore(createSupabaseAdminClient());
}

const RUN_COLUMNS = "id, household_id, local_date, run_kind, status, phase, provider_response_id, new_company_limit, started_at, progress_at, source_count, candidates_count, published_count, estimated_cost, summary, error_summary";
type RunRow = { id: string; household_id: string; local_date: string; run_kind: StoredRun["runKind"]; status: StoredRun["status"]; phase: StoredRun["phase"]; provider_response_id: string | null; new_company_limit: number | null; started_at: string; progress_at: string | null; source_count: number; candidates_count: number; published_count: number; estimated_cost: string | number | null; summary: string; error_summary: string | null };

function mapRun(r: RunRow): StoredRun {
  return { id: r.id, householdId: r.household_id, localDate: r.local_date, runKind: r.run_kind, status: r.status, phase: r.phase, responseHandle: r.provider_response_id, newCompanyLimit: r.new_company_limit, startedAt: r.started_at, progressAt: r.progress_at, sourceCount: r.source_count, candidatesCount: r.candidates_count, publishedCount: r.published_count, estimatedCostUsd: Number(r.estimated_cost ?? 0), summary: r.summary, errorSummary: r.error_summary };
}
