import { ShortlistCard } from "@/components/company/company-card";
import { PageHeader } from "@/components/navigation/page-header";
import { EmptyState, LinkButton } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { loadCompanySummaries } from "@/lib/data/view-models";
import { shortlistRank } from "@/lib/domain/summaries";
import { first, type SearchParams } from "@/lib/types/next";
import { ShortlistSort } from "./shortlist-sort";

export const metadata = { title: "Shortlist" };

export default async function ShortlistPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const sort = first(sp.sort) ?? "priority";
  const member = await requireMember();
  const repo = await getRepository();
  const [members, all] = await Promise.all([repo.getMembers(), loadCompanySummaries(repo, { viewerId: member.userId })]);
  const list = all.filter((s) => s.familyStage === "shortlisted");
  if (sort === "alpha") list.sort((a, b) => a.company.name.localeCompare(b.company.name));
  else if (sort === "recent") list.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  else list.sort((a, b) => shortlistRank(b) - shortlistRank(a));

  return (
    <>
      <PageHeader title="Shortlist" actions={<ShortlistSort value={sort} />} />
      <div className="mx-auto max-w-[900px] px-4 pt-4">
        <p className="mb-3 text-[0.8125rem] text-secondary">Companies where at least 2 of {members.length} members are Interested. The list updates the moment a vote changes; nothing is added or removed by hand.</p>
        {list.length === 0 ? (
          <EmptyState
            title="No shortlist yet"
            body="When two members mark a company Interested it appears here automatically."
            action={
              <LinkButton href="/discover?filter=pending" variant="outline" size="sm">
                See companies awaiting views
              </LinkButton>
            }
          />
        ) : (
          <ul className="space-y-3">
            {list.map((s) => (
              <li key={s.company.id}>
                <ShortlistCard summary={s} members={members} currentUserId={member.userId} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
