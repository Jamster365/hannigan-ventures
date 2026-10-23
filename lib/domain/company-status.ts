import type { AccessCheck, AccessStatus, AiPriority, Confidence, EisStatus } from "./types";

/** Default freshness window for a VERIFIED_OPEN access check (SPEC §7.2). */
export const ACCESS_FRESHNESS_HOURS = 48;

export interface EffectiveAccess {
  status: AccessStatus;
  /** True only when every CAN INVEST NOW precondition holds. */
  canInvestNow: boolean;
  reason: string;
  check: AccessCheck | null;
  isStale: boolean;
}

/**
 * Derive the effective access status from the latest access check.
 * The badge "CAN INVEST NOW" is only permitted when:
 *  - status is VERIFIED_OPEN (or CLOSING_SOON, which implies a verified live route),
 *  - checked within the freshness window,
 *  - an actionable route is stored,
 *  - the cheque terms are compatible with the household maximum,
 *  - no closure conflicts (closed status wins; a later closes_at alone does not).
 * Expiry is automatic: an old check downgrades to STALE without re-verification.
 */
export function effectiveAccess(
  checks: AccessCheck[],
  opts: { now?: Date; maxChequeGbp?: number; freshnessHours?: number } = {},
): EffectiveAccess {
  const now = opts.now ?? new Date();
  const freshnessHours = opts.freshnessHours ?? ACCESS_FRESHNESS_HOURS;
  const maxCheque = opts.maxChequeGbp ?? 250_000;
  if (checks.length === 0) {
    return { status: "unknown", canInvestNow: false, reason: "No way in has been found yet.", check: null, isStale: false };
  }
  const latest = [...checks].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
  const ageHours = (now.getTime() - new Date(latest.checkedAt).getTime()) / 36e5;
  const expired = latest.expiresAt ? new Date(latest.expiresAt).getTime() < now.getTime() : false;

  if (latest.accessStatus === "closed") {
    return { status: "closed", canInvestNow: false, reason: "Source or issuer confirms the round is closed.", check: latest, isStale: false };
  }
  const liveStatuses: AccessStatus[] = ["verified_open", "closing_soon"];
  if (liveStatuses.includes(latest.accessStatus)) {
    if (ageHours > freshnessHours || expired) {
      return {
        status: "stale",
        canInvestNow: false,
        reason: `Last checked ${ageHours >= 48 ? `${Math.round(ageHours / 24)} days` : `${Math.round(ageHours)} hours`} ago; it needs checking again before we can say it is open.`,
        check: latest,
        isStale: true,
      };
    }
    const hasRoute = Boolean(latest.contactOrUrl) && latest.routeType !== "none";
    if (!hasRoute) {
      return { status: "contactable", canInvestNow: false, reason: "The round looked open, but there is no link or contact to use yet.", check: latest, isStale: false };
    }
    // The family's cheque size is a preference, not a rule (owner, 23 Oct
    // 2026): a high minimum is flagged, never hidden or blocked.
    const aboveUsual = latest.minCheque !== null && latest.minCheque > maxCheque;
    return {
      status: latest.accessStatus,
      canInvestNow: true,
      reason: `A live way in was checked recently. Being able to apply does not guarantee an allocation.${aboveUsual ? ` Minimum cheque £${latest.minCheque!.toLocaleString("en-GB")} is above the usual £${maxCheque.toLocaleString("en-GB")} per member.` : ""}`,
      check: latest,
      isStale: false,
    };
  }
  return { status: latest.accessStatus, canInvestNow: false, reason: latest.notes || accessLabel(latest.accessStatus), check: latest, isStale: false };
}

export function accessLabel(status: AccessStatus): string {
  switch (status) {
    case "verified_open":
      return "Verified open";
    case "closing_soon":
      return "Closing soon";
    case "contactable":
      return "Contactable";
    case "fundraising_reported":
      return "Fundraising reported";
    case "expected":
      return "Expected round";
    case "closed":
      return "Closed";
    case "stale":
      return "Needs re-verification";
    default:
      return "Access unknown";
  }
}

export function accessTone(status: AccessStatus): "green" | "amber" | "blue" | "neutral" | "red" {
  switch (status) {
    case "verified_open":
    case "closing_soon":
      return "green";
    case "contactable":
    case "fundraising_reported":
      return "blue";
    case "expected":
      return "amber";
    case "stale":
      return "amber";
    case "closed":
      return "red";
    default:
      return "neutral";
  }
}

export function eisLabel(status: EisStatus): string {
  switch (status) {
    case "confirmed_documented":
      return "EIS/SEIS documented";
    case "company_claimed":
      return "EIS/SEIS claimed";
    case "pending":
      return "EIS/SEIS pending";
    case "not_applicable":
      return "Not applicable";
    default:
      return "Unknown";
  }
}

export function priorityLabel(p: AiPriority): string {
  switch (p) {
    case "high":
      return "AI: High";
    case "medium":
      return "AI: Medium";
    case "low":
      return "AI: Low";
    default:
      return "AI: Not rated";
  }
}

export function confidenceLabel(c: Confidence): string {
  return `${c[0].toUpperCase()}${c.slice(1)} confidence`;
}
