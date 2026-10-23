import { PageHeader } from "@/components/navigation/page-header";
import { PreferencesForm } from "@/components/swipe/preferences-form";
import { ProposeFromAnswers } from "@/components/swipe/propose-from-answers";
import { Card } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { ANSWERS_PER_PROPOSAL, familyInsights, guidanceLines, LEARNING_SUGGESTED_BY } from "@/lib/domain/family-learning";
import { buildMatcher, featureName, reasonChips, tasteSummary, type Contribution } from "@/lib/domain/learning";

export const metadata = { title: "Your taste" };

/**
 * What the matcher has learned about this member, their own preferences
 * (editable), and what the family's answers say overall (aggregates only,
 * never who said what about which company).
 */
export default async function TastePage() {
  const member = await requireMember();
  const repo = await getRepository();
  const [bundles, prefs, suggestions] = await Promise.all([repo.listCompanies(), repo.getPreferences(member.userId), repo.listSuggestions()]);
  const matcher = buildMatcher(bundles, member.userId, null);
  const { likes, dislikes } = tasteSummary(matcher.mine);
  const myVotes = bundles.flatMap((b) => b.votes).filter((v) => v.userId === member.userId && (v.vote === "interested" || v.vote === "pass"));
  const myChips = new Map<string, number>();
  for (const v of myVotes) for (const c of reasonChips(v.note)) myChips.set(c, (myChips.get(c) ?? 0) + 1);
  const insights = familyInsights(bundles);
  const lines = guidanceLines(insights);
  const openProposal = suggestions.find((s) => s.suggestedBy === LEARNING_SUGGESTED_BY && s.status === "proposed");
  const sectors = [...new Set(bundles.map((b) => b.company.sector).filter((s) => s && s !== "Unknown"))].sort();

  return (
    <>
      <PageHeader width="max-w-[640px]" title="Your taste" backHref="/me" variant="back" />
      <div className="mx-auto w-full max-w-[640px] px-4 pb-10 pt-3">
        <p className="text-[0.875rem] text-secondary">The app learns from every yes and no (and any reasons you add) to put the companies you’re most likely to want first. Nothing is ever hidden because of it, and the AI’s own score stays separate.</p>

        <Section title="What the app has learned about you">
          <Card className="p-4">
            <p className="text-[0.875rem] text-ink">
              From <span className="font-semibold">{matcher.mine.answers}</span> answer{matcher.mine.answers === 1 ? "" : "s"} ({matcher.mine.yes} yes).
              {matcher.mine.answers < 10 ? " It gets noticeably better after 20–30; until then your preferences below do most of the work." : ""}
            </p>
            <Leans title="You tend to say yes to" items={likes} tone="green" />
            <Leans title="You tend to say no to" items={dislikes} tone="red" />
            {myChips.size ? (
              <p className="mt-3 text-[0.8125rem] text-secondary">
                Reasons you give most: {[...myChips.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `${c} (${n})`).join(", ")}
              </p>
            ) : null}
            <p className="mt-3 text-[0.75rem] text-tertiary">About 1 in 8 cards is “something a bit different”, so it keeps learning instead of only showing more of the same.</p>
          </Card>
        </Section>

        <Section title="Your preferences">
          <p className="mb-2 px-1 text-[0.8125rem] text-secondary">A head start for your ordering. Preferences, not rules: nothing is filtered out.</p>
          <PreferencesForm initial={prefs} sectors={sectors} />
        </Section>

        <Section title="What the family’s answers say">
          <Card className="p-4">
            <p className="text-[0.875rem] text-ink">
              {insights.answers} answers and {insights.reasons} reasons across the family. Only totals are used here, never who said what.
            </p>
            {lines.length ? (
              <ul className="mt-3 space-y-1.5 text-[0.875rem] text-text">
                {lines.map((l) => (
                  <li key={l} className="flex gap-2">
                    <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue" aria-hidden />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[0.8125rem] text-secondary">Nothing stands out yet. Patterns show once a kind of company has at least four answers.</p>
            )}
            <p className="mt-3 text-[0.8125rem] text-secondary">
              Every {ANSWERS_PER_PROPOSAL} answers, this is turned into a suggested change to the research instructions, which someone in the family has to approve.
            </p>
            <ProposeFromAnswers hasOpen={Boolean(openProposal)} canPropose={lines.length > 0} />
          </Card>
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-tertiary">{title}</h2>
      {children}
    </section>
  );
}

function Leans({ title, items, tone }: { title: string; items: Contribution[]; tone: "green" | "red" }) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-tertiary">{title}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((p) => (
          <li key={p.feature} className={tone === "green" ? "rounded-full bg-green/10 px-3 py-1 text-[0.8125rem] text-ink" : "rounded-full bg-red/10 px-3 py-1 text-[0.8125rem] text-ink"}>
            {featureName(p.feature)} <span className="text-secondary">· yes to {p.yes} of {p.yes + p.no}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
