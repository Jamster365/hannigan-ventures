"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { proposeFromAnswers } from "@/lib/learning/propose";
import type { ActionResult } from "./family";

const prefsSchema = z.object({
  sectorsLike: z.array(z.string().max(80)).max(30),
  sectorsAvoid: z.array(z.string().max(80)).max(30),
  eis: z.enum(["essential", "prefer", "neutral"]),
  stages: z.array(z.string().max(40)).max(10),
  chequeMinGbp: z.number().int().min(0).max(10_000_000).nullable(),
  chequeMaxGbp: z.number().int().min(0).max(10_000_000).nullable(),
  notes: z.string().max(1000),
}).refine((p) => p.chequeMinGbp === null || p.chequeMaxGbp === null || p.chequeMinGbp <= p.chequeMaxGbp, "The usual cheque range is the wrong way round.");

/** A member's own investing preferences: a head start for their deck's ordering. */
export async function savePreferencesAction(input: z.input<typeof prefsSchema>): Promise<ActionResult> {
  const parsed = prefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the preferences and try again." };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.savePreferences({ userId: member.userId, prefs: parsed.data });
    revalidatePath("/");
    revalidatePath("/taste");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save your preferences" };
  }
}

export async function proposeFromAnswersAction(): Promise<ActionResult<{ lines: number }>> {
  try {
    await requireMember();
    const res = await proposeFromAnswers(await getRepository());
    if (!res.ok) return { ok: false, error: res.reason };
    revalidatePath("/research/settings");
    revalidatePath("/me");
    revalidatePath("/taste");
    return { ok: true, data: { lines: res.lines } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not draft a suggestion" };
  }
}
