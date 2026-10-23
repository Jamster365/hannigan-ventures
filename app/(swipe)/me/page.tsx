import { Briefcase, Building2, Lightbulb, ListChecks, Sparkles, Upload, CalendarDays, ChevronRight, FlaskConical, Info, LayoutGrid, Network, Settings } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/navigation/page-header";
import { PushSettings } from "@/components/push/push-settings";
import { Card } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { dataMode } from "@/lib/config";
import { getRepository } from "@/lib/data";
import { formatDateTime } from "@/lib/domain/format";

export const metadata = { title: "Profile" };

export default async function MePage() {
  const member = await requireMember();
  const repo = await getRepository();
  const [members, runs, suggestions, events, leads] = await Promise.all([repo.getMembers(), repo.listRuns(), repo.listSuggestions(), repo.listEvents(), repo.listLeads()]);
  const openLeads = leads.filter((l) => l.status === "new").length;
  const openSuggestions = suggestions.filter((s) => s.status === "proposed").length;
  const upcoming = events.filter((e) => new Date(e.startAt).getTime() > new Date().getTime()).length;
  const lastRun = runs[0];

  const groups: { title: string; items: Item[] }[] = [
    {
      title: "Your activity",
      items: [
        { href: "/decisions", label: "Your picks", sub: "Everything you’ve said yes or no to. Change your mind any time.", Icon: ListChecks },
        { href: "/taste", label: "Your taste", sub: "What the app has learned, and your preferences", Icon: Sparkles },
        { href: "/portfolio", label: "Investments", sub: "What we invested in, what is in due diligence", Icon: Briefcase },
        { href: "/leads", label: "Suggest a company", sub: openLeads ? `${openLeads} waiting for research` : "Heard of one from a network or a founder? Add it here", Icon: Lightbulb, badge: openLeads },
      ],
    },
    {
      title: "Research",
      items: [
        { href: "/research/settings", label: "Research instructions", sub: openSuggestions ? `${openSuggestions} suggestion${openSuggestions === 1 ? "" : "s"} to review` : "What the daily research looks for", Icon: FlaskConical, badge: openSuggestions },
        ...(member.role === "owner" ? [{ href: "/research/upload", label: "Upload research", sub: "Add companies researched in a Claude chat (only you see this)", Icon: Upload }] : []),
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
      <PageHeader width="max-w-[640px]" title="Profile" />
      <div className="mx-auto w-full max-w-[640px] px-4 pb-8 pt-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Avatar member={member} size="lg" />
            <div className="min-w-0">
              <p className="font-serif text-[1.125rem] font-semibold text-ink">{member.displayName}</p>
              <p className="text-[0.8125rem] text-secondary">{member.role === "owner" ? "Household owner" : "Household member"}</p>
            </div>
          </div>
          <p className="mt-3 text-[0.8125rem] text-secondary">
            A company becomes a match when two of you ({members.map((m) => m.displayName).join(", ")}) are interested in it. Your answers stay private until then.
          </p>
        </Card>
        <MenuGroup group={groups[0]} />
        <section className="mt-5">
          <h2 className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-tertiary">Notifications</h2>
          <Card className="overflow-hidden p-0">
            <PushSettings publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} available={dataMode() === "supabase"} />
          </Card>
        </section>
        {groups.slice(1).map((g) => (
          <MenuGroup key={g.title} group={g} />
        ))}
      </div>
    </>
  );
}

type Item = { href: string; label: string; sub: string; Icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>; badge?: number };

function MenuGroup({ group }: { group: { title: string; items: Item[] } }) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-tertiary">{group.title}</h2>
      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-hairline">
          {group.items.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/70">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-ink">
                  <it.Icon size={17} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-medium text-ink">{it.label}</span>
                  <span className="block truncate text-[0.75rem] text-secondary">{it.sub}</span>
                </span>
                {it.badge ? <span className="rounded-full bg-red px-2 py-0.5 text-[0.6875rem] font-semibold text-white">{it.badge}</span> : null}
                <ChevronRight size={18} className="text-tertiary" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
