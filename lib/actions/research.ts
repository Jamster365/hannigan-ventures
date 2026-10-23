"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import type { PromptVersion, ResearchPreferences } from "@/lib/domain/types";
import type { ActionResult } from "./family";

const prefsSchema = z.object({
  maxChequeGbp: z.number().int().min(1000).max(10_000_000),
  geographicFocus: z.string().trim().min(1).max(200),
  discoveryDepth: z.enum(["light", "balanced", "deep"]),
  eventGeography: z.string().trim().min(1).max(200),
  researchTimeLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  sectorsInclude: z.array(z.string().trim().min(1).max(60)).max(50),
  sectorsExclude: z.array(z.string().trim().min(1).max(60)).max(50),
  dailyBudgetUsd: z.number().min(0).max(500),
  dailyMode: z.enum(["update_only", "discover"]).default("update_only"),
});

const saveSchema = z.object({
  promptText: z.string().trim().min(50).max(20_000),
  config: prefsSchema,
  changeNote: z.string().trim().max(300),
  basedOnVersionId: z.string().min(1),
});

export type SaveResult = { ok: true; version: PromptVersion } | { ok: false; error: string; conflict?: PromptVersion };

export async function savePromptAction(input: z.input<typeof saveSchema>): Promise<SaveResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid instructions" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    const res = await repo.savePromptVersion({ userId: member.userId, ...parsed.data, config: parsed.data.config as ResearchPreferences });
    if (!res.ok) return { ok: false, error: "Someone saved a newer version while you were editing.", conflict: res.conflict };
    revalidatePath("/research/settings");
    return { ok: true, version: res.version };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save instructions" };
  }
}

export async function restorePromptAction(versionId: string): Promise<ActionResult> {
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.restorePromptVersion({ userId: member.userId, versionId });
    revalidatePath("/research/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not restore version" };
  }
}

export async function applySuggestionAction(suggestionId: string): Promise<ActionResult> {
  try {
    const member = await requireMember();
    const repo = await getRepository();
    const res = await repo.applySuggestion({ userId: member.userId, suggestionId });
    if (!res.ok) return { ok: false, error: res.reason };
    revalidatePath("/research/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not apply suggestion" };
  }
}

export async function dismissSuggestionAction(suggestionId: string): Promise<ActionResult> {
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.dismissSuggestion({ userId: member.userId, suggestionId });
    revalidatePath("/research/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not dismiss suggestion" };
  }
}

const feedbackSchema = z.object({
  companyId: z.string().nullable(),
  feedbackType: z.enum(["too_many_sector", "more_preseed", "missed_something", "not_this_model", "free_text"]),
  body: z.string().trim().max(1000),
});

/**
 * "Improve our research": record feedback and ask the suggestion engine for a
 * concrete prompt diff. Nothing changes until a member applies it.
 */
export async function submitFeedbackAction(input: z.input<typeof feedbackSchema>): Promise<ActionResult<{ suggestionId: string | null }>> {
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid feedback" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    const feedback = await repo.createFeedback({ ...parsed.data, authorUserId: member.userId });
    const { proposePromptChange } = await import("@/lib/research/suggest");
    const active = await repo.getActivePrompt();
    const company = parsed.data.companyId ? await repo.getCompanyById(parsed.data.companyId) : null;
    const proposal = await proposePromptChange({ feedback, prompt: active, company: company?.company ?? null });
    let suggestionId: string | null = null;
    if (proposal) {
      const s = await repo.createSuggestion({ feedbackId: feedback.id, basePromptVersionId: active.id, suggestedPatch: proposal.patch, rationale: proposal.rationale, expectedImpact: proposal.expectedImpact, suggestedBy: "ai" });
      suggestionId = s.id;
    }
    revalidatePath("/research/settings");
    return { ok: true, data: { suggestionId } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not submit feedback" };
  }
}
