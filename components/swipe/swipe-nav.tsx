"use client";

import { MessageCircle, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Discover", icon: Search, match: (p: string) => p === "/" },
  { href: "/matches", label: "Matches", icon: MessageCircle, match: (p: string) => p.startsWith("/matches") },
  { href: "/me", label: "Profile", icon: UserRound, match: (p: string) => ["/me", "/decisions", "/events", "/networks", "/research", "/about", "/account"].some((x) => p.startsWith(x)) },
];

/** Three-tab thumb navigation (Your picks lives under Profile) for the swipe app, at every screen width. */
export function SwipeNav({ unreadMatches }: { unreadMatches: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="z-40 shrink-0 border-t border-hairline bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85" style={{ paddingBottom: "var(--safe-bottom)" }}>
      <ul className="mx-auto flex h-[var(--bottom-nav-height)] max-w-[520px] items-stretch justify-around px-2">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn("relative flex min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium", active ? "text-ink" : "text-tertiary hover:text-secondary")}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                  {item.label === "Matches" && unreadMatches > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-red px-1 text-center text-[10px] font-semibold leading-[18px] text-white ring-2 ring-surface" aria-label={`${unreadMatches} unread`}>
                      {unreadMatches > 9 ? "9+" : unreadMatches}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
