"use client";

import { useTransition } from "react";
import { switchDemoMemberAction } from "@/lib/actions/demo";
import type { Member } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Shown only in demo mode. Makes the sample-data status unmistakable and lets
 * a reviewer switch between the three sample members to exercise the
 * 2-of-3 shortlist rule.
 */
export function DemoBanner({ members, current }: { members: Member[]; current: Member }) {
  const [pending, start] = useTransition();
  return (
    <div className="z-40 flex items-center justify-between gap-2 bg-amber-pale px-4 py-1.5 text-[0.75rem] text-amber" role="status">
      <p className="min-w-0 truncate font-medium">
        <span className="font-semibold">Demo mode.</span> Sample data, fictional companies. <span className="hidden sm:inline">Changes reset on restart.</span>
      </p>
      <label className="flex shrink-0 items-center gap-1.5">
        <span className="hidden sm:inline">Viewing as</span>
        <select
          className={cn("min-h-[36px] rounded-full border border-amber/30 bg-white/70 px-2.5 text-[0.8125rem] font-medium text-amber", pending && "opacity-60")}
          value={current.userId}
          disabled={pending}
          onChange={(e) => start(() => switchDemoMemberAction(e.target.value))}
          aria-label="Switch sample member"
        >
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.displayName}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
