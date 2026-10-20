import { describe, expect, it } from "vitest";
import { z } from "zod";
import { repairToSchema } from "@/lib/research/repair";

const schema = z.object({
  teaser: z.string().min(1).max(20),
  website: z.string().url().nullable(),
  tags: z.array(z.string()).max(2),
  status: z.enum(["open", "closed", "unknown"]),
  amount: z.number().nullable(),
  founders: z.array(z.object({ bio: z.string().max(10) })),
});

describe("repairToSchema", () => {
  it("fixes only presentation slips and reports each repair", () => {
    const r = repairToSchema(schema, {
      teaser: "A very long teaser that runs on",
      website: "acme.example",
      tags: ["a", "b", "c"],
      status: "raising",
      amount: "1,500,000",
      founders: [{ bio: "Founder with a long biography" }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.teaser.length).toBeLessThanOrEqual(20);
    expect(r.data.teaser.endsWith("…")).toBe(true);
    expect(r.data.website).toBe("https://acme.example/");
    expect(r.data.tags).toEqual(["a", "b"]);
    expect(r.data.status).toBe("unknown");
    expect(r.data.amount).toBe(1_500_000);
    expect(r.data.founders[0].bio.length).toBeLessThanOrEqual(10);
    expect(r.repairs.length).toBeGreaterThanOrEqual(6);
  });

  it("never invents missing content: a required field that is absent still fails, with a readable reason", () => {
    const r = repairToSchema(schema, { website: null, tags: [], status: "open", amount: null, founders: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/teaser/);
  });

  it("removes a URL that cannot be made valid rather than guessing", () => {
    const r = repairToSchema(schema, { teaser: "ok", website: "not a url", tags: [], status: "open", amount: null, founders: [] });
    expect(r.ok && r.data.website).toBeNull();
  });
});

describe("salvageExtraction", () => {
  it("keeps valid candidates and drops only the one that cannot be repaired", async () => {
    const { salvageExtraction } = await import("@/lib/research/discover");
    const good = {
      name: "Acme Bio",
      website: "acme.example",
      legalName: null,
      sector: "Biotech",
      subSector: null,
      city: "Oxford",
      country: "UK",
      stage: "Seed",
      teaser: "x".repeat(400),
      description: "y".repeat(3000),
      discoverySignal: "OUI spinout",
      researchRuleMatched: "Oxford",
      round: null,
      access: { status: "unknown", routeType: "none", contactOrUrl: null, minCheque: null, maxCheque: null, currency: null, notes: "", sourceUrls: [], evidenceStatus: "unknown" },
      eis: { status: "unknown", note: null, sourceUrls: [], evidenceStatus: "unknown" },
      openQuestions: [],
    };
    const broken = { website: null }; // no name, sector or teaser: not repairable
    const out = salvageExtraction({ candidates: [good, broken], events: [], executiveFindings: ["One"] });
    expect(out).not.toBeNull();
    expect(out!.data.candidates.map((c) => c.name)).toEqual(["Acme Bio"]);
    expect(out!.data.candidates[0].description.length).toBeLessThanOrEqual(2000);
    expect(out!.data.candidates[0].website).toBe("https://acme.example/");
    expect(out!.dropped).toHaveLength(1);
    expect(out!.dropped[0]).toMatch(/candidate 2/);
  });
});
