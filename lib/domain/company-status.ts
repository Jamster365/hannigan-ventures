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
  const maxCheque = opts.maxChequeGbp ?? 100_000;
  if (checks.length === 0) {
    return { status: "unknown", canInvestNow: false, reason: "No verified access route recorded.", check: null, isStale: false };
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
        reason: `Last verified ${Math.round(ageHours)}h ago; live access cannot be claimed without re-verification.`,
        check: latest,
        isStale: true,
      };
    }
    const hasRoute = Boolean(latest.contactOrUrl) && latest.routeType !== "none";
    if (!hasRoute) {
      return { status: "contactable", canInvestNow: false, reason: "Verified status recorded without an actionable route.", check: latest, isStale: false };
    }
    const chequeOk = latest.minCheque === null || latest.minCheque <= maxCheque;
    if (!chequeOk) {
      return {
        status: latest.accessStatus,
        canInvestNow: false,
        reason: `Minimum cheque exceeds the household maximum of £${maxCheque.toLocaleString("en-GB")}.`,
        check: latest,
        isStale: false,
      };
    }
    return {
      status: latest.accessStatus,
      canInvestNow: true,
      reason: "Live route verified within the freshness window. An application route does not guarantee allocation.",
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
