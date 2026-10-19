import type { FamilyStage, Vote, VoteValue } from "./types";

/**
 * Number of Interested votes needed for the dynamic family shortlist.
 * v1 rule: 2 of 3 active members. Kept as a named constant so it can be
 * migrated explicitly later (SPEC §18).
 */
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
 * Deterministic family stage (SPEC §6):
 *  1. SHORTLISTED if interested >= 2
 *  2. else PASSED if pass >= 2
 *  3. else UNREVIEWED if nobody has voted
 *  4. else PENDING
 */
export function computeFamilyStage(votes: Pick<Vote, "vote">[]): FamilyStage {
  const t = tallyVotes(votes);
  if (t.interested >= SHORTLIST_THRESHOLD) return "shortlisted";
  if (t.pass >= PASS_THRESHOLD) return "passed";
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
): { votes: Vote[]; transition: StageTransition } {
  const from = computeFamilyStage(existing);
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
  const to = computeFamilyStage(votes);
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
