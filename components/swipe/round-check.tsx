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
  const [asking, setAsking] = useState(false);
  const [figures, setFigures] = useState({ raised: "", target: "", closes: "", valuation: "", scheme: "" });

  const record = (open: boolean) =>
    start(async () => {
      const parts = [
        figures.raised && figures.target ? `${figures.raised} of ${figures.target} raised` : figures.raised ? `${figures.raised} raised` : figures.target ? `target ${figures.target}` : "",
        figures.closes ? `closes ${figures.closes}` : "",
        figures.valuation ? `${figures.valuation} pre-money` : "",
        figures.scheme,
      ].filter(Boolean);
      const res = await recordRoundCheckAction({ companyId: card.company.id, slug: card.company.slug, open, details: parts.length ? `On the page: ${parts.join(", ")}` : undefined });
      setMessage(res.ok ? (open ? "Thanks. Marked as open for the next 48 hours." : "Thanks. Marked as closed.") : res.error);
      if (res.ok) setAsking(false);
    });

  const field = "min-h-[44px] w-full rounded-[10px] border border-hairline-strong bg-page px-2 text-[0.875rem] text-ink";

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
        <button type="button" disabled={pending} onClick={() => setAsking(true)} className="inline-flex min-h-[44px] items-center rounded-full bg-ink px-4 text-[0.8125rem] font-medium text-white disabled:opacity-60">
          I checked: it’s open
        </button>
        <button type="button" disabled={pending} onClick={() => record(false)} className="inline-flex min-h-[44px] items-center rounded-full px-3 text-[0.8125rem] font-medium text-secondary disabled:opacity-60">
          It’s closed
        </button>
      </div>
      {asking ? (
        <div className="mt-3 space-y-2">
          <p className="text-[0.8125rem] text-secondary">If the page shows figures, note them for the family (all optional):</p>
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Amount raised" placeholder="Raised, e.g. £412k" value={figures.raised} onChange={(e) => setFigures({ ...figures, raised: e.target.value })} className={field} />
            <input aria-label="Target" placeholder="Target, e.g. £500k" value={figures.target} onChange={(e) => setFigures({ ...figures, target: e.target.value })} className={field} />
            <input aria-label="Closes" placeholder="Closes, e.g. 3 Nov" value={figures.closes} onChange={(e) => setFigures({ ...figures, closes: e.target.value })} className={field} />
            <input aria-label="Pre-money valuation" placeholder="Valuation, e.g. £3.2m" value={figures.valuation} onChange={(e) => setFigures({ ...figures, valuation: e.target.value })} className={field} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["SEIS", "EIS", "SEIS and EIS", "No tax relief shown"].map((s) => (
              <button key={s} type="button" aria-pressed={figures.scheme === s} onClick={() => setFigures({ ...figures, scheme: figures.scheme === s ? "" : s })} className={figures.scheme === s ? "min-h-[44px] rounded-full border border-ink bg-ink px-3 text-[0.8125rem] font-medium text-white" : "min-h-[44px] rounded-full border border-hairline-strong px-3 text-[0.8125rem] font-medium text-ink"}>
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={() => record(true)} className="inline-flex min-h-[44px] items-center rounded-full bg-ink px-4 text-[0.8125rem] font-medium text-white disabled:opacity-60">
              Save: it’s open
            </button>
            <button type="button" onClick={() => setAsking(false)} className="min-h-[44px] px-2 text-[0.8125rem] font-medium text-secondary">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="mt-2 text-[0.75rem] text-secondary">
          {message}
        </p>
      ) : null}
    </div>
  );
}
