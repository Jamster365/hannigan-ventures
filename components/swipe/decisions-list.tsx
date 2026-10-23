"use client";

import { Check, MessageSquarePlus, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { CompanyArtwork } from "@/components/company/company-artwork";
import { saveReasonAction, swipeAction, undoSwipeAction } from "@/lib/actions/swipe";
import type { DecisionRow } from "@/lib/domain/swipe";
import { cn } from "@/lib/utils";

/**
 * One company you have decided on (or are watching), with buttons to change
 * your mind: tick, cross, or put it back in your deck. Changes save at once.
 */
export function DecisionItem({ row }: { row: DecisionRow }) {
  const [vote, setVote] = useState(row.vote);
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState(row.note ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const [pending, start] = useTransition();
  const { company } = row;

  const change = (next: "interested" | "pass" | null) => {
    if (next === vote) return;
    const before = vote;
    setVote(next ?? "unsure");
    setMessage(null);
    start(async () => {
      if (next) {
        const res = await swipeAction({ companyId: company.id, slug: company.slug, vote: next });
        if (!res.ok) {
          setVote(before);
          setMessage(res.error);
        } else {
          setNote("");
          if (res.data?.outcome.kind === "match") setMessage("It’s a match. The chat is open.");
        }
        return;
      }
      const res = await undoSwipeAction({ companyId: company.id, slug: company.slug, previousVote: null });
      if (!res.ok) {
        setVote(before);
        setMessage(res.error);
      } else setMessage("Back in your deck.");
    });
  };

  const status =
    row.status === "match" ? { label: "Match", cls: "bg-green-pale text-green" } : row.status === "ended" ? { label: "Ended: two not interested", cls: "bg-surface-muted text-secondary" } : row.closed ? { label: "Round closed", cls: "bg-amber-pale text-amber" } : vote === "unsure" ? null : { label: "Waiting on the others", cls: "bg-surface-muted text-secondary" };

  return (
    <li className="flex gap-3 px-4 py-3">
      <span className="relative mt-0.5 h-12 w-12 shrink-0 overflow-hidden rounded-[12px] border border-hairline">
        <CompanyArtwork company={company} media={row.media} logo={row.logo} variant="thumb" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {row.status === "match" ? (
            <Link href={`/matches/${company.slug}`} className="truncate text-[0.9375rem] font-semibold text-ink underline-offset-2 hover:underline">
              {company.name}
            </Link>
          ) : (
            <span className="truncate text-[0.9375rem] font-semibold text-ink">{company.name}</span>
          )}
          {status ? <span className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", status.cls)}>{status.label}</span> : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[0.8125rem] text-secondary">{company.teaser}</p>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Your decision on ${company.name}`}>
          <Choice active={vote === "interested"} disabled={pending} onClick={() => change("interested")} tone="green" name="Interested">
            <Check size={17} strokeWidth={2.6} aria-hidden />
          </Choice>
          <Choice active={vote === "pass"} disabled={pending} onClick={() => change("pass")} tone="red" name="Not interested">
            <X size={17} strokeWidth={2.6} aria-hidden />
          </Choice>
          {vote !== "unsure" ? (
            <Choice active={false} disabled={pending} onClick={() => change(null)} tone="neutral" label="Back to my deck">
              <RotateCcw size={14} aria-hidden /> Put back
            </Choice>
          ) : null}
        </div>
        {vote !== "unsure" ? (
          editingNote ? (
            <form
              className="mt-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const res = await saveReasonAction({ companyId: company.id, slug: company.slug, note });
                  if (res.ok) {
                    setEditingNote(false);
                    setMessage(note.trim() ? "Reason saved." : "Reason removed.");
                  } else setMessage(res.error);
                });
              }}
            >
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} autoFocus placeholder={vote === "interested" ? "Why yes?" : "Why no?"} aria-label={`Why you said ${vote === "interested" ? "yes" : "no"} to ${company.name}`} className="w-full rounded-[12px] border border-hairline-strong bg-page px-3 py-2 text-[0.875rem] text-ink" />
              <div className="mt-1 flex gap-3 text-[0.8125rem]">
                <button type="submit" disabled={pending} className="font-semibold text-blue">
                  Save
                </button>
                <button type="button" onClick={() => { setEditingNote(false); setNote(row.note ?? ""); }} className="text-secondary">
                  Cancel
                </button>
              </div>
            </form>
          ) : note ? (
            <button type="button" onClick={() => setEditingNote(true)} className="mt-1.5 block text-left text-[0.8125rem] text-secondary">
              <span className="font-medium text-ink">Why: </span>
              {note}
            </button>
          ) : (
            <button type="button" onClick={() => setEditingNote(true)} className="mt-1.5 inline-flex items-center gap-1 text-[0.75rem] font-medium text-secondary">
              <MessageSquarePlus size={13} aria-hidden /> Add why
            </button>
          )
        ) : null}
        {message ? (
          <p role="status" className="mt-1.5 text-[0.75rem] text-secondary">
            {message}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/** `label` marks an action button; `name` labels an icon-only on/off choice. */
function Choice({ active, tone, label, name, children, ...rest }: { active: boolean; tone: "green" | "red" | "neutral"; label?: string; name?: string; children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label ?? name}
      title={label ?? name}
      aria-pressed={label ? undefined : active}
      className={cn(
        "inline-flex min-h-[34px] items-center gap-1 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors disabled:opacity-60",
        active && tone === "green" && "border-green bg-green text-white",
        active && tone === "red" && "border-red bg-red text-white",
        !active && "border-hairline-strong bg-surface text-ink",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
