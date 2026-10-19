"use client";

import { Bookmark } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toggleBookmarkAction } from "@/lib/actions/family";
import { cn } from "@/lib/utils";

/**
 * Personal read-later flag. Separate from the Interested vote and never
 * affects the family stage. Stops propagation so it never navigates the card.
 */
export function BookmarkButton({ companyId, slug, bookmarked, variant = "overlay", className }: { companyId: string; slug: string; bookmarked: boolean; variant?: "overlay" | "plain"; className?: string }) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(bookmarked);
  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? "Remove bookmark" : "Bookmark for later"}
      title={optimistic ? "Bookmarked" : "Bookmark for later"}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          setOptimistic(!optimistic);
          await toggleBookmarkAction({ companyId, slug });
        });
      }}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors",
        variant === "overlay" ? "bg-white/90 text-ink shadow-sm backdrop-blur hover:bg-white" : "text-ink hover:bg-surface-muted",
        className,
      )}
    >
      <Bookmark size={18} className={cn(optimistic && "fill-current")} aria-hidden />
    </button>
  );
}
