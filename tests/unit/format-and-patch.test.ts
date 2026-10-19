import { describe, expect, it } from "vitest";
import { londonDate, londonHour } from "@/lib/domain/format";
import { applyPatch, diffLines } from "@/lib/research/patch";
import { partitionForHome, summarise } from "@/lib/domain/summaries";
import { DEMO_COMPANIES } from "@/lib/demo/dataset";

describe("Europe/London time helpers", () => {
  it("handles BST (UTC+1) and GMT (UTC+0)", () => {
    expect(londonHour(new Date("2026-07-01T06:00:00Z"))).toBe(7);
    expect(londonHour(new Date("2026-12-01T07:00:00Z"))).toBe(7);
    expect(londonHour(new Date("2026-12-01T06:00:00Z"))).toBe(6);
  });
  it("gives the London calendar date across midnight", () => {
    expect(londonDate(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    expect(londonDate(new Date("2026-12-01T23:30:00Z"))).toBe("2026-12-01");
  });
});

describe("prompt patches", () => {
  it("applies exact-match patches", () => {
    expect(applyPatch("a b c", [{ find: "b", replace: "B" }])).toBe("a B c");
  });
  it("rejects patches whose anchor is missing or ambiguous", () => {
    expect(applyPatch("a b c", [{ find: "z", replace: "Z" }])).toBeNull();
    expect(applyPatch("a b b", [{ find: "b", replace: "B" }])).toBeNull();
  });
  it("produces a readable line diff", () => {
    const d = diffLines("one\ntwo\nthree", "one\n2\nthree");
    expect(d.map((l) => l.kind)).toEqual(["same", "removed", "added", "same"]);
  });
});

describe("home partitioning", () => {
  it("shows each company at most once across New / Pending / Shortlist", () => {
    const summaries = DEMO_COMPANIES.map((b) => summarise(b));
    const parts = partitionForHome(summaries);
    const ids = [...parts.new, ...parts.pending, ...parts.shortlist].map((s) => s.company.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(parts.shortlist.every((s) => s.familyStage === "shortlisted")).toBe(true);
    expect(parts.new.every((s) => s.votes.length === 0)).toBe(true);
  });
  it("never marks demo data as anything but demo", () => {
    expect(DEMO_COMPANIES.every((b) => b.company.isDemo)).toBe(true);
    expect(DEMO_COMPANIES.flatMap((b) => b.sources).every((s) => s.canonicalUrl.includes(".invalid"))).toBe(true);
  });
});
