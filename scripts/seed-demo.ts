/**
 * Seed a Supabase project with the household, three members, the default
 * research instructions, the research-mandate network names and the
 * LABELLED demo dataset (fictional companies, is_demo = true).
 *
 * Usage:
 *   SEED_MEMBER_EMAILS=owner@x,brother@x,dad@x npm run seed:demo
 *   npm run seed:demo -- --no-demo-companies   (household + prompt only)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Idempotent:
 * re-running updates in place and never duplicates rows.
 */
import { createClient } from "@supabase/supabase-js";
import { DEMO_COMPANIES, DEMO_EVENTS, DEMO_NETWORKS, DEMO_STORIES } from "@/lib/demo/dataset";
import { DEMO_MEMBERS } from "@/lib/demo/members";
import { DEFAULT_PREFERENCES, DEFAULT_RESEARCH_PROMPT } from "@/lib/research/default-prompt";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const emails = (process.env.SEED_MEMBER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const names = (process.env.SEED_MEMBER_NAMES ?? "Jamie,George,Chris").split(",").map((n) => n.trim());
if (emails.length === 0) {
  console.error("Set SEED_MEMBER_EMAILS (comma-separated; owner first). Emails are never stored in the repository.");
  process.exit(1);
}
const withDemoCompanies = !process.argv.includes("--no-demo-companies");
const admin = createClient(url, key, { auth: { persistSession: false } });

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): NonNullable<T> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  if (res.data === null || res.data === undefined) throw new Error(`${what}: no data returned`);
  return res.data as NonNullable<T>;
}

async function main() {
  // 1. Household
  const existingRes = await admin.from("households").select("id").eq("name", "Hannigan Ventures household").maybeSingle<{ id: string }>();
  if (existingRes.error) throw new Error(`household: ${existingRes.error.message}`);
  const householdId = existingRes.data?.id ?? must(await admin.from("households").insert({ name: "Hannigan Ventures household" }).select("id").single<{ id: string }>(), "create household").id;
  console.log("household", householdId);

  // 2. Members (auth users created or reused; never public sign-up)
  const userIds: string[] = [];
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    const list = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (list.error) throw new Error(`list users: ${list.error.message}`);
    let user = list.data.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { display_name: names[i] ?? `Member ${i + 1}` } });
      if (created.error || !created.data.user) throw new Error(`create user: ${created.error?.message ?? "no user"}`);
      user = created.data.user;
    }
    userIds.push(user.id);
    await admin.from("profiles").upsert({ user_id: user.id, display_name: names[i] ?? `Member ${i + 1}`, accent: DEMO_MEMBERS[i]?.accent ?? "blue" });
    must(await admin.from("household_members").upsert({ household_id: householdId, user_id: user.id, role: i === 0 ? "owner" : "member", status: "active" }), "membership");
  }
  console.log("members", userIds.length);

  // 3. Default research instructions (only if none active)
  const activeRes = await admin.from("research_prompts").select("id").eq("household_id", householdId).eq("active", true).maybeSingle();
  if (activeRes.error) throw new Error(`prompt: ${activeRes.error.message}`);
  if (!activeRes.data) {
    must(await admin.from("research_prompts").insert({ household_id: householdId, version: 1, prompt_text: DEFAULT_RESEARCH_PROMPT, config_jsonb: DEFAULT_PREFERENCES, created_by: userIds[0], active: true, change_note: "Initial household instructions." }), "insert prompt");
    console.log("prompt v1 created");
  }

  // 4. Angel network directory (names only; details unverified until researched)
  for (const n of DEMO_NETWORKS) {
    must(await admin.from("angel_networks").upsert({ household_id: householdId, name: n.name, region: n.region, notes: n.notes }, { onConflict: "household_id,name" }), `network ${n.name}`);
  }

  if (!withDemoCompanies) return;

  // 5. Labelled demo companies (fictional)
  const idMap = new Map<string, string>(); // demo id -> db id
  const sourceMap = new Map<string, string>();
  for (const b of DEMO_COMPANIES) {
    const c = b.company;
    const row = must(
      await admin
        .from("companies")
        .upsert(
          { household_id: householdId, name: c.name, slug: c.slug, domain: c.domain ?? null, sector: c.sector, sub_sector: c.subSector ?? null, city: c.city, country: c.country, stage: c.stage, teaser: c.teaser, description: c.description, is_demo: true, first_discovered_at: c.firstDiscoveredAt, last_researched_at: c.lastResearchedAt, discovery_signal: c.discoverySignal ?? null, research_rule_matched: c.researchRuleMatched ?? null, tags: c.tags, eis_status: c.eisStatus, eis_note: c.eisNote ?? null, artwork_hue: c.artwork.hue, artwork_motif: c.artwork.motif },
          { onConflict: "household_id,slug" },
        )
        .select("id")
        .single<{ id: string }>(),
      `company ${c.name}`,
    );
    idMap.set(c.id, row.id);
    const cid = row.id;

    for (const s of b.sources) {
      const sr = must(await admin.from("sources").upsert({ household_id: householdId, company_id: cid, canonical_url: s.canonicalUrl, title: s.title, publisher: s.publisher, source_type: s.sourceType, published_at: s.publishedAt, retrieved_at: s.retrievedAt, trust_tier: s.trustTier, claim_type: s.claimType ?? null }, { onConflict: "household_id,canonical_url" }).select("id").single<{ id: string }>(), `source ${s.title}`);
      sourceMap.set(s.id, sr.id);
    }
    const src = (id: string | null) => (id ? (sourceMap.get(id) ?? null) : null);

    // Replace child rows for idempotency.
    for (const table of ["company_media", "company_facts", "funding_rounds", "investment_access_checks", "company_assessments", "founders", "team_highlights", "company_updates"]) {
      must(await admin.from(table).delete().eq("company_id", cid), `clear ${table}`);
    }
    must(await admin.from("company_media").insert(b.media.map((m) => ({ company_id: cid, kind: m.kind, url: m.url, is_primary: m.isPrimary, rights_status: m.rightsStatus, alt_text: m.altText, checked_at: m.checkedAt ?? null }))), "media");
    must(await admin.from("company_facts").insert(b.facts.map((f) => ({ company_id: cid, field_key: f.fieldKey, label: f.label, value_jsonb: f.value, unit: f.unit ?? null, currency: f.currency ?? null, as_of_date: f.asOfDate?.slice(0, 10) ?? null, evidence_status: f.evidenceStatus, source_id: src(f.sourceId) }))), "facts");
    must(await admin.from("funding_rounds").insert(b.rounds.map((r) => ({ company_id: cid, stage: r.stage, target_amount: r.targetAmount, currency: r.currency, pre_money: r.preMoney, post_money: r.postMoney, reported_committed: r.reportedCommitted, opened_at: r.openedAt, closes_at: r.closesAt, claimed_status: r.claimedStatus, lead_investors: r.leadInvestors, evidence_status: r.evidenceStatus, source_id: src(r.sourceId), is_current: r.isCurrent }))), "rounds");
    if (b.accessChecks.length) must(await admin.from("investment_access_checks").insert(b.accessChecks.map((a) => ({ company_id: cid, access_status: a.accessStatus, route_type: a.routeType, contact_or_url: a.contactOrUrl, min_cheque: a.minCheque, max_cheque: a.maxCheque, currency: a.currency, checked_at: a.checkedAt, expires_at: a.expiresAt, verifier: a.verifier, source_id: src(a.sourceId), notes: a.notes }))), "access");
    if (b.assessment) {
      const a = b.assessment;
      must(await admin.from("company_assessments").insert({ company_id: cid, ai_priority: a.aiPriority, ai_score: a.aiScore, confidence: a.confidence, summary: a.summary, why_interested: a.whyInterested, risks: a.risks, bull_case: a.bullCase, bear_case: a.bearCase, why_now: a.whyNow, assumptions: a.assumptions, open_questions: a.openQuestions, diligence_checklist: a.diligenceChecklist, next_action: a.nextAction, score_breakdown_jsonb: a.breakdown.map((d) => ({ ...d, sourceIds: d.sourceIds.map((id) => sourceMap.get(id) ?? id) })), source_ids: a.sourceIds.map((id) => sourceMap.get(id) ?? id), model_version: a.modelVersion, prompt_version: a.promptVersion, created_at: a.createdAt }), "assessment");
    }
    if (b.founders.length) must(await admin.from("founders").insert(b.founders.map((f) => ({ company_id: cid, name: f.name, role: f.role, bio: f.bio, profile_url: f.profileUrl, evidence_status: f.evidenceStatus, source_id: src(f.sourceId) }))), "founders");
    if (b.teamHighlights.length) must(await admin.from("team_highlights").insert(b.teamHighlights.map((h) => ({ company_id: cid, text: h.text, evidence_status: h.evidenceStatus, source_id: src(h.sourceId) }))), "highlights");
    must(await admin.from("company_updates").insert(b.updates.filter((u) => u.updateType !== "family").map((u) => ({ company_id: cid, update_type: u.updateType, headline: u.headline, summary: u.summary, materiality: u.materiality, source_id: src(u.sourceId), effective_at: u.effectiveAt, detected_at: u.detectedAt, change_jsonb: u.change ?? null, dedupe_key: u.id }))), "updates");

    // Votes and comments map demo members -> real users by position; the DB trigger computes the stage.
    const userFor = (demoId: string) => userIds[DEMO_MEMBERS.findIndex((m) => m.userId === demoId)];
    must(await admin.from("member_votes").delete().eq("company_id", cid), "clear votes");
    for (const v of b.votes) {
      const uid = userFor(v.userId);
      if (uid) must(await admin.from("member_votes").insert({ company_id: cid, user_id: uid, vote: v.vote, score: v.score, updated_at: v.updatedAt }), "vote");
    }
    must(await admin.from("comments").delete().eq("company_id", cid), "clear comments");
    for (const c of b.comments) {
      const uid = userFor(c.authorUserId);
      if (uid) must(await admin.from("comments").insert({ company_id: cid, author_user_id: uid, body: c.body, created_at: c.createdAt }), "comment");
    }
    for (const u of b.bookmarkedBy) {
      const uid = userFor(u);
      if (uid) await admin.from("member_bookmarks").upsert({ company_id: cid, user_id: uid });
    }
    console.log("seeded", c.name);
  }

  // 6. Stories and events
  must(await admin.from("home_stories").delete().eq("household_id", householdId), "clear stories");
  must(await admin.from("home_stories").insert(DEMO_STORIES.map((s) => ({ household_id: householdId, story_type: s.storyType, company_id: s.companyId ? idMap.get(s.companyId) : null, headline: s.headline, teaser: s.teaser, priority: s.priority, source_id: s.sourceId ? sourceMap.get(s.sourceId) : null, created_at: s.createdAt, expires_at: s.expiresAt }))), "stories");
  for (const e of DEMO_EVENTS) {
    must(await admin.from("events").upsert({ household_id: householdId, name: e.name, organiser: e.organiser, event_type: e.eventType, start_at: e.startAt, end_at: e.endAt, timezone: e.timezone, venue: e.venue, city: e.city, is_online: e.isOnline, registration_url: e.registrationUrl, access_status: e.accessStatus, registration_checked_at: e.registrationCheckedAt, audience_fit: e.audienceFit, significance: e.significance, next_action: e.nextAction, related_company_ids: e.relatedCompanyIds.map((id) => idMap.get(id)).filter(Boolean), importance: e.importance }, { onConflict: "household_id,name,start_at" }), `event ${e.name}`);
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
