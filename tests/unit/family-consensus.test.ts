import { describe, expect, it } from "vitest";
import { almostMatch, applyVote, computeFamilyStage, consensusSummary, familyAverage } from "@/lib/domain/family-consensus";
import type { Vote } from "@/lib/domain/types";

const v = (userId: string, vote: Vote["vote"], score: number | null = null): Vote => ({ companyId: "c", userId, vote, score, updatedAt: "2026-10-19T00:00:00Z" });

describe("computeFamilyStage: unanimous (swipe app)", () => {
  it("0 votes = unreviewed", () => expect(computeFamilyStage([])).toBe("unreviewed"));
  it("1 tick = pending", () => expect(computeFamilyStage([v("a", "interested")])).toBe("pending"));
  it("2 of 3 ticks is not yet a match", () => expect(computeFamilyStage([v("a", "interested"), v("b", "interested")])).toBe("pending"));
  it("3 of 3 ticks = match", () => expect(computeFamilyStage([v("a", "interested"), v("b", "interested"), v("c", "interested")])).toBe("shortlisted"));
  it("a single cross ends it, even after two ticks", () => expect(computeFamilyStage([v("a", "interested"), v("b", "interested"), v("c", "pass")])).toBe("passed"));
  it("a cross never deletes anything; leftover unsure votes are pending", () => expect(computeFamilyStage([v("a", "unsure"), v("b", "unsure"), v("c", "unsure")])).toBe("pending"));
  it("uses the actual household size", () => expect(computeFamilyStage([v("a", "interested"), v("b", "interested")], 2)).toBe("shortlisted"));
});

describe("computeFamilyStage: two_of_three (classic app)", () => {
  const classic = (votes: Vote[]) => computeFamilyStage(votes, 3, "two_of_three");
  it("2 interested = shortlisted", () => expect(classic([v("a", "interested"), v("b", "interested"), v("c", "pass")])).toBe("shortlisted"));
  it("2 pass = passed", () => expect(classic([v("a", "pass"), v("b", "pass"), v("c", "interested")])).toBe("passed"));
  it("1 pass alone is pending", () => expect(classic([v("a", "pass")])).toBe("pending"));
});

describe("almostMatch", () => {
  const members = [{ userId: "a" }, { userId: "b" }, { userId: "c" }];
  it("names the others when they both ticked", () => expect(almostMatch([v("a", "interested"), v("b", "interested")], members, "c")).toEqual([{ userId: "a" }, { userId: "b" }]));
  it("is null when someone else has not decided", () => expect(almostMatch([v("a", "interested")], members, "c")).toBeNull());
  it("is null when someone else crossed", () => expect(almostMatch([v("a", "interested"), v("b", "pass")], members, "c")).toBeNull());
});

describe("familyAverage", () => {
  it("uses only submitted ratings", () => {
    expect(familyAverage([v("a", "interested", 8), v("b", "interested", 7), v("c", "unsure", null)])).toEqual({ average: 7.5, raters: 2 });
  });
  it("returns null when nobody rated", () => expect(familyAverage([v("a", "interested")])).toEqual({ average: null, raters: 0 }));
  it("ignores out-of-range scores", () => expect(familyAverage([v("a", "interested", 11 as number)])).toEqual({ average: null, raters: 0 }));
});

describe("applyVote transitions", () => {
  it("promotes on the third tick", () => {
    const { transition } = applyVote([v("a", "interested"), v("b", "interested")], { userId: "c", vote: "interested" });
    expect(transition).toMatchObject({ from: "pending", to: "shortlisted", promoted: true, demoted: false });
  });
  it("undoing the last tick (clearing it) demotes immediately", () => {
    const { transition, votes } = applyVote([v("a", "interested"), v("b", "interested"), v("c", "interested")], { userId: "c", vote: null });
    expect(transition).toMatchObject({ from: "shortlisted", to: "pending", demoted: true });
    expect(votes.find((x) => x.userId === "c")).toBeUndefined();
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
