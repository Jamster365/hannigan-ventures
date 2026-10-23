import { Building2, CalendarDays, ChevronRight, FlaskConical, Info, LayoutGrid, Network, Settings } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/navigation/page-header";
import { PushSettings } from "@/components/push/push-settings";
import { Card } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { dataMode } from "@/lib/config";
import { getRepository } from "@/lib/data";
import { formatDateTime } from "@/lib/domain/format";

export const metadata = { title: "Me" };

export default async function MePage() {
  const member = await requireMember();
  const repo = await getRepository();
  const [members, runs, suggestions, events] = await Promise.all([repo.getMembers(), repo.listRuns(), repo.listSuggestions(), repo.listEvents()]);
  const openSuggestions = suggestions.filter((s) => s.status === "proposed").length;
  const upcoming = events.filter((e) => new Date(e.startAt).getTime() > new Date().getTime()).length;
  const lastRun = runs[0];

  const groups = [
    {
      title: "Research",
      items: [
        { href: "/research/settings", label: "Research instructions", sub: openSuggestions ? `${openSuggestions} suggestion${openSuggestions === 1 ? "" : "s"} to review` : "What the daily research looks for", Icon: FlaskConical, badge: openSuggestions },
        { href: "/research/history", label: "Research history", sub: lastRun ? `Last run ${formatDateTime(lastRun.startedAt)} · ${lastRun.status.replace("_", " ")}` : "No runs yet", Icon: Building2 },
        { href: "/events", label: "Events", sub: `${upcoming} upcoming`, Icon: CalendarDays },
        { href: "/networks", label: "Angel networks", sub: "Ways to get into deals", Icon: Network },
      ],
    },
    {
      title: "Household",
      items: [
        { href: "/about", label: "How it works", sub: "Matches, research and scores", Icon: Info },
        { href: "/account", label: "Account", sub: member.role === "owner" ? "Profile, invitations, sign out" : "Profile and sign out", Icon: Settings },
      ],
    },
    {
      title: "App style",
      items: [{ href: "/home", label: "Classic app", sub: "The earlier version: Home feed, filters and seven-tab profiles", Icon: LayoutGrid }],
    },
  ];

  return (
    <>
      <PageHeader title="Me" />
      <div className="mx-auto w-full max-w-[640px] px-4 pb-8 pt-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Avatar member={member} size="lg" />
            <div className="min-w-0">
              <p className="font-serif text-[18px] font-semibold text-ink">{member.displayName}</p>
              <p className="text-[13px] text-secondary">{member.role === "owner" ? "Household owner" : "Household member"}</p>
            </div>
          </div>
          <p className="mt-3 text-[13px] text-secondary">
            A company becomes a match when two of you ({members.map((m) => m.displayName).join(", ")}) tick it. Your ticks and crosses stay private until then.
          </p>
        </Card>
        <section className="mt-5">
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-tertiary">Notifications</h2>
          <Card className="overflow-hidden p-0">
            <PushSettings publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} available={dataMode() === "supabase"} />
          </Card>
        </section>
        {groups.map((g) => (
          <section key={g.title} className="mt-5">
            <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-tertiary">{g.title}</h2>
            <Card className="overflow-hidden p-0">
              <ul className="divide-y divide-hairline">
                {g.items.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/70">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-ink">
                        <it.Icon size={17} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-medium text-ink">{it.label}</span>
                        <span className="block truncate text-[12px] text-secondary">{it.sub}</span>
                      </span>
                      {"badge" in it && it.badge ? <span className="rounded-full bg-red px-2 py-0.5 text-[11px] font-semibold text-white">{it.badge}</span> : null}
                      <ChevronRight size={18} className="text-tertiary" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))}
      </div>
    </>
  );
}
