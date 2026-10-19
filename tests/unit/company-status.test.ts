import { describe, expect, it } from "vitest";
import { effectiveAccess } from "@/lib/domain/company-status";
import type { AccessCheck } from "@/lib/domain/types";

const now = new Date("2026-10-19T12:00:00Z");
const base: AccessCheck = {
  id: "a",
  companyId: "c",
  accessStatus: "verified_open",
  routeType: "official_application",
  contactOrUrl: "https://example.test/apply",
  minCheque: 10_000,
  maxCheque: 100_000,
  currency: "GBP",
  checkedAt: "2026-10-19T00:00:00Z",
  expiresAt: null,
  verifier: "research",
  sourceId: "s",
  notes: "",
};

describe("CAN INVEST NOW guard", () => {
  it("is allowed only for a fresh verified route with compatible cheque terms", () => {
    expect(effectiveAccess([base], { now }).canInvestNow).toBe(true);
  });
  it("is impossible without any check", () => {
    expect(effectiveAccess([], { now })).toMatchObject({ status: "unknown", canInvestNow: false });
  });
  it("expires automatically after the freshness window", () => {
    const stale = { ...base, checkedAt: "2026-10-16T00:00:00Z" };
    const res = effectiveAccess([stale], { now });
    expect(res).toMatchObject({ status: "stale", canInvestNow: false, isStale: true });
  });
  it("is refused when there is no actionable route", () => {
    expect(effectiveAccess([{ ...base, contactOrUrl: null, routeType: "none" }], { now }).canInvestNow).toBe(false);
  });
  it("is refused when the minimum cheque exceeds the household maximum", () => {
    expect(effectiveAccess([{ ...base, minCheque: 250_000 }], { now, maxChequeGbp: 100_000 }).canInvestNow).toBe(false);
  });
  it("closed always wins", () => {
    expect(effectiveAccess([{ ...base, accessStatus: "closed" }], { now })).toMatchObject({ status: "closed", canInvestNow: false });
  });
  it("fundraising reported never counts as open", () => {
    expect(effectiveAccess([{ ...base, accessStatus: "fundraising_reported" }], { now }).canInvestNow).toBe(false);
  });
  it("uses the latest check", () => {
    const older = { ...base, id: "old", accessStatus: "closed" as const, checkedAt: "2026-10-18T00:00:00Z" };
    expect(effectiveAccess([older, base], { now }).canInvestNow).toBe(true);
  });
});
