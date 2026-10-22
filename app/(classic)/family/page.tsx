import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, Pill } from "@/components/ui/primitives";
import { ChangeRow } from "@/components/updates/change-row";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { loadCompanySummaries } from "@/lib/data/view-models";
import { formatDate } from "@/lib/domain/format";

export const metadata = { title: "Family" };

export default async function FamilyPage() {
  const member = await requireMember();
  const repo = await getRepository();
  const [members, summaries, bundles] = await Promise.all([repo.getMembers(), loadCompanySummaries(repo), repo.listCompanies()]);
  const stats = members.map((m) => {
    const votes = summaries.flatMap((s) => s.votes.filter((v) => v.userId === m.userId));
    const comments = bundles.reduce((n, b) => n + b.comments.filter((c) => c.authorUserId === m.userId && !c.deletedAt).length, 0);
    return { m, interested: votes.filter((v) => v.vote === "interested").length, reviewed: votes.length, comments };
  });
  const familyChanges = summaries
    .flatMap((s) => s.latestUpdate && s.latestUpdate.updateType === "family" ? [{ update: s.latestUpdate, summary: s }] : [])
    .sort((a, b) => b.update.effectiveAt.localeCompare(a.update.effectiveAt));

  return (
    <>
      <PageHeader title="Family" backHref="/more" variant="back" />
      <div className="mx-auto max-w-[900px] px-4 pt-4">
        <ul className="grid gap-3 sm:grid-cols-3">
          {stats.map(({ m, interested, reviewed, comments }) => (
            <li key={m.userId}>
              <Card className="flex h-full flex-col items-center p-4 text-center">
                <Avatar member={m} size="lg" />
                <p className="mt-2 font-serif text-[18px] font-semibold text-ink">
                  {m.displayName}
                  {m.userId === member.userId ? <span className="text-[12px] font-sans font-normal text-tertiary"> (you)</span> : null}
                </p>
                <Pill tone={m.role === "owner" ? "blue" : "neutral"} className="mt-1">
                  {m.role === "owner" ? "Owner" : "Member"}
                </Pill>
                <dl className="mt-3 grid w-full grid-cols-3 gap-1 text-center">
                  <div>
                    <dt className="text-[11px] text-tertiary">Reviewed</dt>
                    <dd className="font-serif text-[18px] font-semibold text-ink tnum">{reviewed}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-tertiary">Interested</dt>
                    <dd className="font-serif text-[18px] font-semibold text-ink tnum">{interested}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-tertiary">Comments</dt>
                    <dd className="font-serif text-[18px] font-semibold text-ink tnum">{comments}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] text-tertiary">Joined {formatDate(m.joinedAt)}</p>
              </Card>
            </li>
          ))}
        </ul>
        <section className="mt-6">
          <h2 className="mb-2 font-serif text-[18px] font-semibold text-ink">Shortlist rule</h2>
          <Card className="p-4 text-[14px] leading-relaxed text-text">
            A company is <span className="font-semibold">Shortlisted</span> when at least 2 of {members.length} members mark it Interested. It is <span className="font-semibold">Passed</span> when 2 mark it Pass. Otherwise it is <span className="font-semibold">Awaiting views</span> once anyone has voted. Votes mean willingness to investigate, not a commitment to invest. The AI research rating is shown separately and is never averaged with family scores.
          </Card>
        </section>
        <section className="mt-6">
          <h2 className="mb-2 font-serif text-[18px] font-semibold text-ink">Recent family activity</h2>
          <Card className="overflow-hidden p-0">
            {familyChanges.length ? (
              <ul className="divide-y divide-hairline">
                {familyChanges.map((c) => (
                  <ChangeRow key={c.update.id} update={c.update} summary={c.summary} />
                ))}
              </ul>
            ) : (
              <p className="p-4 text-[13px] text-secondary">No family activity recorded yet.</p>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
