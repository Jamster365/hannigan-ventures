"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Re-renders the page's server data when a watched table changes (Supabase
 * Realtime, filtered by RLS) and when the app comes back to the foreground.
 * Pass `enabled: false` in demo mode, which has no realtime server.
 */
export function useLiveRefresh({ enabled, channel, table, filter }: { enabled: boolean; channel: string; table: string; filter?: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 150);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    const supabase = getSupabaseBrowserClient();
    let cancelled = false;
    let sub: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;
    if (supabase) {
      void supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        if (data.session) supabase.realtime.setAuth(data.session.access_token);
        sub = supabase
          .channel(channel)
          .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, refresh)
          .subscribe();
      });
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      if (sub && supabase) void supabase.removeChannel(sub);
    };
  }, [enabled, channel, table, filter, router]);
}
