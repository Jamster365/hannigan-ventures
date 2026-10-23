import { Coins, FlaskConical, MessageSquare, ShieldAlert, Users, Wrench } from "lucide-react";
import Link from "next/link";
import { CompanyArtwork } from "@/components/company/company-artwork";
import { Pill } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/domain/format";
import type { CompanySummary } from "@/lib/domain/summaries";
import type { CompanyUpdate, UpdateType } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const typeMeta: Record<UpdateType, { Icon: typeof Coins; cls: string; label: string }> = {
  funding: { Icon: Coins, cls: "bg-green-pale text-green", label: "Funding" },
  company: { Icon: Wrench, cls: "bg-blue-pale text-blue", label: "Company" },
  product: { Icon: Wrench, cls: "bg-blue-pale text-blue", label: "Product" },
  team: { Icon: Users, cls: "bg-violet-pale text-violet", label: "Team" },
  risk: { Icon: ShieldAlert, cls: "bg-red-pale text-red", label: "Risk" },
  research: { Icon: FlaskConical, cls: "bg-violet-pale text-violet", label: "AI research" },
  family: { Icon: MessageSquare, cls: "bg-amber-pale text-amber", label: "Family activity" },
};

export function updateTab(u: CompanyUpdate): string {
  if (u.updateType === "family") return "family";
  if (u.updateType === "funding") return "funding";
  return "updates";
}

/** "Recently changed" row: distinguishes AI research from family activity. */
export function ChangeRow({ update, summary, showCompany = true }: { update: CompanyUpdate; summary: CompanySummary; showCompany?: boolean }) {
  const m = typeMeta[update.updateType];
  const Icon = m.Icon;
  return (
    <li className="relative">
      <Link href={`/companies/${summary.company.slug}?tab=${updateTab(update)}`} className="flex gap-3 rounded-[14px] px-4 py-3 hover:bg-surface-muted/70">
        <span className={cn("mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full", m.cls)}>
          <Icon size={15} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            {showCompany ? <span className="truncate text-[0.8125rem] font-semibold text-ink">{summary.company.name}</span> : null}
            <Pill tone={update.updateType === "family" ? "amber" : "violet"} className="text-[0.625rem] uppercase tracking-[0.06em]">
              {m.label}
            </Pill>
            <span className="ml-auto shrink-0 text-[0.6875rem] text-tertiary">{relativeTime(update.effectiveAt)}</span>
          </span>
          <span className="mt-0.5 block text-[0.875rem] font-medium text-ink">{update.headline}</span>
          <span className="block text-[0.8125rem] text-secondary clamp-2">{update.summary}</span>
        </span>
        {showCompany ? (
          <span className="hidden h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-ink sm:block">
            <CompanyArtwork company={summary.company} media={summary.primaryMedia} logo={summary.logoMedia} variant="thumb" />
          </span>
        ) : null}
      </Link>
    </li>
  );
}
