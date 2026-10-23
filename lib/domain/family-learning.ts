import { companyFeatures, featureName, reasonChips } from "./learning";
import type { CompanyBundle, PromptSuggestion } from "./types";

/**
 * Turns the family's answers and reasons into research guidance: which kinds
 * of company the family keeps saying yes or no to, and the reasons given most.
 * The result is only ever a proposed change to the research instructions,
 * which a member must approve. Built from aggregates only: it never names a
 * company or says who answered what.
 */

export interface FamilyInsights {
  answers: number;
  reasons: number;
  more: { feature: string; yes: number; total: number }[];
  fewer: { feature: string; yes: number; total: number }[];
  topReasons: { chip: string; count: number; vote: "interested" | "pass" }[];
}

export const LEARNING_SUGGESTED_BY = "learning";
/** A new proposal is drafted after this many answers since the last one. */
export const ANSWERS_PER_PROPOSAL = 25;
/** A kind of company needs this many answers before it can appear in the guidance. */
export const MIN_ANSWERS_PER_KIND = 8;
const SECTION = "Learned from the family's answers";

export function familyInsights(bundles: CompanyBundle[]): FamilyInsights {
  const counts = new Map<string, { yes: number; total: number }>();
  const chips = new Map<string, { count: number; vote: "interested" | "pass" }>();
  let answers = 0;
  let reasons = 0;
  for (const b of bundles) {
    const features = companyFeatures(b).filter((f) => !f.startsWith("route:"));
    for (const v of b.votes) {
      if (v.vote !== "interested" && v.vote !== "pass") continue;
      answers++;
      if (v.note) reasons++;
      for (const f of features) {
        const c = counts.get(f) ?? { yes: 0, total: 0 };
        c.total++;
        if (v.vote === "interested") c.yes++;
        counts.set(f, c);
      }
      for (const chip of reasonChips(v.note)) {
        const key = `${v.vote}:${chip}`;
        const c = chips.get(key) ?? { count: 0, vote: v.vote };
        c.count++;
        chips.set(key, c);
      }
    }
  }
  // A kind of company stands out only against the family's usual yes rate
  // (the deck itself skews what gets answered), and only with enough answers.
  const totalYes = [...counts.values()].reduce((s, c) => s + c.yes, 0);
  const totalAll = [...counts.values()].reduce((s, c) => s + c.total, 0);
  const base = (totalYes + 1) / (totalAll + 2);
  const logit = (p: number) => Math.log(p / (1 - p));
  const all = [...counts.entries()]
    .map(([feature, c]) => ({ feature, ...c, lean: logit((c.yes + 2 * base) / (c.total + 2)) - logit(base) }))
    .filter((x) => x.total >= MIN_ANSWERS_PER_KIND);
  return {
    answers,
    reasons,
    more: all.filter((x) => x.lean >= 0.7).sort((a, b) => b.lean - a.lean || b.total - a.total).slice(0, 4),
    fewer: all.filter((x) => x.lean <= -0.7).sort((a, b) => a.lean - b.lean || b.total - a.total).slice(0, 4),
    topReasons: [...chips.entries()].map(([key, c]) => ({ chip: key.slice(key.indexOf(":") + 1), ...c })).sort((a, b) => b.count - a.count).slice(0, 5),
  };
}

/** The guidance lines for the research instructions, or none if nothing stands out yet. */
export function guidanceLines(i: FamilyInsights): string[] {
  const lines: string[] = [];
  for (const m of i.more) lines.push(`Look for more ${featureName(m.feature)}: the family said yes to ${m.yes} of ${m.total}.`);
  for (const f of i.fewer) lines.push(`Find fewer ${featureName(f.feature)}: the family said yes to only ${f.yes} of ${f.total}.`);
  for (const r of i.topReasons.filter((r) => r.count >= 3)) lines.push(`${r.vote === "pass" ? "A common reason for no" : "A common reason for yes"}: "${r.chip}" (${r.count} times).`);
  return lines;
}

/** The research instructions with the learned section added or replaced. */
export function withLearnedSection(promptText: string, lines: string[], date: string): string {
  const section = `${SECTION} (${date}; a preference, not a rule):\n${lines.map((l) => `- ${l}`).join("\n")}`;
  // Replace an earlier learned section (its heading and bullet lines only), keeping anything a member wrote after it.
  const existing = new RegExp(`\\n*${SECTION.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}[^\\n]*\\n(?:- [^\\n]*\\n?)*`);
  if (existing.test(promptText)) return promptText.replace(existing, `\n\n${section}\n`).trimEnd();
  return `${promptText.trimEnd()}\n\n${section}`;
}

/** Whether enough has happened since the last learning proposal to draft a new one. */
export function shouldPropose(bundles: CompanyBundle[], suggestions: PromptSuggestion[]): boolean {
  const learned = suggestions.filter((s) => s.suggestedBy === LEARNING_SUGGESTED_BY);
  if (learned.some((s) => s.status === "proposed")) return false;
  const since = learned.map((s) => s.createdAt).sort().at(-1) ?? "";
  const newAnswers = bundles.flatMap((b) => b.votes).filter((v) => (v.vote === "interested" || v.vote === "pass") && v.updatedAt > since).length;
  return newAnswers >= ANSWERS_PER_PROPOSAL;
}
