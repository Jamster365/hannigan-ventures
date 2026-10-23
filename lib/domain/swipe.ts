import { accessLabel, effectiveAccess, eisLabel } from "./company-status";
import { computeFamilyStage, SHORTLIST_THRESHOLD } from "./family-consensus";
import { formatMoney } from "./format";
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
  /** This member's current vote, if any (only "unsure" can be left over from the classic app). */
  myVote: VoteValue | null;
}

const CROWDFUNDING = /crowdcube|republic|seedrs|crowdfunding/i;

/** True when the round is over: the deck parks these on the watch list until a new round appears. */
export function isClosedRound(bundle: CompanyBundle, opts: { now?: Date } = {}): boolean {
  const access = effectiveAccess(bundle.accessChecks, opts);
  const round = bundle.rounds.find((r) => r.isCurrent) ?? null;
  return access.status === "closed" || (round?.claimedStatus === "closed" && !["verified_open", "closing_soon", "fundraising_reported", "expected"].includes(access.status));
}

/** Higher = closer to a cheque actually being possible. Used to order the deck. */
export function investability(bundle: CompanyBundle, opts: { now?: Date; maxChequeGbp?: number } = {}): number {
  const access = effectiveAccess(bundle.accessChecks, opts);
  const round = bundle.rounds.find((r) => r.isCurrent) ?? null;
  if (access.canInvestNow) return 100;
  if (access.status === "closing_soon" || access.status === "verified_open") return 90;
  if (round?.claimedStatus === "open" || access.status === "fundraising_reported") return 70;
  if (access.status === "expected" || round?.claimedStatus === "expected") return 50;
  if (access.status === "contactable") return 40;
  if (access.status === "stale") return 30;
  return 20;
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

export function buildSwipeCard(bundle: CompanyBundle, userId: string, opts: { now?: Date; maxChequeGbp?: number } = {}): SwipeCard {
  const { company, media, rounds, accessChecks, assessment, founders, facts, sources, votes } = bundle;
  const access = effectiveAccess(accessChecks, opts);
  const round = rounds.find((r) => r.isCurrent) ?? null;

  let raising: SwipeCard["raising"];
  if (access.canInvestNow) raising = { label: "Can invest now", tone: "green", detail: access.reason };
  else if (access.status === "closed" || round?.claimedStatus === "closed") raising = { label: "Round closed", tone: "red", detail: access.reason };
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
    myVote: votes.find((v) => v.userId === userId)?.vote ?? null,
  };
}

/**
 * A member's deck: companies they have not ticked or crossed, that are not
 * already a match or ended (two crosses), and whose round is not closed
 * (closed ones wait on the watch list). Most investable first, then newest.
 * Everyone still decides: one person's cross does not hide a company.
 */
export function deckFor(bundles: CompanyBundle[], userId: string, opts: { now?: Date; maxChequeGbp?: number; memberCount?: number } = {}): CompanyBundle[] {
  return bundles
    .filter((b) => {
      const mine = b.votes.find((v) => v.userId === userId);
      if (mine && mine.vote !== "unsure") return false;
      const stage = computeFamilyStage(b.votes, opts.memberCount);
      if (stage === "shortlisted" || stage === "passed") return false;
      return !isClosedRound(b, opts);
    })
    .map((b) => ({ b, score: investability(b, opts) }))
    .sort((x, y) => y.score - x.score || y.b.company.firstDiscoveredAt.localeCompare(x.b.company.firstDiscoveredAt))
    .map((x) => x.b);
}

/** Whether this member's tick alone would make at least one deck company a match. Never says which. */
export function someoneWaiting(deck: CompanyBundle[], userId: string): boolean {
  return deck.some((b) => b.votes.filter((v) => v.userId !== userId && v.vote === "interested").length >= SHORTLIST_THRESHOLD - 1);
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
    if (mine && mine.vote !== "unsure") decided.push({ ...base, vote: mine.vote, decidedAt: mine.updatedAt, status });
    else if (base.closed && stage !== "shortlisted" && stage !== "passed") watching.push({ ...base, vote: "unsure", decidedAt: b.company.updatedAt, status });
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
}

/** The moment the last member ticked: the latest Interested vote. */
export function matchedAt(bundle: CompanyBundle): string {
  return bundle.votes.map((v) => v.updatedAt).sort().at(-1) ?? bundle.company.updatedAt;
}

export function matchesFor(bundles: CompanyBundle[], members: Member[], notifications: Notification[]): MatchRow[] {
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
      };
    })
    .sort((a, b) => (b.lastMessage?.createdAt ?? b.matchedAt).localeCompare(a.lastMessage?.createdAt ?? a.matchedAt));
}
