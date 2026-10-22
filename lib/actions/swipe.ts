"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { almostMatch } from "@/lib/domain/family-consensus";
import type { VoteValue } from "@/lib/domain/types";
import type { ActionResult } from "./family";

export type SwipeOutcome =
  | { kind: "match"; with: string[] }
  | { kind: "almost"; likedBy: string[] }
  | { kind: "none" };

const swipeSchema = z.object({
  companyId: z.string().min(1),
  slug: z.string().min(1),
  vote: z.enum(["interested", "pass"]),
});

function revalidateSwipe(slug: string) {
  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath(`/matches/${slug}`);
}

/**
 * Tick (interested) or cross (pass). Reports a match when this tick made it
 * unanimous, and "almost a match" when this member was the last to decide,
 * crossed, and everyone else had ticked. `previousVote` lets the client undo.
 */
export async function swipeAction(input: z.input<typeof swipeSchema>): Promise<ActionResult<{ outcome: SwipeOutcome; previousVote: VoteValue | null }>> {
  const parsed = swipeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid swipe" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    const [bundle, members] = await Promise.all([repo.getCompanyById(parsed.data.companyId), repo.getMembers()]);
    if (!bundle) return { ok: false, error: "Company not found" };
    const previousVote = bundle.votes.find((v) => v.userId === member.userId)?.vote ?? null;
    const { transition } = await repo.setVote({ userId: member.userId, companyId: parsed.data.companyId, vote: parsed.data.vote });
    const others = members.filter((m) => m.userId !== member.userId).map((m) => m.displayName);
    let outcome: SwipeOutcome = { kind: "none" };
    if (parsed.data.vote === "interested" && transition.promoted) outcome = { kind: "match", with: others };
    else if (parsed.data.vote === "pass") {
      const liked = almostMatch(bundle.votes, members, member.userId);
      if (liked) outcome = { kind: "almost", likedBy: liked.map((m) => m.displayName) };
    }
    revalidateSwipe(parsed.data.slug);
    return { ok: true, data: { outcome, previousVote } };
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
