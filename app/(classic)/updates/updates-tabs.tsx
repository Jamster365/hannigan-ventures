import Link from "next/link";
import { cn } from "@/lib/utils";

export function UpdatesTabs({ active, counts }: { active: string; counts: Record<"all" | "company" | "family", number> }) {
  const tabs = [
    { key: "all", label: "All" },
    { key: "company", label: "Company updates" },
    { key: "family", label: "Family activity" },
  ] as const;
  return (
    <div className="mx-auto flex max-w-[1200px] gap-2 px-4 pb-2.5" role="tablist">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.key === "all" ? "/updates" : `/updates?tab=${t.key}`}
          role="tab"
          aria-selected={active === t.key}
          className={cn("inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] font-medium", active === t.key ? "border-ink bg-ink text-white" : "border-hairline bg-surface text-ink")}
        >
          {t.label}
          <span className={cn("tnum text-[0.6875rem]", active === t.key ? "text-white/70" : "text-tertiary")}>{counts[t.key]}</span>
        </Link>
      ))}
    </div>
  );
}
