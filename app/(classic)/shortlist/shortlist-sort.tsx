"use client";

import { useRouter } from "next/navigation";

export function ShortlistSort({ value }: { value: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-1 text-[0.75rem] text-secondary">
      <span className="sr-only">Sort shortlist</span>
      <select value={value} onChange={(e) => router.replace(`/shortlist?sort=${e.target.value}`)} className="min-h-[36px] rounded-full border border-hairline bg-surface px-3 text-[0.8125rem] font-medium text-ink">
        <option value="priority">Priority</option>
        <option value="recent">Recent activity</option>
        <option value="alpha">A–Z</option>
      </select>
    </label>
  );
}
