"use client";

import { Lightbulb } from "lucide-react";
import { useState, useTransition } from "react";
import { applySuggestionAction, dismissSuggestionAction } from "@/lib/actions/research";
import { relativeTime } from "@/lib/domain/format";
import type { Member, PromptSuggestion } from "@/lib/domain/types";
import { Button, Pill } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function SuggestionReview({ suggestion, members, feedbackAuthor }: { suggestion: PromptSuggestion; members: Member[]; feedbackAuthor: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const approver = members.find((m) => m.userId === suggestion.approvedBy)?.displayName;
  return (
    <li className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-pale text-amber">
          <Lightbulb size={17} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[0.875rem] font-semibold text-ink">{suggestion.rationale.split(". ")[0]}.</p>
            <Pill tone={suggestion.status === "proposed" ? "amber" : suggestion.status === "applied" ? "green" : "neutral"}>{suggestion.status}</Pill>
          </div>
          <p className="mt-0.5 text-[0.75rem] text-secondary">
            Suggested by {suggestion.suggestedBy === "ai" ? "research assistant" : suggestion.suggestedBy === "learning" ? "the family’s answers" : "a member"}
            {feedbackAuthor ? ` from ${feedbackAuthor}'s feedback` : ""} · {relativeTime(suggestion.createdAt)}
            {approver ? ` · ${suggestion.status} by ${approver}` : ""}
          </p>
          <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 text-[0.8125rem] font-medium text-blue">
            {open ? "Hide proposed change" : "Show proposed change"}
          </button>
          {open ? (
            <div className="mt-2 space-y-2">
              {suggestion.suggestedPatch.map((p, i) => (
                <div key={i} className="rounded-[12px] border border-hairline bg-page p-3 text-[0.8125rem] leading-relaxed">
                  <p className="bg-red-pale px-1 text-red line-through">{p.find}</p>
                  <p className="mt-1 bg-green-pale px-1 text-green">{p.replace}</p>
                </div>
              ))}
              <p className="text-[0.8125rem] text-text">
                <span className="font-semibold">Why:</span> {suggestion.rationale}
              </p>
              <p className="text-[0.8125rem] text-text">
                <span className="font-semibold">Expected impact:</span> {suggestion.expectedImpact}
              </p>
            </div>
          ) : null}
          {error ? <p className={cn("mt-2 text-[0.8125rem] text-red")}>{error}</p> : null}
          {suggestion.status === "proposed" ? (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await dismissSuggestionAction(suggestion.id); if (!r.ok) setError(r.error); })}>
                Dismiss
              </Button>
              <Button size="sm" disabled={pending} onClick={() => start(async () => { const r = await applySuggestionAction(suggestion.id); if (!r.ok) setError(r.error); })}>
                {pending ? "Applying…" : "Apply"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
