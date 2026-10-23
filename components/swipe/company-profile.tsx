"use client";

import { ExternalLink, MapPin, Sparkles } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Pill, type Tone } from "@/components/ui/primitives";
import type { SwipeCard } from "@/lib/domain/swipe";
import { cn } from "@/lib/utils";
import { RoundCheck } from "./round-check";

/**
 * Hinge-style company profile, all on one scrolling page: picture, pitch,
 * raising status, the AI's one-line view, key facts, then the team, how to
 * get in, the AI's summary and sources. No labels or controls sit on the
 * company image.
 */
export function CompanyProfile({ card, className }: { card: SwipeCard; className?: string }) {
  const { company } = card;
  const keyFacts = card.facts.slice(0, 4);
  const moreFacts = card.facts.slice(4);
  const moreWhy = card.whyInteresting.slice(1);
  const moreRisks = card.risks.slice(1);

  return (
    <article className={cn("bg-surface", className)} aria-label={company.name}>
      <ProfileHero card={card} />

      <div className="px-5 pb-6 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-serif text-[1.75rem] font-semibold leading-[1.1] text-ink">{company.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-[0.8125rem] text-secondary">
              <MapPin size={13} aria-hidden />
              {[company.city, company.country].filter((x) => x && x !== "Unknown").join(", ") || "Location unknown"} · {company.subSector ?? company.sector}
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
          {card.crowdfunding ? <Pill tone="violet">Crowdfunding</Pill> : null}
          {card.explore ? <Pill tone="amber">Something different</Pill> : null}
        </div>
        {card.why && !card.explore ? (
          <p className="mt-2 flex items-center gap-1.5 text-[0.8125rem] text-secondary">
            <Sparkles size={13} className="shrink-0 text-blue" aria-hidden />
            {card.why}
          </p>
        ) : null}

        <p className="mt-4 text-[1.0625rem] leading-relaxed text-text">{company.teaser}</p>

        {card.aiLine.worth || card.aiLine.watch ? (
          <section className="mt-4 space-y-2 rounded-[18px] border border-hairline bg-page px-4 py-3.5" aria-label="The AI's view">
            {card.aiLine.worth ? (
              <p className="flex gap-2.5 text-[0.9375rem] leading-relaxed">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-green" aria-hidden />
                <span>
                  <span className="font-semibold text-ink">Worth a look: </span>
                  {card.aiLine.worth}
                </span>
              </p>
            ) : null}
            {card.aiLine.watch ? (
              <p className="flex gap-2.5 text-[0.9375rem] leading-relaxed">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-red" aria-hidden />
                <span>
                  <span className="font-semibold text-ink">Watch out: </span>
                  {card.aiLine.watch}
                </span>
              </p>
            ) : null}
            <p className="text-[0.6875rem] text-tertiary">The AI’s view, from the research. It never counts towards a match.</p>
          </section>
        ) : null}

        <Facts facts={keyFacts} />

        <>
            {moreFacts.length ? <Facts facts={moreFacts} /> : null}

            {moreWhy.length ? (
              <Prompt title="More reasons it could work">
                <Bullets items={moreWhy} tone="green" />
              </Prompt>
            ) : null}

            {moreRisks.length ? (
              <Prompt title="Other risks">
                <Bullets items={moreRisks} tone="red" />
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
                      {f.bio ? <p className="mt-0.5 text-[0.875rem] text-secondary">{f.bio}</p> : null}
                    </li>
                  ))}
                </ul>
              </Prompt>
            ) : null}

            <Prompt title="How we could get in">
              <p>{card.howToGetIn}</p>
              {card.platform ? <RoundCheck card={card} /> : null}
            </Prompt>

            {card.ai?.summary ? (
              <Prompt title="The AI's summary" note="Separate from your views. It never counts towards a match.">
                <p>{card.ai.summary}</p>
              </Prompt>
            ) : null}

            {card.sources.length ? (
              <Prompt title="Sources">
                <ul className="space-y-1">
                  {card.sources.map((s) => (
                    <li key={s.id}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex min-h-[40px] items-start gap-2 py-1 text-[0.875rem] text-blue">
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

            <p className="mt-5 text-[0.75rem] text-tertiary">Anything shown as Unknown or Undisclosed has no source yet. Interested means “worth a conversation”, not “let’s invest”.</p>
        </>
      </div>
    </article>
  );
}

/**
 * The company's own photo when we may use it; otherwise its logo large on a
 * plain colour; otherwise its name set in type on that colour.
 */
function ProfileHero({ card }: { card: SwipeCard }) {
  const { company, media, logo } = card;
  const hue = company.artwork.hue;
  const plain: CSSProperties = { background: `oklch(0.95 0.025 ${hue})` };
  if (media?.url && media.rightsStatus !== "fallback") {
    return (
      <div className="relative aspect-[16/10] max-h-[42dvh] w-full md:max-h-[30dvh] overflow-hidden bg-surface-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media.url} alt={media.altText} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className="relative flex aspect-[16/10] max-h-[42dvh] w-full md:max-h-[30dvh] items-center justify-center overflow-hidden" style={plain} role="img" aria-label={logo?.url ? logo.altText : `${company.name} name`}>
      {logo?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo.url} alt="" className="max-h-[42%] max-w-[62%] object-contain" />
      ) : (
        <span className="px-8 text-center font-serif text-[clamp(30px,9vw,52px)] font-semibold leading-[1.05]" style={{ color: `oklch(0.34 0.07 ${hue})` }}>
          {company.name}
        </span>
      )}
    </div>
  );
}

function Facts({ facts }: { facts: SwipeCard["facts"] }) {
  if (!facts.length) return null;
  return (
    <dl className="mt-4 grid grid-cols-2 gap-2">
      {facts.map((f) => (
        <div key={f.label} className="rounded-[14px] bg-surface-muted px-3.5 py-2.5">
          <dt className="text-[0.75rem] text-secondary">{f.label}</dt>
          <dd className={cn("mt-0.5 text-[0.9375rem] font-semibold", /^(Unknown|Undisclosed)$/.test(f.value) ? "text-tertiary" : "text-ink")}>{f.value}</dd>
          {f.hint ? <dd className="mt-0.5 text-[0.6875rem] text-tertiary">{f.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

function Bullets({ items, tone }: { items: string[]; tone: "green" | "red" }) {
  return (
    <ul className="space-y-2">
      {items.map((w) => (
        <li key={w} className="flex gap-2">
          <span className={cn("mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full", tone === "green" ? "bg-green" : "bg-red")} aria-hidden />
          <span>{w}</span>
        </li>
      ))}
    </ul>
  );
}

function Prompt({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-[18px] border border-hairline bg-page px-4 py-3.5">
      <h3 className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-tertiary">{title}</h3>
      <div className="mt-1.5 text-[0.9375rem] leading-relaxed text-text">{children}</div>
      {note ? <p className="mt-2 text-[0.6875rem] text-tertiary">{note}</p> : null}
    </section>
  );
}
