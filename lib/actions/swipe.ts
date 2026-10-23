"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import type { ActionResult } from "./family";

export type SwipeOutcome =
  | { kind: "match"; tickedBy: string[] }
  | { kind: "almost" }
  | { kind: "none" };

const swipeSchema = z.object({
  companyId: z.string().min(1),
  slug: z.string().min(1),
  vote: z.enum(["interested", "pass"]),
});

function revalidateSwipe(slug: string) {
  // Not "/": the deck is client state, and a refresh mid-animation used to blank it.
  revalidatePath("/decisions");
  revalidatePath("/matches");
  revalidatePath(`/matches/${slug}`);
}

/**
 * Tick (interested) or cross (pass). Reports a match when this tick made it
 * one (with who else ticked), and "almost a match" when this member's cross
 * was the deciding vote and a tick would have made it a match.
 */
export async function swipeAction(input: z.input<typeof swipeSchema>): Promise<ActionResult<{ outcome: SwipeOutcome }>> {
  const parsed = swipeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid swipe" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    const { transition } = await repo.setVote({ userId: member.userId, companyId: parsed.data.companyId, vote: parsed.data.vote });
    let outcome: SwipeOutcome = { kind: "none" };
    if (parsed.data.vote === "interested" && transition.promoted) {
      // Others' votes become readable only once it is a match, so look them up now.
      const [votes, members] = await Promise.all([repo.listVotes(parsed.data.companyId), repo.getMembers()]);
      const others = votes.filter((v) => v.userId !== member.userId && v.vote === "interested").map((v) => members.find((m) => m.userId === v.userId)?.displayName ?? "Someone");
      outcome = { kind: "match", tickedBy: others };
    } else if (parsed.data.vote === "pass" && (await repo.almostMatch({ userId: member.userId, companyId: parsed.data.companyId }))) {
      outcome = { kind: "almost" };
    }
    revalidateSwipe(parsed.data.slug);
    // Every so many answers, draft research guidance from them (a proposal to approve).
    after(() => import("@/lib/learning/propose").then((m) => m.maybeProposeFromAnswers(repo)).catch(() => undefined));
    return { ok: true, data: { outcome } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save your swipe" };
  }
}

const undoSchema = z.object({
  companyId: z.string().min(1),
  slug: z.string().min(1),
  previousVote: z.enum(["interested", "unsure", "pass"]).nullable(),
});

/** Put the last swipe back exactly as it was (usually: no vote at all). */
export async function undoSwipeAction(input: z.input<typeof undoSchema>): Promise<ActionResult> {
  const parsed = undoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid undo" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.setVote({ userId: member.userId, companyId: parsed.data.companyId, vote: parsed.data.previousVote });
    revalidateSwipe(parsed.data.slug);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not undo" };
  }
}

/** Opening a match chat clears its unread match/comment notifications. */
export async function markMatchReadAction(ids: string[]): Promise<ActionResult> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string")) return { ok: true };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.markNotificationsRead(member.userId, ids);
    revalidatePath("/matches");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update notifications" };
  }
}

const reasonSchema = z.object({
  companyId: z.string().min(1),
  slug: z.string().min(1),
  note: z.string().trim().max(500),
});

/** Optional "why?" for a yes or no. Private like the vote; used later to learn what the family likes. */
export async function saveReasonAction(input: z.input<typeof reasonSchema>): Promise<ActionResult> {
  const parsed = reasonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Keep the reason under 500 characters." };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.setVoteNote({ userId: member.userId, companyId: parsed.data.companyId, note: parsed.data.note || null });
    revalidatePath("/decisions");
    revalidatePath("/taste");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the reason" };
  }
}

const roundCheckSchema = z.object({
  companyId: z.string().min(1),
  slug: z.string().min(1),
  open: z.boolean(),
  /** What the member saw on the page: "£412k of £500k raised, closes 3 Nov, £3.2m pre-money, SEIS". */
  details: z.string().trim().max(300).optional(),
});

/**
 * A member opened the round's page (usually a crowdfunding campaign, which
 * research cannot read) and says whether it is live. "Open" counts as a
 * direct, fresh check for 48 hours.
 */
export async function recordRoundCheckAction(input: z.input<typeof roundCheckSchema>): Promise<ActionResult> {
  const parsed = roundCheckSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid check" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.recordMemberRoundCheck({ userId: member.userId, companyId: parsed.data.companyId, open: parsed.data.open, details: parsed.data.details });
    revalidateSwipe(parsed.data.slug);
    revalidatePath(`/matches/${parsed.data.slug}/profile`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save your check" };
  }
}
