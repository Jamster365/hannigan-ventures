import { describe, expect, it } from "vitest";
import { getDemoRepository } from "@/lib/data/demo-repository";
import { DEMO_MEMBERS } from "@/lib/demo/members";
import { familyInsights, guidanceLines, shouldPropose, withLearnedSection } from "@/lib/domain/family-learning";
import { buildMatcher, companyFeatures, DEFAULT_MEMBER_PREFERENCES, reasonChips } from "@/lib/domain/learning";
import { EXPLORE_EVERY_EARLY, rankDeck } from "@/lib/domain/swipe";
import type { CompanyBundle, Vote } from "@/lib/domain/types";

const [a, b, c] = DEMO_MEMBERS;

async function bundles(): Promise<CompanyBundle[]> {
  const list = (await getDemoRepository().listCompanies()).map((x) => structuredClone(x));
  for (const x of list) {
    x.votes = [];
    x.accessChecks = [];
    x.rounds = [];
    x.company = { ...x.company, country: "United Kingdom" };
  }
  return list;
}

const vote = (userId: string, companyId: string, v: Vote["vote"], note?: string): Vote => ({ companyId, userId, vote: v, score: null, note, updatedAt: "2026-10-23T10:00:00Z" });

describe("matcher", () => {
  it("learns a member's sector taste and puts similar companies higher", async () => {
    const list = await bundles();
    list.forEach((x, i) => (x.company = { ...x.company, sector: i % 2 ? "Climate" : "Fintech", eisStatus: "unknown", stage: "Seed" }));
    const climate = list.filter((x) => x.company.sector === "Climate");
    const fintech = list.filter((x) => x.company.sector === "Fintech");
    // Answer four of each; the rest are unanswered.
    climate.slice(0, 4).forEach((x) => x.votes.push(vote(a.userId, x.company.id, "interested")));
    fintech.slice(0, 4).forEach((x) => x.votes.push(vote(a.userId, x.company.id, "pass")));
    const m = buildMatcher(list, a.userId);
    expect(m.score(climate[4]).points).toBeGreaterThan(m.score(fintech[4]).points);
    expect(m.score(climate[4]).why).toMatch(/yes to 4 of 4 Climate companies/);
    expect(m.score(fintech[4]).why).toBeNull();
  });

  it("counts a reason that names the feature twice", () => {
    expect(reasonChips("Not our sector, Valuation too high. Too consumer-y")).toEqual(["Not our sector", "Valuation too high"]);
  });

  it("uses stated preferences before there are any answers", async () => {
    const list = await bundles();
    const [liked, other] = list;
    liked.company = { ...liked.company, sector: "Climate" };
    other.company = { ...other.company, sector: "Fintech" };
    const m = buildMatcher(list, a.userId, { ...DEFAULT_MEMBER_PREFERENCES, sectorsLike: ["Climate"], sectorsAvoid: ["Fintech"] });
    expect(m.score(liked).points).toBeGreaterThan(0);
    expect(m.score(other).points).toBeLessThan(0);
    expect(m.score(liked).why).toBe("You said you like Climate.");
  });

  it("never lets other members' votes on a company move that company", async () => {
    const list = await bundles();
    list.forEach((x) => (x.company = { ...x.company, sector: "Climate" }));
    const [target, ...rest] = list;
    rest.slice(0, 4).forEach((x) => x.votes.push(vote(b.userId, x.company.id, "interested")));
    const before = buildMatcher(list, a.userId).score(target).points;
    target.votes.push(vote(b.userId, target.company.id, "interested"), vote(c.userId, target.company.id, "interested"));
    const after = buildMatcher(list, a.userId).score(target).points;
    expect(after).toBeCloseTo(before, 6);
  });

  it("mixes in an explore pick once a member has answered a few", async () => {
    const base = await bundles();
    const list = [0, 1, 2].flatMap((n) => base.map((x) => ({ ...structuredClone(x), company: { ...x.company, id: `${x.company.id}-${n}`, slug: `${x.company.slug}-${n}` } })));
    list.forEach((x, i) => (x.company = { ...x.company, sector: i < 8 ? "Climate" : `Sector ${i % 7}` }));
    list.slice(0, 5).forEach((x) => x.votes.push(vote(a.userId, x.company.id, "interested")));
    const deck = rankDeck(list, a.userId);
    expect(deck.length).toBeGreaterThan(EXPLORE_EVERY_EARLY);
    expect(deck[EXPLORE_EVERY_EARLY - 1].explore).toBe(true);
    expect(deck.filter((e) => e.explore).every((e) => e.why?.includes("different"))).toBe(true);
  });

  it("describes companies by sector, stage and SEIS/EIS, not region or route", async () => {
    const [x] = await bundles();
    x.company = { ...x.company, sector: "Climate", stage: "Pre-seed", eisStatus: "confirmed_documented", city: "Edinburgh" };
    expect(companyFeatures(x)).toEqual(expect.arrayContaining(["sector:Climate", "stage:Pre-seed", "eis:yes"]));
    expect(companyFeatures(x).some((f) => f.startsWith("region:") || f.startsWith("route:"))).toBe(false);
  });
});

describe("family learning", () => {
  it("turns totals into research guidance and a learned section", async () => {
    const list = await bundles();
    list.forEach((x, i) => (x.company = { ...x.company, sector: i < 5 ? "Climate" : "Consumer" }));
    for (const m of [a, b, c]) {
      list.slice(0, 5).forEach((x) => x.votes.push(vote(m.userId, x.company.id, "interested", "Love the sector")));
      list.slice(5, 10).forEach((x) => x.votes.push(vote(m.userId, x.company.id, "pass", "Not our sector")));
    }
    const insights = familyInsights(list);
    const lines = guidanceLines(insights);
    expect(lines.some((l) => l.startsWith("Look for more Climate companies: the family said yes to 15 of 15"))).toBe(true);
    expect(lines.some((l) => l.startsWith("Find fewer Consumer companies"))).toBe(true);
    const once = withLearnedSection("Base instructions.", lines, "2026-10-23");
    const twice = withLearnedSection(once, ["New line."], "2026-11-01");
    expect(twice).toBe("Base instructions.\n\nLearned from the family's answers (2026-11-01; a preference, not a rule):\n- New line.");
  });

  it("proposes again only after enough new answers and none waiting", async () => {
    const list = await bundles();
    list.slice(0, 10).forEach((x) => x.votes.push(vote(a.userId, x.company.id, "pass"), vote(b.userId, x.company.id, "interested"), vote(c.userId, x.company.id, "pass")));
    expect(shouldPropose(list, [])).toBe(true);
    const waiting = { id: "s", feedbackId: null, basePromptVersionId: "p", suggestedPatch: [], rationale: "", expectedImpact: "", status: "proposed" as const, suggestedBy: "learning", approvedBy: null, appliedVersionId: null, createdAt: "2026-10-23T09:00:00Z" };
    expect(shouldPropose(list, [waiting])).toBe(false);
    expect(shouldPropose(list, [{ ...waiting, status: "applied", createdAt: "2026-10-23T11:00:00Z" }])).toBe(false);
  });
});
