import { ExternalLink, MapPin, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { CompanyArtwork } from "@/components/company/company-artwork";
import { Pill, type Tone } from "@/components/ui/primitives";
import { confidenceLabel, priorityLabel } from "@/lib/domain/company-status";
import type { SwipeCard } from "@/lib/domain/swipe";
import { cn } from "@/lib/utils";

/**
 * Hinge-style company profile: the essentials up top, then short sections
 * you scroll through. Used on deck cards and on a match's profile page.
 * No labels or controls sit on the company image.
 */
export function CompanyProfile({ card, className }: { card: SwipeCard; className?: string }) {
  const { company } = card;
  return (
    <article className={cn("bg-surface", className)} aria-label={company.name}>
      <div className="relative aspect-[2/1] w-full overflow-hidden bg-surface-muted">
        <CompanyArtwork company={company} media={card.media} logo={card.logo} variant="hero" />
      </div>

      <div className="px-5 pb-6 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-serif text-[28px] font-semibold leading-[1.1] text-ink">{company.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-[13px] text-secondary">
              <MapPin size={13} aria-hidden />
              {[company.city, company.country].filter(Boolean).join(", ") || "Location unknown"} · {company.subSector ?? company.sector}
            </p>
          </div>
          {company.isDemo ? (
            <Pill tone="amber" className="mt-1.5 shrink-0">
              Demo
            </Pill>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone={card.raising.tone as Tone} className={card.raising.tone === "green" ? "font-semibold uppercase tracking-[0.04em]" : undefined}>
            {card.raising.label}
          </Pill>
          {card.ai ? (
            <Pill tone={card.ai.aiPriority === "high" ? "green" : card.ai.aiPriority === "medium" ? "amber" : "neutral"} icon={<Sparkles size={12} aria-hidden />}>
              {priorityLabel(card.ai.aiPriority)}
            </Pill>
          ) : null}
        </div>

        <p className="mt-4 text-[17px] leading-relaxed text-text">{company.teaser}</p>

        <dl className="mt-4 grid grid-cols-2 gap-2">
          {card.facts.map((f) => (
            <div key={f.label} className="rounded-[14px] bg-surface-muted px-3.5 py-2.5">
              <dt className="text-[12px] text-secondary">{f.label}</dt>
              <dd className={cn("mt-0.5 text-[15px] font-semibold", /^(Unknown|Undisclosed)$/.test(f.value) ? "text-tertiary" : "text-ink")}>{f.value}</dd>
              {f.hint ? <dd className="mt-0.5 text-[11px] text-tertiary">{f.hint}</dd> : null}
            </div>
          ))}
        </dl>

        {card.whyInteresting.length ? (
          <Prompt title="Why it might be interesting">
            <ul className="space-y-2">
              {card.whyInteresting.map((w) => (
                <li key={w} className="flex gap-2">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-green" aria-hidden />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Prompt>
        ) : null}

        {card.risks.length ? (
          <Prompt title="Biggest risk">
            <ul className="space-y-2">
              {card.risks.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-red" aria-hidden />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Prompt>
        ) : null}

        {card.founders.length ? (
          <Prompt title="The team">
            <ul className="space-y-3">
              {card.founders.map((f) => (
                <li key={f.name}>
                  <p className="font-semibold text-ink">
                    {f.name} <span className="font-normal text-secondary">· {f.role}</span>
                  </p>
                  {f.bio ? <p className="mt-0.5 text-[14px] text-secondary">{f.bio}</p> : null}
                </li>
              ))}
            </ul>
          </Prompt>
        ) : null}

        <Prompt title="How we could get in">
          <p>{card.howToGetIn}</p>
        </Prompt>

        <Prompt title="The AI's view" note="Separate from yours. It never counts towards a match.">
          {card.ai ? (
            <>
              <p className="text-[13px] font-semibold text-ink">
                {priorityLabel(card.ai.aiPriority)}
                {card.ai.aiScore !== null ? ` · ${card.ai.aiScore.toFixed(1)}/10` : ""} · {confidenceLabel(card.ai.confidence)}
              </p>
              <p className="mt-1">{card.ai.summary}</p>
            </>
          ) : (
            <p className="text-secondary">Not rated yet: not enough sourced evidence.</p>
          )}
        </Prompt>

        {card.sources.length ? (
          <Prompt title="Sources">
            <ul className="space-y-1">
              {card.sources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex min-h-[40px] items-start gap-2 py-1 text-[14px] text-blue">
                    <ExternalLink size={14} className="mt-1 shrink-0" aria-hidden />
                    <span>
                      <span className="font-medium">{s.publisher}</span>
                      <span className="text-secondary"> · {s.title}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Prompt>
        ) : null}

        <p className="mt-5 text-[12px] text-tertiary">Anything shown as Unknown or Undisclosed has no source yet. A tick means “worth a conversation”, not “let’s invest”.</p>
      </div>
    </article>
  );
}

function Prompt({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-[18px] border border-hairline bg-page px-4 py-3.5">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-tertiary">{title}</h3>
      <div className="mt-1.5 text-[15px] leading-relaxed text-text">{children}</div>
      {note ? <p className="mt-2 text-[11px] text-tertiary">{note}</p> : null}
    </section>
  );
}
