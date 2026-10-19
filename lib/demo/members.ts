import type { Member } from "@/lib/domain/types";

/**
 * Demo household. Display names deliberately match the design reference so the
 * UI can be compared against it; nothing in the app logic depends on them.
 */
export const DEMO_HOUSEHOLD_ID = "00000000-0000-4000-8000-00000000d000";

export const DEMO_MEMBERS: Member[] = [
  {
    userId: "00000000-0000-4000-8000-0000000000a1",
    displayName: "Jamie",
    initial: "J",
    role: "owner",
    accent: "blue",
    joinedAt: "2026-09-01T09:00:00Z",
  },
  {
    userId: "00000000-0000-4000-8000-0000000000b2",
    displayName: "Brother",
    initial: "B",
    role: "member",
    accent: "green",
    joinedAt: "2026-09-01T09:05:00Z",
  },
  {
    userId: "00000000-0000-4000-8000-0000000000c3",
    displayName: "Dad",
    initial: "D",
    role: "member",
    accent: "red",
    joinedAt: "2026-09-01T09:10:00Z",
  },
];

export const [JAMIE, BROTHER, DAD] = DEMO_MEMBERS;
