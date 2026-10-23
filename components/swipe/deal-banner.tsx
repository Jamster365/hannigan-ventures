import { ClipboardCheck, ChevronRight } from "lucide-react";
import Link from "next/link";
import { dealProgress, dealStatusLabel, type Deal } from "@/lib/domain/deal";
import { cn } from "@/lib/utils";

/** The strip at the top of a match chat: where the deal stands, and the way into the deal room. */
export function DealBanner({ slug, deal, className }: { slug: string; deal: Deal; className?: string }) {
  const p = dealProgress(deal);
  const started = p.done > 0 || p.documents > 0 || deal.decision !== null;
  return (
    <Link href={`/matches/${slug}/deal`} className={cn("flex items-center gap-3 border-b border-hairline bg-surface px-4 py-2.5 hover:bg-surface-muted/60", className)}>
      <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full", p.status === "invested" ? "bg-green/15 text-green" : "bg-blue-pale text-blue")}>
        <ClipboardCheck size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold text-ink">Deal room</span>
        <span className="block truncate text-[0.75rem] text-secondary">
          {started ? `${dealStatusLabel(p.status)}${p.status === "invested" && p.totalInvestedGbp ? ` £${p.totalInvestedGbp.toLocaleString("en-GB")}` : ""} · due diligence ${p.done} of ${p.total} · ${p.documents} document${p.documents === 1 ? "" : "s"}` : "Checklist, documents, the team, the timeline and our decision"}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-tertiary" aria-hidden />
    </Link>
  );
}
