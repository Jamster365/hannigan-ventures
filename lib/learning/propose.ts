import "server-only";
import type { Repository } from "@/lib/data/repository";
import { familyInsights, guidanceLines, LEARNING_SUGGESTED_BY, shouldPropose, withLearnedSection } from "@/lib/domain/family-learning";
import { londonDate } from "@/lib/domain/format";

/**
 * Drafts a change to the research instructions from the family's answers and
 * reasons. It is only a proposal: a member approves or dismisses it on the
 * research instructions page.
 */
export async function proposeFromAnswers(repo: Repository): Promise<{ ok: true; lines: number } | { ok: false; reason: string }> {
  const [bundles, active] = await Promise.all([repo.listCompanies(), repo.getActivePrompt()]);
  const insights = familyInsights(bundles);
  const lines = guidanceLines(insights);
  if (lines.length === 0) return { ok: false, reason: "Nothing stands out yet. Keep answering (and adding reasons) and try again." };
  await repo.createSuggestion({
    feedbackId: null,
    basePromptVersionId: active.id,
    suggestedPatch: [],
    suggestedText: withLearnedSection(active.promptText, lines, londonDate(new Date())),
    rationale: `From ${insights.answers} answers and ${insights.reasons} reasons: ${lines[0]}`,
    expectedImpact: "Research leans towards the kinds of company the family says yes to. Only research changes; nothing is hidden from your decks.",
    suggestedBy: LEARNING_SUGGESTED_BY,
  });
  return { ok: true, lines: lines.length };
}

/** After an answer: every ANSWERS_PER_PROPOSAL answers, draft a fresh proposal automatically. */
export async function maybeProposeFromAnswers(repo: Repository): Promise<void> {
  const [bundles, suggestions] = await Promise.all([repo.listCompanies(), repo.listSuggestions()]);
  if (shouldPropose(bundles, suggestions)) await proposeFromAnswers(repo);
}
