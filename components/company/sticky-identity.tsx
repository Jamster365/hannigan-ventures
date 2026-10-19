"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Collapsing company header. The compact row (back · name · actions) is hidden
 * while the full identity block above is in view, and appears once the user
 * scrolls past it, so the name and tabs stay reachable on every tab.
 */
export function StickyIdentity({ compact, tabs }: { compact: ReactNode; tabs: ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { rootMargin: "-1px 0px 0px 0px", threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px w-full" />
      <div className={cn("sticky top-0 z-30 border-b border-hairline/70 bg-page/92 backdrop-blur supports-[backdrop-filter]:bg-page/80", stuck && "shadow-[0_1px_0_rgba(20,32,51,0.04)]")}>
        <div className={cn("mx-auto max-w-[1200px] overflow-hidden transition-[max-height,opacity] duration-200", stuck ? "max-h-[56px] opacity-100" : "max-h-0 opacity-0")} aria-hidden={!stuck}>
          {compact}
        </div>
        <div className="mx-auto max-w-[1200px]">{tabs}</div>
      </div>
    </>
  );
}
