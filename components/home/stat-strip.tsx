import { Building2, CalendarDays, Coins, Star } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  value: number;
  href: string;
  icon: "companies" | "raising" | "shortlist" | "events";
  sub?: string;
}

const icons = {
  companies: { Icon: Building2, cls: "bg-blue-pale text-blue" },
  raising: { Icon: Coins, cls: "bg-red-pale text-red" },
  shortlist: { Icon: Star, cls: "bg-amber-pale text-amber" },
  events: { Icon: CalendarDays, cls: "bg-violet-pale text-violet" },
};

/** Compact metric strip. Values are computed from the database, never constants. */
export function StatStrip({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-4 gap-2 px-4", className)}>
      {stats.map((s) => {
        const { Icon, cls } = icons[s.icon];
        return (
          <li key={s.label}>
            <Link href={s.href} className="flex h-full flex-col rounded-[14px] border border-hairline bg-surface px-3 py-2.5 shadow-[var(--shadow-card)]">
              <span className="flex items-start justify-between">
                <span className="font-serif text-[1.375rem] font-semibold leading-none text-ink tnum">{s.value}</span>
                <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full", cls)}>
                  <Icon size={13} aria-hidden />
                </span>
              </span>
              <span className="mt-1.5 text-[0.6875rem] font-medium text-secondary">{s.label}</span>
              {s.sub ? <span className="mt-0.5 hidden text-[0.6875rem] text-green xl:block">{s.sub}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
