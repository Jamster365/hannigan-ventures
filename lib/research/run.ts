import "server-only";
import type { ResearchRun } from "@/lib/domain/types";

/** Replaced in Milestone C with the full pipeline. */
export async function runResearch(_input: { runKind: ResearchRun["runKind"]; triggeredBy: string | null }): Promise<ResearchRun> {
  throw new Error("Research pipeline not implemented yet");
}
