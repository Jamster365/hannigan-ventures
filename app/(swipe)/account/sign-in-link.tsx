"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useState, useTransition } from "react";
import { createSignInLinkAction } from "@/lib/actions/account";

/** Owner only: makes a one-time sign-in link for a member, to send them directly. */
export function SignInLinkButton({ userId, name }: { userId: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="w-full">
      {!url ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await createSignInLinkAction(userId);
              if (res.ok) {
                setUrl(res.url);
                setError(null);
              } else setError(res.error);
            })
          }
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-hairline-strong px-3 text-[0.8125rem] font-medium text-ink disabled:opacity-60"
        >
          <Link2 size={14} aria-hidden /> {pending ? "Creating…" : `Sign-in link for ${name}`}
        </button>
      ) : (
        <div className="rounded-[12px] bg-surface-muted p-3">
          <p className="text-[0.75rem] text-secondary">Send this to {name} (e.g. on WhatsApp). It works once, within an hour.</p>
          <p className="mt-1 select-all break-all font-mono text-[0.6875rem] text-ink">{url}</p>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="mt-2 inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-ink px-3 text-[0.8125rem] font-medium text-white"
          >
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-1 text-[0.75rem] text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
