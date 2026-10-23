import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { SourceRef } from "@/components/company/source-link";
import { LinkButton, Pill } from "@/components/ui/primitives";
import { formatDate, relativeTime } from "@/lib/domain/format";
import type { CompanyBundle, UpdateType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const CATS: { key: string; label: string; types: UpdateType[] }[] = [
  { key: "all", label: "All", types: [] },
  { key: "company", label: "Company", types: ["company", "research", "risk"] },
  { key: "funding", label: "Funding", types: ["funding"] },
  { key: "product", label: "Product", types: ["product"] },
  { key: "team", label: "Team", types: ["team"] },
  { key: "family", label: "Family", types: ["family"] },
];

export function UpdatesTab({ bundle, category }: { bundle: CompanyBundle; category: string }) {
  const { company, updates, sources } = bundle;
  const byId = new Map(sources.map((s) => [s.id, s]));
  const cat = CATS.find((c) => c.key === category) ?? CATS[0];
  const list = [...updates].filter((u) => cat.types.length === 0 || cat.types.includes(u.updateType)).sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt));
  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-3" role="tablist" aria-label="Update categories">
        {CATS.map((c) => (
          <Link
            key={c.key}
            href={`/companies/${company.slug}?tab=updates${c.key === "all" ? "" : `&cat=${c.key}`}`}
            scroll={false}
            role="tab"
            aria-selected={cat.key === c.key}
            className={cn("min-h-[34px] shrink-0 rounded-full border px-3.5 text-[0.8125rem] font-medium leading-[32px]", cat.key === c.key ? "border-ink bg-ink text-white" : "border-hairline bg-surface text-ink")}
          >
            {c.label}
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="rounded-[14px] bg-surface-muted px-4 py-6 text-center text-[0.875rem] text-secondary">No updates in this category.</p>
      ) : (
        <ol className="relative ml-2 border-l border-hairline-strong pl-5">
          {list.map((u, i) => {
            const src = u.sourceId ? byId.get(u.sourceId) : undefined;
            const dotCls = u.updateType === "family" ? "bg-amber" : u.materiality === "high" ? "bg-green" : i === 0 ? "bg-blue" : "bg-hairline-strong";
            return (
              <li key={u.id} className="relative pb-6 last:pb-0">
                <span className={cn("absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-page", dotCls)} aria-hidden />
                <div className="flex items-baseline gap-2 text-[0.75rem] text-secondary">
                  <span className="font-medium text-ink">{formatDate(u.effectiveAt)}</span>
                  <span>{relativeTime(u.effectiveAt)}</span>
                  <Pill tone={u.updateType === "family" ? "amber" : u.updateType === "research" ? "violet" : "neutral"} className="ml-auto text-[0.625rem] uppercase tracking-[0.06em]">
                    {u.updateType === "research" ? "AI research" : u.updateType}
                  </Pill>
                </div>
                <p className="mt-1 text-[0.9375rem] font-semibold text-ink">{u.headline}</p>
                <p className="mt-0.5 text-[0.875rem] leading-relaxed text-text">
                  {u.summary}
                  <SourceRef source={src} />
                </p>
                {u.change?.length ? (
                  <ul className="mt-2 space-y-1 rounded-[12px] bg-surface-muted px-3 py-2 text-[0.75rem]">
                    {u.change.map((c, j) => (
                      <li key={j} className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-ink">{c.field}:</span>
                        <span className="text-tertiary line-through">{c.from ?? "unknown"}</span>
                        <ChevronRight size={12} className="text-tertiary" aria-hidden />
                        <span className="font-medium text-ink">{c.to ?? "unknown"}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {src ? (
                  <a href={src.canonicalUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[0.75rem] text-blue">
                    {src.publisher} · {formatDate(src.publishedAt)}
                  </a>
                ) : u.updateType !== "family" ? (
                  <p className="mt-1.5 text-[0.75rem] text-tertiary">No source attached.</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <LinkButton href={`/companies/${company.slug}?tab=sources`} scroll={false} className="mt-6 w-full">
        View all sources
      </LinkButton>
    </div>
  );
}
