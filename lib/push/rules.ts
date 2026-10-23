import type { NotificationType } from "@/lib/domain/types";

/**
 * Which notifications reach phones: new matches, match-chat messages (members
 * and Research's company updates), and changes to the research instructions.
 * Everything else stays in the app.
 */
export const PUSH_TYPES: NotificationType[] = ["shortlist_promoted", "comment", "research_applied"];

export function isPushable(n: { notificationType: NotificationType; href: string }): boolean {
  if (n.notificationType === "comment") return n.href.startsWith("/matches");
  return PUSH_TYPES.includes(n.notificationType);
}

/** Notifications older than this are never pushed (a late phone alert is noise). */
export const PUSH_MAX_AGE_MS = 6 * 3600_000;
