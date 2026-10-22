import { describe, expect, it } from "vitest";
import { getDemoRepository } from "@/lib/data/demo-repository";
import { DEMO_MEMBERS } from "@/lib/demo/members";
import { buildSwipeCard, deckFor, matchesFor, waitingOnMe } from "@/lib/domain/swipe";
import type { CompanyBundle, Vote } from "@/lib/domain/types";

const [a, b, c] = DEMO_MEMBERS;
const vote = (userId: string, v: Vote["vote"]): Vote => ({ companyId: "x", userId, vote: v, score: null, updatedAt: "2026-10-20T00:00:00Z" });

async function bundles(): Promise<CompanyBundle[]> {
  return (await getDemoRepository().listCompanies()).map((bundle) => structuredClone(bundle));
}

describe("deckFor", () => {
  it("leaves out companies I have decided, companies anyone crossed and matches", async () => {
    const [one, two, three, four] = await bundles();
    one.votes = [vote(a.userId, "interested")];
    two.votes = [vote(b.userId, "pass")];
    three.votes = [vote(a.userId, "unsure"), vote(b.userId, "interested")];
    four.votes = [];
    const ids = deckFor([one, two, three, four], a.userId).map((x) => x.company.id);
    expect(ids).toContain(three.company.id);
    expect(ids).toContain(four.company.id);
    expect(ids).not.toContain(one.company.id);
    expect(ids).not.toContain(two.company.id);
  });

  it("counts companies the others have both ticked without saying which", async () => {
    const [one, two] = await bundles();
    one.votes = [vote(b.userId, "interested"), vote(c.userId, "interested")];
    two.votes = [vote(b.userId, "interested")];
    expect(waitingOnMe([one, two], DEMO_MEMBERS, a.userId)).toBe(1);
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

  it("lists only unanimous companies as matches", async () => {
    const [one, two] = await bundles();
    one.votes = [vote(a.userId, "interested"), vote(b.userId, "interested"), vote(c.userId, "interested")];
    two.votes = [vote(a.userId, "interested"), vote(b.userId, "interested")];
    const rows = matchesFor([one, two], DEMO_MEMBERS, []);
    expect(rows.map((r) => r.company.id)).toEqual([one.company.id]);
  });
});
