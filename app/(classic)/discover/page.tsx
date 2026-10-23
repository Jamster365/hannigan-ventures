import { Suspense } from "react";
import { CompanyCard, CompanyRow } from "@/components/company/company-card";
import { FilterBar } from "@/components/discover/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { EmptyState, LinkButton } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { loadCompanySummaries } from "@/lib/data/view-models";
import { applyDiscoverQuery } from "@/lib/domain/discover";
import { pluralise } from "@/lib/domain/format";
import { first, type SearchParams } from "@/lib/types/next";

export const metadata = { title: "Discover" };

export default async function DiscoverPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const member = await requireMember();
  const repo = await getRepository();
  const [members, all] = await Promise.all([repo.getMembers(), loadCompanySummaries(repo, { viewerId: member.userId })]);
  const query = { q: first(sp.q), filter: first(sp.filter), sector: first(sp.sector), stage: first(sp.stage), access: first(sp.access), eis: first(sp.eis), ai: first(sp.ai), sort: first(sp.sort) };
  const results = applyDiscoverQuery(all, query);
  const sectors = [...new Set(all.map((s) => s.company.sector))].sort();
  const stages = [...new Set(all.map((s) => s.company.stage))].sort();

  return (
    <>
      <PageHeader title="Discover">
        <Suspense>
          <FilterBar sectors={sectors} stages={stages} totalLabel={`${pluralise(results.length, "company", "companies")} of ${all.length} tracked`} />
        </Suspense>
      </PageHeader>
      <div className="mx-auto max-w-[1200px] px-4 pt-4">
        {results.length === 0 ? (
          <EmptyState
            title="No companies match"
            body="Try a different search or clear the filters. Companies are only added by a research run with sources."
            action={
              <LinkButton href="/discover" variant="outline" size="sm">
                Reset filters
              </LinkButton>
            }
          />
        ) : (
          <>
            <ul className="grid gap-4 md:grid-cols-2 xl:hidden">
              {results.map((s) => (
                <li key={s.company.id} className="flex">
                  <CompanyCard summary={s} members={members} currentUserId={member.userId} className="w-full" />
                </li>
              ))}
            </ul>
            <div className="hidden overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-card)] xl:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.06em] text-tertiary">
                    <th className="py-3 pl-4 font-semibold">Company</th>
                    <th className="px-2 font-semibold">Sector</th>
                    <th className="px-2 font-semibold">Stage</th>
                    <th className="px-2 font-semibold">Raise / valuation</th>
                    <th className="px-2 font-semibold">Access</th>
                    <th className="px-2 font-semibold">Family</th>
                    <th className="pr-4 text-right font-semibold">AI</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((s) => (
                    <CompanyRow key={s.company.id} summary={s} members={members} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
