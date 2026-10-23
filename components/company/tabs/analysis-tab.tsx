import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { SourceRef } from "@/components/company/source-link";
import { Pill } from "@/components/ui/primitives";
import { confidenceLabel, priorityLabel } from "@/lib/domain/company-status";
import { formatDate } from "@/lib/domain/format";
import type { CompanyBundle } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function AnalysisTab({ bundle }: { bundle: CompanyBundle }) {
  const { assessment, sources } = bundle;
  const byId = new Map(sources.map((s) => [s.id, s]));
  const indexOf = (id: string) => sources.findIndex((s) => s.id === id) + 1;
  if (!assessment) {
    return <p className="rounded-[14px] bg-surface-muted px-4 py-6 text-center text-[0.875rem] text-secondary">No AI assessment has been produced for this company. It will be rated only once sourced evidence is sufficient.</p>;
  }
  const rated = assessment.aiScore !== null;
  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-serif text-[1.25rem] font-semibold text-ink">Why we&rsquo;re interested</h2>
        <ul className="mt-2 space-y-2">
          {assessment.whyInterested.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-[0.875rem] leading-snug text-text">
              <CircleCheck size={18} className="mt-0.5 shrink-0 text-green" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-[1.25rem] font-semibold text-ink">Key risks</h2>
        <ul className="mt-2 space-y-2">
          {assessment.risks.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-[0.875rem] leading-snug text-text">
              <CircleAlert size={18} className="mt-0.5 shrink-0 text-red" aria-hidden />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-[1.25rem] font-semibold text-ink">Our view</h2>
        <div className="mt-2 rounded-[var(--radius-card)] bg-surface-muted p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[0.875rem] font-medium text-ink">
              AI research rating
              <span title="A research-priority opinion from cited evidence. Not a probability of success and never blended with family votes." className="text-tertiary">
                <Info size={14} aria-hidden />
              </span>
            </p>
            <Pill tone={rated ? (assessment.aiPriority === "high" ? "green" : assessment.aiPriority === "medium" ? "amber" : "neutral") : "neutral"} className="text-[0.875rem] font-semibold tnum">
              {rated ? `${assessment.aiScore!.toFixed(1)}/10` : "Not rated"}
            </Pill>
          </div>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-text">{assessment.summary}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill tone="neutral">{priorityLabel(assessment.aiPriority)}</Pill>
            <Pill tone="neutral">{confidenceLabel(assessment.confidence)}</Pill>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-serif text-[1.25rem] font-semibold text-ink">Breakdown</h2>
        <ul className="mt-2 divide-y divide-hairline rounded-[var(--radius-card)] border border-hairline bg-surface">
          {assessment.breakdown.map((d) => (
            <li key={d.key} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.875rem] font-semibold text-ink">{d.label}</p>
                <p className="text-[0.8125rem] text-secondary">
                  {d.note}
                  {d.sourceIds.map((id) => (
                    <SourceRef key={id} source={byId.get(id)} index={indexOf(id)} />
                  ))}
                </p>
              </div>
              <div className="flex w-[64px] shrink-0 flex-col items-end">
                <span className={cn("font-serif text-[1.125rem] font-semibold tnum", d.score === null ? "text-tertiary" : "text-ink")}>{d.score === null ? "–" : `${d.score}/10`}</span>
                {d.score !== null ? (
                  <span className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-hairline" aria-hidden>
                    <span className={cn("block h-full rounded-full", d.score >= 7 ? "bg-green" : d.score >= 5 ? "bg-amber" : "bg-red")} style={{ width: `${d.score * 10}%` }} />
                  </span>
                ) : (
                  <span className="text-[0.625rem] uppercase tracking-[0.06em] text-tertiary">Unrated</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <TextList title="Explicit assumptions" items={assessment.assumptions} empty="None recorded." />
      <TextList title="Unresolved questions" items={assessment.openQuestions} empty="None recorded." />
      <TextList title="Diligence checklist" items={assessment.diligenceChecklist} empty="None recorded." checklist />

      <p className="text-[0.75rem] leading-relaxed text-tertiary">
        Research date {formatDate(assessment.createdAt)} · model {assessment.modelVersion} · instructions {assessment.promptVersion}. The rating is a research-priority opinion built from cited evidence, not investment advice or a probability of success. Dimensions without evidence stay unrated.
      </p>
    </div>
  );
}

function TextList({ title, items, empty, checklist }: { title: string; items: string[]; empty: string; checklist?: boolean }) {
  return (
    <section>
      <h2 className="font-serif text-[1.25rem] font-semibold text-ink">{title}</h2>
      {items.length ? (
        <ul className={cn("mt-2 space-y-1.5 text-[0.875rem] text-text", !checklist && "list-disc pl-5")}>
          {items.map((t, i) => (
            <li key={i} className={cn(checklist && "flex items-start gap-2")}>
              {checklist ? <span className="mt-[5px] h-3.5 w-3.5 shrink-0 rounded-[4px] border border-hairline-strong" aria-hidden /> : null}
              {t}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[0.8125rem] text-secondary">{empty}</p>
      )}
    </section>
  );
}
