import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planImport } from "@/lib/research/import-batch";
import { parseTechRoundIndex, parseTechRoundPost, pollTechRound, techRoundPayload } from "@/lib/research/techround";

const index = readFileSync("tests/fixtures/techround-index.html", "utf8");
const post = readFileSync("tests/fixtures/techround-post.html", "utf8");

describe("TechRound weekly crowdfunding list", () => {
  it("finds the weekly posts, newest first", () => {
    const posts = parseTechRoundIndex(index);
    expect(posts[0]).toEqual({ url: "https://techround.co.uk/startups/5-startups-crowdfunding-w-c-19-10-2026/", weekOf: "2026-10-19" });
    expect(posts.length).toBeGreaterThan(5);
  });

  it("reads each entry's name, target, website, SEIS/EIS and platform", () => {
    const entries = parseTechRoundPost(post);
    expect(entries.map((e) => e.name)).toEqual(["INTUNE Drinks", "Café del Mar Spirits", "EverRhythm", "Gemsza", "Curcle"]);
    expect(entries[0]).toMatchObject({ target: { amount: 219_909, currency: "GBP" }, website: "https://intunedrinks.com", eis: "yes_eis", platform: "Europe Republic" });
    expect(entries[1]).toMatchObject({ target: null, website: "https://spirits.cafedelmar.com", eis: "yes_eis", platform: "Crowdcube" });
    expect(entries[2].platform).toBe("Crowdfunder");
    expect(entries[0].about).toMatch(/^INTUNE makes sparkling/);
  });

  it("turns the equity-platform entries into a batch the import pipeline accepts", () => {
    const payload = techRoundPayload({ url: "https://techround.co.uk/startups/meet-the-startups-crowdfunding-w-c-12-10-2026/", weekOf: "2026-10-12" }, parseTechRoundPost(post));
    expect(payload?.companies.map((c) => (c.candidate as { name: string }).name)).toEqual(["INTUNE Drinks", "Café del Mar Spirits"]);
    const planned = planImport(payload);
    expect(planned.ok && planned.plan.rejected).toEqual([]);
    const intune = (payload!.companies[0].candidate as { round: { target: { amount: number } }; access: { contactOrUrl: string; status: string }; eis: { status: string } });
    expect(intune.round.target.amount).toBe(219_909);
    expect(intune.access).toMatchObject({ status: "fundraising_reported", contactOrUrl: "https://europe.republic.com/discover" });
    expect(intune.eis.status).toBe("company_claimed");
  });

  it("leaves out euro campaigns and posts already queued", async () => {
    const euro = techRoundPayload({ url: "https://techround.co.uk/x/", weekOf: "2026-10-05" }, [{ name: "Skytree", target: { amount: 1_140_000, currency: "EUR" }, website: null, eis: "unknown", platform: "Europe Republic", about: "" }]);
    expect(euro).toBeNull();
    const fetcher = async (url: string) => ({ ok: true, status: 200, finalUrl: url, contentType: "text/html", text: url.includes("/search/") ? index : post });
    const queued: string[] = [];
    const labels = await pollTechRound({ householdId: "h", fetcher, now: new Date("2026-10-24T00:00:00Z"), alreadyQueued: async (l) => l.includes("2026-10-19"), queue: async (l) => (queued.push(l), true) });
    expect(labels).not.toContain("TechRound crowdfunding w/c 2026-10-19");
    expect(labels).toContain("TechRound crowdfunding w/c 2026-10-12");
    expect(labels.every((l) => l >= "TechRound crowdfunding w/c 2026-08-23")).toBe(true);
  });
});
