"use client";

import { Bell, Bookmark, Compass, Home, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/discover", label: "Discover", icon: Compass, match: (p: string) => p.startsWith("/discover") },
  { href: "/shortlist", label: "Shortlist", icon: Bookmark, match: (p: string) => p.startsWith("/shortlist") },
  { href: "/updates", label: "Updates", icon: Bell, match: (p: string) => p.startsWith("/updates") },
  { href: "/more", label: "More", icon: Menu, match: (p: string) => ["/more", "/events", "/networks", "/family", "/research", "/about", "/account"].some((x) => p.startsWith(x)) },
];

export function BottomNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85 xl:hidden"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex h-[var(--bottom-nav-height)] max-w-[720px] items-stretch justify-around px-2">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex min-w-[44px] flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium", active ? "text-ink" : "text-tertiary hover:text-secondary")}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                  {item.label === "Updates" && unread > 0 ? <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-red ring-2 ring-surface" aria-label={`${unread} unread`} /> : null}
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
