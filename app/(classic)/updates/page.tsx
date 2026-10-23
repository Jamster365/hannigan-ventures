import { Bell, CalendarClock, CircleCheck, Coins, FlaskConical, MessageSquare, ShieldAlert, Sparkles, Star, Users, X } from "lucide-react";
import Link from "next/link";
import { CompanyArtwork } from "@/components/company/company-artwork";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, EmptyState } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { loadCompanySummaries } from "@/lib/data/view-models";
import { formatDate, relativeTime, londonDate } from "@/lib/domain/format";
import type { Notification, NotificationType } from "@/lib/domain/types";
import { first, type SearchParams } from "@/lib/types/next";
import { cn } from "@/lib/utils";
import { MarkAllRead } from "./mark-all-read";
import { UpdatesTabs } from "./updates-tabs";

export const metadata = { title: "Updates" };

const familyTypes: NotificationType[] = ["shortlist_promoted", "shortlist_demoted", "comment", "vote_changed", "research_applied"];

const iconFor: Record<NotificationType, { Icon: typeof Bell; cls: string }> = {
  round_confirmed: { Icon: Coins, cls: "bg-green-pale text-green" },
  round_closed: { Icon: X, cls: "bg-red-pale text-red" },
  valuation_changed: { Icon: Coins, cls: "bg-amber-pale text-amber" },
  milestone: { Icon: Sparkles, cls: "bg-blue-pale text-blue" },
  deadline: { Icon: CalendarClock, cls: "bg-amber-pale text-amber" },
  risk: { Icon: ShieldAlert, cls: "bg-red-pale text-red" },
  access_changed: { Icon: CircleCheck, cls: "bg-green-pale text-green" },
  new_company: { Icon: Sparkles, cls: "bg-violet-pale text-violet" },
  shortlist_promoted: { Icon: Star, cls: "bg-green-pale text-green" },
  shortlist_demoted: { Icon: Star, cls: "bg-amber-pale text-amber" },
  comment: { Icon: MessageSquare, cls: "bg-blue-pale text-blue" },
  vote_changed: { Icon: Users, cls: "bg-amber-pale text-amber" },
  research_applied: { Icon: FlaskConical, cls: "bg-violet-pale text-violet" },
  research_failed: { Icon: ShieldAlert, cls: "bg-red-pale text-red" },
};

function groupLabel(iso: string): string {
  const d = londonDate(new Date(iso));
  const today = londonDate(new Date());
  const yesterday = londonDate(new Date(Date.now() - 86_400_000));
  if (d === today) return "Today";
  if (d === yesterday) return "Yesterday";
  return formatDate(iso);
}

export default async function UpdatesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = first(sp.tab) ?? "all";
  const member = await requireMember();
  const repo = await getRepository();
  const [notifications, summaries] = await Promise.all([repo.listNotifications(member.userId), loadCompanySummaries(repo, { viewerId: member.userId })]);
  const byId = new Map(summaries.map((s) => [s.company.id, s]));
  const filtered = notifications.filter((n) => (tab === "all" ? true : tab === "family" ? familyTypes.includes(n.notificationType) : !familyTypes.includes(n.notificationType)));
  const unread = notifications.filter((n) => !n.readAt).length;

  const groups: { label: string; items: Notification[] }[] = [];
  for (const n of filtered) {
    const label = groupLabel(n.createdAt);
    const g = groups.at(-1);
    if (g && g.label === label) g.items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <>
      <PageHeader title="Updates" actions={unread > 0 ? <MarkAllRead /> : null}>
        <UpdatesTabs active={tab} counts={{ all: notifications.length, company: notifications.filter((n) => !familyTypes.includes(n.notificationType)).length, family: notifications.filter((n) => familyTypes.includes(n.notificationType)).length }} />
      </PageHeader>
      <div className="mx-auto max-w-[900px] px-4 pt-4">
        <p className="mb-3 text-[13px] text-secondary">Important developments only. Routine daily re-checks and passive views never appear here.</p>
        {groups.length === 0 ? (
          <EmptyState title="No updates" body="Material company developments and meaningful family activity will appear here." />
        ) : (
          groups.map((g) => (
            <section key={g.label} className="mb-5">
              <h2 className="mb-2 font-serif text-[18px] font-semibold text-ink">{g.label}</h2>
              <Card className="overflow-hidden p-0">
                <ul className="divide-y divide-hairline">
                  {g.items.map((n) => {
                    const { Icon, cls } = iconFor[n.notificationType];
                    const s = n.companyId ? byId.get(n.companyId) : null;
                    return (
                      <li key={n.id}>
                        <Link href={n.href} className={cn("flex gap-3 px-4 py-3 hover:bg-surface-muted/70", !n.readAt && "bg-blue-pale/30")}>
                          <span className={cn("mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full", cls)}>
                            <Icon size={16} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-2">
                              <span className={cn("truncate text-[14px] text-ink", !n.readAt ? "font-semibold" : "font-medium")}>{n.title}</span>
                              <span className="ml-auto shrink-0 text-[11px] text-tertiary">{relativeTime(n.createdAt)}</span>
                            </span>
                            <span className="mt-0.5 block text-[13px] text-secondary clamp-2">{n.body}</span>
                            {!n.readAt ? <span className="sr-only">Unread</span> : null}
                          </span>
                          {s ? (
                            <span className="hidden h-11 w-11 shrink-0 overflow-hidden rounded-[10px] bg-ink sm:block">
                              <CompanyArtwork company={s.company} media={s.primaryMedia} logo={s.logoMedia} variant="thumb" />
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))
        )}
      </div>
    </>
  );
}
