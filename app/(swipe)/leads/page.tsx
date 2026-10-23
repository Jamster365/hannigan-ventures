import { PageHeader } from "@/components/navigation/page-header";
import { LeadForm, LeadList } from "@/components/swipe/leads";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";

export const metadata = { title: "Suggest a company" };

/**
 * Deals the family hears about outside the app (angel-network emails,
 * founders they meet, news) go here. Each becomes a full profile in the
 * next research session; until then everyone can see what was suggested.
 */
export default async function LeadsPage() {
  const member = await requireMember();
  const repo = await getRepository();
  const [members, leads] = await Promise.all([repo.getMembers(), repo.listLeads()]);
  const open = leads.filter((l) => l.status === "new");
  const rest = leads.filter((l) => l.status !== "new");
  return (
    <>
      <PageHeader width="max-w-[640px]" title="Suggest a company" backHref="/me" variant="back" />
      <div className="mx-auto w-full max-w-[640px] px-4 pb-10 pt-3">
        <p className="mb-3 text-[0.875rem] text-secondary">Heard of a company from an angel network, a founder or the news? Add it here and it will be researched properly, with sources, and land in everyone’s deck.</p>
        <LeadForm />
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-tertiary">Waiting for research ({open.length})</h2>
          <LeadList leads={open} members={members} currentUserId={member.userId} />
        </section>
        {rest.length ? (
          <section className="mt-6">
            <h2 className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-tertiary">Done or dismissed</h2>
            <LeadList leads={rest} members={members} currentUserId={member.userId} />
          </section>
        ) : null}
      </div>
    </>
  );
}
