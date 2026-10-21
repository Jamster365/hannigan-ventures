import { describe, expect, it } from "vitest";
import { toIsoDate } from "@/lib/research/dates";

describe("toIsoDate", () => {
  it("normalises partial dates to the start of the stated period", () => {
    expect(toIsoDate("2024-11")).toBe("2024-11-01");
    expect(toIsoDate("2024-3")).toBe("2024-03-01");
    expect(toIsoDate("2024")).toBe("2024-01-01");
    expect(toIsoDate("2026-08-26T09:00:00Z")).toBe("2026-08-26");
    expect(toIsoDate("15 November 2024")).toBe("2024-11-15");
  });
  it("returns null for anything it cannot read, never a guess", () => {
    expect(toIsoDate("Q4")).toBeNull();
    expect(toIsoDate("2024-13")).toBeNull();
    expect(toIsoDate("2024-02-30")).toBeNull();
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate(null)).toBeNull();
  });
});
