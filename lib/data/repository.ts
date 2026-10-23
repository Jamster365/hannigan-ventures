import type { MemberPreferences } from "@/lib/domain/learning";
import type {
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
  recordMemberRoundCheck(input: { userId: string; companyId: string; open: boolean }): Promise<void>;
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

  // Research runs
  listRuns(): Promise<ResearchRun[]>;
  listAuditEvents(limit?: number): Promise<AuditEvent[]>;
}
