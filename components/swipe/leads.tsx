"use client";

import { useState, useTransition } from "react";
import { addLeadAction, setLeadStatusAction } from "@/lib/actions/leads";
import { formatDate } from "@/lib/domain/format";
import type { DealLead, Member } from "@/lib/domain/types";
import { safeHref } from "@/lib/utils";

/** Suggest a company, and the list of what the family has suggested so far. */
export function LeadForm() {
  const [form, setForm] = useState({ name: "", website: "", source: "", notes: "" });
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const field = "mt-0.5 block min-h-[44px] w-full rounded-[10px] border border-hairline-strong bg-page px-3 text-[0.9375rem] text-ink";
  return (
    <form
      className="space-y-3 rounded-[18px] border border-hairline bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addLeadAction(form);
          setMessage(res.ok ? "Added. It will be researched in the next research session." : res.error);
          if (res.ok) setForm({ name: "", website: "", source: "", notes: "" });
        });
      }}
    >
      <label className="block text-[0.8125rem] font-medium text-ink">
        Company name
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} className={field} />
      </label>
      <label className="block text-[0.8125rem] font-medium text-ink">
        Website (optional)
        <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} inputMode="url" placeholder="example.co.uk" maxLength={200} className={field} />
      </label>
      <label className="block text-[0.8125rem] font-medium text-ink">
        Where you heard of it
        <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. Cambridge Angels email, met the founder, UKTN" maxLength={200} className={field} />
      </label>
      <label className="block text-[0.8125rem] font-medium text-ink">
        Anything you know (paste the email or deal summary here)
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={5} maxLength={4000} className="mt-0.5 block w-full rounded-[12px] border border-hairline-strong bg-page px-3 py-2 text-[0.9375rem] text-ink" />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || form.name.trim().length < 2} className="inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 text-[0.875rem] font-medium text-white disabled:opacity-60">
          Add for research
        </button>
        {message ? (
          <p role="status" className="text-[0.8125rem] text-secondary">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function LeadList({ leads, members, currentUserId }: { leads: DealLead[]; members: Member[]; currentUserId: string }) {
  const [pending, start] = useTransition();
  const nameOf = (id: string | null) => (id === currentUserId ? "you" : (members.find((m) => m.userId === id)?.displayName ?? "someone"));
  if (!leads.length) return <p className="px-1 text-[0.875rem] text-secondary">Nothing suggested yet.</p>;
  return (
    <ul className="divide-y divide-hairline rounded-[18px] border border-hairline bg-surface">
      {leads.map((l) => (
        <li key={l.id} className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.9375rem] font-semibold text-ink">
                {l.name}
                {safeHref(l.website) ? (
                  <a href={safeHref(l.website)!} target="_blank" rel="noopener noreferrer" className="ml-2 text-[0.8125rem] font-medium text-blue">
                    website
                  </a>
                ) : null}
              </p>
              <p className="text-[0.75rem] text-secondary">
                {l.source ? `${l.source} · ` : ""}added by {nameOf(l.addedBy)} {formatDate(l.createdAt)}
                {l.status === "researched" ? " · researched" : l.status === "dismissed" ? " · dismissed" : " · waiting for research"}
              </p>
              {l.notes ? <p className="mt-1 whitespace-pre-wrap text-[0.8125rem] text-text">{l.notes}</p> : null}
            </div>
            {l.status === "new" ? (
              <button type="button" disabled={pending} onClick={() => start(async () => void (await setLeadStatusAction({ leadId: l.id, status: "dismissed" })))} className="shrink-0 min-h-[44px] px-2 text-[0.8125rem] font-medium text-secondary">
                Dismiss
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
