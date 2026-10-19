import Link from "next/link";
import { ConsensusStrip } from "@/components/ui/avatar";
import { Card, Pill } from "@/components/ui/primitives";
import { consensusSummary } from "@/lib/domain/family-consensus";
import { formatMoney, relativeTime } from "@/lib/domain/format";
import type { CompanySummary } from "@/lib/domain/summaries";
import type { Member } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { BookmarkButton } from "./bookmark-button";
import { CompanyArtwork } from "./company-artwork";
import { AccessPill, AiInline, CardFlag, UpdateCue } from "./status-badges";

export function companyHref(summary: CompanySummary, tab?: string) {
  return tab ? `/companies/${summary.company.slug}?tab=${tab}` : `/companies/${summary.company.slug}`;
}

/** Large image-led card for carousels and Discover. */
export function CompanyCard({ summary, members, currentUserId, className, imageClass = "aspect-[16/10]" }: { summary: CompanySummary; members: Member[]; currentUserId: string; className?: string; imageClass?: string }) {
  const { company } = summary;
  const bookmarked = summary.bookmarkedBy.includes(currentUserId);
  const priorityText = summary.assessment?.aiPriority === "high" ? "High priority" : null;
  return (
    <Card as="article" className={cn("relative flex flex-col overflow-hidden", className)}>
      <Link href={companyHref(summary)} className="absolute inset-0 z-[1] rounded-[inherit]" aria-label={`Open ${company.name}`} />
      <div className={cn("relative w-full overflow-hidden bg-ink", imageClass)}>
        <CompanyArtwork company={company} media={summary.primaryMedia} />
        <div className="absolute left-3 top-3 z-[2] flex gap-1.5">
          <CardFlag summary={summary} />
        </div>
        <div className="absolute right-3 top-3 z-[2]">
          <BookmarkButton companyId={company.id} slug={company.slug} bookmarked={bookmarked} />
        </div>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-[19px] font-semibold leading-tight text-ink">{company.name}</h3>
          {priorityText ? (
            <Pill tone="green" className="relative z-[2] shrink-0">
              {priorityText}
            </Pill>
          ) : summary.familyStage === "shortlisted" ? (
            <Pill tone="green" className="shrink-0">
              Shortlisted
            </Pill>
          ) : null}
        </div>
        <p className="mt-0.5 text-[12px] text-secondary">
          {company.sector} · {company.city} · {company.stage}
        </p>
        <p className="mt-2 text-[14px] leading-snug text-text clamp-2">{company.teaser}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <AiInline priority={summary.assessment?.aiPriority ?? null} />
          {summary.access.canInvestNow ? <AccessPill access={summary.access} /> : <UpdateCue summary={summary} />}
        </div>
        {summary.familyStage !== "unreviewed" ? (
          <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
            <ConsensusStrip members={members} votes={summary.votes} />
            <span className="text-[12px] text-secondary">{consensusSummary(summary.votes, members.length)}</span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** Compact card for "Awaiting our views" and dense lists. */
export function CompactCompanyCard({ summary, members, className }: { summary: CompanySummary; members: Member[]; className?: string }) {
  const { company } = summary;
  return (
    <Card as="article" className={cn("relative flex gap-3 p-3", className)}>
      <Link href={companyHref(summary, "family")} className="absolute inset-0 z-[1] rounded-[inherit]" aria-label={`Open ${company.name}`} />
      <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[12px] bg-ink">
        <CompanyArtwork company={company} media={summary.primaryMedia} variant="thumb" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-serif text-[16px] font-semibold text-ink">{company.name}</h3>
        <p className="truncate text-[12px] text-secondary">
          {company.sector} · {company.city}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <ConsensusStrip members={members} votes={summary.votes} />
          <span className="truncate text-[12px] text-secondary">{consensusSummary(summary.votes, members.length)}</span>
        </div>
      </div>
    </Card>
  );
}

/** Editorial shortlist card with consensus, family average and AI score side by side. */
export function ShortlistCard({ summary, members, currentUserId }: { summary: CompanySummary; members: Member[]; currentUserId: string }) {
  const { company } = summary;
  return (
    <Card as="article" className="relative overflow-hidden">
      <Link href={companyHref(summary)} className="absolute inset-0 z-[1] rounded-[inherit]" aria-label={`Open ${company.name}`} />
      <div className="flex gap-3 p-3">
        <div className="h-[96px] w-[96px] shrink-0 overflow-hidden rounded-[14px] bg-ink">
          <CompanyArtwork company={company} media={summary.primaryMedia} variant="thumb" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-serif text-[18px] font-semibold text-ink">{company.name}</h3>
              <p className="truncate text-[12px] text-secondary">
                {company.sector} · {company.city} · {company.stage}
              </p>
            </div>
            <div className="relative z-[2]">
              <BookmarkButton companyId={company.id} slug={company.slug} bookmarked={summary.bookmarkedBy.includes(currentUserId)} variant="plain" />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ConsensusStrip members={members} votes={summary.votes} />
            <span className="text-[12px] text-secondary tnum">{summary.familyAverage !== null ? `Family ${summary.familyAverage}/10 · ${summary.raters} rated` : "No family ratings yet"}</span>
            <span className="text-[12px] text-secondary tnum">{summary.assessment?.aiScore != null ? `AI ${summary.assessment.aiScore.toFixed(1)}/10` : "AI not rated"}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-hairline px-4 py-2.5">
        <p className="min-w-0 truncate text-[12px] text-secondary">
          {summary.latestUpdate ? (
            <>
              <span className="font-medium text-ink">{summary.latestUpdate.headline}</span> · {relativeTime(summary.latestUpdate.effectiveAt)}
            </>
          ) : (
            "No developments recorded"
          )}
        </p>
        <AccessPill access={summary.access} compact />
      </div>
    </Card>
  );
}

/** Desktop table row. */
export function CompanyRow({ summary, members }: { summary: CompanySummary; members: Member[] }) {
  const { company } = summary;
  const round = summary.currentRound;
  return (
    <tr className="group border-t border-hairline hover:bg-surface-muted/60">
      <td className="py-2.5 pl-4 pr-2">
        <Link href={companyHref(summary)} className="flex items-center gap-3">
          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-ink">
            <CompanyArtwork company={company} media={summary.primaryMedia} variant="thumb" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-ink">{company.name}</span>
            <span className="block truncate text-[12px] text-secondary">{company.teaser}</span>
          </span>
        </Link>
      </td>
      <td className="px-2 text-[13px] text-secondary">{company.sector}</td>
      <td className="px-2 text-[13px] text-secondary">{company.stage}</td>
      <td className="px-2 text-[13px] text-secondary tnum">
        {round ? (
          <>
            <span className="text-ink">{formatMoney(round.targetAmount, round.currency)}</span>
            <span className="block text-[11px]">{round.preMoney ? `${formatMoney(round.preMoney, round.currency)} pre-money` : "Valuation undisclosed"}</span>
          </>
        ) : (
          "Unknown"
        )}
      </td>
      <td className="px-2">
        <AccessPill access={summary.access} />
      </td>
      <td className="px-2">
        <ConsensusStrip members={members} votes={summary.votes} />
      </td>
      <td className="pr-4 text-right">
        <AiInline priority={summary.assessment?.aiPriority ?? null} />
      </td>
    </tr>
  );
}
