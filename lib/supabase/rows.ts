/**
 * Row shapes for the tables the app reads and writes. They mirror
 * supabase/migrations/0001_init.sql. Regenerate full types with
 * `npm run supabase:types` once a project is linked; these hand-written
 * shapes are kept minimal and are what the repository maps from.
 */
import type {
  AccessStatus,
  AiPriority,
  Confidence,
  EisStatus,
  EvidenceStatus,
  FamilyStage,
  Materiality,
  NotificationType,
  ScoreDimension,
  SourceType,
  StoryType,
  UpdateType,
  VoteValue,
} from "@/lib/domain/types";

export interface HouseholdMemberRow {
  household_id: string;
  user_id: string;
  role: "owner" | "member";
  status: "active" | "invited" | "removed";
  joined_at: string;
}

export interface ProfileRow {
  user_id: string;
  display_name: string;
  avatar_initial: string;
  accent: "blue" | "green" | "red" | "violet" | "amber";
}

export interface CompanyRow {
  id: string;
  household_id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  domain: string | null;
  sector: string;
  sub_sector: string | null;
  city: string;
  country: string;
  stage: string;
  teaser: string;
  description: string;
  is_demo: boolean;
  first_discovered_at: string;
  last_researched_at: string | null;
  discovery_signal: string | null;
  research_rule_matched: string | null;
  tags: string[];
  eis_status: EisStatus;
  eis_note: string | null;
  artwork_hue: number;
  artwork_motif: string;
  family_stage: FamilyStage;
  created_at: string;
  updated_at: string;
}

export interface SourceRow {
  id: string;
  household_id: string;
  company_id: string | null;
  canonical_url: string;
  title: string;
  publisher: string;
  source_type: SourceType;
  published_at: string | null;
  retrieved_at: string;
  content_hash: string | null;
  trust_tier: "primary" | "reputable" | "secondary" | "unverified";
  excerpt: string | null;
  claim_type: string | null;
}

export interface MediaRow {
  id: string;
  company_id: string;
  kind: "hero" | "logo" | "product" | "founder" | "other";
  url: string | null;
  storage_path: string | null;
  is_primary: boolean;
  rights_status: "permitted" | "attributed" | "fallback";
  origin_url: string | null;
  attribution: string | null;
  alt_text: string;
  checked_at: string | null;
}

export interface FactRow {
  id: string;
  company_id: string;
  field_key: string;
  label: string;
  value_jsonb: unknown;
  unit: string | null;
  currency: string | null;
  as_of_date: string | null;
  evidence_status: EvidenceStatus;
  source_id: string | null;
  effective_to: string | null;
  recorded_at: string;
}

export interface RoundRow {
  id: string;
  company_id: string;
  stage: string;
  target_amount: number | string | null;
  currency: string | null;
  pre_money: number | string | null;
  post_money: number | string | null;
  reported_committed: number | string | null;
  opened_at: string | null;
  closes_at: string | null;
  claimed_status: "open" | "closed" | "expected" | "unknown";
  lead_investors: string[];
  evidence_status: EvidenceStatus;
  source_id: string | null;
  is_current: boolean;
}

export interface AccessRow {
  id: string;
  company_id: string;
  access_status: AccessStatus;
  route_type: "official_application" | "syndicate" | "founder_intro" | "spv" | "platform" | "none";
  contact_or_url: string | null;
  min_cheque: number | string | null;
  max_cheque: number | string | null;
  currency: string | null;
  checked_at: string;
  expires_at: string | null;
  verifier: string;
  source_id: string | null;
  notes: string;
}

export interface AssessmentRow {
  id: string;
  company_id: string;
  run_id: string | null;
  ai_priority: AiPriority;
  ai_score: number | string | null;
  confidence: Confidence;
  summary: string;
  why_interested: string[];
  risks: string[];
  bull_case: string;
  bear_case: string;
  why_now: string;
  assumptions: string[];
  open_questions: string[];
  diligence_checklist: string[];
  next_action: string;
  score_breakdown_jsonb: ScoreDimension[];
  source_ids: string[];
  model_version: string;
  prompt_version: string;
  created_at: string;
}

export interface FounderRow {
  id: string;
  company_id: string;
  name: string;
  role: string;
  bio: string;
  profile_url: string | null;
  evidence_status: EvidenceStatus;
  source_id: string | null;
}

export interface HighlightRow {
  id: string;
  company_id: string;
  text: string;
  evidence_status: EvidenceStatus;
  source_id: string | null;
}

export interface VoteRow {
  company_id: string;
  user_id: string;
  vote: VoteValue;
  score: number | null;
  note: string | null;
  updated_at: string;
}

export interface BookmarkRow {
  company_id: string;
  user_id: string;
}

export interface CommentRow {
  id: string;
  company_id: string;
  author_user_id: string | null;
  author_kind: "member" | "research";
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface UpdateRow {
  id: string;
  company_id: string;
  update_type: UpdateType;
  headline: string;
  summary: string;
  materiality: Materiality;
  source_id: string | null;
  run_id: string | null;
  effective_at: string;
  detected_at: string;
  change_jsonb: { field: string; from: string | null; to: string | null }[] | null;
}

export interface StoryRow {
  id: string;
  run_id: string | null;
  story_type: StoryType;
  company_id: string | null;
  headline: string;
  teaser: string;
  priority: number;
  source_id: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface NotificationRow {
  id: string;
  recipient_user_id: string;
  notification_type: NotificationType;
  company_id: string | null;
  update_id: string | null;
  comment_id: string | null;
  title: string;
  body: string;
  importance: "high" | "normal";
  href: string;
  read_at: string | null;
  created_at: string;
  dedupe_key: string;
}

export interface EventRow {
  id: string;
  name: string;
  organiser: string;
  event_type: string;
  start_at: string;
  end_at: string | null;
  timezone: string;
  venue: string | null;
  city: string;
  is_online: boolean;
  registration_url: string | null;
  access_status: "open" | "invitation_only" | "waitlist" | "closed" | "unknown";
  registration_checked_at: string | null;
  audience_fit: string;
  significance: string;
  next_action: string;
  related_company_ids: string[];
  source_id: string | null;
  importance: "high" | "normal";
}

export interface EventStatusRow {
  event_id: string;
  user_id: string;
  status: "registered" | "interested";
}

export interface NetworkRow {
  id: string;
  name: string;
  website: string | null;
  focus: string;
  region: string;
  eligibility: string;
  joining_url: string | null;
  fees: string;
  cheque_requirements: string;
  co_invest_route: string;
  contact: string | null;
  verification_status: "verified" | "partially_verified" | "unverified";
  accessibility_confidence: Confidence;
  last_checked_at: string | null;
  notes: string;
  portfolio_company_ids: string[];
}

export interface PromptRow {
  id: string;
  version: number;
  prompt_text: string;
  config_jsonb: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  active: boolean;
  change_note: string;
  parent_version_id: string | null;
}

export interface FeedbackRow {
  id: string;
  company_id: string | null;
  author_user_id: string;
  feedback_type: "too_many_sector" | "more_preseed" | "missed_something" | "not_this_model" | "free_text";
  body: string;
  created_at: string;
}

export interface SuggestionRow {
  id: string;
  feedback_id: string | null;
  base_prompt_version_id: string;
  suggested_patch: { find: string; replace: string }[];
  suggested_text: string | null;
  rationale: string;
  expected_impact: string;
  status: "proposed" | "applied" | "dismissed";
  suggested_by: string;
  approved_by: string | null;
  applied_version_id: string | null;
  created_at: string;
}

export interface RunRow {
  id: string;
  local_date: string;
  run_kind: "scheduled" | "manual" | "recheck";
  prompt_version_id: string | null;
  status: "queued" | "running" | "published" | "failed" | "no_new_research";
  started_at: string;
  finished_at: string | null;
  model: string;
  source_count: number;
  candidates_count: number;
  published_count: number;
  estimated_cost: number | string | null;
  summary: string;
  error_summary: string | null;
}

export interface AuditRow {
  id: string;
  actor_type: "member" | "research" | "system";
  actor_id: string | null;
  action: string;
  object_type: string;
  object_id: string;
  before_jsonb: unknown;
  after_jsonb: unknown;
  created_at: string;
}

export const num = (v: number | string | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));
