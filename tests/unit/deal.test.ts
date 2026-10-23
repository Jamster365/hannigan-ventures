import { describe, expect, it } from "vitest";
import { checklistFor, DEAL_CHECKLIST, dealProgress, EMPTY_DEAL, safeDocumentName, type Deal } from "@/lib/domain/deal";

const check = (key: string, status: "todo" | "done" | "na", label?: string) => ({ companyId: "c", key, status, note: "", updatedBy: "u", updatedAt: "2026-10-23T10:00:00Z", label });

describe("deal room", () => {
  it("starts every match with the full checklist, in stage order", () => {
    const items = checklistFor(EMPTY_DEAL);
    expect(items).toHaveLength(DEAL_CHECKLIST.length);
    expect(items.every((i) => i.status === "todo")).toBe(true);
    expect(items[0].stage).toBe("meet");
    expect(items.at(-1)!.stage).toBe("after");
  });

  it("merges what the family recorded and their own items, and counts progress without 'not needed'", () => {
    const deal: Deal = { checks: [check("founders_call", "done"), check("customer_refs", "na"), check("custom_1", "done", "Visit the factory")], documents: [], decision: null };
    const items = checklistFor(deal);
    expect(items.find((i) => i.key === "founders_call")?.status).toBe("done");
    expect(items.find((i) => i.key === "custom_1")).toMatchObject({ label: "Visit the factory", custom: true, status: "done" });
    const p = dealProgress(deal);
    expect(p.total).toBe(DEAL_CHECKLIST.length); // 16 template + 1 custom − 1 not needed
    expect(p.done).toBe(2);
    expect(p.status).toBe("considering");
  });

  it("totals an investment across members", () => {
    const deal: Deal = { ...EMPTY_DEAL, decision: { companyId: "c", status: "invested", amounts: { a: 50_000, b: 25_000 }, investedAt: "2026-11-01", scheme: "SEIS", stakePct: 4, instrument: "", certificateReceived: false, notes: "", updatedBy: "a", updatedAt: "" } };
    expect(dealProgress(deal)).toMatchObject({ status: "invested", totalInvestedGbp: 75_000 });
  });

  it("keeps document names safe for storage paths", () => {
    expect(safeDocumentName("Term sheet (v2) / FINAL?.pdf")).toBe("Term sheet (v2) _ FINAL_.pdf");
    expect(safeDocumentName("   ")).toBe("document");
  });
});
