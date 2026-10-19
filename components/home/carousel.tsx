"use client";

import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const STORAGE_PREFIX = "dr:carousel:";

/**
 * Horizontal scroll-snap carousel.
 *  - One prominent card with the next card peeking on phones.
 *  - Scroll position persisted in sessionStorage so Back restores it.
 *  - No auto-scroll, no motion while reading.
 */
export function Carousel({ id, children, label, cardWidth = "w-[85vw] max-w-[350px] md:w-[360px]", showDots = true, className }: { id: string; children: ReactNode; label: string; cardWidth?: string; showDots?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      const saved = sessionStorage.getItem(STORAGE_PREFIX + id);
      if (saved) el.scrollLeft = Number(saved);
    } catch {
      /* storage unavailable */
    }
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          sessionStorage.setItem(STORAGE_PREFIX + id, String(el.scrollLeft));
        } catch {
          /* ignore */
        }
        const first = el.firstElementChild as HTMLElement | null;
        if (first) {
          const step = first.offsetWidth + 12;
          setIndex(Math.min(items.length - 1, Math.max(0, Math.round(el.scrollLeft / step))));
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [id, items.length]);

  return (
    <div className={className}>
      <div ref={ref} className="carousel py-1" role="region" aria-label={label} aria-roledescription="carousel">
        {items.map((child, i) => (
          <div key={i} className={cn(cardWidth, "flex")} role="group" aria-label={`${i + 1} of ${items.length}`}>
            {child}
          </div>
        ))}
        <div className="w-1 shrink-0" aria-hidden />
      </div>
      {showDots && items.length > 1 ? (
        <div className="mt-1 flex justify-center gap-1.5" aria-hidden>
          {items.map((_, i) => (
            <span key={i} className={cn("h-1.5 w-1.5 rounded-full transition-colors", i === index ? "bg-ink" : "bg-hairline-strong")} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
