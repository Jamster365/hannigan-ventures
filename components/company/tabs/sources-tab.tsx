import { Building2, ExternalLink, FileText, FlaskConical, Newspaper, Radio, Link2 } from "lucide-react";
import Link from "next/link";
import { Pill } from "@/components/ui/primitives";
import { formatDate } from "@/lib/domain/format";
import type { CompanyBundle, SourceType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const TYPES: { key: string; label: string; Icon: typeof Newspaper }[] = [
  { key: "all", label: "All", Icon: Link2 },
  { key: "news", label: "News", Icon: Newspaper },
  { key: "official", label: "Official", Icon: Building2 },
  { key: "filing", label: "Filings", Icon: FileText },
  { key: "research", label: "Research", Icon: FlaskConical },
  { key: "media", label: "Media", Icon: Radio },
  { key: "other", label: "Other", Icon: Link2 },
];

const iconFor: Record<SourceType, typeof Newspaper> = { news: Newspaper, official: Building2, filing: FileText, research: FlaskConical, media: Radio, other: Link2 };

export function SourcesTab({ bundle, type }: { bundle: CompanyBundle; type: string }) {
  const { company, sources } = bundle;
  const list = sources.filter((s) => type === "all" || s.sourceType === type);
  return (
    <div>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-3" role="tablist" aria-label="Source types">
        {TYPES.map((t) => (
          <Link
            key={t.key}
            href={`/companies/${company.slug}?tab=sources${t.key === "all" ? "" : `&type=${t.key}`}`}
            scroll={false}
            role="tab"
            aria-selected={type === t.key}
            className={cn("min-h-[34px] shrink-0 rounded-full border px-3.5 text-[13px] font-medium leading-[32px]", type === t.key ? "border-ink bg-ink text-white" : "border-hairline bg-surface text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {company.isDemo ? <p className="mb-3 rounded-[12px] bg-amber-pale px-3 py-2 text-[12px] text-amber">Sample sources for a fictional company. Links use a reserved domain and do not resolve.</p> : null}
      {list.length === 0 ? (
        <p className="rounded-[14px] bg-surface-muted px-4 py-6 text-center text-[14px] text-secondary">No sources of this type. Claims without a source are labelled as inference or omitted.</p>
      ) : (
        <ol className="divide-y divide-hairline rounded-[var(--radius-card)] border border-hairline bg-surface">
          {list.map((s) => {
            const Icon = iconFor[s.sourceType];
            const n = sources.findIndex((x) => x.id === s.id) + 1;
            return (
              <li key={s.id}>
                <a href={s.canonicalUrl} target="_blank" rel="noopener noreferrer" className="flex gap-3 px-4 py-3 hover:bg-surface-muted/70">
                  <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-secondary">
                    <Icon size={16} aria-hidden />
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-pale px-1 text-[9px] font-semibold text-blue tnum">{n}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold leading-snug text-ink">{s.title}</span>
                    <span className="mt-0.5 block text-[12px] text-secondary">
                      {s.publisher} · {formatDate(s.publishedAt)}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {s.claimType ? <Pill tone="neutral">{s.claimType}</Pill> : null}
                      <Pill tone={s.trustTier === "primary" ? "green" : s.trustTier === "reputable" ? "blue" : s.trustTier === "secondary" ? "amber" : "neutral"}>{trustLabel(s.trustTier)}</Pill>
                      <span className="text-[11px] text-tertiary">Checked {formatDate(s.retrievedAt)}</span>
                    </span>
                  </span>
                  <ExternalLink size={15} className="mt-1 shrink-0 text-tertiary" aria-hidden />
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function trustLabel(t: CompanyBundle["sources"][number]["trustTier"]) {
  return t === "primary" ? "Primary source" : t === "reputable" ? "Reputable" : t === "secondary" ? "Secondary" : "Unverified";
}
