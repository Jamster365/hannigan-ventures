import { describe, expect, it } from "vitest";
import { almostMatch, applyVote, computeFamilyStage, consensusSummary, familyAverage, visibleVotes } from "@/lib/domain/family-consensus";
import type { Vote } from "@/lib/domain/types";

const v = (userId: string, vote: Vote["vote"], score: number | null = null): Vote => ({ companyId: "c", userId, vote, score, updatedAt: "2026-10-19T00:00:00Z" });

describe("computeFamilyStage: two_of_three (current rule)", () => {
  it("0 votes = unreviewed", () => expect(computeFamilyStage([])).toBe("unreviewed"));
  it("1 tick = pending", () => expect(computeFamilyStage([v("a", "interested")])).toBe("pending"));
  it("2 ticks = match, even with a cross", () => expect(computeFamilyStage([v("a", "interested"), v("b", "interested"), v("c", "pass")])).toBe("shortlisted"));
  it("one cross does not end it", () => expect(computeFamilyStage([v("a", "pass"), v("b", "interested")])).toBe("pending"));
  it("2 crosses = ended", () => expect(computeFamilyStage([v("a", "pass"), v("b", "pass"), v("c", "interested")])).toBe("passed"));
  it("leftover unsure votes are pending", () => expect(computeFamilyStage([v("a", "unsure"), v("b", "unsure"), v("c", "unsure")])).toBe("pending"));
});

describe("computeFamilyStage: unanimous (kept selectable)", () => {
  const unanimous = (votes: Vote[], n = 3) => computeFamilyStage(votes, n, "unanimous");
  it("2 of 3 ticks is not yet a match", () => expect(unanimous([v("a", "interested"), v("b", "interested")])).toBe("pending"));
  it("3 of 3 ticks = match", () => expect(unanimous([v("a", "interested"), v("b", "interested"), v("c", "interested")])).toBe("shortlisted"));
  it("a single cross ends it", () => expect(unanimous([v("a", "interested"), v("b", "interested"), v("c", "pass")])).toBe("passed"));
  it("uses the actual household size", () => expect(unanimous([v("a", "interested"), v("b", "interested")], 2)).toBe("shortlisted"));
});

describe("almostMatch (two_of_three)", () => {
  const members = [{ userId: "a" }, { userId: "b" }, { userId: "c" }];
  it("your tick would have made it: one other ticked, the third crossed", () => expect(almostMatch([v("a", "interested"), v("b", "pass")], members, "c")).toEqual([{ userId: "a" }]));
  it("not decisive while someone has not decided", () => expect(almostMatch([v("a", "interested")], members, "c")).toBeNull());
  it("not decisive when nobody ticked", () => expect(almostMatch([v("a", "pass"), v("b", "pass")], members, "c")).toBeNull());
});

describe("visibleVotes", () => {
  it("shows only your own vote before a match", () => expect(visibleVotes([v("a", "interested"), v("b", "pass")], "a").map((x) => x.userId)).toEqual(["a"]));
  it("shows everyone's on a match", () => expect(visibleVotes([v("a", "interested"), v("b", "interested"), v("c", "pass")], "c")).toHaveLength(3));
});

describe("familyAverage", () => {
  it("uses only submitted ratings", () => {
    expect(familyAverage([v("a", "interested", 8), v("b", "interested", 7), v("c", "unsure", null)])).toEqual({ average: 7.5, raters: 2 });
  });
  it("returns null when nobody rated", () => expect(familyAverage([v("a", "interested")])).toEqual({ average: null, raters: 0 }));
  it("ignores out-of-range scores", () => expect(familyAverage([v("a", "interested", 11 as number)])).toEqual({ average: null, raters: 0 }));
});

describe("applyVote transitions", () => {
  it("promotes on the second tick", () => {
    const { transition } = applyVote([v("a", "interested")], { userId: "b", vote: "interested" });
    expect(transition).toMatchObject({ from: "pending", to: "shortlisted", promoted: true, demoted: false });
  });
  it("undoing a tick (clearing it) demotes immediately", () => {
    const { transition, votes } = applyVote([v("a", "interested"), v("b", "interested")], { userId: "b", vote: null });
    expect(transition).toMatchObject({ from: "shortlisted", to: "pending", demoted: true });
    expect(votes.find((x) => x.userId === "b")).toBeUndefined();
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
