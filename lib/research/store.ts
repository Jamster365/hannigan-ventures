import type { NotificationType, ResearchPreferences } from "@/lib/domain/types";
import type { KnownCompany } from "./resolve";
import type { AssessmentOutput, Candidate } from "./schemas";
import type { MaterialChange } from "./materiality";
import type { PreviousState } from "./materiality";
import type { VerifiedSource } from "./verify";
import type { FoundImage } from "./imagery";

/**
 * Persistence boundary for the research pipeline. The pipeline never touches
 * Supabase directly; it talks to this interface so it can be tested against an
 * in-memory store and run against Postgres through the service role.
 */
export interface RunConfig {
  householdId: string;
  promptVersionId: string;
  promptText: string;
  preferences: ResearchPreferences;
  known: KnownCompany[];
  memberIds: string[];
  seenHashes: Set<string>;
}

export interface RunRecord {
  id: string;
  localDate: string;
  runKind: "scheduled" | "manual" | "recheck";
}

/** Pipeline steps reported to the UI while a run is in progress. */
export type RunStage = "searching" | "verifying" | "reading" | "assessing" | "publishing";

export interface PublishedCompany {
  companyId: string;
  slug: string;
  name: string;
  isNew: boolean;
}

export interface ResearchStore {
  loadConfig(householdId: string): Promise<RunConfig>;
  /** Returns null if a run of this kind already exists for the local date (idempotency). */
  startRun(input: { householdId: string; localDate: string; runKind: RunRecord["runKind"]; promptVersionId: string; model: string; triggeredBy: string | null }): Promise<RunRecord | null>;
  /** Best-effort live progress for the UI; must never fail the run. */
  progress(runId: string, stage: RunStage, detail: string): Promise<void>;
  finishRun(input: { runId: string; status: "published" | "failed" | "no_new_research"; sourceCount: number; candidatesCount: number; publishedCount: number; estimatedCostUsd: number; summary: string; errorSummary: string | null }): Promise<void>;
  upsertSources(householdId: string, companyId: string | null, sources: VerifiedSource[], sourceTypeFor: (url: string) => "news" | "official" | "filing" | "research" | "media" | "other"): Promise<Map<string, string>>;
  previousState(companyId: string): Promise<PreviousState | null>;
  publishCompany(input: { householdId: string; runId: string; candidate: Candidate; resolution: { kind: "existing"; companyId: string } | { kind: "new"; slug: string }; sourceIds: Map<string, string>; assessment: AssessmentOutput | null; policyVersion: string; model: string; promptVersion: string }): Promise<PublishedCompany>;
  recordChanges(input: { householdId: string; runId: string; company: PublishedCompany; changes: MaterialChange[]; sourceIds: Map<string, string>; memberIds: string[] }): Promise<number>;
  publishStories(input: { householdId: string; runId: string; stories: { storyType: "financing" | "access" | "deadline" | "signal" | "research"; companyId: string | null; headline: string; teaser: string; priority: number; sourceId: string | null }[] }): Promise<void>;
  publishEvents(input: { householdId: string; events: { name: string; organiser: string; eventType: string; startAt: string; endAt: string | null; venue: string | null; city: string; isOnline: boolean; registrationUrl: string | null; accessStatus: "open" | "invitation_only" | "waitlist" | "closed" | "unknown"; audienceFit: string; significance: string; nextAction: string; sourceId: string | null }[] }): Promise<void>;
  notifyMembers(input: { householdId: string; memberIds: string[]; type: NotificationType; title: string; body: string; importance: "high" | "normal"; href: string; dedupeKey: string; companyId?: string | null }): Promise<void>;
  /** True when the company already has real (non-fallback) imagery. */
  hasImagery(companyId: string): Promise<boolean>;
  /** Store copies of the company's own images with origin and attribution. */
  saveImagery(input: { householdId: string; companyId: string; companyName: string; images: FoundImage[] }): Promise<number>;
  logReview(input: { householdId: string; runId: string; kind: "ambiguous_entity" | "rejected_candidate" | "dropped_claims"; detail: unknown }): Promise<void>;
  audit(input: { householdId: string; runId: string; action: string; objectType: string; objectId: string; after?: unknown }): Promise<void>;
}
