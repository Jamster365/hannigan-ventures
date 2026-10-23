import { ListChecks } from "lucide-react";
import { PageHeader } from "@/components/navigation/page-header";
import { DecisionItem } from "@/components/swipe/decisions-list";
import { EmptyState } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { decisionsFor } from "@/lib/domain/swipe";

export const metadata = { title: "Decisions" };

export default async function DecisionsPage() {
  const member = await requireMember();
  const repo = await getRepository();
  const [members, bundles] = await Promise.all([repo.getMembers(), repo.listCompanies()]);
  const { decided, watching } = decisionsFor(bundles, member.userId, { memberCount: members.length });
  const interested = decided.filter((d) => d.vote === "interested");
  const notInterested = decided.filter((d) => d.vote === "pass");

  return (
    <>
      <PageHeader title="Decisions" />
      <div className="mx-auto w-full max-w-[640px] pb-8">
        <p className="px-4 pt-3 text-[13px] text-secondary">Every company you’ve said you’re interested or not interested in. Change your mind any time; only you can see your picks until there’s a match.</p>
        {decided.length === 0 && watching.length === 0 ? (
          <div className="pt-8">
            <EmptyState icon={<ListChecks size={28} />} title="Nothing decided yet" body="Companies you decide on in Discover appear here." />
          </div>
        ) : null}
        <Group title="Interested" count={interested.length} rows={interested} />
        <Group title="Not interested" count={notInterested.length} rows={notInterested} />
        <Group title="Watch list" count={watching.length} rows={watching} note="Rounds that have closed. They return to your deck when research finds a new round." />
      </div>
    </>
  );
}

function Group({ title, count, rows, note }: { title: string; count: number; rows: Parameters<typeof DecisionItem>[0]["row"][]; note?: string }) {
  if (!rows.length) return null;
  return (
    <section className="mt-5" aria-label={title}>
      <h2 className="px-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-tertiary">
        {title} · {count}
      </h2>
      {note ? <p className="px-4 pt-1 text-[12px] text-tertiary">{note}</p> : null}
      <ul className="mt-1 divide-y divide-hairline">
        {rows.map((r) => (
          <DecisionItem key={r.company.id} row={r} />
        ))}
      </ul>
    </section>
  );
}
