"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/primitives";
import { safeNextPath } from "@/lib/auth/next-path";
import { clearHandoff, markHandoffDone, readHandoff } from "@/lib/auth/handoff-storage";

type Tokens = { access_token: string; refresh_token: string };
type View = { kind: "working" } | { kind: "confirm"; code: string } | { kind: "handed_off" };

const post = (url: string, body: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });

/**
 * Landing page for email links. The session arrives in the URL fragment. If
 * the link was requested on another screen (on iPhone: the home-screen app,
 * whose cookies this browser cannot reach), the member confirms the code that
 * screen shows and the session is handed over; otherwise it signs in here.
 */
export function ConfirmSignIn() {
  const [view, setView] = useState<View>({ kind: "working" });
  const tokens = useRef<Tokens | null>(null);
  const context = useRef<{ next: string; handoff: string | null }>({ next: "/", handoff: null });
  const started = useRef(false);

  const signInHere = async () => {
    const { next, handoff } = context.current;
    const t = tokens.current;
    if (!t) return window.location.replace(`/auth/session?next=${encodeURIComponent(next)}`);
    setView({ kind: "working" });
    const res = await post("/auth/session", t).catch(() => null);
    if (res?.ok) {
      if (handoff && readHandoff()?.id === handoff) {
        // Signal first: the waiting tab stops listening once the record is cleared.
        markHandoffDone(handoff);
        clearHandoff();
      }
      window.location.replace(next);
    } else window.location.replace(`/auth/session?next=${encodeURIComponent(next)}`);
  };

  const handOver = async () => {
    const { handoff } = context.current;
    if (!handoff || !tokens.current) return;
    setView({ kind: "working" });
    const res = await post("/auth/handoff", { action: "confirm", id: handoff, ...tokens.current }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { status?: string } | null;
    if (data?.status === "handed_off") setView({ kind: "handed_off" });
    else void signInHere();
  };

  useEffect(() => {
    // Run once: the fragment is cleared below, so a second run would find no tokens.
    if (started.current) return;
    started.current = true;
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    context.current = { next: safeNextPath(search.get("next")), handoff: search.get("handoff") };
    const access = hash.get("access_token");
    const refresh = hash.get("refresh_token");
    // Keep the tokens out of history and screenshots.
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!access || !refresh) {
      window.location.replace(`/auth/session?next=${encodeURIComponent(context.current.next)}`);
      return;
    }
    tokens.current = { access_token: access, refresh_token: refresh };
    const { handoff } = context.current;
    // Requested in this same browser, or no hand-off: just sign in here.
    if (!handoff || readHandoff()?.id === handoff) {
      void signInHere();
      return;
    }
    void (async () => {
      const res = await post("/auth/handoff", { action: "inspect", id: handoff }).catch(() => null);
      const data = (await res?.json().catch(() => null)) as { status?: string; code?: string } | null;
      if (data?.status === "waiting" && data.code) setView({ kind: "confirm", code: data.code });
      else void signInHere();
    })();
  }, []);

  if (view.kind === "confirm") {
    return (
      <div>
        <h1 className="font-serif text-[24px] font-semibold text-ink">Finish signing in</h1>
        <p className="mt-2 text-[14px] text-secondary">You asked for this link on another screen, such as the Hannigan Ventures app on your home screen. Check that screen shows this code:</p>
        <p className="mt-4 text-center font-serif text-[40px] font-semibold tracking-[0.2em] text-ink" aria-label={`Code ${view.code.split("").join(" ")}`}>
          {view.code}
        </p>
        <Button className="mt-5 w-full" onClick={() => void handOver()}>
          It matches: sign in there
        </Button>
        <Button variant="outline" className="mt-3 w-full" onClick={() => void signInHere()}>
          Use this browser instead
        </Button>
        <p className="mt-4 text-[12px] text-tertiary">If you did not ask for a sign-in link, close this page. Nothing is signed in until you choose.</p>
      </div>
    );
  }
  if (view.kind === "handed_off") {
    return (
      <div role="status">
        <h1 className="font-serif text-[24px] font-semibold text-ink">You&rsquo;re signed in</h1>
        <p className="mt-2 text-[14px] text-secondary">Go back to the Hannigan Ventures app. It signs in by itself within a few seconds. You can close this page.</p>
      </div>
    );
  }
  return <p className="text-[14px] text-secondary">Signing you in…</p>;
}
