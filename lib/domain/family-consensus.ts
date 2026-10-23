import type { FamilyStage, Vote, VoteValue } from "./types";

/**
 * How a company reaches the family shortlist ("a match").
 *  - "two_of_three" (current, chosen 23 Oct 2026): 2 ticks make a match,
 *    2 crosses end it; everyone still decides.
 *  - "unanimous" (22–23 Oct 2026): every member ticks it; one cross ends it.
 * The database applies the same rule in compute_family_stage()
 * (supabase/migrations/0013_two_of_three_matches.sql); change both together.
 * See docs/classic-app.md.
 */
export type MatchRule = "unanimous" | "two_of_three";
export const MATCH_RULE: MatchRule = "two_of_three";

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
 * "Almost a match": this member just crossed a company, everyone else has
 * already decided, and this member's tick would have made it a match.
 * Returns the members who ticked it, or null.
 */
export function almostMatch<M extends { userId: string }>(votes: Pick<Vote, "userId" | "vote">[], members: M[], userId: string, rule: MatchRule = MATCH_RULE): M[] | null {
  const others = members.filter((m) => m.userId !== userId);
  if (others.length === 0) return null;
  const voteOf = (id: string) => votes.find((v) => v.userId === id)?.vote;
  if (others.some((m) => !voteOf(m.userId) || voteOf(m.userId) === "unsure")) return null;
  const ticked = others.filter((m) => voteOf(m.userId) === "interested");
  const needed = rule === "unanimous" ? members.length : SHORTLIST_THRESHOLD;
  return ticked.length === needed - 1 ? ticked : null;
}

/**
 * The family stage of a company. The database keeps companies.family_stage up
 * to date from everyone's votes (a member only ever receives their own votes
 * until a match), so that is the truth in the live app; demo data has no such
 * column and the stage is computed from the votes to hand.
 */
export function familyStageOf(bundle: { company: { familyStage?: FamilyStage }; votes: Pick<Vote, "vote">[] }, memberCount: number = HOUSEHOLD_SIZE): FamilyStage {
  return bundle.company.familyStage ?? computeFamilyStage(bundle.votes, memberCount);
}

/**
 * Votes stay private until a company is a match: before that a viewer sees
 * only their own. Used by every screen that shows votes (both apps).
 */
export function visibleVotes<V extends Pick<Vote, "userId" | "vote">>(votes: V[], viewerId: string | null, memberCount: number = HOUSEHOLD_SIZE): V[] {
  if (computeFamilyStage(votes, memberCount) === "shortlisted") return votes;
  return votes.filter((v) => v.userId === viewerId);
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
