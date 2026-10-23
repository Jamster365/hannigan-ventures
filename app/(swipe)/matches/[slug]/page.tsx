import Link from "next/link";
import { notFound } from "next/navigation";
import { CompanyArtwork } from "@/components/company/company-artwork";
import { BackLink } from "@/components/navigation/page-header";
import { MatchChat } from "@/components/swipe/match-chat";
import { Pill, type Tone } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { dataMode } from "@/lib/config";
import { getRepository } from "@/lib/data";
import { computeFamilyStage } from "@/lib/domain/family-consensus";
import { formatDate } from "@/lib/domain/format";
import { buildSwipeCard, matchedAt, matchesFor } from "@/lib/domain/swipe";

export default async function MatchChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const member = await requireMember();
  const repo = await getRepository();
  const bundle = await repo.getCompanyBySlug(slug);
  if (!bundle) notFound();
  const [members, notifications, prompt] = await Promise.all([repo.getMembers(), repo.listNotifications(member.userId), repo.getActivePrompt()]);
  const card = buildSwipeCard(bundle, member.userId, { maxChequeGbp: prompt.config.maxChequeGbp });
  const isMatch = computeFamilyStage(bundle.votes, members.length) === "shortlisted";
  const row = matchesFor([bundle], members, notifications)[0];
  const { company } = bundle;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-hairline bg-surface px-2 py-1.5 md:px-[max(8px,calc((100%-776px)/2))]">
        <BackLink href="/matches" />
        <Link href={`/matches/${slug}/profile`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1 pr-2 hover:bg-surface-muted/60">
          <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-hairline">
            <CompanyArtwork company={company} media={card.media} logo={card.logo} variant="thumb" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-serif text-[1.0625rem] font-semibold text-ink">{company.name}</span>
            <span className="block truncate text-[0.75rem] text-secondary">Tap for profile · {company.teaser}</span>
          </span>
        </Link>
      </header>

      <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-hairline bg-page px-4 py-2 md:px-[max(16px,calc((100%-760px)/2))]">
        <Pill tone={card.raising.tone as Tone}>{card.raising.label}</Pill>
        {card.facts.slice(0, 3).map((f) => (
          <Pill key={f.label}>
            {f.label}: {f.value}
          </Pill>
        ))}
      </div>

      {isMatch ? (
        <MatchChat
          companyId={company.id}
          slug={slug}
          companyName={company.name}
          comments={bundle.comments}
          members={members}
          currentUserId={member.userId}
          unreadIds={row?.unreadIds ?? []}
          intro={`It’s a match · ${formatDate(matchedAt(bundle))}`}
          live={dataMode() === "supabase"}
        />
      ) : (
        <div className="mx-auto max-w-[36ch] px-6 pt-12 text-center">
          <p className="font-serif text-[1.25rem] font-semibold text-ink">Not a match right now</p>
          <p className="mt-1 text-[0.875rem] text-secondary">Not enough of you want {company.name} right now, so its chat is closed.</p>
          <Link href="/matches" className="mt-4 inline-flex min-h-[44px] items-center font-medium text-blue">
            Back to matches
          </Link>
        </div>
      )}
    </div>
  );
}
