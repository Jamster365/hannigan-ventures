"use client";

import { useTransition } from "react";
import { markNotificationsReadAction } from "@/lib/actions/family";

export function MarkAllRead() {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await markNotificationsReadAction(); })} className="min-h-[36px] rounded-full px-3 text-[13px] font-medium text-blue hover:bg-blue-pale disabled:opacity-60">
      Mark all read
    </button>
  );
}
