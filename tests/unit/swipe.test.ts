import { describe, expect, it } from "vitest";
import { getDemoRepository } from "@/lib/data/demo-repository";
import { DEMO_MEMBERS } from "@/lib/demo/members";
import { buildSwipeCard, decisionsFor, deckFor, fitScore, isUk, matchesFor } from "@/lib/domain/swipe";
import type { CompanyBundle, Vote } from "@/lib/domain/types";

const [a, b, c] = DEMO_MEMBERS;
const vote = (userId: string, v: Vote["vote"]): Vote => ({ companyId: "x", userId, vote: v, score: null, updatedAt: "2026-10-20T00:00:00Z" });

async function bundles(): Promise<CompanyBundle[]> {
  return (await getDemoRepository().listCompanies()).map((bundle) => structuredClone(bundle));
}

describe("deckFor", () => {
  it("leaves out what I decided, matches and companies two people crossed; keeps a single cross", async () => {
    const [one, two, three, four, five] = (await bundles()).filter((b) => !b.accessChecks.some((x) => x.accessStatus === "closed") && !b.rounds.some((r) => r.isCurrent && r.claimedStatus === "closed"));
    one.votes = [vote(a.userId, "interested")];
    two.votes = [vote(b.userId, "pass")];
    three.votes = [vote(a.userId, "unsure"), vote(b.userId, "interested")];
    four.votes = [vote(b.userId, "interested"), vote(c.userId, "interested")];
    five.votes = [vote(b.userId, "pass"), vote(c.userId, "pass")];
    const ids = deckFor([one, two, three, four, five], a.userId).map((x) => x.company.id);
    expect(ids).toContain(two.company.id);
    expect(ids).toContain(three.company.id);
    expect(ids).not.toContain(one.company.id);
    expect(ids).not.toContain(four.company.id);
    expect(ids).not.toContain(five.company.id);
  });

  it("parks closed rounds on the watch list instead of the deck", async () => {
    const [one] = await bundles();
    one.votes = [];
    one.accessChecks = [{ ...one.accessChecks[0], id: "closed-check", accessStatus: "closed", checkedAt: "2026-10-22T00:00:00Z" } as (typeof one.accessChecks)[number]];
    expect(deckFor([one], a.userId)).toHaveLength(0);
    expect(decisionsFor([one], a.userId).watching.map((r) => r.company.id)).toEqual([one.company.id]);
  });
});

describe("decisionsFor", () => {
  it("lists my ticks and crosses with their status", async () => {
    const [one, two] = await bundles();
    one.votes = [vote(a.userId, "interested"), vote(b.userId, "interested")];
    two.votes = [vote(a.userId, "pass")];
    const { decided } = decisionsFor([one, two], a.userId);
    expect(decided.map((d) => [d.company.id, d.vote, d.status])).toEqual(expect.arrayContaining([[one.company.id, "interested", "match"], [two.company.id, "pass", "waiting"]]));
  });
});

describe("cards and matches", () => {
  it("never shows other members' votes on a card, and keeps unknowns visible", async () => {
    const [one] = await bundles();
    one.votes = [vote(b.userId, "interested")];
    const card = buildSwipeCard(one, a.userId);
    expect(card.myVote).toBeNull();
    expect(JSON.stringify(card)).not.toContain(b.userId);
    expect(card.facts.map((f) => f.label)).toEqual(expect.arrayContaining(["Stage", "Raising", "Valuation", "EIS/SEIS"]));
  });

  it("lists companies with two ticks as matches", async () => {
    const [one, two] = await bundles();
    one.votes = [vote(a.userId, "interested"), vote(b.userId, "interested"), vote(c.userId, "pass")];
    two.votes = [vote(a.userId, "interested"), vote(b.userId, "pass")];
    const rows = matchesFor([one, two], DEMO_MEMBERS, []);
    expect(rows.map((r) => r.company.id)).toEqual([one.company.id]);
  });

  it("archives a match when its round closes", async () => {
    const all = await bundles();
    const closed = all.find((x) => x.accessChecks.some((k) => k.accessStatus === "closed"))!;
    const open = all.find((x) => x !== closed && !x.accessChecks.some((k) => k.accessStatus === "closed") && !x.rounds.some((r) => r.isCurrent && r.claimedStatus === "closed"))!;
    for (const x of [closed, open]) x.votes = [vote(a.userId, "interested"), vote(b.userId, "interested")];
    const rows = matchesFor([closed, open], DEMO_MEMBERS, []);
    expect(rows.find((r) => r.company.id === closed.company.id)?.archived).toBe(true);
    expect(rows.find((r) => r.company.id === open.company.id)?.archived).toBe(false);
  });
});

describe("deck fit", () => {
  it("keeps UK companies only and puts EIS/SEIS, early, small rounds first", async () => {
    const all = (await bundles()).filter((x) => !x.accessChecks.some((k) => k.accessStatus === "closed") && !x.rounds.some((r) => r.isCurrent && r.claimedStatus === "closed")).slice(0, 3);
    const [eis, plain, abroad] = all;
    for (const x of all) {
      x.votes = [];
      x.accessChecks = [];
      x.rounds = [];
      x.company = { ...x.company, country: "United Kingdom", stage: "Series A", eisStatus: "unknown" };
    }
    eis.company = { ...eis.company, eisStatus: "confirmed_documented", stage: "Pre-seed" };
    plain.company = { ...plain.company, eisStatus: "not_applicable" };
    abroad.company = { ...abroad.company, country: "Germany", eisStatus: "confirmed_documented" };
    expect(fitScore(eis)).toBeGreaterThan(fitScore(plain));
    expect(isUk(abroad)).toBe(false);
    expect(deckFor(all, a.userId).map((x) => x.company.id)).toEqual([eis.company.id, plain.company.id]);
  });
});
