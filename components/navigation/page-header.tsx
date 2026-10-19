import { ArrowLeft, Bell, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Wordmark } from "./logo";

/**
 * Sticky top bar. Three shapes:
 *  - brand (Home): wordmark + search + notifications
 *  - title: large serif page title with optional actions
 *  - back: back chevron + centred title + actions (company pages)
 */
export function PageHeader({
  variant = "title",
  title,
  backHref,
  actions,
  unread = 0,
  className,
  children,
}: {
  variant?: "brand" | "title" | "back";
  title?: string;
  backHref?: string;
  actions?: ReactNode;
  unread?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={cn("sticky top-0 z-30 border-b border-hairline/70 bg-page/92 backdrop-blur supports-[backdrop-filter]:bg-page/80", className)}>
      <div className="mx-auto flex min-h-[56px] max-w-[1200px] items-center gap-2 px-4">
        {variant === "back" ? (
          <>
            <BackLink href={backHref ?? "/"} />
            <h1 className="min-w-0 flex-1 truncate text-center font-serif text-[18px] font-semibold text-ink">{title}</h1>
            <div className="flex min-w-[44px] items-center justify-end gap-1">{actions}</div>
          </>
        ) : variant === "brand" ? (
          <>
            <Link href="/" className="min-w-0 flex-1 xl:hidden" aria-label="Home">
              <Wordmark />
            </Link>
            <Link href="/discover?focus=search" className="hidden min-w-0 flex-1 items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2.5 text-[14px] text-tertiary xl:flex">
              <Search size={16} aria-hidden />
              Search companies, sectors, founders…
            </Link>
            <Link href="/discover?focus=search" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface-muted xl:hidden" aria-label="Search">
              <Search size={21} />
            </Link>
            <Link href="/updates" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface-muted" aria-label={unread ? `Updates, ${unread} unread` : "Updates"}>
              <Bell size={21} />
              {unread > 0 ? <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-red ring-2 ring-page" /> : null}
            </Link>
            {actions}
          </>
        ) : (
          <>
            <h1 className="min-w-0 flex-1 truncate font-serif text-[24px] font-semibold text-ink">{title}</h1>
            <div className="flex items-center gap-1">{actions}</div>
          </>
        )}
      </div>
      {children}
    </header>
  );
}

export function BackLink({ href, className }: { href: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface-muted", className)} aria-label="Back">
      <ArrowLeft size={22} />
    </Link>
  );
}
