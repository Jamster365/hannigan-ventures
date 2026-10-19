import type { NotificationType } from "@/lib/domain/types";
import type { Candidate } from "./schemas";

/**
 * Materiality classifier (SPEC §8.2 step 9). Separates novelty, financing,
 * risk, access, traction/founder changes and routine noise. Only material
 * changes produce notifications; routine re-checks never do.
 */
export interface PreviousState {
  accessStatus: string | null;
  claimedRoundStatus: string | null;
  preMoney: number | null;
  targetAmount: number | null;
  lastSignalHeadlines: string[];
}

export interface MaterialChange {
  updateType: "company" | "funding" | "product" | "team" | "risk" | "research";
  headline: string;
  summary: string;
  materiality: "high" | "medium" | "low";
  notify: NotificationType | null;
  change?: { field: string; from: string | null; to: string | null }[];
  sourceUrl: string | null;
}

export function classifyChanges(c: Candidate, prev: PreviousState | null): MaterialChange[] {
  const out: MaterialChange[] = [];
  const firstUrl = (urls: string[]) => urls[0] ?? null;

  if (!prev) {
    out.push({ updateType: "research", headline: "New company added", summary: c.discoverySignal, materiality: "medium", notify: "new_company", sourceUrl: firstUrl(c.access.sourceUrls) ?? firstUrl(c.signals[0]?.sourceUrls ?? []) });
  }

  const access = c.access.status;
  if (prev && prev.accessStatus !== access) {
    if (access === "verified_open" || access === "closing_soon") {
      out.push({ updateType: "funding", headline: access === "closing_soon" ? "Round confirmed open and closing soon" : "Application route verified", summary: c.access.notes || "A live route was verified in this run.", materiality: "high", notify: access === "closing_soon" ? "deadline" : "access_changed", change: [{ field: "Access", from: prev.accessStatus, to: access }], sourceUrl: firstUrl(c.access.sourceUrls) });
    } else if (access === "closed") {
      out.push({ updateType: "funding", headline: "Round reported closed", summary: c.access.notes || "A source reports the round has closed.", materiality: "high", notify: "round_closed", change: [{ field: "Access", from: prev.accessStatus, to: access }], sourceUrl: firstUrl(c.access.sourceUrls) });
    } else if (access !== "unknown") {
      out.push({ updateType: "funding", headline: "Access status changed", summary: c.access.notes || `Now ${access.replace("_", " ")}.`, materiality: "medium", notify: null, change: [{ field: "Access", from: prev.accessStatus, to: access }], sourceUrl: firstUrl(c.access.sourceUrls) });
    }
  } else if (!prev && (access === "verified_open" || access === "closing_soon")) {
    out.push({ updateType: "funding", headline: "Verified live route on discovery", summary: c.access.notes || "A live route was verified in this run.", materiality: "high", notify: "access_changed", sourceUrl: firstUrl(c.access.sourceUrls) });
  }

  const pre = c.round?.preMoney?.amount ?? null;
  if (prev && pre !== null && prev.preMoney !== null && pre !== prev.preMoney) {
    out.push({ updateType: "funding", headline: "Valuation changed", summary: `Pre-money moved from ${fmt(prev.preMoney)} to ${fmt(pre)}.`, materiality: "high", notify: "valuation_changed", change: [{ field: "Pre-money", from: fmt(prev.preMoney), to: fmt(pre) }], sourceUrl: firstUrl(c.round?.preMoney?.sourceUrls ?? []) });
  }
  const target = c.round?.target?.amount ?? null;
  if (prev && target !== null && prev.targetAmount !== target) {
    out.push({ updateType: "funding", headline: prev.targetAmount === null ? "Round target reported" : "Round target changed", summary: `Target ${fmt(target)}.`, materiality: prev.targetAmount === null ? "medium" : "high", notify: prev.targetAmount === null ? null : "round_confirmed", change: [{ field: "Target", from: fmt(prev.targetAmount), to: fmt(target) }], sourceUrl: firstUrl(c.round?.target?.sourceUrls ?? []) });
  }

  for (const s of c.signals) {
    if (prev?.lastSignalHeadlines.includes(s.headline)) continue; // already seen
    const notify: NotificationType | null = s.materiality === "high" ? (s.type === "risk" ? "risk" : "milestone") : null;
    out.push({ updateType: s.type, headline: s.headline, summary: s.summary, materiality: s.materiality, notify, sourceUrl: firstUrl(s.sourceUrls) });
  }
  return out;
}

function fmt(n: number | null): string | null {
  if (n === null) return null;
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}m` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}
