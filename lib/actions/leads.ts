"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import type { ActionResult } from "./family";

const leadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  website: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : ""))
    .refine((v) => v === "" || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v), "That doesn't look like a web address.")
    .default(""),
  source: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(4000).default(""),
});

/**
 * Any member can suggest a company for research: one they heard of from an
 * angel network, a founder they met, or a news story. The next research
 * session researches it through the normal pipeline; until then it is a
 * shared note on the Leads page.
 */
export async function addLeadAction(input: z.input<typeof leadSchema>): Promise<ActionResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.addLead({ userId: member.userId, ...parsed.data, website: parsed.data.website || null });
    revalidatePath("/leads");
    revalidatePath("/me");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the lead" };
  }
}

export async function setLeadStatusAction(input: { leadId: string; status: "new" | "researched" | "dismissed" }): Promise<ActionResult> {
  if (!input.leadId || !["new", "researched", "dismissed"].includes(input.status)) return { ok: false, error: "Invalid lead" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.setLeadStatus({ userId: member.userId, leadId: input.leadId, status: input.status });
    revalidatePath("/leads");
    revalidatePath("/me");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not update the lead" };
  }
}
