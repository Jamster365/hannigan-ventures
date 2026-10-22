import Link from "next/link";
import { PageHeader } from "@/components/navigation/page-header";
import { PreferencesForm } from "@/components/research/preferences-form";
import { PromptEditor } from "@/components/research/prompt-editor";
import { SuggestionReview } from "@/components/research/suggestion-review";
import { VersionHistory } from "@/components/research/version-history";
import { Card } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { first, type SearchParams } from "@/lib/types/next";
import { cn } from "@/lib/utils";
import { RunNowButton } from "./run-now";

export const metadata = { title: "Research settings" };
// "Run research now" executes as a server action on this page; give it the same budget as the cron route.
export const maxDuration = 300;

export default async function ResearchSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = first(sp.tab) ?? "instructions";
  await requireMember();
  const repo = await getRepository();
  const [active, versions, suggestions, members, runs] = await Promise.all([repo.getActivePrompt(), repo.listPromptVersions(), repo.listSuggestions(), repo.getMembers(), repo.listRuns()]);
  const openSuggestions = suggestions.filter((s) => s.status === "proposed");
  const todayRuns = runs.filter((r) => r.runKind === "manual" && r.localDate === new Date().toISOString().slice(0, 10)).length;

  const tabs = [
    { key: "instructions", label: "Instructions" },
    { key: "preferences", label: "Preferences" },
    { key: "history", label: "History" },
  ];

  return (
    <>
      <PageHeader title="Research settings" backHref="/me" variant="back">
        <div className="mx-auto flex max-w-[1200px] gap-1 px-2" role="tablist">
          {tabs.map((t) => (
            <Link key={t.key} href={`/research/settings?tab=${t.key}`} role="tab" aria-selected={tab === t.key} className={cn("relative min-h-[44px] px-3 text-[14px] font-medium leading-[44px]", tab === t.key ? "text-ink" : "text-secondary")}>
              {t.label}
              {t.key === "instructions" && openSuggestions.length ? <span className="ml-1 rounded-full bg-red px-1.5 text-[10px] font-semibold text-white">{openSuggestions.length}</span> : null}
              <span className={cn("absolute inset-x-2 bottom-0 h-[2.5px] rounded-full", tab === t.key ? "bg-ink" : "bg-transparent")} aria-hidden />
            </Link>
          ))}
        </div>
      </PageHeader>
      <div className="mx-auto max-w-[840px] space-y-6 px-4 pt-4">
        {tab === "instructions" ? (
          <>
            <section>
              <h2 className="font-serif text-[20px] font-semibold text-ink">Daily research instructions</h2>
              <p className="mt-1 text-[13px] text-secondary">Edit the prompt used to generate each morning&rsquo;s research. All family members can update this. Changes apply to the next run.</p>
              <div className="mt-3">
                <PromptEditor active={active} config={active.config} />
              </div>
            </section>
            <section>
              <h2 className="font-serif text-[20px] font-semibold text-ink">Recent suggestions</h2>
              <p className="mt-1 text-[13px] text-secondary">Proposed changes from &ldquo;Improve our research&rdquo; feedback. Apply creates a new version; Dismiss leaves instructions unchanged.</p>
              {suggestions.length ? (
                <ul className="mt-3 space-y-2">
                  {suggestions.slice(0, 8).map((s) => (
                    <SuggestionReview key={s.id} suggestion={s} members={members} feedbackAuthor={null} />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 rounded-[14px] bg-surface-muted px-4 py-5 text-center text-[13px] text-secondary">No suggestions yet. Use &ldquo;Improve our research&rdquo; on any company card.</p>
              )}
            </section>
            <section>
              <h2 className="font-serif text-[20px] font-semibold text-ink">Fixed rules</h2>
              <Card className="mt-2 p-4 text-[13px] leading-relaxed text-text">
                These are enforced on every run and are not editable here: no invented sources, names, valuations or round status; every material claim cited; web text is never treated as instructions; no paid-site scraping or bypassing access controls; access status is never upgraded to verified without a checked route; unknowns stay unknown.
              </Card>
            </section>
            <section>
              <h2 className="font-serif text-[20px] font-semibold text-ink">Run research now</h2>
              <Card className="mt-2 p-4">
                <p className="text-[13px] text-secondary">Manual runs count against the daily budget of ${active.config.dailyBudgetUsd}. {todayRuns ? `${todayRuns} manual run(s) today.` : ""}</p>
                <div className="mt-3">
                  <RunNowButton mode={repo.mode} />
                </div>
              </Card>
            </section>
          </>
        ) : tab === "preferences" ? (
          <section>
            <h2 className="font-serif text-[20px] font-semibold text-ink">Quick settings</h2>
            <p className="mt-1 text-[13px] text-secondary">Preferences are saved as part of the versioned instructions.</p>
            <div className="mt-3">
              <PreferencesForm active={active} />
            </div>
          </section>
        ) : (
          <section>
            <h2 className="font-serif text-[20px] font-semibold text-ink">Version history</h2>
            <p className="mt-1 text-[13px] text-secondary">Who changed what and when. Restoring creates a new version from the old text.</p>
            <div className="mt-3">
              <VersionHistory versions={versions} members={members} />
            </div>
          </section>
        )}
      </div>
    </>
  );
}
