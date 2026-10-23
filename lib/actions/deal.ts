"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { DOCUMENT_MIMES, MAX_DOCUMENT_BYTES, safeDocumentName, type DealDecision } from "@/lib/domain/deal";
import type { ActionResult } from "./family";

function revalidateDeal(slug: string) {
  revalidatePath(`/matches/${slug}`);
  revalidatePath(`/matches/${slug}/deal`);
  revalidatePath(`/matches/${slug}/profile`);
  revalidatePath("/matches");
  revalidatePath("/portfolio");
}

const checkSchema = z.object({
  companyId: z.string().min(1),
  slug: z.string().min(1),
  key: z.string().min(1).max(80),
  status: z.enum(["todo", "done", "na"]),
  note: z.string().max(1000).optional(),
  label: z.string().min(1).max(120).optional(),
});

/** Tick, untick or annotate a due-diligence item; with a label, adds the family's own item. */
export async function setDealCheckAction(input: z.input<typeof checkSchema>): Promise<ActionResult> {
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the item and try again." };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.setDealCheck({ userId: member.userId, ...parsed.data });
    revalidateDeal(parsed.data.slug);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save" };
  }
}

const decisionSchema = z.object({
  companyId: z.string().min(1),
  slug: z.string().min(1),
  status: z.enum(["considering", "invested", "passed"]),
  amounts: z.record(z.string(), z.number().min(0).max(100_000_000)),
  investedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  scheme: z.enum(["SEIS", "EIS", "none", "unknown"]),
  stakePct: z.number().min(0).max(100).nullable(),
  instrument: z.string().max(120),
  certificateReceived: z.boolean(),
  notes: z.string().max(2000),
});

/** The family's decision on a match. Investing or passing is also announced in the chat. */
export async function saveDecisionAction(input: z.input<typeof decisionSchema>): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the figures and try again." };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    const { companyId, slug, ...decision } = parsed.data;
    const before = (await repo.getDeal(companyId)).decision;
    await repo.saveDealDecision({ userId: member.userId, companyId, decision: decision as Omit<DealDecision, "companyId" | "updatedBy" | "updatedAt"> });
    if (decision.status !== (before?.status ?? "considering") && decision.status !== "considering") {
      const total = Object.values(decision.amounts).reduce((s, n) => s + n, 0);
      const body = decision.status === "invested" ? `${member.displayName} recorded that we invested${total ? ` £${total.toLocaleString("en-GB")}` : ""}${decision.scheme !== "unknown" && decision.scheme !== "none" ? ` (${decision.scheme})` : ""}.` : `${member.displayName} recorded that we passed on this one.`;
      await repo.addComment({ userId: member.userId, companyId, body });
    }
    revalidateDeal(slug);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the decision" };
  }
}

/** A document for the deal (deck, term sheet, HMRC letter...). Announced in the chat. */
export async function uploadDocumentAction(formData: FormData): Promise<ActionResult> {
  const companyId = String(formData.get("companyId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const file = formData.get("file");
  if (!companyId || !slug || !(file instanceof File)) return { ok: false, error: "Choose a file first." };
  if (file.size === 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, error: "Files up to 20 MB only." };
  const mime = file.type || "application/octet-stream";
  if (!DOCUMENT_MIMES.has(mime)) return { ok: false, error: "PDFs, images, Office files, text and CSV only." };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await repo.addDealDocument({ userId: member.userId, companyId, name: safeDocumentName(file.name), mime, bytes });
    await repo.addComment({ userId: member.userId, companyId, body: `${member.displayName} added a document: ${doc.name}` });
    revalidateDeal(slug);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not upload" };
  }
}

export async function removeDocumentAction(input: { companyId: string; slug: string; documentId: string }): Promise<ActionResult> {
  if (!input.companyId || !input.documentId) return { ok: false, error: "Invalid document" };
  try {
    const member = await requireMember();
    const repo = await getRepository();
    await repo.removeDealDocument({ userId: member.userId, companyId: input.companyId, documentId: input.documentId });
    revalidateDeal(input.slug);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not remove" };
  }
}
