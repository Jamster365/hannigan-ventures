"use client";

import { useLiveRefresh } from "./use-live-refresh";

/** Drop-in for server pages: refreshes the page when the table changes. */
export function LiveRefresh(props: { enabled: boolean; channel: string; table: string; filter?: string }) {
  useLiveRefresh(props);
  return null;
}
