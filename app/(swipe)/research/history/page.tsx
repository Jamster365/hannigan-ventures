import { PageHeader } from "@/components/navigation/page-header";
import { Card, Pill, type Tone } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { formatDateTime } from "@/lib/domain/format";
import type { ResearchRun } from "@/lib/domain/types";

export const metadata = { title: "Research history" };

const statusMeta: Record<ResearchRun["status"], { label: string; tone: Tone }> = {
  published: { label: "Published", tone: "green" },
  running: { label: "Running", tone: "blue" },
  queued: { label: "Queued", tone: "neutral" },
  failed: { label: "Failed", tone: "red" },
  no_new_research: { label: "No new research", tone: "amber" },
};

export default async function ResearchHistoryPage() {
  await requireMember();
  const repo = await getRepository();
  const [runs, versions, audit, members] = await Promise.all([repo.listRuns(), repo.listPromptVersions(), repo.listAuditEvents(30), repo.getMembers()]);
  const versionOf = (id: string) => versions.find((v) => v.id === id)?.version;
  const totalCost = runs.reduce((n, r) => n + (r.estimatedCostUsd ?? 0), 0);
  return (
    <>
      <PageHeader title="Research history" backHref="/me" variant="back" />
      <div className="mx-auto max-w-[840px] px-4 pt-4">
        <p className="mb-3 text-[0.8125rem] text-secondary">
          Every run with its date, instruction version, status, source counts and estimated cost. Total estimated cost shown: ${totalCost.toFixed(2)}.
        </p>
        {runs.length === 0 ? (
          <Card className="p-6 text-center text-[0.875rem] text-secondary">No research runs yet. The first scheduled run happens at the configured London time.</Card>
        ) : (
          <ol className="space-y-2">
            {runs.map((r) => {
              const m = statusMeta[r.status];
              return (
                <li key={r.id}>
                  <Card className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[0.875rem] font-semibold text-ink">
                          {r.localDate} · {r.runKind}
                        </p>
                        <p className="text-[0.75rem] text-secondary">
                          {formatDateTime(r.startedAt)} → {r.finishedAt ? formatDateTime(r.finishedAt) : "…"} · instructions v{versionOf(r.promptVersionId) ?? "?"} · {r.model}
                        </p>
                      </div>
                      <Pill tone={m.tone}>{m.label}</Pill>
                    </div>
                    <p className="mt-2 text-[0.8125rem] text-text">{r.summary}</p>
                    {r.errorSummary ? <p className="mt-1 rounded-[10px] bg-red-pale px-2.5 py-1.5 text-[0.75rem] text-red">{r.errorSummary}</p> : null}
                    <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                      <Stat label="Sources" value={r.sourceCount} />
                      <Stat label="Candidates" value={r.candidatesCount} />
                      <Stat label="Published" value={r.publishedCount} />
                      <Stat label="Est. cost" value={r.estimatedCostUsd === null ? "–" : `$${r.estimatedCostUsd.toFixed(2)}`} />
                    </dl>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
        <section className="mt-8">
          <h2 className="mb-2 font-serif text-[1.125rem] font-semibold text-ink">Audit log</h2>
          <Card className="overflow-hidden p-0">
            {audit.length ? (
              <ul className="divide-y divide-hairline text-[0.8125rem]">
                {audit.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-ink">{a.action}</span>
                      <span className="text-secondary">
                        {" "}
                        · {a.objectType} {a.objectId}
                      </span>
                    </span>
                    <span className="shrink-0 text-[0.75rem] text-tertiary">
                      {a.actorType === "member" ? (members.find((m) => m.userId === a.actorId)?.displayName ?? "Member") : a.actorType} · {formatDateTime(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-[0.8125rem] text-secondary">No audit events yet.</p>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[10px] bg-surface-muted px-2 py-2">
      <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-tertiary">{label}</dt>
      <dd className="font-serif text-[1rem] font-semibold text-ink tnum">{value}</dd>
    </div>
  );
}
