import type { CompanySummary } from "./summaries";
import { eisLabel } from "./company-status";

export interface DiscoverQuery {
  q?: string;
  filter?: string;
  sector?: string;
  stage?: string;
  access?: string;
  eis?: string;
  ai?: string;
  sort?: string;
}

const accessMap: Record<string, (s: CompanySummary) => boolean> = {
  "Can invest now": (s) => s.access.canInvestNow,
  Contactable: (s) => s.access.status === "contactable",
  "Fundraising reported": (s) => s.access.status === "fundraising_reported",
  Expected: (s) => s.access.status === "expected",
  Closed: (s) => s.access.status === "closed",
  Unknown: (s) => s.access.status === "unknown" || s.access.status === "stale",
};

const eisMap: Record<string, string> = { Documented: "confirmed_documented", Claimed: "company_claimed", Pending: "pending", Unknown: "unknown", "Not applicable": "not_applicable" };
const aiMap: Record<string, string> = { High: "high", Medium: "medium", Low: "low", "Not rated": "insufficient_evidence" };

export function applyDiscoverQuery(all: CompanySummary[], query: DiscoverQuery): CompanySummary[] {
  let list = all;
  const q = query.q?.trim().toLowerCase();
  if (q) {
    list = list.filter((s) => {
      const c = s.company;
      const hay = [c.name, c.sector, c.subSector, c.city, c.teaser, c.description, ...c.tags, eisLabel(c.eisStatus)].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  switch (query.filter) {
    case "new":
      list = list.filter((s) => s.isNew);
      break;
    case "raising":
      list = list.filter((s) => s.currentRound?.claimedStatus === "open" || ["verified_open", "closing_soon", "fundraising_reported"].includes(s.access.status));
      break;
    case "uk":
      list = list.filter((s) => s.company.country === "UK");
      break;
    case "pre-seed":
      list = list.filter((s) => s.company.stage.toLowerCase().includes("pre-seed"));
      break;
    case "seed":
      list = list.filter((s) => s.company.stage.toLowerCase().startsWith("seed"));
      break;
    case "pending":
      list = list.filter((s) => s.familyStage === "pending");
      break;
    case "shortlist":
      list = list.filter((s) => s.familyStage === "shortlisted");
      break;
    case "passed":
      list = list.filter((s) => s.familyStage === "passed");
      break;
  }
  if (query.sector) list = list.filter((s) => s.company.sector === query.sector);
  if (query.stage) list = list.filter((s) => s.company.stage === query.stage);
  if (query.access && accessMap[query.access]) list = list.filter(accessMap[query.access]);
  if (query.eis && eisMap[query.eis]) list = list.filter((s) => s.company.eisStatus === eisMap[query.eis!]);
  if (query.ai && aiMap[query.ai]) list = list.filter((s) => (s.assessment?.aiPriority ?? "insufficient_evidence") === aiMap[query.ai!]);
  return sortSummaries(list, query.sort ?? "relevant");
}

export function sortSummaries(list: CompanySummary[], sort: string): CompanySummary[] {
  const copy = [...list];
  const prio = { high: 3, medium: 2, low: 1, insufficient_evidence: 0 } as const;
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => b.company.firstDiscoveredAt.localeCompare(a.company.firstDiscoveredAt));
    case "changed":
      return copy.sort((a, b) => (b.latestUpdate?.effectiveAt ?? "").localeCompare(a.latestUpdate?.effectiveAt ?? ""));
    case "deadline":
      return copy.sort((a, b) => (a.currentRound?.closesAt ?? "9999").localeCompare(b.currentRound?.closesAt ?? "9999"));
    case "ai":
      return copy.sort((a, b) => (b.assessment?.aiScore ?? -1) - (a.assessment?.aiScore ?? -1));
    case "family":
      return copy.sort((a, b) => b.tally.interested - a.tally.interested || (b.familyAverage ?? 0) - (a.familyAverage ?? 0));
    default:
      return copy.sort((a, b) => relevance(b, prio) - relevance(a, prio));
  }
}

function relevance(s: CompanySummary, prio: Record<string, number>): number {
  let r = 0;
  if (s.access.canInvestNow) r += 50;
  r += prio[s.assessment?.aiPriority ?? "insufficient_evidence"] * 10;
  if (s.isNew) r += 8;
  r += Math.min(s.recentUpdateCount, 3) * 3;
  r += s.tally.interested * 4;
  if (s.familyStage === "passed") r -= 30;
  if (s.access.status === "closed") r -= 15;
  return r;
}
