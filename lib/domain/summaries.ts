import { computeFamilyStage, familyAverage, tallyVotes, type VoteTally } from "./family-consensus";
import { effectiveAccess, type EffectiveAccess } from "./company-status";
import type { Assessment, Company, CompanyBundle, CompanyMedia, CompanyUpdate, FamilyStage, FundingRound, Vote } from "./types";

export interface CompanySummary {
  company: Company;
  primaryMedia: CompanyMedia | null;
  currentRound: FundingRound | null;
  access: EffectiveAccess;
  assessment: Pick<Assessment, "aiPriority" | "aiScore" | "confidence" | "summary" | "createdAt"> | null;
  votes: Vote[];
  tally: VoteTally;
  familyStage: FamilyStage;
  familyAverage: number | null;
  raters: number;
  bookmarkedBy: string[];
  latestUpdate: CompanyUpdate | null;
  recentUpdateCount: number;
  commentCount: number;
  lastActivityAt: string;
  isNew: boolean;
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

export function summarise(bundle: CompanyBundle, opts: { now?: Date; maxChequeGbp?: number } = {}): CompanySummary {
  const now = opts.now ?? new Date();
  const { company, media, rounds, accessChecks, assessment, votes, comments, updates, bookmarkedBy } = bundle;
  const sortedUpdates = [...updates].sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt));
  const latestUpdate = sortedUpdates[0] ?? null;
  const recentUpdateCount = sortedUpdates.filter((u) => now.getTime() - new Date(u.effectiveAt).getTime() < WEEK_MS).length;
  const liveComments = comments.filter((c) => !c.deletedAt);
  const activity = [
    latestUpdate?.effectiveAt,
    ...votes.map((v) => v.updatedAt),
    ...liveComments.map((c) => c.createdAt),
    company.updatedAt,
  ].filter((x): x is string => Boolean(x));
  const lastActivityAt = activity.sort().at(-1) ?? company.createdAt;
  const avg = familyAverage(votes);
  const isNew = now.getTime() - new Date(company.firstDiscoveredAt).getTime() < WEEK_MS && votes.length === 0;
  return {
    company,
    primaryMedia: media.find((m) => m.isPrimary) ?? media[0] ?? null,
    currentRound: rounds.find((r) => r.isCurrent) ?? null,
    access: effectiveAccess(accessChecks, { now, maxChequeGbp: opts.maxChequeGbp }),
    assessment: assessment
      ? { aiPriority: assessment.aiPriority, aiScore: assessment.aiScore, confidence: assessment.confidence, summary: assessment.summary, createdAt: assessment.createdAt }
      : null,
    votes,
    tally: tallyVotes(votes),
    familyStage: computeFamilyStage(votes),
    familyAverage: avg.average,
    raters: avg.raters,
    bookmarkedBy,
    latestUpdate,
    recentUpdateCount,
    commentCount: liveComments.length,
    lastActivityAt,
    isNew,
  };
}

export type HomeSectionKey = "new" | "pending" | "shortlist";

/**
 * Each company appears at most once across New / Pending / Shortlist.
 * Shortlist takes precedence, then pending, then new (SPEC §5.1).
 */
export function partitionForHome(summaries: CompanySummary[]): Record<HomeSectionKey, CompanySummary[]> {
  const out: Record<HomeSectionKey, CompanySummary[]> = { new: [], pending: [], shortlist: [] };
  for (const s of summaries) {
    if (s.familyStage === "shortlisted") out.shortlist.push(s);
    else if (s.familyStage === "pending") out.pending.push(s);
    else if (s.isNew) out.new.push(s);
  }
  // Shortlist: verified urgency, material recency, discussion, interest.
  out.shortlist.sort((a, b) => shortlistRank(b) - shortlistRank(a));
  out.new.sort((a, b) => b.company.firstDiscoveredAt.localeCompare(a.company.firstDiscoveredAt));
  out.pending.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  return out;
}

export function shortlistRank(s: CompanySummary): number {
  let score = 0;
  if (s.access.canInvestNow) score += 1000;
  if (s.access.status === "closing_soon") score += 500;
  if (s.latestUpdate?.materiality === "high") score += 200;
  score += Math.min(s.recentUpdateCount, 5) * 20;
  score += Math.min(s.commentCount, 10) * 5;
  score += s.tally.interested * 30;
  return score;
}
