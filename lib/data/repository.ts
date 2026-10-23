import type { Deal, DealCheck, DealCheckStatus, DealDecision, DealDocument } from "@/lib/domain/deal";
import type { MemberPreferences } from "@/lib/domain/learning";
import type {
  DealLead,
  AngelNetwork,
  AuditEvent,
  Comment,
  CompanyBundle,
  EventRecord,
  HomeStory,
  Member,
  Notification,
  PromptSuggestion,
  PromptVersion,
  ResearchFeedback,
  ResearchPreferences,
  ResearchRun,
  Vote,
  VoteValue,
} from "@/lib/domain/types";
import type { StageTransition } from "@/lib/domain/family-consensus";

/**
 * The single data contract used by pages and server actions.
 *
 * Two implementations:
 *  - DemoRepository (lib/data/demo-repository.ts): in-memory, labelled sample
 *    data; used when Supabase env vars are absent. Changes are process-local.
 *  - SupabaseRepository (lib/data/supabase-repository.ts): Postgres via
 *    Supabase with RLS; the real app.
 */
export interface Repository {
  readonly mode: "demo" | "supabase";

  // Household
  getMembers(): Promise<Member[]>;

  // Companies
  listCompanies(): Promise<CompanyBundle[]>;
  getCompanyBySlug(slug: string): Promise<CompanyBundle | null>;
  getCompanyById(id: string): Promise<CompanyBundle | null>;

  // Feed
  listHomeStories(): Promise<HomeStory[]>;
  listNotifications(userId: string): Promise<Notification[]>;
  markNotificationsRead(userId: string, ids?: string[]): Promise<void>;

  // Directory
  listEvents(): Promise<EventRecord[]>;
  listNetworks(): Promise<AngelNetwork[]>;

  // Family
  listVotes(companyId: string): Promise<Vote[]>;
  // Family mutations (caller must already be authorised as userId)
  setVote(input: { userId: string; companyId: string; vote: VoteValue | null; score?: number | null }): Promise<{ transition: StageTransition }>;
  /** The member's optional reason for their current answer (private, like the vote). */
  /** True when every other member has answered and exactly one is interested, so this member's yes would make a match. Never says who. */
  almostMatch(input: { userId: string; companyId: string }): Promise<boolean>;
  setVoteNote(input: { userId: string; companyId: string; note: string | null }): Promise<void>;
  getPreferences(userId: string): Promise<MemberPreferences>;
  savePreferences(input: { userId: string; prefs: MemberPreferences }): Promise<void>;
  /** A member opened the round's page and says whether it is live (open: expires after 48h). */
  recordMemberRoundCheck(input: { userId: string; companyId: string; open: boolean; details?: string }): Promise<void>;
  addComment(input: { userId: string; companyId: string; body: string }): Promise<Comment>;
  editComment(input: { userId: string; commentId: string; body: string }): Promise<Comment>;
  deleteComment(input: { userId: string; commentId: string }): Promise<void>;
  toggleBookmark(input: { userId: string; companyId: string }): Promise<{ bookmarked: boolean }>;

  // Research instructions
  listPromptVersions(): Promise<PromptVersion[]>;
  getActivePrompt(): Promise<PromptVersion>;
  savePromptVersion(input: {
    userId: string;
    promptText: string;
    config: ResearchPreferences;
    changeNote: string;
    /** The version the editor started from; used for optimistic concurrency. */
    basedOnVersionId: string;
  }): Promise<{ ok: true; version: PromptVersion } | { ok: false; conflict: PromptVersion }>;
  restorePromptVersion(input: { userId: string; versionId: string }): Promise<PromptVersion>;

  listSuggestions(): Promise<PromptSuggestion[]>;
  createFeedback(input: Omit<ResearchFeedback, "id" | "createdAt">): Promise<ResearchFeedback>;
  createSuggestion(input: Omit<PromptSuggestion, "id" | "createdAt" | "status" | "approvedBy" | "appliedVersionId">): Promise<PromptSuggestion>;
  applySuggestion(input: { userId: string; suggestionId: string }): Promise<{ ok: true; version: PromptVersion } | { ok: false; reason: string }>;
  dismissSuggestion(input: { userId: string; suggestionId: string }): Promise<void>;

  // Deal room (after a match): shared checklist, documents and decision
  getDeal(companyId: string): Promise<Deal>;
  /** Every company with any deal-room data, keyed by company id (document links not filled in). */
  listDeals(): Promise<Record<string, Deal>>;
  setDealCheck(input: { userId: string; companyId: string; key: string; status: DealCheckStatus; note?: string; label?: string }): Promise<DealCheck>;
  saveDealDecision(input: { userId: string; companyId: string; decision: Omit<DealDecision, "companyId" | "updatedBy" | "updatedAt"> }): Promise<DealDecision>;
  addDealDocument(input: { userId: string; companyId: string; name: string; mime: string; bytes: Uint8Array }): Promise<DealDocument>;
  removeDealDocument(input: { userId: string; companyId: string; documentId: string }): Promise<void>;

  // Leads: companies members heard of, waiting for research
  listLeads(): Promise<DealLead[]>;
  addLead(input: { userId: string; name: string; website: string | null; source: string; notes: string }): Promise<DealLead>;
  setLeadStatus(input: { userId: string; leadId: string; status: DealLead["status"] }): Promise<void>;

  // Research runs
  listRuns(): Promise<ResearchRun[]>;
  listAuditEvents(limit?: number): Promise<AuditEvent[]>;
}
