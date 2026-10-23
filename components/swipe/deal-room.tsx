"use client";

import { Check, ChevronDown, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { removeDocumentAction, saveDecisionAction, setDealCheckAction, uploadDocumentAction } from "@/lib/actions/deal";
import { checklistFor, DEAL_STAGES, dealStatusLabel, emptyDecision, type ChecklistItem, type Deal, type DealDecision, type DealStatus } from "@/lib/domain/deal";
import { formatDate } from "@/lib/domain/format";
import type { Member } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * The deal room for a match: the family's decision, the due-diligence
 * checklist, and the documents. Everything is shared; any member can change
 * anything, and the chat records who recorded an investment or added a file.
 */
export function DealRoom({ companyId, slug, deal, members, currentUserId }: { companyId: string; slug: string; deal: Deal; members: Member[]; currentUserId: string }) {
  const nameOf = (id: string | null) => (id === currentUserId ? "you" : (members.find((m) => m.userId === id)?.displayName ?? "someone"));
  return (
    <div className="space-y-6">
      <DecisionCard companyId={companyId} slug={slug} decision={deal.decision} members={members} />
      <Checklist companyId={companyId} slug={slug} items={checklistFor(deal)} nameOf={nameOf} />
      <Documents companyId={companyId} slug={slug} deal={deal} nameOf={nameOf} />
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[18px] border border-hairline bg-surface">
      <header className="px-4 pt-4">
        <h2 className="font-serif text-[1.25rem] font-semibold text-ink">{title}</h2>
        {sub ? <p className="mt-0.5 text-[0.8125rem] text-secondary">{sub}</p> : null}
      </header>
      <div className="px-4 pb-4 pt-3">{children}</div>
    </section>
  );
}

const STATUS_TONE: Record<DealStatus, string> = { considering: "bg-amber/15 text-ink", invested: "bg-green/15 text-ink", passed: "bg-surface-muted text-secondary" };

function DecisionCard({ companyId, slug, decision, members }: { companyId: string; slug: string; decision: DealDecision | null; members: Member[] }) {
  const [form, setForm] = useState<DealDecision>(decision ?? emptyDecision(companyId));
  const [editing, setEditing] = useState(decision === null ? false : false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const total = Object.values(form.amounts).reduce((s, n) => s + (n || 0), 0);
  const money = (v: string) => Math.max(0, Math.round(Number(v.replace(/[£,\s]/g, "")) || 0));

  const save = () =>
    start(async () => {
      const res = await saveDecisionAction({ companyId, slug, status: form.status, amounts: form.amounts, investedAt: form.investedAt, scheme: form.scheme, stakePct: form.stakePct, instrument: form.instrument, certificateReceived: form.certificateReceived, notes: form.notes });
      setMessage(res.ok ? "Saved." : res.error);
      if (res.ok) setEditing(false);
    });

  return (
    <Section title="Our decision" sub="Where the family stands on this one. Investing or passing is posted in the chat.">
      <div className="flex flex-wrap items-center gap-2">
        {(["considering", "invested", "passed"] as DealStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={form.status === s}
            onClick={() => {
              setForm((f) => ({ ...f, status: s, investedAt: s === "invested" ? (f.investedAt ?? new Date().toISOString().slice(0, 10)) : f.investedAt }));
              setEditing(true);
            }}
            className={cn("min-h-[40px] rounded-full border px-4 text-[0.875rem] font-medium", form.status === s ? "border-ink bg-ink text-white" : "border-hairline-strong text-ink")}
          >
            {dealStatusLabel(s)}
          </button>
        ))}
      </div>
      {!editing && decision ? (
        <div className="mt-3 text-[0.875rem] text-secondary">
          <span className={cn("mr-2 rounded-full px-2 py-0.5 text-[0.75rem] font-semibold", STATUS_TONE[decision.status])}>{dealStatusLabel(decision.status)}</span>
          {decision.status === "invested" ? (
            <>
              £{total.toLocaleString("en-GB")} in total{decision.investedAt ? ` on ${formatDate(decision.investedAt)}` : ""}
              {decision.scheme !== "unknown" ? ` · ${decision.scheme === "none" ? "no tax relief" : decision.scheme}` : ""}
              {decision.stakePct !== null ? ` · ${decision.stakePct}% of the company` : ""}
              {decision.certificateReceived ? " · certificate received" : ""}
            </>
          ) : decision.notes ? (
            decision.notes
          ) : null}
          <button type="button" onClick={() => setEditing(true)} className="ml-2 font-medium text-blue">
            Edit
          </button>
        </div>
      ) : null}
      {editing ? (
        <div className="mt-4 space-y-3">
          {form.status === "invested" ? (
            <>
              <div>
                <p className="text-[0.8125rem] font-semibold text-ink">Who put in what (£)</p>
                <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
                  {members.map((m) => (
                    <label key={m.userId} className="block text-[0.8125rem] text-secondary">
                      {m.displayName}
                      <input inputMode="numeric" value={form.amounts[m.userId] ? form.amounts[m.userId].toLocaleString("en-GB") : ""} onChange={(e) => setForm((f) => ({ ...f, amounts: { ...f.amounts, [m.userId]: money(e.target.value) } }))} className="mt-0.5 block min-h-[40px] w-full rounded-[10px] border border-hairline-strong bg-page px-2 text-ink" />
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[0.75rem] text-tertiary">Total £{total.toLocaleString("en-GB")}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-[0.8125rem] text-secondary">
                  Date
                  <input type="date" value={form.investedAt ?? ""} onChange={(e) => setForm((f) => ({ ...f, investedAt: e.target.value || null }))} className="mt-0.5 block min-h-[40px] w-full rounded-[10px] border border-hairline-strong bg-page px-2 text-ink" />
                </label>
                <label className="block text-[0.8125rem] text-secondary">
                  Our share of the company (%)
                  <input inputMode="decimal" value={form.stakePct ?? ""} onChange={(e) => setForm((f) => ({ ...f, stakePct: e.target.value === "" ? null : Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))} className="mt-0.5 block min-h-[40px] w-full rounded-[10px] border border-hairline-strong bg-page px-2 text-ink" />
                </label>
              </div>
              <div>
                <p className="text-[0.8125rem] font-semibold text-ink">Tax relief</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(["SEIS", "EIS", "none", "unknown"] as const).map((s) => (
                    <button key={s} type="button" aria-pressed={form.scheme === s} onClick={() => setForm((f) => ({ ...f, scheme: s }))} className={cn("min-h-[36px] rounded-full border px-3 text-[0.8125rem] font-medium", form.scheme === s ? "border-ink bg-ink text-white" : "border-hairline-strong text-ink")}>
                      {s === "none" ? "None" : s === "unknown" ? "Not sure yet" : s}
                    </button>
                  ))}
                </div>
                <label className="mt-2 flex min-h-[40px] items-center gap-2 text-[0.875rem] text-ink">
                  <input type="checkbox" checked={form.certificateReceived} onChange={(e) => setForm((f) => ({ ...f, certificateReceived: e.target.checked }))} className="h-5 w-5" />
                  SEIS3 / EIS3 certificate received
                </label>
              </div>
              <label className="block text-[0.8125rem] text-secondary">
                Instrument (e.g. ordinary shares, ASA, SAFE)
                <input value={form.instrument} onChange={(e) => setForm((f) => ({ ...f, instrument: e.target.value }))} maxLength={120} className="mt-0.5 block min-h-[40px] w-full rounded-[10px] border border-hairline-strong bg-page px-2 text-ink" />
              </label>
            </>
          ) : null}
          <label className="block text-[0.8125rem] text-secondary">
            Notes
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} maxLength={2000} className="mt-0.5 block w-full rounded-[12px] border border-hairline-strong bg-page px-3 py-2 text-[0.9375rem] text-ink" />
          </label>
          <div className="flex items-center gap-3">
            <button type="button" disabled={pending} onClick={save} className="inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 text-[0.875rem] font-medium text-white disabled:opacity-60">
              Save decision
            </button>
            <button type="button" onClick={() => { setForm(decision ?? emptyDecision(companyId)); setEditing(false); }} className="text-[0.875rem] font-medium text-secondary">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="mt-2 text-[0.75rem] text-secondary">
          {message}
        </p>
      ) : null}
    </Section>
  );
}

function Checklist({ companyId, slug, items, nameOf }: { companyId: string; slug: string; items: ChecklistItem[]; nameOf: (id: string | null) => string }) {
  const [state, setState] = useState(items);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const live = state.filter((i) => i.status !== "na");
  const done = live.filter((i) => i.status === "done").length;

  const set = (item: ChecklistItem, patch: Partial<Pick<ChecklistItem, "status" | "note">>) => {
    const next = { ...item, ...patch, updatedAt: new Date().toISOString() };
    setState((s) => s.map((i) => (i.key === item.key ? next : i)));
    start(async () => {
      const res = await setDealCheckAction({ companyId, slug, key: item.key, status: next.status, note: patch.note, label: item.custom ? item.label : undefined });
      if (!res.ok) {
        setError(res.error);
        setState((s) => s.map((i) => (i.key === item.key ? item : i)));
      }
    });
  };

  const add = () => {
    const label = adding.trim();
    if (!label) return;
    const key = `custom_${Date.now().toString(36)}`;
    const item: ChecklistItem = { key, label, hint: "", stage: "verify", status: "todo", note: "", updatedBy: null, updatedAt: null, custom: true };
    setState((s) => [...s, item]);
    setAdding("");
    start(async () => {
      const res = await setDealCheckAction({ companyId, slug, key, status: "todo", label });
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <Section title="Due diligence" sub={`${done} of ${live.length} done. Tap to tick; open an item for a note or to mark it not needed.`}>
      <div className="space-y-4">
        {DEAL_STAGES.map((stage) => {
          const rows = state.filter((i) => i.stage === stage.key);
          if (!rows.length) return null;
          return (
            <div key={stage.key}>
              <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-tertiary">{stage.label}</p>
              <ul className="divide-y divide-hairline rounded-[14px] border border-hairline">
                {rows.map((item) => (
                  <li key={item.key} className={cn(item.status === "na" && "opacity-60")}>
                    <div className="flex items-start gap-2 px-2 py-1.5">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={item.status === "done"}
                        aria-label={item.label}
                        disabled={pending && false}
                        onClick={() => set(item, { status: item.status === "done" ? "todo" : "done" })}
                        className={cn("mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", item.status === "done" ? "border-green bg-green text-white" : "border-hairline-strong bg-surface")}
                      >
                        {item.status === "done" ? <Check size={16} aria-hidden /> : null}
                      </button>
                      <button type="button" onClick={() => setOpen(open === item.key ? null : item.key)} className="min-w-0 flex-1 py-1 text-left">
                        <span className={cn("block text-[0.9375rem] text-ink", item.status === "done" && "line-through decoration-hairline-strong", item.status === "na" && "line-through")}>{item.label}</span>
                        <span className="block text-[0.75rem] text-secondary">
                          {item.status === "done" && item.updatedBy ? `Done by ${nameOf(item.updatedBy)}` : item.status === "na" ? "Not needed" : item.hint}
                          {item.note && open !== item.key ? ` · ${item.note}` : ""}
                        </span>
                      </button>
                      <ChevronDown size={16} className={cn("mt-2.5 shrink-0 text-tertiary transition-transform", open === item.key && "rotate-180")} aria-hidden />
                    </div>
                    {open === item.key ? (
                      <div className="space-y-2 px-3 pb-3 pl-11">
                        {item.hint ? <p className="text-[0.8125rem] text-secondary">{item.hint}</p> : null}
                        <textarea defaultValue={item.note} onBlur={(e) => e.target.value !== item.note && set(item, { note: e.target.value })} rows={2} maxLength={1000} placeholder="Notes for the family (what you found, who you spoke to…)" aria-label={`Notes for ${item.label}`} className="block w-full rounded-[10px] border border-hairline-strong bg-page px-2 py-1.5 text-[0.875rem] text-ink" />
                        <button type="button" onClick={() => set(item, { status: item.status === "na" ? "todo" : "na" })} className="text-[0.8125rem] font-medium text-secondary">
                          {item.status === "na" ? "Needed after all" : "Not needed for this deal"}
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <div className="flex gap-2">
          <input value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} maxLength={120} placeholder="Add our own item…" aria-label="Add a checklist item" className="min-h-[40px] flex-1 rounded-[10px] border border-hairline-strong bg-page px-3 text-[0.875rem] text-ink" />
          <button type="button" onClick={add} disabled={!adding.trim()} className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-hairline-strong px-3 text-[0.8125rem] font-medium text-ink disabled:opacity-50">
            <Plus size={14} aria-hidden /> Add
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-[0.75rem] text-red">
            {error}
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function Documents({ companyId, slug, deal, nameOf }: { companyId: string; slug: string; deal: Deal; nameOf: (id: string | null) => string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const upload = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("companyId", companyId);
    fd.set("slug", slug);
    fd.set("file", file);
    setMessage(`Uploading ${file.name}…`);
    start(async () => {
      const res = await uploadDocumentAction(fd);
      setMessage(res.ok ? null : res.error);
      if (input.current) input.current.value = "";
    });
  };
  const size = (b: number) => (b > 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);
  return (
    <Section title="Documents" sub="The deck, financial model, term sheet, HMRC letters, certificates. Only the family can open them.">
      {deal.documents.length ? (
        <ul className="divide-y divide-hairline rounded-[14px] border border-hairline">
          {deal.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2">
              <FileText size={18} className="shrink-0 text-secondary" aria-hidden />
              <span className="min-w-0 flex-1">
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[0.9375rem] font-medium text-blue">
                    {d.name}
                  </a>
                ) : (
                  <span className="block truncate text-[0.9375rem] font-medium text-ink">{d.name}</span>
                )}
                <span className="block text-[0.75rem] text-secondary">
                  {size(d.sizeBytes)} · added by {nameOf(d.uploadedBy)} {formatDate(d.createdAt)}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${d.name}`}
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Remove ${d.name} for everyone?`)) return;
                  start(async () => {
                    const res = await removeDocumentAction({ companyId, slug, documentId: d.id });
                    if (!res.ok) setMessage(res.error);
                  });
                }}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-tertiary hover:bg-surface-muted"
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.875rem] text-secondary">Nothing here yet.</p>
      )}
      <div className="mt-3">
        <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" onChange={(e) => upload(e.target.files?.[0])} className="hidden" id={`doc-${companyId}`} />
        <label htmlFor={`doc-${companyId}`} className={cn("inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-hairline-strong px-4 text-[0.875rem] font-medium text-ink", pending && "opacity-60")}>
          <Paperclip size={15} aria-hidden /> Add a document
        </label>
        {message ? (
          <p role="status" className="mt-2 text-[0.75rem] text-secondary">
            {message}
          </p>
        ) : null}
      </div>
    </Section>
  );
}
