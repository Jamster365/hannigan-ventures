import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { EvidencePill, SourceRef } from "@/components/company/source-link";
import { KeyFact, LinkButton } from "@/components/ui/primitives";
import { eisLabel } from "@/lib/domain/company-status";
import { formatMoney, relativeTime } from "@/lib/domain/format";
import type { CompanyBundle } from "@/lib/domain/types";

export function OverviewTab({ bundle }: { bundle: CompanyBundle }) {
  const { company, assessment, rounds, facts, updates, sources } = bundle;
  const round = rounds.find((r) => r.isCurrent) ?? null;
  const byId = new Map(sources.map((s) => [s.id, s]));
  const recent = [...updates].sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt)).slice(0, 2);
  const valuationLabel = round?.preMoney ? `${formatMoney(round.preMoney, round.currency)} pre-money` : round?.postMoney ? `${formatMoney(round.postMoney, round.currency)} post-money` : "Undisclosed";
  const extraFacts = facts.filter((f) => !["stage", "target_raise", "valuation", "pre_money", "post_money"].includes(f.fieldKey) && f.value !== null).slice(0, 2);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-serif text-[20px] font-semibold text-ink">In a sentence</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-text">{company.teaser}</p>
      </section>

      <section>
        <div className="grid grid-cols-2 gap-2.5">
          <KeyFact label="Stage" value={company.stage} />
          <KeyFact label="Target raise" value={round?.targetAmount ? formatMoney(round.targetAmount, round.currency) : "Undisclosed"} hint={round?.targetAmount ? evidenceHint(round.evidenceStatus) : undefined} />
          <KeyFact label="Valuation" value={valuationLabel} hint={round?.preMoney || round?.postMoney ? evidenceHint(round.evidenceStatus) : undefined} />
          <KeyFact label="EIS/SEIS" value={company.eisStatus === "unknown" ? "Unknown" : eisLabel(company.eisStatus)} />
          {extraFacts.map((f) => (
            <KeyFact key={f.id} label={f.label} value={typeof f.value === "number" ? formatMoney(f.value, f.currency) : String(f.value)} hint={evidenceHint(f.evidenceStatus)} />
          ))}
        </div>
        <p className="mt-2 text-[12px] text-tertiary">Values are shown as Undisclosed or Unknown until a source supports them.</p>
      </section>

      {assessment ? (
        <section>
          <h2 className="font-serif text-[20px] font-semibold text-ink">Why it matters</h2>
          <p className="mt-1.5 text-[15px] leading-relaxed text-text">{assessment.whyNow}</p>
        </section>
      ) : null}

      {recent.length ? (
        <section>
          <h2 className="font-serif text-[20px] font-semibold text-ink">What changed recently</h2>
          <ul className="mt-2 space-y-2">
            {recent.map((u) => (
              <li key={u.id} className="rounded-[14px] bg-surface-muted px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[14px] font-semibold text-ink">{u.headline}</p>
                  <span className="shrink-0 text-[11px] text-tertiary">{relativeTime(u.effectiveAt)}</span>
                </div>
                <p className="mt-0.5 text-[13px] text-secondary">
                  {u.summary}
                  <SourceRef source={u.sourceId ? byId.get(u.sourceId) : undefined} />
                </p>
              </li>
            ))}
          </ul>
          <Link href={`/companies/${company.slug}?tab=updates`} scroll={false} className="mt-2 inline-flex min-h-[36px] items-center text-[13px] font-medium text-blue">
            All updates
          </Link>
        </section>
      ) : null}

      <section>
        <h2 className="font-serif text-[20px] font-semibold text-ink">Investment thesis</h2>
        {assessment ? (
          <>
            <p className="mt-1.5 text-[15px] leading-relaxed text-text">{assessment.bullCase}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-secondary">
              <span className="font-semibold text-ink">Reasons to hesitate: </span>
              {assessment.bearCase}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <EvidencePill status={assessment.aiPriority === "insufficient_evidence" ? "unknown" : "analyst_inference"} />
              <span className="text-[12px] text-tertiary">
                AI research view · {relativeTime(assessment.createdAt)} ·{" "}
                <Link href={`/companies/${company.slug}?tab=analysis`} scroll={false} className="text-blue">
                  full analysis
                </Link>
              </span>
            </div>
          </>
        ) : (
          <p className="mt-1.5 text-[14px] text-secondary">No AI assessment yet. Not enough sourced evidence to form a view.</p>
        )}
      </section>

      {assessment?.nextAction ? (
        <section className="rounded-[14px] border border-hairline bg-surface p-4">
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-tertiary">Next action</p>
          <p className="mt-1 text-[14px] text-ink">{assessment.nextAction}</p>
        </section>
      ) : null}

      <div className="flex gap-2">
        <LinkButton href={`/companies/${company.slug}?tab=family`} scroll={false} className="flex-1">
          Add your view
        </LinkButton>
        <LinkButton href={`/companies/${company.slug}?tab=family#discussion`} scroll={false} variant="outline" aria-label="Family discussion" className="w-[50px] px-0">
          <MessageSquare size={18} />
        </LinkButton>
      </div>
    </div>
  );
}

function evidenceHint(status: CompanyBundle["facts"][number]["evidenceStatus"]): string {
  switch (status) {
    case "verified_independent":
      return "Independently verified";
    case "official_company_claim":
      return "Company claim";
    case "third_party_report":
      return "Third-party report";
    case "analyst_inference":
      return "Inference";
    default:
      return "Unverified";
  }
}
