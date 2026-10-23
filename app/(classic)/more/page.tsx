import { Building2, CalendarDays, ChevronRight, FlaskConical, Heart, Info, Network, Settings, Users } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/navigation/page-header";
import { Card } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { formatDateTime } from "@/lib/domain/format";

export const metadata = { title: "More" };

export default async function MorePage() {
  const member = await requireMember();
  const repo = await getRepository();
  const [runs, suggestions, events] = await Promise.all([repo.listRuns(), repo.listSuggestions(), repo.listEvents()]);
  const openSuggestions = suggestions.filter((s) => s.status === "proposed").length;
  const upcoming = events.filter((e) => new Date(e.startAt).getTime() > new Date().getTime()).length;
  const lastRun = runs[0];

  const groups = [
    {
      title: "Research",
      items: [
        { href: "/events", label: "Events", sub: `${upcoming} upcoming`, Icon: CalendarDays },
        { href: "/networks", label: "Angel networks", sub: "Access routes directory", Icon: Network },
        { href: "/research/settings", label: "Research instructions", sub: openSuggestions ? `${openSuggestions} suggestion${openSuggestions === 1 ? "" : "s"} to review` : "Prompt, preferences, history", Icon: FlaskConical, badge: openSuggestions },
        { href: "/research/history", label: "Research history", sub: lastRun ? `Last run ${formatDateTime(lastRun.startedAt)} · ${lastRun.status.replace("_", " ")}` : "No runs yet", Icon: Building2 },
      ],
    },
    {
      title: "Household",
      items: [
        { href: "/family", label: "Family", sub: "Members and recent activity", Icon: Users },
        { href: "/about", label: "About & methodology", sub: "How research and scores work", Icon: Info },
        { href: "/account", label: "Account", sub: member.role === "owner" ? "Profile, invitations, sign out" : "Profile and sign out", Icon: Settings },
      ],
    },
    {
      title: "App style",
      items: [{ href: "/", label: "Swipe app", sub: "Back to the deck and match chats", Icon: Heart }],
    },
  ];

  return (
    <>
      <PageHeader title="More" />
      <div className="mx-auto max-w-[720px] px-4 pt-4">
        <Card className="flex items-center gap-3 p-4">
          <Avatar member={member} size="lg" />
          <div className="min-w-0">
            <p className="font-serif text-[18px] font-semibold text-ink">{member.displayName}</p>
            <p className="text-[13px] text-secondary">{member.role === "owner" ? "Household owner" : "Household member"}</p>
          </div>
        </Card>
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
