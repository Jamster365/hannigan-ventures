"use client";

import { ExternalLink } from "lucide-react";
import { useState, useTransition } from "react";
import { recordRoundCheckAction } from "@/lib/actions/swipe";
import type { SwipeCard } from "@/lib/domain/swipe";

/**
 * Crowdfunding rounds: research can't read Crowdcube, Seedrs or Republic
 * pages, so the round shows as reported until one of the family opens the
 * page and says whether it is live.
 */
export function RoundCheck({ card }: { card: SwipeCard }) {
  const platform = card.platform!;
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const record = (open: boolean) =>
    start(async () => {
      const res = await recordRoundCheckAction({ companyId: card.company.id, slug: card.company.slug, open });
      setMessage(res.ok ? (open ? "Thanks. Marked as open for the next 48 hours." : "Thanks. Marked as closed.") : res.error);
    });

  return (
    <div className="mt-3 rounded-[14px] border border-hairline bg-page px-3.5 py-3">
      <p className="text-[0.875rem] leading-relaxed text-secondary">
        {platform.name} pages can’t be read automatically, so this round stays “reported” until one of us checks the page. If you open it and the round is live, say so here.
      </p>
      {platform.checkedBy ? <p className="mt-1.5 text-[0.8125rem] font-medium text-ink">{platform.checkedBy}</p> : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {platform.url ? (
          <a href={platform.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-hairline-strong px-4 text-[0.8125rem] font-medium text-ink">
            Open the page <ExternalLink size={13} aria-hidden />
          </a>
        ) : null}
        <button type="button" disabled={pending} onClick={() => record(true)} className="inline-flex min-h-[40px] items-center rounded-full bg-ink px-4 text-[0.8125rem] font-medium text-white disabled:opacity-60">
          I checked: it’s open
        </button>
        <button type="button" disabled={pending} onClick={() => record(false)} className="inline-flex min-h-[40px] items-center rounded-full px-3 text-[0.8125rem] font-medium text-secondary disabled:opacity-60">
          It’s closed
        </button>
      </div>
      {message ? (
        <p role="status" className="mt-2 text-[0.75rem] text-secondary">
          {message}
        </p>
      ) : null}
    </div>
  );
}
