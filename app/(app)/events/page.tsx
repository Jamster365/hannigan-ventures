import { EventCard } from "@/components/events/event-card";
import { PageHeader } from "@/components/navigation/page-header";
import { EmptyState } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";

export const metadata = { title: "Events" };

export default async function EventsPage() {
  const member = await requireMember();
  const repo = await getRepository();
  const events = await repo.listEvents();
  const now = new Date().getTime();
  const upcoming = events.filter((e) => new Date(e.startAt).getTime() >= now);
  const past = events.filter((e) => new Date(e.startAt).getTime() < now).reverse();
  return (
    <>
      <PageHeader title="Events" backHref="/more" variant="back" />
      <div className="mx-auto max-w-[900px] px-4 pt-4">
        <p className="mb-3 text-[13px] text-secondary">Founder and investor events found by research, in London local time. Registration status is shown as of the date it was checked; unverified listings say so.</p>
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming events" body="Verified events will appear here when research finds them." />
        ) : (
          <ul className="space-y-3">
            {upcoming.map((e) => (
              <li key={e.id}>
                <EventCard event={e} currentUserId={member.userId} />
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-2 font-serif text-[18px] font-semibold text-ink">Archive</h2>
            <ul className="space-y-2">
              {past.map((e) => (
                <li key={e.id}>
                  <EventCard event={e} compact />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
