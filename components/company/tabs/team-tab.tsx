import { Award, ExternalLink, GraduationCap, Users } from "lucide-react";
import { EvidencePill, SourceRef } from "@/components/company/source-link";
import type { CompanyBundle } from "@/lib/domain/types";

export function TeamTab({ bundle }: { bundle: CompanyBundle }) {
  const { founders, teamHighlights, rounds, sources, company } = bundle;
  const byId = new Map(sources.map((s) => [s.id, s]));
  const backers = [...new Set(rounds.flatMap((r) => r.leadInvestors))];
  const icons = [Users, GraduationCap, Award];
  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-serif text-[20px] font-semibold text-ink">Founders</h2>
        {founders.length ? (
          <ul className="mt-2 space-y-3">
            {founders.map((f) => (
              <li key={f.id} className="flex gap-3 rounded-[var(--radius-card)] border border-hairline bg-surface p-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-muted font-serif text-[18px] font-semibold text-ink" aria-hidden>
                  {f.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-semibold text-ink">{f.name}</p>
                      <p className="text-[12px] text-secondary">{f.role}</p>
                    </div>
                    {f.profileUrl ? (
                      <a href={f.profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-blue hover:bg-blue-pale" aria-label={`${f.name} public profile`}>
                        <ExternalLink size={16} />
                      </a>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-text">{f.bio}</p>
                  <div className="mt-2 flex items-center gap-1">
                    <EvidencePill status={f.evidenceStatus} />
                    <SourceRef source={f.sourceId ? byId.get(f.sourceId) : undefined} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-[14px] bg-surface-muted px-4 py-5 text-center text-[14px] text-secondary">No founders verified yet. Names are only shown with a public source; nothing is inferred.</p>
        )}
        <p className="mt-2 text-[12px] text-tertiary">No portraits are shown unless a permitted image exists. Bios come from public sources and carry their evidence status.</p>
      </section>

      <section>
        <h2 className="font-serif text-[20px] font-semibold text-ink">Team highlights</h2>
        {teamHighlights.length ? (
          <ul className="mt-2 space-y-2">
            {teamHighlights.map((h, i) => {
              const Icon = icons[i % icons.length];
              return (
                <li key={i} className="flex items-start gap-2.5 text-[14px] text-text">
                  <Icon size={17} className="mt-0.5 shrink-0 text-secondary" aria-hidden />
                  <span>
                    {h.text}
                    <SourceRef source={h.sourceId ? byId.get(h.sourceId) : undefined} />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1 text-[14px] text-secondary">Nothing recorded.</p>
        )}
      </section>

      <section>
        <h2 className="font-serif text-[20px] font-semibold text-ink">Investors and backers</h2>
        {backers.length ? (
          <ul className="mt-2 space-y-1.5 text-[14px] text-text">
            {backers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[14px] text-secondary">No named investors in sourced material for {company.name}.</p>
        )}
      </section>
    </div>
  );
}
