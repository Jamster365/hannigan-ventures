import { describe, expect, it } from "vitest";
import { isPushable } from "@/lib/push/rules";

describe("isPushable", () => {
  it("sends matches, match-chat messages and instruction changes to phones", () => {
    expect(isPushable({ notificationType: "shortlist_promoted", href: "/matches/x" })).toBe(true);
    expect(isPushable({ notificationType: "comment", href: "/matches/x" })).toBe(true);
    expect(isPushable({ notificationType: "research_applied", href: "/research/settings?tab=history" })).toBe(true);
  });

  it("keeps everything else in the app", () => {
    expect(isPushable({ notificationType: "comment", href: "/companies/x?tab=family" })).toBe(false);
    expect(isPushable({ notificationType: "shortlist_demoted", href: "/matches" })).toBe(false);
    expect(isPushable({ notificationType: "round_confirmed", href: "/companies/x" })).toBe(false);
    expect(isPushable({ notificationType: "research_failed", href: "/research/history" })).toBe(false);
  });
});
