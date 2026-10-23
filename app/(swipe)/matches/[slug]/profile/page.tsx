import { notFound } from "next/navigation";
import { PageHeader } from "@/components/navigation/page-header";
import { CompanyProfile } from "@/components/swipe/company-profile";
import { LinkButton } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { buildSwipeCard } from "@/lib/domain/swipe";

export default async function MatchProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const member = await requireMember();
  const repo = await getRepository();
  const bundle = await repo.getCompanyBySlug(slug);
  if (!bundle) notFound();
  const prompt = await repo.getActivePrompt();
  const card = buildSwipeCard(bundle, member.userId, { maxChequeGbp: prompt.config.maxChequeGbp });

  return (
    <>
      <PageHeader variant="back" title={bundle.company.name} backHref={`/matches/${slug}`} />
      <div className="mx-auto w-full max-w-[560px] pb-8">
        <CompanyProfile card={card} />
        <div className="grid gap-2 px-5">
          <LinkButton href={`/matches/${slug}/deal`} className="w-full">
            Deal room: checklist, documents, decision
          </LinkButton>
          {/* The classic seven-tab profile holds the full research: funding detail, analysis, sources and history. */}
          <LinkButton href={`/companies/${slug}?from=match`} variant="outline" className="w-full">
            Full research
          </LinkButton>
        </div>
      </div>
    </>
  );
}
