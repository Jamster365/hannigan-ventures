/**
 * Emit SQL that seeds the labelled demo dataset into an existing household,
 * mapping the first demo member (owner) to a real user id. Used when the
 * service-role seed script cannot run. Usage:
 *   npx tsx scripts/demo-sql.ts <household_id> <owner_user_id> > /tmp/demo.sql
 * Output is plain SQL (no PL/pgSQL blocks) so it can be pasted into any SQL
 * runner; companies are separated by "-- @@BLOCK@@" and every statement is
 * idempotent (upsert, or delete-then-insert per company).
 */
import { DEMO_COMPANIES, DEMO_EVENTS, DEMO_STORIES } from "@/lib/demo/dataset";
import { DEMO_MEMBERS } from "@/lib/demo/members";

const [hid, ownerId] = process.argv.slice(2);
if (!hid || !ownerId) throw new Error("usage: demo-sql <household_id> <owner_user_id>");
const q = (v: unknown): string => (v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "true" : "false") : Array.isArray(v) ? `array[${v.map(q).join(",")}]::text[]` : `'${String(v).replace(/'/g, "''")}'`);
const j = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const userFor = (demoId: string) => (demoId === DEMO_MEMBERS[0].userId ? ownerId : null);

const out: string[] = [];
for (const b of DEMO_COMPANIES) {
  const c = b.company;
  const cid = `(select id from public.companies where household_id = ${q(hid)} and slug = ${q(c.slug)})`;
  out.push(`insert into public.companies (household_id, name, slug, domain, sector, sub_sector, city, country, stage, teaser, description, is_demo, first_discovered_at, last_researched_at, discovery_signal, research_rule_matched, tags, eis_status, eis_note, artwork_hue, artwork_motif)
values (${q(hid)}, ${q(c.name)}, ${q(c.slug)}, ${q(c.domain ?? null)}, ${q(c.sector)}, ${q(c.subSector ?? null)}, ${q(c.city)}, ${q(c.country)}, ${q(c.stage)}, ${q(c.teaser)}, ${q(c.description)}, true, ${q(c.firstDiscoveredAt)}, ${q(c.lastResearchedAt)}, ${q(c.discoverySignal ?? null)}, ${q(c.researchRuleMatched ?? null)}, ${q(c.tags)}, ${q(c.eisStatus)}, ${q(c.eisNote ?? null)}, ${c.artwork.hue}, ${q(c.artwork.motif)})
on conflict (household_id, slug) do update set name = excluded.name;`);
  for (const s of b.sources) {
    out.push(`insert into public.sources (household_id, company_id, canonical_url, title, publisher, source_type, published_at, retrieved_at, trust_tier, claim_type) values (${q(hid)}, ${cid}, ${q(s.canonicalUrl)}, ${q(s.title)}, ${q(s.publisher)}, ${q(s.sourceType)}, ${q(s.publishedAt)}, ${q(s.retrievedAt)}, ${q(s.trustTier)}, ${q(s.claimType ?? null)}) on conflict (household_id, canonical_url) do update set title = excluded.title;`);
  }
  const S = (id: string | null) => {
    const url = b.sources.find((x) => x.id === id)?.canonicalUrl;
    return url ? `(select id from public.sources where household_id = ${q(hid)} and canonical_url = ${q(url)})` : "null";
  };
  // Idempotent without DELETE (some SQL runners block destructive statements):
  // each row is inserted only when no row with the same natural key exists.
  const G = (table: string, key: string, sql: string) => out.push(sql.replace(/\) values \(([\s\S]*)\);$/, `) select $1 where not exists (select 1 from public.${table} where company_id = ${cid} and ${key});`));
  for (const m of b.media) G("company_media", `kind = ${q(m.kind)} and alt_text = ${q(m.altText)}`, `insert into public.company_media (company_id, kind, url, is_primary, rights_status, alt_text, checked_at) values (${cid}, ${q(m.kind)}, ${q(m.url)}, ${m.isPrimary}, ${q(m.rightsStatus)}, ${q(m.altText)}, ${q(m.checkedAt ?? null)});`);
  for (const f of b.facts) G("company_facts", `field_key = ${q(f.fieldKey)}`, `insert into public.company_facts (company_id, field_key, label, value_jsonb, unit, currency, as_of_date, evidence_status, source_id) values (${cid}, ${q(f.fieldKey)}, ${q(f.label)}, ${j(f.value)}, ${q(f.unit ?? null)}, ${q(f.currency ?? null)}, ${q(f.asOfDate?.slice(0, 10) ?? null)}, ${q(f.evidenceStatus)}, ${S(f.sourceId)});`);
  for (const r of b.rounds) G("funding_rounds", `stage = ${q(r.stage)}`, `insert into public.funding_rounds (company_id, stage, target_amount, currency, pre_money, post_money, reported_committed, opened_at, closes_at, claimed_status, lead_investors, evidence_status, source_id, is_current) values (${cid}, ${q(r.stage)}, ${q(r.targetAmount)}, ${q(r.currency)}, ${q(r.preMoney)}, ${q(r.postMoney)}, ${q(r.reportedCommitted)}, ${q(r.openedAt)}, ${q(r.closesAt)}, ${q(r.claimedStatus)}, ${q(r.leadInvestors)}, ${q(r.evidenceStatus)}, ${S(r.sourceId)}, ${r.isCurrent});`);
  for (const a of b.accessChecks) G("investment_access_checks", `checked_at = ${q(a.checkedAt)}::timestamptz`, `insert into public.investment_access_checks (company_id, access_status, route_type, contact_or_url, min_cheque, max_cheque, currency, checked_at, expires_at, verifier, source_id, notes) values (${cid}, ${q(a.accessStatus)}, ${q(a.routeType)}, ${q(a.contactOrUrl)}, ${q(a.minCheque)}, ${q(a.maxCheque)}, ${q(a.currency)}, ${q(a.checkedAt)}, ${q(a.expiresAt)}, ${q(a.verifier)}, ${S(a.sourceId)}, ${q(a.notes)});`);
  if (b.assessment) {
    const a = b.assessment;
    const breakdown = a.breakdown.map((d) => ({ ...d, sourceIds: [] as string[] }));
    G("company_assessments", `true`, `insert into public.company_assessments (company_id, ai_priority, ai_score, confidence, summary, why_interested, risks, bull_case, bear_case, why_now, assumptions, open_questions, diligence_checklist, next_action, score_breakdown_jsonb, model_version, prompt_version, created_at) values (${cid}, ${q(a.aiPriority)}, ${q(a.aiScore)}, ${q(a.confidence)}, ${q(a.summary)}, ${q(a.whyInterested)}, ${q(a.risks)}, ${q(a.bullCase)}, ${q(a.bearCase)}, ${q(a.whyNow)}, ${q(a.assumptions)}, ${q(a.openQuestions)}, ${q(a.diligenceChecklist)}, ${q(a.nextAction)}, ${j(breakdown)}, ${q(a.modelVersion)}, ${q(a.promptVersion)}, ${q(a.createdAt)});`);
  }
  for (const f of b.founders) G("founders", `name = ${q(f.name)}`, `insert into public.founders (company_id, name, role, bio, profile_url, evidence_status, source_id) values (${cid}, ${q(f.name)}, ${q(f.role)}, ${q(f.bio)}, ${q(f.profileUrl)}, ${q(f.evidenceStatus)}, ${S(f.sourceId)});`);
  for (const h of b.teamHighlights) G("team_highlights", `text = ${q(h.text)}`, `insert into public.team_highlights (company_id, text, evidence_status, source_id) values (${cid}, ${q(h.text)}, ${q(h.evidenceStatus)}, ${S(h.sourceId)});`);
  for (const u of b.updates.filter((x) => x.updateType !== "family")) G("company_updates", `dedupe_key = ${q(u.id)}`, `insert into public.company_updates (company_id, update_type, headline, summary, materiality, source_id, effective_at, detected_at, change_jsonb, dedupe_key) values (${cid}, ${q(u.updateType)}, ${q(u.headline)}, ${q(u.summary)}, ${q(u.materiality)}, ${S(u.sourceId)}, ${q(u.effectiveAt)}, ${q(u.detectedAt)}, ${u.change ? j(u.change) : "null"}, ${q(u.id)});`);
  for (const v of b.votes) {
    const uid = userFor(v.userId);
    if (uid) G("member_votes", `user_id = ${q(uid)}`, `insert into public.member_votes (company_id, user_id, vote, score, updated_at) values (${cid}, ${q(uid)}, ${q(v.vote)}, ${q(v.score)}, ${q(v.updatedAt)});`);
  }
  for (const c2 of b.comments) {
    const uid = userFor(c2.authorUserId);
    if (uid) G("comments", `author_user_id = ${q(uid)} and body = ${q(c2.body)}`, `insert into public.comments (company_id, author_user_id, body, created_at) values (${cid}, ${q(uid)}, ${q(c2.body)}, ${q(c2.createdAt)});`);
  }
  for (const u of b.bookmarkedBy) {
    const uid = userFor(u);
    if (uid) out.push(`insert into public.member_bookmarks (company_id, user_id) values (${cid}, ${q(uid)}) on conflict do nothing;`);
  }
  out.push("-- @@BLOCK@@");
}
const slugOf = (id: string | null) => DEMO_COMPANIES.find((b) => b.company.id === id)?.company.slug ?? null;
const urlOf = (id: string | null) => DEMO_COMPANIES.flatMap((b) => b.sources).find((s) => s.id === id)?.canonicalUrl ?? null;
for (const s of DEMO_STORIES) out.push(`insert into public.home_stories (household_id, story_type, company_id, headline, teaser, priority, source_id, created_at, expires_at) select ${q(hid)}, ${q(s.storyType)}, ${slugOf(s.companyId) ? `(select id from public.companies where household_id = ${q(hid)} and slug = ${q(slugOf(s.companyId))})` : "null"}, ${q(s.headline)}, ${q(s.teaser)}, ${s.priority}, ${urlOf(s.sourceId) ? `(select id from public.sources where household_id = ${q(hid)} and canonical_url = ${q(urlOf(s.sourceId))})` : "null"}, ${q(s.createdAt)}, ${q(s.expiresAt)} where not exists (select 1 from public.home_stories where household_id = ${q(hid)} and headline = ${q(s.headline)});`);
for (const e of DEMO_EVENTS) out.push(`insert into public.events (household_id, name, organiser, event_type, start_at, end_at, timezone, venue, city, is_online, registration_url, access_status, registration_checked_at, audience_fit, significance, next_action, importance) values (${q(hid)}, ${q(e.name)}, ${q(e.organiser)}, ${q(e.eventType)}, ${q(e.startAt)}, ${q(e.endAt)}, ${q(e.timezone)}, ${q(e.venue)}, ${q(e.city)}, ${e.isOnline}, ${q(e.registrationUrl)}, ${q(e.accessStatus)}, ${q(e.registrationCheckedAt)}, ${q(e.audienceFit)}, ${q(e.significance)}, ${q(e.nextAction)}, ${q(e.importance)}) on conflict (household_id, name, start_at) do nothing;`);
process.stdout.write(out.join("\n") + "\n");
