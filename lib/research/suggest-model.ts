import "server-only";
import { z } from "zod";
import type { Company, PromptVersion, ResearchFeedback } from "@/lib/domain/types";
import { applyPatch } from "./patch";
import type { PromptProposal } from "./suggest";
import { getResearchModel } from "./provider";

const proposalSchema = z.object({
  patch: z.array(z.object({ find: z.string().min(10), replace: z.string().min(1) })).min(1).max(3),
  rationale: z.string().min(10).max(600),
  expectedImpact: z.string().min(5).max(300),
});

/**
 * Model-drafted prompt patch. The model only sees the editable prompt and the
 * feedback; it cannot touch the immutable policy layer. Its output is validated
 * as an exact-match patch so the member sees a true diff.
 */
export async function proposeWithModel(input: { feedback: ResearchFeedback; prompt: PromptVersion; company: Company | null }): Promise<PromptProposal | null> {
  const model = getResearchModel();
  const result = await model.structured({
    schema: proposalSchema,
    schemaName: "prompt_patch",
    system:
      "You help a private family refine the editable discovery instructions for their investment research assistant. Propose the smallest exact-match find/replace patch that implements the feedback. Each `find` must be copied verbatim from the current instructions and occur exactly once. Never remove the ten numbered discovery priorities. Do not add claims about any company.",
    input: JSON.stringify({
      feedbackType: input.feedback.feedbackType,
      feedback: input.feedback.body,
      company: input.company ? { name: input.company.name, sector: input.company.sector, subSector: input.company.subSector } : null,
      currentInstructions: input.prompt.promptText,
    }),
    maxOutputTokens: 1200,
  });
  if (!result) return null;
  const patched = applyPatch(input.prompt.promptText, result.patch);
  if (patched === null) return null;
  return result;
}
