import { accessLabel, effectiveAccess, eisLabel } from "./company-status";
import { computeFamilyStage } from "./family-consensus";
import { formatMoney } from "./format";
import { buildMatcher, type MemberPreferences } from "./learning";
import type { Assessment, Company, CompanyBundle, CompanyMedia, EvidenceStatus, Member, Notification, VoteValue } from "./types";

/**
 * View models for the swipe app: one card per company in a member's deck, and
 * one row per match. Built on the server from CompanyBundles; plain data so it
 * can be handed to client components.
 *
 * Other members' votes never appear on a card. They are only revealed by a
 * match (two ticks) or by "almost a match" (see swipeAction).
 */

export type RaisingTone = "green" | "blue" | "amber" | "red" | "neutral";

export interface SwipeCard {
  company: Company;
  media: CompanyMedia | null;
  logo: CompanyMedia | null;
  raising: { label: string; tone: RaisingTone; detail: string };
  facts: { label: string; value: string; hint?: string }[];
  ai: Pick<Assessment, "aiPriority" | "aiScore" | "confidence" | "summary"> | null;
  whyInteresting: string[];
  risks: string[];
  founders: { name: string; role: string; bio: string }[];
  howToGetIn: string;
  sources: { id: string; title: string; publisher: string; url: string }[];
  /** The AI's view in one line each way, from the latest assessment. */
  aiLine: { worth: string | null; watch: string | null };
  /** Raising through a crowdfunding platform (Crowdcube, Republic, Seedrs...). */
  crowdfunding: boolean;
  /**
   * The crowdfunding platform by name, and the campaign page a member can
   * open to check it. These pages block automated reading, so the round
   * stays "reported" until a member checks it.
   */
  platform: { name: string; url: string | null; checkedBy: string | null } | null;
  /** Why the matcher put this company here (learned from answers), if anything. */
  why: string | null;
  /** An explore pick, outside this member's usual pattern. */
  explore: boolean;
  /** This member's current vote, if any (only "unsure" can be left over from the classic app). */
  myVote: VoteValue | null;
}

const CROWDFUNDING = /crowdcube|republic|seedrs|crowdfunding/i;
const PLATFORMS: [RegExp, string][] = [
  [/crowdcube/i, "Crowdcube"],
  [/seedrs/i, "Seedrs"],
  [/republic/i, "Republic"],
];

/** The crowdfunding platform a company is listed on, from its latest access check. */
export function crowdfundingPlatform(bundle: CompanyBundle): string | null {
  const latest = [...bundle.accessChecks].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
  if (!latest) return null;
  const text = `${latest.contactOrUrl ?? ""} ${latest.notes}`;
  for (const [re, name] of PLATFORMS) if (re.test(text)) return name;
  return null;
}

/**
 * A live campaign listing on Crowdcube, Seedrs or Republic: probably open,
 * though research can't read the page to confirm it. "Coming soon" and
 * early-access pages don't count.
 */
function probablyOpenListing(bundle: CompanyBundle, status: string): boolean {
  if (!["fundraising_reported", "contactable", "unknown"].includes(status)) return false;
  const latest = [...bundle.accessChecks].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
  return Boolean(crowdfundingPlatform(bundle)) && !/coming-soon|early-access/i.test(latest?.contactOrUrl ?? "");
}

/** True when the round is over: the deck parks these on the watch list until a new round appears. */
export function isClosedRound(bundle: CompanyBundle, opts: { now?: Date } = {}): boolean {
  const access = effectiveAccess(bundle.accessChecks, opts);
  const round = bundle.rounds.find((r) => r.isCurrent) ?? null;
  return access.status === "closed" || (round?.claimedStatus === "closed" && !["verified_open", "closing_soon", "fundraising_reported", "expected"].includes(access.status));
}

/** Higher = closer to a cheque actually being possible. With fitScore, orders the deck. */
export function investability(bundle: CompanyBundle, opts: { now?: Date; maxChequeGbp?: number } = {}): number {
  const access = effectiveAccess(bundle.accessChecks, opts);
  const round = bundle.rounds.find((r) => r.isCurrent) ?? null;
  if (access.canInvestNow) return 100;
  if (access.status === "closing_soon" || access.status === "verified_open") return 90;
  // Listed on a crowdfunding platform: probably open, even though research
  // cannot read the page to confirm it.
  if (probablyOpenListing(bundle, access.status)) return 80;
  if (round?.claimedStatus === "open" || access.status === "fundraising_reported") return 70;
  if (access.status === "expected" || round?.claimedStatus === "expected") return 50;
  if (access.status === "contactable") return 40;
  if (access.status === "stale") return 30;
  return 20;
}

const UK = /^(uk|u\.k\.|united kingdom|great britain|england|scotland|wales|northern ireland|gb)$/i;

/** True unless the company is known to be outside the UK (unknown location stays in). */
export function isUk(bundle: CompanyBundle): boolean {
  const country = bundle.company.country?.trim();
  return !country || country === "Unknown" || UK.test(country);
}

/**
 * How well a company fits what the family looks for (owner's brief, 23 Oct
 * 2026): UK EIS/SEIS opportunities at an early stage, where a cheque buys a
 * meaningful share. Non-EIS companies still appear, just rarely near the top.
 */
export function fitScore(bundle: CompanyBundle): number {
  const { company } = bundle;
  let score = 0;
  score += company.eisStatus === "confirmed_documented" ? 30 : company.eisStatus === "company_claimed" || company.eisStatus === "pending" ? 20 : company.eisStatus === "not_applicable" ? -30 : 0;
  const stage = (company.stage ?? "").toLowerCase();
  if (/pre-?seed|angel/.test(stage)) score += 15;
  else if (/seed/.test(stage)) score += 10;
  else if (/series [b-z]|growth|late/.test(stage)) score -= 15;
  const round = bundle.rounds.find((r) => r.isCurrent) ?? null;
  const pre = round?.preMoney ?? null;
  if (pre !== null && (round?.currency ?? "GBP") === "GBP") score += pre <= 5_000_000 ? 10 : pre >= 20_000_000 ? -10 : 0;
  return score;
}

export function evidenceHint(status: EvidenceStatus): string | undefined {
  switch (status) {
    case "verified_independent":
      return "Independently verified";
    case "official_company_claim":
      return "Company claim";
    case "third_party_report":
      return "Third-party report";
    case "analyst_inference":
      return "Inference";
    default:
      return undefined;
  }
}

export function buildSwipeCard(bundle: CompanyBundle, userId: string, opts: { now?: Date; maxChequeGbp?: number; why?: string | null; explore?: boolean } = {}): SwipeCard {
  const { company, media, rounds, accessChecks, assessment, founders, facts, sources, votes } = bundle;
  const access = effectiveAccess(accessChecks, opts);
  const round = rounds.find((r) => r.isCurrent) ?? null;

  const platformName = crowdfundingPlatform(bundle);
  let raising: SwipeCard["raising"];
  if (access.canInvestNow) raising = { label: "Can invest now", tone: "green", detail: access.reason };
  else if (access.status === "closed" || round?.claimedStatus === "closed") raising = { label: "Round closed", tone: "red", detail: access.reason };
  else if (platformName && probablyOpenListing(bundle, access.status)) raising = { label: `On ${platformName} · probably open`, tone: "blue", detail: "Reported until a member checks the page" };
  else if (round?.claimedStatus === "open") raising = { label: "Raising (reported)", tone: "blue", detail: evidenceHint(round.evidenceStatus) ?? "Not verified" };
  else if (access.status !== "unknown") raising = { label: accessLabel(access.status), tone: access.status === "stale" || access.status === "expected" ? "amber" : "blue", detail: access.reason };
  else if (round?.claimedStatus === "expected") raising = { label: "Round expected", tone: "amber", detail: evidenceHint(round.evidenceStatus) ?? "Not verified" };
  else raising = { label: "Raising: unknown", tone: "neutral", detail: "No source says they are raising." };

  const valuation = round?.preMoney ? `${formatMoney(round.preMoney, round.currency)} pre` : round?.postMoney ? `${formatMoney(round.postMoney, round.currency)} post` : "Unknown";
  const cardFacts: SwipeCard["facts"] = [
    { label: "Stage", value: company.stage || "Unknown" },
    { label: "Raising", value: round?.targetAmount ? formatMoney(round.targetAmount, round.currency) : "Undisclosed", hint: round?.targetAmount ? evidenceHint(round.evidenceStatus) : undefined },
    { label: "Valuation", value: valuation, hint: round?.preMoney || round?.postMoney ? evidenceHint(round.evidenceStatus) : undefined },
    { label: "EIS/SEIS", value: company.eisStatus === "unknown" ? "Unknown" : eisLabel(company.eisStatus) },
  ];
  for (const f of facts) {
    if (cardFacts.length >= 6) break;
    if (["stage", "target_raise", "valuation", "pre_money", "post_money"].includes(f.fieldKey) || f.value === null) continue;
    cardFacts.push({ label: f.label, value: typeof f.value === "number" ? (f.currency ? formatMoney(f.value, f.currency) : f.value.toLocaleString("en-GB")) + (f.unit && !f.currency ? ` ${f.unit}` : "") : String(f.value), hint: evidenceHint(f.evidenceStatus) });
  }

  const route = access.check?.routeType && access.check.routeType !== "none" ? access.check.routeType.replace("_", " ") : null;
  const howToGetIn = access.canInvestNow || route ? `${route ? `Route: ${route}. ` : ""}${access.reason}` : access.reason;

  return {
    company,
    media: media.find((m) => m.isPrimary) ?? media[0] ?? null,
    logo: media.find((m) => m.kind === "logo" && m.url && m.rightsStatus !== "fallback") ?? null,
    raising,
    facts: cardFacts,
    ai: assessment ? { aiPriority: assessment.aiPriority, aiScore: assessment.aiScore, confidence: assessment.confidence, summary: assessment.summary } : null,
    whyInteresting: assessment?.whyInterested.slice(0, 3) ?? [],
    risks: assessment?.risks.slice(0, 2) ?? [],
    founders: founders.slice(0, 4).map((f) => ({ name: f.name, role: f.role, bio: f.bio })),
    howToGetIn,
    sources: sources.slice(0, 6).map((s) => ({ id: s.id, title: s.title, publisher: s.publisher, url: s.canonicalUrl })),
    aiLine: { worth: assessment?.whyInterested[0] ?? null, watch: assessment?.risks[0] ?? null },
    crowdfunding: CROWDFUNDING.test(`${access.check?.contactOrUrl ?? ""} ${access.check?.notes ?? ""}`) || access.check?.routeType === "platform",
    platform: platformName
      ? {
          name: platformName,
          url: access.check?.contactOrUrl && /^https?:\/\//.test(access.check.contactOrUrl) ? access.check.contactOrUrl : null,
          checkedBy: access.check?.verifier.startsWith("member:") ? access.check.notes : null,
        }
      : null,
    why: opts.why ?? null,
    explore: opts.explore ?? false,
    myVote: votes.find((v) => v.userId === userId)?.vote ?? null,
  };
}

/** One place in a member's deck, with why it is there. */
export interface DeckEntry {
  bundle: CompanyBundle;
  /** One line on why the matcher put it here, if it learned something. */
  why: string | null;
  /** An "explore" pick: outside this member's usual pattern, to learn more. */
  explore: boolean;
}

/** Every EXPLORE_EVERY-th card is an explore pick (once the member has given some answers). */
export const EXPLORE_EVERY = 8;

/**
 * A member's deck: companies they have not answered, that are not already a
 * match or ended (two crosses), and whose round is not closed (closed ones
 * wait on the watch list). UK companies only: that and closed rounds are the
 * only hard rules. Everything else orders the deck: how investable, how well
 * it fits the family's brief (SEIS/EIS, early, small valuation), and what the
 * matcher has learned from this member's answers, reasons and preferences
 * (plus, more lightly, the family's). Every 8th card explores something new.
 * Everyone still decides: one "not interested" does not hide a company.
 */
export function rankDeck(bundles: CompanyBundle[], userId: string, opts: { now?: Date; maxChequeGbp?: number; memberCount?: number; prefs?: MemberPreferences | null } = {}): DeckEntry[] {
  const matcher = buildMatcher(bundles, userId, opts.prefs);
  const scored = bundles
    .filter((b) => {
      const mine = b.votes.find((v) => v.userId === userId);
      if (mine && mine.vote !== "unsure") return false;
      const stage = computeFamilyStage(b.votes, opts.memberCount);
      if (stage === "shortlisted" || stage === "passed") return false;
      return isUk(b) && !isClosedRound(b, opts);
    })
    .map((b) => {
      const learned = matcher.score(b);
      return { b, score: investability(b, opts) + fitScore(b) + learned.points, why: learned.why, novelty: learned.novelty };
    })
    .sort((x, y) => y.score - x.score || y.b.company.firstDiscoveredAt.localeCompare(x.b.company.firstDiscoveredAt));

  const out: DeckEntry[] = [];
  const rest = [...scored];
  const learning = matcher.mine.answers >= 5;
  while (rest.length) {
    if (learning && (out.length + 1) % EXPLORE_EVERY === 0 && rest.length > 1) {
      // From the better half, the one this member's answers say least about.
      const pool = rest.slice(0, Math.max(2, Math.ceil(rest.length / 2)));
      const pick = pool.reduce((best, x) => (x.novelty > best.novelty ? x : best), pool[pool.length - 1]);
      if (pick.novelty > 0 && pick !== rest[0]) {
        rest.splice(rest.indexOf(pick), 1);
        out.push({ bundle: pick.b, why: "Something a bit different, to learn what you think.", explore: true });
        continue;
      }
    }
    const next = rest.shift()!;
    out.push({ bundle: next.b, why: next.why, explore: false });
  }
  return out;
}

/** The deck as companies only (see rankDeck). */
export function deckFor(bundles: CompanyBundle[], userId: string, opts: { now?: Date; maxChequeGbp?: number; memberCount?: number; prefs?: MemberPreferences | null } = {}): CompanyBundle[] {
  return rankDeck(bundles, userId, opts).map((e) => e.bundle);
}

export type DecisionStatus = "match" | "waiting" | "ended";

export interface DecisionRow {
  company: Company;
  media: CompanyMedia | null;
  logo: CompanyMedia | null;
  vote: VoteValue;
  decidedAt: string;
  status: DecisionStatus;
  closed: boolean;
  /** This member's optional reason for their answer (private). */
  note: string | null;
}

/**
 * Everything this member has ticked or crossed, newest first, plus the watch
 * list: closed-round companies they have not decided on yet.
 */
export function decisionsFor(bundles: CompanyBundle[], userId: string, opts: { now?: Date; memberCount?: number } = {}): { decided: DecisionRow[]; watching: DecisionRow[] } {
  const decided: DecisionRow[] = [];
  const watching: DecisionRow[] = [];
  for (const b of bundles) {
    const base = {
      company: b.company,
      media: b.media.find((m) => m.isPrimary) ?? b.media[0] ?? null,
      logo: b.media.find((m) => m.kind === "logo" && m.url && m.rightsStatus !== "fallback") ?? null,
      closed: isClosedRound(b, opts),
    };
    const stage = computeFamilyStage(b.votes, opts.memberCount);
    const status: DecisionStatus = stage === "shortlisted" ? "match" : stage === "passed" ? "ended" : "waiting";
    const mine = b.votes.find((v) => v.userId === userId);
    if (mine && mine.vote !== "unsure") decided.push({ ...base, vote: mine.vote, decidedAt: mine.updatedAt, status, note: mine.note ?? null });
    else if (base.closed && stage !== "shortlisted" && stage !== "passed") watching.push({ ...base, vote: "unsure", decidedAt: b.company.updatedAt, status, note: null });
  }
  decided.sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
  watching.sort((a, b) => a.company.name.localeCompare(b.company.name));
  return { decided, watching };
}

export interface MatchRow {
  company: Company;
  media: CompanyMedia | null;
  logo: CompanyMedia | null;
  matchedAt: string;
  lastMessage: { authorUserId: string; body: string; createdAt: string } | null;
  unread: number;
  /** Unread notification ids for this company (match + comments), cleared when the chat is opened. */
  unreadIds: string[];
  isNewMatch: boolean;
  /** The round has closed: the match moves to Archived (its chat stays readable). */
  archived: boolean;
}

/** The moment the last member ticked: the latest Interested vote. */
export function matchedAt(bundle: CompanyBundle): string {
  return bundle.votes.map((v) => v.updatedAt).sort().at(-1) ?? bundle.company.updatedAt;
}

export function matchesFor(bundles: CompanyBundle[], members: Member[], notifications: Notification[], opts: { now?: Date } = {}): MatchRow[] {
  return bundles
    .filter((b) => computeFamilyStage(b.votes, members.length) === "shortlisted")
    .map((b) => {
      const live = b.comments.filter((c) => !c.deletedAt).sort((x, y) => x.createdAt.localeCompare(y.createdAt));
      const last = live.at(-1) ?? null;
      const unreadNotes = notifications.filter((n) => !n.readAt && n.companyId === b.company.id && (n.notificationType === "comment" || n.notificationType === "shortlist_promoted"));
      return {
        company: b.company,
        media: b.media.find((m) => m.isPrimary) ?? b.media[0] ?? null,
        logo: b.media.find((m) => m.kind === "logo" && m.url && m.rightsStatus !== "fallback") ?? null,
        matchedAt: matchedAt(b),
        lastMessage: last ? { authorUserId: last.authorUserId, body: last.body, createdAt: last.createdAt } : null,
        // Counts match the tab badge, which only counts swipe-app notifications.
        unread: unreadNotes.filter((n) => n.notificationType === "comment" && n.href.startsWith("/matches")).length,
        unreadIds: unreadNotes.map((n) => n.id),
        isNewMatch: unreadNotes.some((n) => n.notificationType === "shortlist_promoted" && n.href.startsWith("/matches")),
        archived: isClosedRound(b, opts),
      };
    })
    .sort((a, b) => (b.lastMessage?.createdAt ?? b.matchedAt).localeCompare(a.lastMessage?.createdAt ?? a.matchedAt));
}
