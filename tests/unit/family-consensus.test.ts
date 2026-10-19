import { describe, expect, it } from "vitest";
import { applyVote, computeFamilyStage, consensusSummary, familyAverage } from "@/lib/domain/family-consensus";
import type { Vote } from "@/lib/domain/types";

const v = (userId: string, vote: Vote["vote"], score: number | null = null): Vote => ({ companyId: "c", userId, vote, score, updatedAt: "2026-10-19T00:00:00Z" });

describe("computeFamilyStage", () => {
  it("0 votes = unreviewed", () => expect(computeFamilyStage([])).toBe("unreviewed"));
  it("1 interested = pending", () => expect(computeFamilyStage([v("a", "interested")])).toBe("pending"));
  it("2 interested = shortlisted", () => expect(computeFamilyStage([v("a", "interested"), v("b", "interested"), v("c", "pass")])).toBe("shortlisted"));
  it("2 pass = passed", () => expect(computeFamilyStage([v("a", "pass"), v("b", "pass"), v("c", "interested")])).toBe("passed"));
  it("1 pass alone is pending, never deletion", () => expect(computeFamilyStage([v("a", "pass")])).toBe("pending"));
  it("unsure votes alone are pending", () => expect(computeFamilyStage([v("a", "unsure"), v("b", "unsure"), v("c", "unsure")])).toBe("pending"));
});

describe("familyAverage", () => {
  it("uses only submitted ratings", () => {
    expect(familyAverage([v("a", "interested", 8), v("b", "interested", 7), v("c", "unsure", null)])).toEqual({ average: 7.5, raters: 2 });
  });
  it("returns null when nobody rated", () => expect(familyAverage([v("a", "interested")])).toEqual({ average: null, raters: 0 }));
  it("ignores out-of-range scores", () => expect(familyAverage([v("a", "interested", 11 as number)])).toEqual({ average: null, raters: 0 }));
});

describe("applyVote transitions", () => {
  it("promotes on the second Interested vote", () => {
    const { transition } = applyVote([v("a", "interested")], { userId: "b", vote: "interested" });
    expect(transition).toMatchObject({ from: "pending", to: "shortlisted", promoted: true, demoted: false });
  });
  it("demotes immediately when one of two Interested changes to Unsure", () => {
    const { transition, votes } = applyVote([v("a", "interested"), v("b", "interested")], { userId: "b", vote: "unsure" });
    expect(transition).toMatchObject({ from: "shortlisted", to: "pending", demoted: true });
    expect(votes.find((x) => x.userId === "b")?.vote).toBe("unsure");
  });
  it("changing score alone does not change the stage", () => {
    const { transition } = applyVote([v("a", "interested", 5)], { userId: "a", vote: "interested", score: 9 });
    expect(transition.from).toBe(transition.to);
  });
  it("clearing a vote removes the record", () => {
    const { votes } = applyVote([v("a", "interested")], { userId: "a", vote: null });
    expect(votes).toEqual([]);
  });
});

describe("consensusSummary", () => {
  it("reports interest and remaining voters", () => {
    expect(consensusSummary([v("a", "interested")], 3)).toBe("1 of 3 interested · 2 yet to vote");
    expect(consensusSummary([v("a", "interested"), v("b", "pass"), v("c", "pass")], 3)).toBe("1 of 3 interested · 2 pass");
  });
});
