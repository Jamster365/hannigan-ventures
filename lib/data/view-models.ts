import "server-only";
import type { Repository } from "./repository";
import { partitionForHome, summarise, type CompanySummary } from "@/lib/domain/summaries";
import type { CompanyUpdate, Member, ResearchRun } from "@/lib/domain/types";

export interface ChangeItem {
  update: CompanyUpdate;
  summary: CompanySummary;
}

export interface ResearchFreshness {
  lastRun: ResearchRun | null;
  /** True when the most recent run is older than 36h or did not publish. */
  stale: boolean;
  message: string | null;
}

export async function loadCompanySummaries(repo: Repository, maxChequeGbp?: number): Promise<CompanySummary[]> {
  const bundles = await repo.listCompanies();
  const now = new Date();
  return bundles.map((b) => summarise(b, { now, maxChequeGbp }));
}

export function recentChanges(summaries: CompanySummary[], days = 7, limit = 8): ChangeItem[] {
  const cutoff = Date.now() - days * 86_400_000;
  const items: ChangeItem[] = [];
  for (const s of summaries) {
    // Passed companies only surface when the change is genuinely consequential.
    const minMateriality = s.familyStage === "passed" ? "high" : "medium";
    const rank = { high: 3, medium: 2, low: 1 } as const;
    for (const u of s.latestUpdate ? [s.latestUpdate] : []) {
      if (new Date(u.effectiveAt).getTime() < cutoff) continue;
      if (rank[u.materiality] < rank[minMateriality]) continue;
      items.push({ update: u, summary: s });
    }
  }
  return items.sort((a, b) => b.update.effectiveAt.localeCompare(a.update.effectiveAt)).slice(0, limit);
}

export function researchFreshness(runs: ResearchRun[]): ResearchFreshness {
  const lastRun = runs[0] ?? null;
  if (!lastRun) return { lastRun: null, stale: true, message: "No research has run yet. Discoveries below are not from today's research." };
  const ageHours = (Date.now() - new Date(lastRun.finishedAt ?? lastRun.startedAt).getTime()) / 36e5;
  if (lastRun.status === "failed" || lastRun.status === "no_new_research") {
    return { lastRun, stale: true, message: `Latest research run (${lastRun.localDate}) did not publish: ${lastRun.errorSummary ?? lastRun.summary}. Older discoveries are shown.` };
  }
  if (ageHours > 36) return { lastRun, stale: true, message: `Research last published ${Math.round(ageHours / 24)} day(s) ago. These are not today's discoveries.` };
  return { lastRun, stale: false, message: null };
}

export function memberById(members: Member[], id: string | null | undefined): Member | null {
  return members.find((m) => m.userId === id) ?? null;
}

export { partitionForHome };
