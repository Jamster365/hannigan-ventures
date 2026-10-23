"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { proposeFromAnswersAction } from "@/lib/actions/learning";

/** Drafts a research-instruction change from the family's answers now, instead of waiting. */
export function ProposeFromAnswers({ hasOpen, canPropose }: { hasOpen: boolean; canPropose: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  if (hasOpen)
    return (
      <p className="mt-3 text-[0.8125rem]">
        <Link href="/research/settings" className="font-medium text-blue">
          A suggestion from your answers is waiting for approval →
        </Link>
      </p>
    );
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending || !canPropose}
        onClick={() =>
          start(async () => {
            const res = await proposeFromAnswersAction();
            setMessage(res.ok ? "Drafted. Review it under Research instructions." : res.error);
          })
        }
        className="inline-flex min-h-[40px] items-center rounded-full border border-hairline-strong px-4 text-[0.8125rem] font-medium text-ink disabled:opacity-50"
      >
        Suggest research changes now
      </button>
      {message ? (
        <p role="status" className="mt-2 text-[0.75rem] text-secondary">
          {message}
        </p>
      ) : null}
    </div>
  );
}
