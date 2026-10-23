"use client";

import { Bell, BellOff, Share } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction, sendTestPushAction } from "@/lib/actions/push";

type State = "checking" | "unsupported" | "needs-home-screen" | "denied" | "off" | "on";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Phone notifications for this device: matches, match-chat messages (including
 * Research's company updates) and research-instruction changes. On iPhone and
 * iPad they need the app added to the Home Screen first (iOS 16.4+).
 */
export function PushSettings({ publicKey, available }: { publicKey: string | null; available: boolean }) {
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const set = (s: State) => {
      if (!cancelled) setState(s);
    };
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      set(isIos() && !isStandalone() ? "needs-home-screen" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      set("denied");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => set(sub ? "on" : "off"))
      .catch(() => set("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOn = () =>
    start(async () => {
      setMessage(null);
      if (!publicKey) return setMessage("Phone notifications are not set up on the server yet.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
        const json = sub.toJSON();
        const res = await savePushSubscriptionAction({ endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" }, userAgent: navigator.userAgent.slice(0, 300) });
        if (!res.ok) {
          await sub.unsubscribe();
          return setMessage(res.error);
        }
        setState("on");
        setMessage("Notifications are on for this device.");
      } catch {
        setMessage("This device could not be registered. Try again.");
      }
    });

  const turnOff = () =>
    start(async () => {
      setMessage(null);
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setMessage("Notifications are off for this device.");
    });

  const test = () =>
    start(async () => {
      const res = await sendTestPushAction();
      setMessage(res.ok ? "Test sent. It should arrive in a few seconds." : res.error);
    });

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink">{state === "on" ? <Bell size={17} aria-hidden /> : <BellOff size={17} aria-hidden />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-ink">Phone notifications</p>
          <p className="text-[12px] text-secondary">New matches, chat messages, Research updates on your matches, and changes to the research instructions.</p>
        </div>
      </div>

      <div className="mt-3 pl-12">
        {!available ? (
          <p className="text-[13px] text-secondary">Available in the live app (not the demo).</p>
        ) : state === "checking" ? (
          <p className="text-[13px] text-tertiary">Checking this device…</p>
        ) : state === "needs-home-screen" ? (
          <p className="text-[13px] leading-relaxed text-secondary">
            On iPhone and iPad, first add the app to your Home Screen: tap <Share size={13} className="inline align-[-2px]" aria-label="Share" /> then <span className="font-medium text-ink">Add to Home Screen</span>. Open it from there and come back to this page.
          </p>
        ) : state === "unsupported" ? (
          <p className="text-[13px] text-secondary">This browser can’t receive notifications. Try Safari (from the Home Screen) on iPhone, or Chrome.</p>
        ) : state === "denied" ? (
          <p className="text-[13px] text-secondary">Notifications are blocked for this app. Allow them in your phone’s Settings → Notifications, then reopen this page.</p>
        ) : state === "on" ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={test} disabled={pending} className="inline-flex min-h-[38px] items-center rounded-full border border-hairline-strong px-4 text-[13px] font-medium text-ink disabled:opacity-60">
              Send a test
            </button>
            <button type="button" onClick={turnOff} disabled={pending} className="inline-flex min-h-[38px] items-center rounded-full px-3 text-[13px] font-medium text-secondary disabled:opacity-60">
              Turn off on this device
            </button>
          </div>
        ) : (
          <button type="button" onClick={turnOn} disabled={pending} className="inline-flex min-h-[40px] items-center rounded-full bg-ink px-5 text-[14px] font-medium text-white disabled:opacity-60">
            Turn on for this device
          </button>
        )}
        {message ? (
          <p role="status" className="mt-2 text-[12px] text-secondary">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
