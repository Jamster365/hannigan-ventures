"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/primitives";
import { requestMagicLinkAction, type MagicLinkState } from "@/lib/actions/auth";
import { clearHandoff, HANDOFF_DONE_KEY, handoffSnapshot, parseHandoff, saveHandoff, type StoredHandoff } from "@/lib/auth/handoff-storage";

const subscribeStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

export function SignInForm({ mode }: { mode: "demo" | "supabase" }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(requestMagicLinkAction, { status: "idle" });
  // A hand-off this screen is waiting on: from this request, or restored after
  // the home-screen app was closed while the member opened their email.
  const storedRaw = useSyncExternalStore(subscribeStorage, handoffSnapshot, () => null);
  const [createdAt] = useState(() => Date.now());
  const fromRequest = useMemo<StoredHandoff | null>(
    () => (state.status === "sent" && state.handoff ? { ...state.handoff, email: state.email, createdAt } : null),
    [state, createdAt],
  );
  const [closedId, setClosedId] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const candidate = fromRequest ?? (mode === "supabase" ? parseHandoff(storedRaw) : null);
  const waiting = candidate && candidate.id !== closedId ? candidate : null;

  useEffect(() => {
    if (fromRequest) saveHandoff(fromRequest);
  }, [fromRequest]);

  const waitingId = waiting?.id;
  const waitingSecret = waiting?.secret;
  useEffect(() => {
    if (!waitingId || !waitingSecret) return;
    let stopped = false;
    const finish = () => {
      stopped = true;
      clearHandoff();
      window.location.replace("/");
    };
    const poll = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      const res = await fetch("/auth/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "claim", id: waitingId, secret: waitingSecret }),
      }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { status?: string } | null;
      if (stopped) return;
      if (data?.status === "signed_in") finish();
      else if (data?.status === "expired") {
        stopped = true;
        clearHandoff();
        setClosedId(waitingId);
        setExpired(true);
      }
    };
    // The link opened in this same browser (another tab) and signed it in.
    const onStorage = (e: StorageEvent) => {
      if (e.key === HANDOFF_DONE_KEY && e.newValue === waitingId) finish();
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("focus", poll);
    window.addEventListener("storage", onStorage);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
      window.removeEventListener("focus", poll);
      window.removeEventListener("storage", onStorage);
    };
  }, [waitingId, waitingSecret]);

  if (mode === "demo") {
    return (
      <div className="mt-5">
        <p className="rounded-[12px] bg-amber-pale px-3 py-2 text-[13px] text-amber">Demo mode: Supabase is not configured, so sign-in is bypassed and you are viewing as a sample member.</p>
        <Link href="/" className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-ink px-5 text-[14px] font-medium text-white">
          Continue to the demo
        </Link>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="mt-5" role="status">
        <div className="rounded-[12px] bg-green-pale px-3 py-3 text-[14px] text-green">
          Check your email. If <span className="font-semibold">{waiting.email}</span> belongs to an invited member, a sign-in link is on its way.
        </div>
        <p className="mt-4 text-[14px] text-secondary">Tap the link, even if it opens in another browser. Confirm this code there and this screen signs in by itself:</p>
        <p className="mt-3 text-center font-serif text-[40px] font-semibold tracking-[0.2em] text-ink" aria-label={`Code ${waiting.code.split("").join(" ")}`}>
          {waiting.code}
        </p>
        <button
          type="button"
          className="mt-3 w-full text-center text-[13px] text-tertiary underline"
          onClick={() => {
            clearHandoff();
            setClosedId(waiting.id);
          }}
        >
          Use a different email
        </button>
      </div>
    );
  }

  if (state.status === "sent" && !state.handoff) {
    return (
      <div className="mt-5 rounded-[12px] bg-green-pale px-3 py-3 text-[14px] text-green" role="status">
        Check your email. If <span className="font-semibold">{state.email}</span> belongs to an invited member, a sign-in link is on its way.
      </div>
    );
  }

  return (
    <form action={action} className="mt-5 space-y-3">
      <label className="block">
        <span className="text-[13px] font-medium text-ink">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className="mt-1 block min-h-[44px] w-full rounded-[12px] border border-hairline-strong bg-surface px-3 text-[15px] text-ink focus:border-blue"
          placeholder="you@example.com"
        />
      </label>
      {expired ? (
        <p className="text-[13px] text-red" role="alert">
          That sign-in request has expired. Request a new link.
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-[13px] text-red" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
