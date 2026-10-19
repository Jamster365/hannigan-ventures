"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

import { COMPANY_TABS, type CompanyTabKey } from "@/lib/domain/company-tabs";

/** Horizontal, thumb-height tab strip with underline. Deep-linkable via ?tab=. */
export function CompanyTabs({ slug, active, counts }: { slug: string; active: CompanyTabKey; counts?: Partial<Record<CompanyTabKey, number>> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
  }, [active]);
  return (
    <div ref={ref} className="no-scrollbar flex gap-1 overflow-x-auto px-2" role="tablist" aria-label="Company sections">
      {COMPANY_TABS.map((t) => {
        const selected = t.key === active;
        const count = counts?.[t.key];
        return (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/companies/${slug}` : `/companies/${slug}?tab=${t.key}`}
            scroll={false}
            role="tab"
            aria-selected={selected}
            className={cn(
              "relative inline-flex min-h-[44px] shrink-0 items-center gap-1 px-3 text-[14px] font-medium transition-colors",
              selected ? "text-ink" : "text-secondary hover:text-ink",
            )}
          >
            {t.label}
            {count ? <span className={cn("tnum text-[11px]", selected ? "text-ink/70" : "text-tertiary")}>{count}</span> : null}
            <span className={cn("absolute inset-x-2 bottom-0 h-[2.5px] rounded-full", selected ? "bg-ink" : "bg-transparent")} aria-hidden />
          </Link>
        );
      })}
    </div>
  );
}
