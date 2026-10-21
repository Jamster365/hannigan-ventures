import { Clock3, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { BookmarkButton } from "@/components/company/bookmark-button";
import { CompanyArtwork } from "@/components/company/company-artwork";
import { CompanyMenu } from "@/components/company/company-menu";
import { CompanyTabs } from "@/components/company/company-tabs";
import { isTabKey } from "@/lib/domain/company-tabs";
import { AccessPill, AiPriorityPill, FamilyStagePill } from "@/components/company/status-badges";
import { StickyIdentity } from "@/components/company/sticky-identity";
import { AnalysisTab } from "@/components/company/tabs/analysis-tab";
import { FamilyTab } from "@/components/company/tabs/family-tab";
import { FundingTab } from "@/components/company/tabs/funding-tab";
import { OverviewTab } from "@/components/company/tabs/overview-tab";
import { SourcesTab } from "@/components/company/tabs/sources-tab";
import { TeamTab } from "@/components/company/tabs/team-tab";
import { UpdatesTab } from "@/components/company/tabs/updates-tab";
import { BackLink } from "@/components/navigation/page-header";
import { Chip } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { effectiveAccess } from "@/lib/domain/company-status";
import { computeFamilyStage } from "@/lib/domain/family-consensus";
import { relativeTime } from "@/lib/domain/format";
import { first, type Params, type SearchParams } from "@/lib/types/next";

export async function generateMetadata({ params }: { params: Params<{ slug: string }> }) {
  const { slug } = await params;
  const repo = await getRepository();
  const bundle = await repo.getCompanyBySlug(slug);
  return { title: bundle?.company.name ?? "Company" };
}

export default async function CompanyPage({ params, searchParams }: { params: Params<{ slug: string }>; searchParams: SearchParams }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const member = await requireMember();
  const repo = await getRepository();
  const [bundle, members, prompt] = await Promise.all([repo.getCompanyBySlug(slug), repo.getMembers(), repo.getActivePrompt()]);
  if (!bundle) notFound();
  const tabParam = first(sp.tab);
  const tab = isTabKey(tabParam) ? tabParam : "overview";
  const { company, media, votes, accessChecks, assessment, updates } = bundle;
  const primary = media.find((m) => m.isPrimary) ?? media[0] ?? null;
  const stage = computeFamilyStage(votes);
  const access = effectiveAccess(accessChecks, { maxChequeGbp: prompt.config.maxChequeGbp });
  const bookmarked = bundle.bookmarkedBy.includes(member.userId);
  const latest = [...updates].sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))[0];
  const whatsNew = latest && new Date().getTime() - new Date(latest.detectedAt).getTime() < 36 * 3600_000 ? `${latest.headline}: ${latest.summary}` : null;
  const counts = { updates: updates.length, family: bundle.comments.filter((c) => !c.deletedAt).length, sources: bundle.sources.length };

  const compact = (
    <div className="flex min-h-[56px] items-center gap-1 px-2">
      <BackLink href="/" />
      <p className="min-w-0 flex-1 truncate text-center font-serif text-[18px] font-semibold text-ink">{company.name}</p>
      <BookmarkButton companyId={company.id} slug={company.slug} bookmarked={bookmarked} variant="plain" />
      <CompanyMenu company={company} sources={bundle.sources} whatsNew={whatsNew} />
    </div>
  );

  return (
    <article className="mx-auto w-full max-w-[1200px] xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-8 xl:px-6 xl:pt-6">
      <div className="min-w-0">
        {/* Controls sit above the image, never on it: company imagery often carries its own headline text. */}
        <div className="flex items-center justify-between px-2 pb-1 xl:px-0 xl:pb-2" style={{ paddingTop: "max(4px, env(safe-area-inset-top))" }}>
          <BackLink href="/" />
          <div className="flex gap-1">
            <BookmarkButton companyId={company.id} slug={company.slug} bookmarked={bookmarked} variant="plain" />
            <CompanyMenu company={company} sources={bundle.sources} whatsNew={whatsNew} />
          </div>
        </div>
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-ink sm:aspect-[16/9] xl:aspect-[21/9] xl:rounded-[var(--radius-lg)]">
          <CompanyArtwork company={company} media={primary} logo={media.find((m) => m.kind === "logo" && m.url && m.rightsStatus !== "fallback") ?? null} variant="hero" priority />
          {company.isDemo ? <span className="absolute right-3 bottom-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-white/90">Sample company</span> : null}
        </div>
        {primary?.attribution ? <p className="px-4 pt-1.5 text-right text-[11px] text-tertiary xl:px-0">{primary.attribution}</p> : null}

        <header className="px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-serif text-[30px] font-semibold leading-[1.05] text-ink">{company.name}</h1>
            <FamilyStagePill stage={stage} />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Chip>{company.sector}</Chip>
            <Chip>
              <MapPin size={11} className="mr-1" aria-hidden />
              {company.city}, {company.country}
            </Chip>
            <Chip>{company.stage}</Chip>
          </div>
          <p className="mt-3 text-[16px] leading-snug text-text">{company.teaser}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <AccessPill access={access} />
            {assessment ? <AiPriorityPill priority={assessment.aiPriority} score={assessment.aiScore} /> : null}
            <span className="inline-flex items-center gap-1 text-[12px] text-tertiary">
              <Clock3 size={12} aria-hidden />
              {company.lastResearchedAt ? `Researched ${relativeTime(company.lastResearchedAt)}` : "Not yet researched"}
            </span>
          </div>
          {company.tags.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {company.tags.map((t) => (
                <Chip key={t} className="bg-surface border border-hairline">
                  {t}
                </Chip>
              ))}
            </div>
          ) : null}
        </header>

        <div className="mt-3">
          <StickyIdentity compact={compact} tabs={<CompanyTabs slug={company.slug} active={tab} counts={counts} />} />
        </div>

        <div className="px-4 pt-5" role="tabpanel">
          {tab === "overview" ? <OverviewTab bundle={bundle} /> : null}
          {tab === "analysis" ? <AnalysisTab bundle={bundle} /> : null}
          {tab === "funding" ? <FundingTab bundle={bundle} currentUserId={member.userId} maxChequeGbp={prompt.config.maxChequeGbp} /> : null}
          {tab === "team" ? <TeamTab bundle={bundle} /> : null}
          {tab === "updates" ? <UpdatesTab bundle={bundle} category={first(sp.cat) ?? "all"} /> : null}
          {tab === "family" ? <FamilyTab bundle={bundle} members={members} currentUserId={member.userId} /> : null}
          {tab === "sources" ? <SourcesTab bundle={bundle} type={first(sp.type) ?? "all"} /> : null}
        </div>
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-6 space-y-4">
          <div className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-tertiary">Summary</p>
            <dl className="mt-2 space-y-2 text-[13px]">
              <Row label="Family" value={<FamilyStagePill stage={stage} />} />
              <Row label="Access" value={<AccessPill access={access} />} />
              <Row label="AI" value={assessment ? <AiPriorityPill priority={assessment.aiPriority} score={assessment.aiScore} /> : <span className="text-secondary">Not rated</span>} />
              <Row label="Sources" value={<span className="text-ink tnum">{bundle.sources.length}</span>} />
              <Row label="Discovered" value={<span className="text-ink">{relativeTime(company.firstDiscoveredAt)}</span>} />
            </dl>
          </div>
          {assessment ? (
            <div className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-tertiary">Next action</p>
              <p className="mt-1 text-[14px] text-ink">{assessment.nextAction}</p>
            </div>
          ) : null}
        </div>
      </aside>
    </article>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-secondary">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
