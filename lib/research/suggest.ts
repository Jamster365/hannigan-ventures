import "server-only";
import type { Company, PromptVersion, ResearchFeedback } from "@/lib/domain/types";

export interface PromptProposal {
  patch: { find: string; replace: string }[];
  rationale: string;
  expectedImpact: string;
}

const ANCHOR = "Every sector qualifies; there are no thematic quotas.";

/**
 * Turn member feedback into a concrete, reviewable prompt diff.
 *
 * Without an AI key this uses deterministic templates anchored on a stable
 * sentence in the default prompt. With OPENAI_API_KEY set, an LLM drafts the
 * patch, but the output is validated as an exact-match patch against the
 * current prompt before it is stored. Either way nothing is applied until a
 * member presses Apply (SPEC §9).
 */
export async function proposePromptChange(input: { feedback: ResearchFeedback; prompt: PromptVersion; company: Company | null }): Promise<PromptProposal | null> {
  if (process.env.OPENAI_API_KEY) {
    try {
      const { proposeWithModel } = await import("./suggest-model");
      const res = await proposeWithModel(input);
      if (res) return res;
    } catch (e) {
      console.error("[suggest] model proposal failed; falling back to template", e instanceof Error ? e.message : e);
    }
  }
  return templateProposal(input);
}

export function templateProposal({ feedback, prompt, company }: { feedback: ResearchFeedback; prompt: PromptVersion; company: Company | null }): PromptProposal | null {
  const sector = company?.sector ?? "this sector";
  const hasAnchor = prompt.promptText.includes(ANCHOR) && prompt.promptText.indexOf(ANCHOR) === prompt.promptText.lastIndexOf(ANCHOR);
  const append = (sentence: string) =>
    hasAnchor
      ? [{ find: ANCHOR, replace: `${ANCHOR} ${sentence}` }]
      : [{ find: prompt.promptText.split("\n")[0], replace: `${prompt.promptText.split("\n")[0]} ${sentence}` }];

  switch (feedback.feedbackType) {
    case "too_many_sector":
      return {
        patch: append(`Down-weight ${sector} companies unless there is evidence of a signed pilot, paying customer or verified allocation.`),
        rationale: `${feedback.body ? `Feedback: "${feedback.body}". ` : ""}A conditional down-weight keeps the no-quota rule but raises the evidence bar for ${sector}.`,
        expectedImpact: `Fewer early ${sector} cards without commercial evidence; other sectors unaffected.`,
      };
    case "more_preseed":
      return {
        patch: append("Give additional weight to pre-seed and pre-round companies where a first external cheque is still available."),
        rationale: `${feedback.body ? `Feedback: "${feedback.body}". ` : ""}Shifts discovery earlier without excluding seed rounds.`,
        expectedImpact: "More pre-seed and pre-round discoveries; slightly fewer later-stage rounds.",
      };
    case "not_this_model":
      return {
        patch: append(`Deprioritise business models like ${company?.name ?? "the flagged company"} (${company?.subSector ?? company?.sector ?? "similar model"}) unless traction is exceptional.`),
        rationale: `${feedback.body ? `Feedback: "${feedback.body}". ` : ""}Records a model-level preference rather than a sector ban.`,
        expectedImpact: "Fewer companies with this business model.",
      };
    case "missed_something":
      if (!feedback.body) return null;
      return {
        patch: append(`When researching ${company?.name ?? "companies"}, also check: ${feedback.body.trim()}`),
        rationale: "Adds the missed angle as an explicit research instruction.",
        expectedImpact: "The next run will look for the flagged information.",
      };
    default:
      if (!feedback.body) return null;
      return {
        patch: append(feedback.body.trim()),
        rationale: "Free-text feedback added verbatim as an instruction; edit before applying if needed.",
        expectedImpact: "Depends on the instruction added.",
      };
  }
}
