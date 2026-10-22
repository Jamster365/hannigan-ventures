import type { FamilyStage, Vote, VoteValue } from "./types";

/**
 * How a company reaches the family shortlist ("a match").
 *  - "unanimous" (swipe app): every member ticks it; a single cross ends it.
 *  - "two_of_three" (classic app): 2 Interested shortlists, 2 Pass passes.
 * The database applies the same rule in compute_family_stage()
 * (supabase/migrations/0012_unanimous_matches.sql); change both together.
 * See docs/classic-app.md.
 */
export type MatchRule = "unanimous" | "two_of_three";
export const MATCH_RULE: MatchRule = "unanimous";

/** Active household members at launch; used where the member list is not to hand. */
export const HOUSEHOLD_SIZE = 3;

/** Classic thresholds, kept for the two_of_three rule. */
export const SHORTLIST_THRESHOLD = 2;
export const PASS_THRESHOLD = 2;

export interface VoteTally {
  interested: number;
  unsure: number;
  pass: number;
  total: number;
}

export function tallyVotes(votes: Pick<Vote, "vote">[]): VoteTally {
  const t: VoteTally = { interested: 0, unsure: 0, pass: 0, total: 0 };
  for (const v of votes) {
    t[v.vote] += 1;
    t.total += 1;
  }
  return t;
}

/**
 * Deterministic family stage:
 *  1. SHORTLISTED (a match) if every member is interested (unanimous) or
 *     interested >= 2 (two_of_three)
 *  2. else PASSED if anyone passed (unanimous) or pass >= 2 (two_of_three)
 *  3. else UNREVIEWED if nobody has voted
 *  4. else PENDING
 */
export function computeFamilyStage(votes: Pick<Vote, "vote">[], memberCount: number = HOUSEHOLD_SIZE, rule: MatchRule = MATCH_RULE): FamilyStage {
  const t = tallyVotes(votes);
  const unanimous = rule === "unanimous";
  if (unanimous ? memberCount > 0 && t.interested >= memberCount : t.interested >= SHORTLIST_THRESHOLD) return "shortlisted";
  if (t.pass >= (unanimous ? 1 : PASS_THRESHOLD)) return "passed";
  if (t.total === 0) return "unreviewed";
  return "pending";
}

/**
 * Arithmetic mean over submitted ratings only. Returns null when no member has
 * rated. The AI score is a separate concept and must never be fed in here.
 */
export function familyAverage(votes: Pick<Vote, "score">[]): {
  average: number | null;
  raters: number;
} {
  const scores = votes
    .map((v) => v.score)
    .filter((s): s is number => typeof s === "number" && s >= 1 && s <= 10);
  if (scores.length === 0) return { average: null, raters: 0 };
  const sum = scores.reduce((a, b) => a + b, 0);
  return { average: Math.round((sum / scores.length) * 10) / 10, raters: scores.length };
}

export interface StageTransition {
  from: FamilyStage;
  to: FamilyStage;
  promoted: boolean;
  demoted: boolean;
}

/** Describe the effect of replacing one member's vote. */
export function applyVote(
  existing: Vote[],
  next: { userId: string; vote: VoteValue | null; score?: number | null },
  memberCount: number = HOUSEHOLD_SIZE,
): { votes: Vote[]; transition: StageTransition } {
  const from = computeFamilyStage(existing, memberCount);
  const others = existing.filter((v) => v.userId !== next.userId);
  const prior = existing.find((v) => v.userId === next.userId);
  const votes: Vote[] =
    next.vote === null
      ? others
      : [
          ...others,
          {
            companyId: prior?.companyId ?? "",
            userId: next.userId,
            vote: next.vote,
            score: next.score === undefined ? (prior?.score ?? null) : next.score,
            updatedAt: new Date().toISOString(),
          },
        ];
  const to = computeFamilyStage(votes, memberCount);
  return {
    votes,
    transition: {
      from,
      to,
      promoted: to === "shortlisted" && from !== "shortlisted",
      demoted: from === "shortlisted" && to !== "shortlisted",
    },
  };
}

/**
 * "Almost a match": the member who just crossed a company was the last to
 * decide, and everyone else had ticked it. Returns the members who ticked.
 */
export function almostMatch<M extends { userId: string }>(votes: Pick<Vote, "userId" | "vote">[], members: M[], userId: string): M[] | null {
  const others = members.filter((m) => m.userId !== userId);
  if (others.length === 0) return null;
  const ticked = others.every((m) => votes.some((v) => v.userId === m.userId && v.vote === "interested"));
  return ticked ? others : null;
}

export function stageLabel(stage: FamilyStage): string {
  switch (stage) {
    case "shortlisted":
      return "Shortlisted";
    case "passed":
      return "Passed";
    case "pending":
      return "Awaiting views";
    default:
      return "Not reviewed";
  }
}

/** e.g. "1 of 3 interested · 2 yet to vote" */
export function consensusSummary(votes: Pick<Vote, "vote">[], memberCount: number): string {
  const t = tallyVotes(votes);
  const remaining = Math.max(memberCount - t.total, 0);
  const parts: string[] = [`${t.interested} of ${memberCount} interested`];
  if (remaining > 0) parts.push(`${remaining} yet to vote`);
  else if (t.pass > 0) parts.push(`${t.pass} pass`);
  return parts.join(" · ");
}
