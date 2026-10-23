import { describe, expect, it } from "vitest";
import { planImport } from "@/lib/research/import-batch";
import { RESEARCH_POOL } from "@/lib/research/research-pool";

describe("research pool shipped with the app", () => {
  it("every batch is labelled for the heartbeat and reads cleanly", () => {
    const labels = new Set<string>();
    for (const batch of RESEARCH_POOL) {
      expect(batch.label.startsWith("Research pool")).toBe(true);
      expect(labels.has(batch.label)).toBe(false);
      labels.add(batch.label);
      const planned = planImport(batch.data);
      expect(planned.ok).toBe(true);
      if (planned.ok) {
        expect(planned.plan.rejected).toEqual([]);
        for (const b of planned.plan.batches) for (const c of b.companies) expect((c.candidate as { country: string }).country).toMatch(/^(United Kingdom|UK)$/);
      }
    }
  });
});
