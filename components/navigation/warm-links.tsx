"use client";

import type { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const MAX_PER_PAGE = 40;
const SKIP = /^\/(api|auth)\b/;

/**
 * Greedy prefetch: once a page has rendered, fully prefetch (data included)
 * every in-app link inside <main>, in document order, so the cards at the top
 * (Today's highlights, New discoveries) are ready first, including cards
 * scrolled off-screen in carousels, which <Link> alone would not prefetch.
 * A company page is a few tens of KB held in memory, so this is cheap for a
 * three-person app. Skipped when the device asks to save data.
 */
export function WarmLinks() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    let cancelled = false;
    const warm = () => {
      if (cancelled) return;
      const hrefs = new Set<string>();
      for (const a of document.querySelectorAll<HTMLAnchorElement>("main a[href^='/']")) {
        const href = a.getAttribute("href");
        if (href && !SKIP.test(href) && href !== pathname) hrefs.add(href);
        if (hrefs.size >= MAX_PER_PAGE) break;
      }
      for (const href of hrefs) router.prefetch(href, { kind: "full" as PrefetchKind });
    };
    // Let the visible page finish first, then warm in the background.
    const timer = window.setTimeout(warm, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pathname, router]);

  return null;
}
