"use client";

import { Minus, Plus } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { setVoteAction } from "@/lib/actions/family";
import type { Vote, VoteValue } from "@/lib/domain/types";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const OPTIONS: { value: VoteValue; label: string; cls: string }[] = [
  { value: "interested", label: "Interested", cls: "data-[on=true]:bg-green data-[on=true]:text-white data-[on=true]:border-green" },
  { value: "unsure", label: "Unsure", cls: "data-[on=true]:bg-amber data-[on=true]:text-white data-[on=true]:border-amber" },
  { value: "pass", label: "Pass", cls: "data-[on=true]:bg-red data-[on=true]:text-white data-[on=true]:border-red" },
];

/**
 * The current member's own vote. Optimistic update with rollback and an
 * inline message when the family stage changes as a result.
 */
export function VotePanel({ companyId, slug, existing }: { companyId: string; slug: string; existing: Vote | null }) {
  const [pending, start] = useTransition();
  const [vote, setVote] = useOptimistic<VoteValue | null>(existing?.vote ?? null);
  const [score, setScore] = useState<number | null>(existing?.score ?? null);
  const [message, setMessage] = useState<{ tone: "green" | "amber" | "red"; text: string } | null>(null);

  const submit = (nextVote: VoteValue | null, nextScore: number | null | undefined) => {
    start(async () => {
      setVote(nextVote);
      const res = await setVoteAction({ companyId, slug, vote: nextVote, score: nextScore });
      if (!res.ok) {
        setMessage({ tone: "red", text: res.error });
        return;
      }
      if (res.data?.promoted) setMessage({ tone: "green", text: "Promoted to the family shortlist." });
      else if (res.data?.demoted) setMessage({ tone: "amber", text: "Removed from the shortlist." });
      else setMessage(null);
    });
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-tertiary">Your view</p>
      <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Your vote">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={vote === o.value}
            data-on={vote === o.value}
            disabled={pending}
            onClick={() => submit(vote === o.value ? null : o.value, score)}
            className={cn("min-h-[44px] rounded-full border border-hairline-strong bg-surface text-[0.875rem] font-medium text-ink transition-colors hover:bg-surface-muted", o.cls)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.8125rem] font-medium text-ink">Optional score</p>
          <p className="text-[0.75rem] text-secondary">1–10, independent of your vote</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Lower score" disabled={pending || !vote} onClick={() => { const n = Math.max(1, (score ?? 6) - 1); setScore(n); submit(vote, n); }} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline-strong text-ink disabled:opacity-40">
            <Minus size={16} />
          </button>
          <span className="w-12 text-center font-serif text-[1.375rem] font-semibold text-ink tnum" aria-live="polite">
            {score ?? "–"}
          </span>
          <button type="button" aria-label="Raise score" disabled={pending || !vote} onClick={() => { const n = Math.min(10, (score ?? 5) + 1); setScore(n); submit(vote, n); }} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline-strong text-ink disabled:opacity-40">
            <Plus size={16} />
          </button>
        </div>
      </div>
      {score !== null && vote ? (
        <Button type="button" variant="ghost" size="sm" className="mt-1 -ml-2 text-secondary" disabled={pending} onClick={() => { setScore(null); submit(vote, null); }}>
          Clear score
        </Button>
      ) : null}
      {!vote ? <p className="mt-2 text-[0.75rem] text-tertiary">Cast a vote first to add a score.</p> : null}
      {message ? (
        <p role="status" className={cn("mt-3 rounded-[12px] px-3 py-2 text-[0.8125rem]", message.tone === "green" && "bg-green-pale text-green", message.tone === "amber" && "bg-amber-pale text-amber", message.tone === "red" && "bg-red-pale text-red")}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
