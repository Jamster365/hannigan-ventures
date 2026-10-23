"use client";

import { useEffect, useState } from "react";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

const SESSION_KEY = "hv-launched";

/**
 * Brief logo animation on a cold open of the app (once per browser session).
 * While it plays, the navigation's fully-prefetching tab links load the main
 * tabs into the router cache, so the first taps afterwards are instant. It never waits on the network: it
 * always clears after ~1.1s. A tiny inline script hides it before first paint
 * when this session has already seen it, so in-session reloads never flash.
 */
export function LaunchSplash() {
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");

  useEffect(() => {
    // Decided once, before hydration, by the inline script below (stable even if this effect re-runs).
    const seen = document.documentElement.dataset.launched === "1";
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Private mode or blocked storage: it simply plays again next time.
    }
    // Already seen this session: CSS hid it before paint; just unmount it.
    const leave = setTimeout(() => setPhase("leaving"), seen ? 0 : 1100);
    const done = setTimeout(() => setPhase("gone"), seen ? 0 : 1500);
    return () => {
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, []);

  if (phase === "gone") return null;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem("${SESSION_KEY}")==="1")document.documentElement.dataset.launched="1"}catch(e){}` }} />
      <div className={`launch-splash fixed inset-0 z-[100] flex flex-col items-center justify-center bg-page ${phase === "leaving" ? "launch-splash-leave" : ""}`} aria-hidden="true">
        <svg width="76" height="76" viewBox="0 0 40 40">
          <path className="launch-peak launch-peak-1" d="M6 32 22 6l5 9-8 17Z" fill="#142033" />
          <path className="launch-peak launch-peak-2" d="M19 32 29 12l6 11-5 9Z" fill="#9aa3b2" />
        </svg>
        <p className="launch-word mt-4 font-serif text-[1.5rem] font-semibold tracking-[-0.01em] text-ink">{APP_NAME}</p>
        <p className="launch-word launch-word-2 mt-1 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-tertiary">{APP_TAGLINE}</p>
      </div>
    </>
  );
}
