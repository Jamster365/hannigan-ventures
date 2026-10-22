"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";

const voteSchema = z.object({
  companyId: z.string().min(1),
  slug: z.string().min(1),
  vote: z.enum(["interested", "unsure", "pass"]).nullable(),
  score: z.number().int().min(1).max(10).nullable().optional(),
});

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function setVoteAction(input: z.input<typeof voteSchema>): Promise<ActionResult<{ promoted: boolean; demoted: boolean }>> {
  const parsed = voteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid vote" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    const { transition } = await repo.setVote({ userId: member.userId, companyId: parsed.data.companyId, vote: parsed.data.vote, score: parsed.data.score });
    revalidatePath("/");
    revalidatePath("/shortlist");
    revalidatePath("/updates");
    revalidatePath(`/companies/${parsed.data.slug}`);
    revalidatePath(`/matches/${parsed.data.slug}`);
    return { ok: true, data: { promoted: transition.promoted, demoted: transition.demoted } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save your vote" };
  }
}

const commentSchema = z.object({ companyId: z.string().min(1), slug: z.string().min(1), body: z.string().trim().min(1).max(2000) });

export async function addCommentAction(input: z.input<typeof commentSchema>): Promise<ActionResult> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Comment must be between 1 and 2000 characters" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.addComment({ userId: member.userId, companyId: parsed.data.companyId, body: parsed.data.body });
    revalidatePath(`/companies/${parsed.data.slug}`);
    revalidatePath(`/matches/${parsed.data.slug}`);
    revalidatePath("/matches");
    revalidatePath("/updates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not post comment" };
  }
}

const editSchema = z.object({ commentId: z.string().min(1), slug: z.string().min(1), body: z.string().trim().min(1).max(2000) });
export async function editCommentAction(input: z.input<typeof editSchema>): Promise<ActionResult> {
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid comment" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.editComment({ userId: member.userId, commentId: parsed.data.commentId, body: parsed.data.body });
    revalidatePath(`/companies/${parsed.data.slug}`);
    revalidatePath(`/matches/${parsed.data.slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not edit comment" };
  }
}

const deleteSchema = z.object({ commentId: z.string().min(1), slug: z.string().min(1) });
export async function deleteCommentAction(input: z.input<typeof deleteSchema>): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.deleteComment({ userId: member.userId, commentId: parsed.data.commentId });
    revalidatePath(`/companies/${parsed.data.slug}`);
    revalidatePath(`/matches/${parsed.data.slug}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete comment" };
  }
}

const bookmarkSchema = z.object({ companyId: z.string().min(1), slug: z.string().min(1) });
export async function toggleBookmarkAction(input: z.input<typeof bookmarkSchema>): Promise<ActionResult<{ bookmarked: boolean }>> {
  const parsed = bookmarkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    const res = await repo.toggleBookmark({ userId: member.userId, companyId: parsed.data.companyId });
    revalidatePath("/");
    revalidatePath("/discover");
    revalidatePath(`/companies/${parsed.data.slug}`);
    revalidatePath(`/matches/${parsed.data.slug}`);
    return { ok: true, data: res };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update bookmark" };
  }
}

export async function markNotificationsReadAction(ids?: string[]): Promise<ActionResult> {
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.markNotificationsRead(member.userId, ids);
    revalidatePath("/updates");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update notifications" };
  }
}
