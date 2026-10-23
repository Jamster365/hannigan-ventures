import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { CompactCompanyCard, CompanyCard, ShortlistCard } from "@/components/company/company-card";
import { EventCard } from "@/components/events/event-card";
import { Carousel } from "@/components/home/carousel";
import { StatStrip } from "@/components/home/stat-strip";
import { StoryCard } from "@/components/home/story-card";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, EmptyState, SectionHeader } from "@/components/ui/primitives";
import { ChangeRow } from "@/components/updates/change-row";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { loadCompanySummaries, partitionForHome, recentChanges, researchFreshness } from "@/lib/data/view-models";
import { formatLongDate, greeting, pluralise } from "@/lib/domain/format";

export default async function HomePage() {
  const member = await requireMember();
  const repo = await getRepository();
  const [members, summaries, stories, notifications, events, runs] = await Promise.all([
    repo.getMembers(),
    loadCompanySummaries(repo, { viewerId: member.userId }),
    repo.listHomeStories(),
    repo.listNotifications(member.userId),
    repo.listEvents(),
    repo.listRuns(),
  ]);
  const now = new Date();
  const sections = partitionForHome(summaries);
  const unread = notifications.filter((n) => !n.readAt).length;
  const importantUnread = notifications.filter((n) => !n.readAt && n.importance === "high").length;
  const upcoming = events.filter((e) => new Date(e.startAt).getTime() > now.getTime());
  const raising = summaries.filter((s) => s.currentRound?.claimedStatus === "open" || s.access.status === "closing_soon" || s.access.status === "verified_open");
  const changes = recentChanges(summaries);
  const freshness = researchFreshness(runs);
  const byId = new Map(summaries.map((s) => [s.company.id, s]));
  const newCount = sections.new.length;

  const contextLine = [newCount > 0 ? pluralise(newCount, "new opportunity", "new opportunities") : null, importantUnread > 0 ? pluralise(importantUnread, "important update") : null]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <PageHeader variant="brand" unread={unread} />
      <div className="mx-auto w-full max-w-[1200px] xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-8 xl:px-6">
        <div className="min-w-0">
          <section className="px-4 pb-2 pt-4">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-tertiary">{formatLongDate(now)}</p>
            <h1 className="mt-1 font-serif text-[1.875rem] font-semibold leading-[1.1] text-ink xl:text-[2.25rem]">
              {greeting(now)}, {member.displayName}.
            </h1>
            <p className="mt-1 text-[0.875rem] text-secondary">{contextLine ? `${contextLine}.` : "Nothing new since you last looked."}</p>
          </section>

          {freshness.stale ? (
            <div className="mx-4 mb-3 flex items-start gap-2 rounded-[14px] border border-amber/30 bg-amber-pale px-3.5 py-2.5 text-[0.8125rem] text-amber" role="status">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              <p>
                {freshness.message}{" "}
                <Link href="/research/history" className="font-semibold underline">
                  Research history
                </Link>
              </p>
            </div>
          ) : null}

          <StatStrip
            className="mt-2"
            stats={[
              { label: "Tracked", value: summaries.length, href: "/discover", icon: "companies", sub: newCount ? `+${newCount} new this week` : undefined },
              { label: "Raising", value: raising.length, href: "/discover?filter=raising", icon: "raising" },
              { label: "Shortlist", value: sections.shortlist.length, href: "/shortlist", icon: "shortlist" },
              { label: "Events", value: upcoming.length, href: "/events", icon: "events" },
            ]}
          />

          {stories.length > 0 ? (
            <section className="mt-6" aria-labelledby="highlights">
              <SectionHeader title="Today's highlights" action="See all" href="/updates" />
              <Carousel id="highlights" label="Today's highlights" cardWidth="w-[85vw] max-w-[350px] md:w-[360px]" className="mt-2.5">
                {stories.slice(0, 4).map((s) => (
                  <StoryCard key={s.id} story={s} company={s.companyId ? (byId.get(s.companyId) ?? null) : null} />
                ))}
              </Carousel>
            </section>
          ) : null}

          <section className="mt-6" aria-labelledby="new">
            <SectionHeader title="New discoveries" action="See all" href="/discover?filter=new" />
            {sections.new.length > 0 ? (
              <Carousel id="new" label="New discoveries" className="mt-2.5">
                {sections.new.map((s) => (
                  <CompanyCard key={s.company.id} summary={s} members={members} currentUserId={member.userId} className="w-full" />
                ))}
              </Carousel>
            ) : (
              <div className="mt-2.5">
                <EmptyState title="No new companies" body="Nothing new was discovered in the last seven days. Research runs every morning at 07:00 London time." />
              </div>
            )}
          </section>

          {sections.pending.length > 0 ? (
            <section className="mt-6" aria-labelledby="pending">
              <SectionHeader title="Awaiting our views" action="See all" href="/discover?filter=pending" />
              <Carousel id="pending" label="Awaiting our views" cardWidth="w-[78vw] max-w-[320px] md:w-[320px]" showDots={false} className="mt-2.5">
                {sections.pending.map((s) => (
                  <CompactCompanyCard key={s.company.id} summary={s} members={members} className="w-full" />
                ))}
              </Carousel>
            </section>
          ) : null}

          <section className="mt-6" aria-labelledby="shortlist">
            <SectionHeader title="Our shortlist" action="See all" href="/shortlist" />
            {sections.shortlist.length > 0 ? (
              <Carousel id="shortlist" label="Our shortlist" cardWidth="w-[88vw] max-w-[380px] md:w-[380px]" showDots={false} className="mt-2.5">
                {sections.shortlist.slice(0, 5).map((s) => (
                  <div key={s.company.id} className="w-full">
                    <ShortlistCard summary={s} members={members} currentUserId={member.userId} />
                  </div>
                ))}
              </Carousel>
            ) : (
              <div className="mt-2.5">
                <EmptyState title="No shortlist yet" body="A company joins the shortlist automatically when the family agrees it is Interested." />
              </div>
            )}
          </section>

          {changes.length > 0 ? (
            <section className="mt-6" aria-labelledby="changes">
              <SectionHeader title="Recently changed" action="See all" href="/updates" />
              <Card className="mx-4 mt-2.5 overflow-hidden p-0">
                <ul className="divide-y divide-hairline">
                  {changes.slice(0, 5).map((c) => (
                    <ChangeRow key={c.update.id} update={c.update} summary={c.summary} />
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}

          <section className="mt-6 xl:hidden" aria-labelledby="events">
            <SectionHeader title="Coming up" action="See all" href="/events" />
            <div className="mt-2.5 space-y-2.5 px-4">
              {upcoming.length > 0 ? upcoming.slice(0, 3).map((e) => <EventCard key={e.id} event={e} compact currentUserId={member.userId} />) : <EmptyState title="No upcoming events" body="Verified events will appear here when research finds them." />}
            </div>
          </section>
        </div>

        {/* Desktop right rail */}
        <aside className="hidden xl:block xl:pt-6">
          <Card className="p-5">
            <h2 className="font-serif text-[1.125rem] font-semibold text-ink">Today&rsquo;s key points</h2>
            {stories.length > 0 ? (
              <ol className="mt-3 space-y-3">
                {stories.slice(0, 5).map((s, i) => (
                  <li key={s.id} className="flex gap-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[0.75rem] font-semibold text-secondary tnum">{i + 1}</span>
                    <div>
                      <p className="text-[0.875rem] font-semibold leading-snug text-ink">{s.headline}</p>
                      <p className="text-[0.8125rem] text-secondary">{s.teaser}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-[0.8125rem] text-secondary">No highlights published today.</p>
            )}
          </Card>
          <Card className="mt-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-[1.125rem] font-semibold text-ink">Upcoming events</h2>
              <Link href="/events" className="text-[0.8125rem] font-medium text-blue">
                View all
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {upcoming.slice(0, 4).map((e) => (
                <EventCard key={e.id} event={e} compact currentUserId={member.userId} />
              ))}
            </div>
          </Card>
          <Card className="mt-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-[1.125rem] font-semibold text-ink">Recent activity</h2>
              <Link href="/updates" className="text-[0.8125rem] font-medium text-blue">
                View all
              </Link>
            </div>
            <ul className="mt-2 -mx-4">
              {changes.slice(0, 4).map((c) => (
                <ChangeRow key={c.update.id} update={c.update} summary={c.summary} />
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
