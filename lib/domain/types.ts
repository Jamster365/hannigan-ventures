/**
 * Domain types for Hannigan Ventures.
 *
 * These mirror the Supabase schema (supabase/migrations) and are the shape the
 * UI consumes regardless of whether data comes from Postgres or the labelled
 * demo dataset. Keep this file dependency-free.
 */

export type VoteValue = "interested" | "unsure" | "pass";

/** Computed, never hand-edited. See lib/domain/family-consensus.ts */
export type FamilyStage = "unreviewed" | "pending" | "shortlisted" | "passed";

export type AccessStatus =
  | "unknown"
  | "fundraising_reported"
  | "contactable"
  | "verified_open"
  | "expected"
  | "closing_soon"
  | "closed"
  | "stale";

export type EvidenceStatus =
  | "verified_independent"
  | "official_company_claim"
  | "third_party_report"
  | "analyst_inference"
  | "unknown";

export type EisStatus =
  | "confirmed_documented"
  | "company_claimed"
  | "pending"
  | "unknown"
  | "not_applicable";

export type AiPriority = "high" | "medium" | "low" | "insufficient_evidence";
export type Confidence = "high" | "medium" | "low";

export type SourceType =
  | "news"
  | "official"
  | "filing"
  | "research"
  | "media"
  | "other";

export type UpdateType =
  | "company"
  | "funding"
  | "product"
  | "team"
  | "risk"
  | "research"
  | "family";

export type Materiality = "high" | "medium" | "low";

export type StoryType =
  | "financing"
  | "access"
  | "deadline"
  | "signal"
  | "research"
  | "family";

export type NotificationType =
  | "round_confirmed"
  | "round_closed"
  | "valuation_changed"
  | "milestone"
  | "deadline"
  | "risk"
  | "access_changed"
  | "new_company"
  | "shortlist_promoted"
  | "shortlist_demoted"
  | "comment"
  | "vote_changed"
  | "research_applied"
  | "research_failed";

export type MemberRole = "owner" | "member";

export interface Member {
  userId: string;
  displayName: string;
  /** Single-letter avatar glyph; colours are derived deterministically. */
  initial: string;
  role: MemberRole;
  /** Visual accent key used for the three-avatar consensus strip. */
  accent: "blue" | "green" | "red" | "violet" | "amber";
  email?: string;
  joinedAt: string;
}

export interface Source {
  id: string;
  companyId: string | null;
  canonicalUrl: string;
  title: string;
  publisher: string;
  sourceType: SourceType;
  publishedAt: string | null;
  retrievedAt: string;
  trustTier: "primary" | "reputable" | "secondary" | "unverified";
  excerpt?: string;
  /** What kind of claim this source supports. */
  claimType?: string;
}

export interface CompanyMedia {
  id: string;
  companyId: string;
  kind: "hero" | "logo" | "product" | "founder" | "other";
  url: string | null;
  isPrimary: boolean;
  rightsStatus: "permitted" | "attributed" | "fallback";
  originUrl?: string;
  attribution?: string;
  altText: string;
  checkedAt?: string;
}

export interface CompanyFact {
  id: string;
  companyId: string;
  fieldKey: string;
  label: string;
  value: string | number | null;
  unit?: string;
  currency?: string;
  asOfDate: string | null;
  evidenceStatus: EvidenceStatus;
  sourceId: string | null;
  recordedAt: string;
}

export interface FundingRound {
  id: string;
  companyId: string;
  stage: string;
  targetAmount: number | null;
  currency: string | null;
  preMoney: number | null;
  postMoney: number | null;
  reportedCommitted: number | null;
  openedAt: string | null;
  closesAt: string | null;
  claimedStatus: "open" | "closed" | "expected" | "unknown";
  leadInvestors: string[];
  evidenceStatus: EvidenceStatus;
  sourceId: string | null;
  isCurrent: boolean;
}

export interface AccessCheck {
  id: string;
  companyId: string;
  accessStatus: AccessStatus;
  routeType:
    | "official_application"
    | "syndicate"
    | "founder_intro"
    | "spv"
    | "platform"
    | "none";
  contactOrUrl: string | null;
  minCheque: number | null;
  maxCheque: number | null;
  currency: string | null;
  checkedAt: string;
  expiresAt: string | null;
  verifier: string;
  sourceId: string | null;
  notes: string;
}

export interface ScoreDimension {
  key: string;
  label: string;
  /** null = unrated (e.g. valuation unknown). */
  score: number | null;
  note: string;
  sourceIds: string[];
}

export interface Assessment {
  id: string;
  companyId: string;
  runId: string | null;
  aiPriority: AiPriority;
  /** 0.0–10.0, null when evidence is insufficient. Never blended with family. */
  aiScore: number | null;
  confidence: Confidence;
  summary: string;
  whyInterested: string[];
  risks: string[];
  bullCase: string;
  bearCase: string;
  whyNow: string;
  assumptions: string[];
  openQuestions: string[];
  diligenceChecklist: string[];
  nextAction: string;
  breakdown: ScoreDimension[];
  modelVersion: string;
  promptVersion: string;
  createdAt: string;
  sourceIds: string[];
}

export interface Founder {
  id: string;
  companyId: string;
  name: string;
  role: string;
  bio: string;
  profileUrl: string | null;
  evidenceStatus: EvidenceStatus;
  sourceId: string | null;
}

export interface TeamHighlight {
  text: string;
  evidenceStatus: EvidenceStatus;
  sourceId: string | null;
}

export interface Vote {
  companyId: string;
  userId: string;
  vote: VoteValue;
  score: number | null;
  note?: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  companyId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  likedBy?: string[];
}

export interface CompanyUpdate {
  id: string;
  companyId: string;
  updateType: UpdateType;
  headline: string;
  summary: string;
  /** What changed relative to the previous state, if known. */
  change?: { field: string; from: string | null; to: string | null }[];
  materiality: Materiality;
  sourceId: string | null;
  runId: string | null;
  effectiveAt: string;
  detectedAt: string;
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  legalName?: string;
  domain?: string;
  sector: string;
  subSector?: string;
  city: string;
  country: string;
  stage: string;
  teaser: string;
  description: string;
  /** Explicit demo flag: true for labelled sample data, never for research output. */
  isDemo: boolean;
  firstDiscoveredAt: string;
  lastResearchedAt: string | null;
  discoverySignal?: string;
  researchRuleMatched?: string;
  tags: string[];
  eisStatus: EisStatus;
  eisNote?: string;
  /** Design accent used by the typographic artwork fallback. */
  artwork: { hue: number; motif: "orbit" | "grid" | "wave" | "facet" | "ring" | "field" };
  createdAt: string;
  updatedAt: string;
}

/** Everything the UI needs to render a company anywhere. */
export interface CompanyBundle {
  company: Company;
  media: CompanyMedia[];
  facts: CompanyFact[];
  rounds: FundingRound[];
  accessChecks: AccessCheck[];
  assessment: Assessment | null;
  founders: Founder[];
  teamHighlights: TeamHighlight[];
  votes: Vote[];
  comments: Comment[];
  updates: CompanyUpdate[];
  sources: Source[];
  bookmarkedBy: string[];
}

export interface HomeStory {
  id: string;
  runId: string | null;
  storyType: StoryType;
  companyId: string | null;
  headline: string;
  teaser: string;
  priority: number;
  sourceId: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface Notification {
  id: string;
  recipientUserId: string;
  notificationType: NotificationType;
  companyId: string | null;
  updateId: string | null;
  commentId: string | null;
  title: string;
  body: string;
  importance: "high" | "normal";
  readAt: string | null;
  createdAt: string;
  dedupeKey: string;
  href: string;
}

export interface EventRecord {
  id: string;
  name: string;
  organiser: string;
  eventType: string;
  startAt: string;
  endAt: string | null;
  timezone: string;
  venue: string | null;
  city: string;
  isOnline: boolean;
  registrationUrl: string | null;
  accessStatus: "open" | "invitation_only" | "waitlist" | "closed" | "unknown";
  registrationCheckedAt: string | null;
  audienceFit: string;
  significance: string;
  nextAction: string;
  relatedCompanyIds: string[];
  sourceId: string | null;
  importance: "high" | "normal";
  memberStatus?: Record<string, "registered" | "interested">;
}

export interface AngelNetwork {
  id: string;
  name: string;
  website: string | null;
  focus: string;
  region: string;
  eligibility: string;
  joiningUrl: string | null;
  fees: string;
  chequeRequirements: string;
  coInvestRoute: string;
  contact: string | null;
  verificationStatus: "verified" | "partially_verified" | "unverified";
  accessibilityConfidence: Confidence;
  lastCheckedAt: string | null;
  notes: string;
  portfolioCompanyIds: string[];
}

export interface PromptVersion {
  id: string;
  version: number;
  promptText: string;
  config: ResearchPreferences;
  createdBy: string;
  createdAt: string;
  active: boolean;
  changeNote: string;
  parentVersionId: string | null;
}

export interface ResearchPreferences {
  maxChequeGbp: number;
  geographicFocus: string;
  discoveryDepth: "light" | "balanced" | "deep";
  eventGeography: string;
  researchTimeLocal: string; // HH:MM Europe/London
  sectorsInclude: string[];
  sectorsExclude: string[];
  dailyBudgetUsd: number;
}

export interface ResearchFeedback {
  id: string;
  companyId: string | null;
  authorUserId: string;
  feedbackType:
    | "too_many_sector"
    | "more_preseed"
    | "missed_something"
    | "not_this_model"
    | "free_text";
  body: string;
  createdAt: string;
}

export interface PromptSuggestion {
  id: string;
  feedbackId: string | null;
  basePromptVersionId: string;
  suggestedPatch: { find: string; replace: string }[];
  suggestedText?: string;
  rationale: string;
  expectedImpact: string;
  status: "proposed" | "applied" | "dismissed";
  suggestedBy: string; // 'ai' or user id
  approvedBy: string | null;
  appliedVersionId: string | null;
  createdAt: string;
}

export interface ResearchRun {
  id: string;
  localDate: string;
  runKind: "scheduled" | "manual" | "recheck";
  promptVersionId: string;
  status: "queued" | "running" | "published" | "failed" | "no_new_research";
  startedAt: string;
  finishedAt: string | null;
  model: string;
  sourceCount: number;
  candidatesCount: number;
  publishedCount: number;
  estimatedCostUsd: number | null;
  summary: string;
  errorSummary: string | null;
}

export interface AuditEvent {
  id: string;
  actorType: "member" | "research" | "system";
  actorId: string | null;
  action: string;
  objectType: string;
  objectId: string;
  before?: unknown;
  after?: unknown;
  createdAt: string;
}
