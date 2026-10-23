import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { TeamTab } from "@/components/company/tabs/team-tab";
import { UpdatesTab } from "@/components/company/tabs/updates-tab";
import { PageHeader } from "@/components/navigation/page-header";
import { DealRoom } from "@/components/swipe/deal-room";
import { LinkButton } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { familyStageOf } from "@/lib/domain/family-consensus";
import { buildSwipeCard } from "@/lib/domain/swipe";

export const metadata = { title: "Deal room" };

/**
 * After a match: everything the family needs to get from "we both like it"
 * to "we invested" (or "we passed"). The decision, the due-diligence
 * checklist and the documents at the top; the team, the company's timeline
 * and the way in below; the full seven-tab research a tap away.
 */
export default async function DealRoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const member = await requireMember();
  const repo = await getRepository();
  const bundle = await repo.getCompanyBySlug(slug);
  if (!bundle) notFound();
  const [members, deal, prompt] = await Promise.all([repo.getMembers(), repo.getDeal(bundle.company.id), repo.getActivePrompt()]);
  const card = buildSwipeCard(bundle, member.userId, { maxChequeGbp: prompt.config.maxChequeGbp });
  const isMatch = familyStageOf(bundle, members.length) === "shortlisted";
  const { company } = bundle;

  return (
    <>
      <PageHeader variant="back" title={`${company.name} · Deal room`} backHref={`/matches/${slug}`} />
      <div className="mx-auto w-full max-w-[640px] px-4 pb-10 pt-3">
        {!isMatch ? <p className="mb-3 rounded-[12px] bg-amber/10 px-3 py-2 text-[0.8125rem] text-ink">This company is not a match right now, but what the family recorded here is kept.</p> : null}
        <DealRoom companyId={company.id} slug={slug} deal={deal} members={members} currentUserId={member.userId} />

        <section className="mt-6 rounded-[18px] border border-hairline bg-surface p-4">
          <h2 className="font-serif text-[1.25rem] font-semibold text-ink">How we get in</h2>
          <p className="mt-1 text-[0.9375rem] text-text">{card.howToGetIn}</p>
          {card.platform?.url ? (
            <a href={card.platform.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-[40px] items-center gap-1 text-[0.875rem] font-medium text-blue">
              Open the {card.platform.name} page <ExternalLink size={13} aria-hidden />
            </a>
          ) : null}
        </section>

        <section className="mt-6">
          <h2 className="mb-2 px-1 font-serif text-[1.25rem] font-semibold text-ink">The team</h2>
          <div className="rounded-[18px] border border-hairline bg-surface p-4">
            <TeamTab bundle={bundle} />
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 px-1 font-serif text-[1.25rem] font-semibold text-ink">Timeline</h2>
          <div className="rounded-[18px] border border-hairline bg-surface p-4">
            <UpdatesTab bundle={bundle} category="all" />
          </div>
        </section>

        <div className="mt-6 grid gap-2">
          <LinkButton href={`/companies/${slug}?from=match`} variant="outline" className="w-full">
            Full research: funding, analysis, sources, history
          </LinkButton>
          <LinkButton href={`/matches/${slug}/profile`} variant="outline" className="w-full">
            Profile card
          </LinkButton>
        </div>
      </div>
    </>
  );
}
