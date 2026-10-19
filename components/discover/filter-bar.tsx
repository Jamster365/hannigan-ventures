"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

export const QUICK_FILTERS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "raising", label: "Raising" },
  { key: "uk", label: "UK" },
  { key: "pre-seed", label: "Pre-seed" },
  { key: "seed", label: "Seed" },
  { key: "pending", label: "Awaiting views" },
  { key: "shortlist", label: "Shortlist" },
  { key: "passed", label: "Passed" },
] as const;

export const SORTS = [
  { key: "relevant", label: "Most relevant" },
  { key: "newest", label: "Newest" },
  { key: "changed", label: "Latest change" },
  { key: "deadline", label: "Deadline" },
  { key: "ai", label: "AI assessment" },
  { key: "family", label: "Family interest" },
] as const;

export function FilterBar({ sectors, stages, totalLabel }: { sectors: string[]; stages: string[]; totalLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(params.get("q") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const filter = params.get("filter") ?? "all";

  useEffect(() => {
    if (params.get("focus") === "search") inputRef.current?.focus();
  }, [params]);

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    }
    next.delete("focus");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) set({ q });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const advancedCount = ["sector", "stage", "access", "eis", "ai"].filter((k) => params.get(k)).length;

  return (
    <div className="border-b border-hairline/70 bg-page/95 backdrop-blur">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex items-center gap-2 px-4 pb-2">
          <label className="relative flex min-h-[44px] flex-1 items-center">
            <Search size={17} className="pointer-events-none absolute left-3 text-tertiary" aria-hidden />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search companies, sectors, founders…"
              aria-label="Search companies"
              className="min-h-[44px] w-full rounded-full border border-hairline bg-surface pl-9 pr-9 text-[15px] text-ink placeholder:text-tertiary focus:border-blue"
            />
            {q ? (
              <button type="button" onClick={() => setQ("")} className="absolute right-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-tertiary hover:bg-surface-muted" aria-label="Clear search">
                <X size={15} />
              </button>
            ) : null}
          </label>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cn("inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium", advancedCount ? "border-ink bg-ink text-white" : "border-hairline bg-surface text-ink")}
          >
            <SlidersHorizontal size={15} aria-hidden />
            Filters{advancedCount ? ` · ${advancedCount}` : ""}
          </button>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5" role="tablist" aria-label="Quick filters">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => set({ filter: f.key })}
              className={cn("min-h-[34px] shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition-colors", filter === f.key ? "border-ink bg-ink text-white" : "border-hairline bg-surface text-ink hover:bg-surface-muted")}
            >
              {f.label}
            </button>
          ))}
        </div>
        {open ? (
          <div className="grid grid-cols-2 gap-2 border-t border-hairline px-4 py-3 sm:grid-cols-3 lg:grid-cols-6">
            <Select label="Sector" value={params.get("sector")} onChange={(v) => set({ sector: v })} options={sectors} />
            <Select label="Stage" value={params.get("stage")} onChange={(v) => set({ stage: v })} options={stages} />
            <Select label="Access" value={params.get("access")} onChange={(v) => set({ access: v })} options={["Can invest now", "Contactable", "Fundraising reported", "Expected", "Closed", "Unknown"]} />
            <Select label="EIS/SEIS" value={params.get("eis")} onChange={(v) => set({ eis: v })} options={["Documented", "Claimed", "Pending", "Unknown", "Not applicable"]} />
            <Select label="AI priority" value={params.get("ai")} onChange={(v) => set({ ai: v })} options={["High", "Medium", "Low", "Not rated"]} />
            <Select label="Sort" value={params.get("sort")} onChange={(v) => set({ sort: v })} options={SORTS.map((s) => s.label)} keys={SORTS.map((s) => s.key)} />
            {advancedCount || params.get("sort") ? (
              <button type="button" onClick={() => set({ sector: null, stage: null, access: null, eis: null, ai: null, sort: null })} className="col-span-full justify-self-start text-[13px] font-medium text-blue">
                Reset filters
              </button>
            ) : null}
          </div>
        ) : null}
        <p className="px-4 pb-2 text-[12px] text-tertiary">{totalLabel}</p>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options, keys }: { label: string; value: string | null; onChange: (v: string | null) => void; options: string[]; keys?: string[] }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className="mt-0.5 block min-h-[40px] w-full rounded-[10px] border border-hairline bg-surface px-2 text-[14px] text-ink">
        <option value="">Any</option>
        {options.map((o, i) => (
          <option key={o} value={keys ? keys[i] : o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
