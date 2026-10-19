"use client";

import { Bell, Bookmark, Building2, CalendarDays, Compass, FlaskConical, Home, Info, Network, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Wordmark } from "./logo";

const groups = [
  {
    items: [
      { href: "/", label: "Home", icon: Home, exact: true },
      { href: "/discover", label: "Discover", icon: Compass },
      { href: "/shortlist", label: "Shortlist", icon: Bookmark },
      { href: "/updates", label: "Updates", icon: Bell },
    ],
  },
  {
    title: "Research",
    items: [
      { href: "/events", label: "Events", icon: CalendarDays },
      { href: "/networks", label: "Networks", icon: Network },
      { href: "/research/settings", label: "Research instructions", icon: FlaskConical },
      { href: "/research/history", label: "Research history", icon: Building2 },
    ],
  },
  {
    title: "Household",
    items: [
      { href: "/family", label: "Family", icon: Users },
      { href: "/about", label: "Methodology", icon: Info },
      { href: "/account", label: "Account", icon: Settings },
    ],
  },
];

export function Sidebar({ unread, lastRunLabel }: { unread: number; lastRunLabel: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-hairline bg-ink-deep text-white xl:flex">
      <div className="px-5 pb-4 pt-6">
        <Wordmark dark />
      </div>
      <nav className="flex-1 overflow-y-auto px-3" aria-label="Sidebar">
        {groups.map((g, i) => (
          <div key={i} className="mb-4">
            {g.title ? <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{g.title}</p> : null}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors", active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white")}
                    >
                      <Icon size={18} aria-hidden />
                      <span className="flex-1">{item.label}</span>
                      {item.label === "Updates" && unread > 0 ? <span className="rounded-full bg-red px-1.5 text-[11px] font-semibold text-white">{unread}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-2xl bg-white/8 p-4">
        <p className="text-[12px] font-semibold text-white/90">Daily research</p>
        <p className="mt-1 text-[12px] text-white/60">{lastRunLabel ?? "No research run recorded yet"}</p>
        <Link href="/research/history" className="mt-3 inline-flex min-h-[36px] items-center rounded-full bg-white px-4 text-[13px] font-medium text-ink">
          View history
        </Link>
      </div>
    </aside>
  );
}
