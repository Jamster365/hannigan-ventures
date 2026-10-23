"use client";

import { Check, ExternalLink, HelpCircle, Lightbulb, MoreHorizontal, Share } from "lucide-react";
import { Dialog, DropdownMenu } from "radix-ui";
import { useState, useTransition } from "react";
import { submitFeedbackAction } from "@/lib/actions/research";
import { formatDate } from "@/lib/domain/format";
import type { Company, Source } from "@/lib/domain/types";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const FEEDBACK_OPTIONS = [
  { key: "too_many_sector", label: "Too many in this sector" },
  { key: "more_preseed", label: "Find more pre-seed" },
  { key: "missed_something", label: "Research missed something" },
  { key: "not_this_model", label: "Not interested in this model" },
  { key: "free_text", label: "Something else" },
] as const;

export function CompanyMenu({ company, sources, whatsNew, overlay }: { company: Company; sources: Source[]; whatsNew: string | null; overlay?: boolean }) {
  const [dialog, setDialog] = useState<"why" | "improve" | null>(null);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href.split("?")[0]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="More actions"
            className={cn("inline-flex h-10 w-10 items-center justify-center rounded-full", overlay ? "bg-white/90 text-ink shadow-sm backdrop-blur hover:bg-white" : "text-ink hover:bg-surface-muted")}
          >
            {copied ? <Check size={18} /> : <MoreHorizontal size={20} />}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[230px] rounded-[14px] border border-hairline bg-surface p-1.5 shadow-[var(--shadow-float)]">
            <Item icon={<HelpCircle size={16} />} onSelect={() => setDialog("why")}>
              Why am I seeing this?
            </Item>
            <Item icon={<Lightbulb size={16} />} onSelect={() => setDialog("improve")}>
              Improve our research
            </Item>
            <Item icon={<Share size={16} />} onSelect={copyLink}>
              Copy link
            </Item>
            {company.domain && !company.isDemo ? (
              <DropdownMenu.Item asChild>
                <a href={`https://${company.domain}`} target="_blank" rel="noopener noreferrer" className="flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-[0.875rem] text-ink outline-none data-[highlighted]:bg-surface-muted">
                  <ExternalLink size={16} /> Company website
                </a>
              </DropdownMenu.Item>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Sheet open={dialog === "why"} onClose={() => setDialog(null)} title="Why am I seeing this?">
        <dl className="space-y-3 text-[0.875rem]">
          <div>
            <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-tertiary">Discovery signal</dt>
            <dd className="mt-0.5 text-ink">{company.discoverySignal ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-tertiary">Research rule matched</dt>
            <dd className="mt-0.5 text-ink">{company.researchRuleMatched ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-tertiary">What is new since yesterday</dt>
            <dd className="mt-0.5 text-ink">{whatsNew ?? "No material change recorded in the last day."}</dd>
          </div>
          <div>
            <dt className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-tertiary">Sources</dt>
            <dd className="mt-1">
              {sources.length ? (
                <ul className="space-y-1.5">
                  {sources.slice(0, 6).map((s) => (
                    <li key={s.id}>
                      <a href={s.canonicalUrl} target="_blank" rel="noopener noreferrer" className="text-blue underline-offset-2 hover:underline">
                        {s.title}
                      </a>
                      <span className="text-secondary">
                        {" "}
                        · {s.publisher} · {formatDate(s.publishedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-secondary">No sources attached.</p>
              )}
            </dd>
          </div>
          <p className="text-[0.75rem] text-tertiary">Last researched {company.lastResearchedAt ? formatDate(company.lastResearchedAt) : "never"}.</p>
        </dl>
      </Sheet>

      <Sheet open={dialog === "improve"} onClose={() => setDialog(null)} title="Improve our research">
        <ImproveForm company={company} onDone={() => setDialog(null)} />
      </Sheet>
    </>
  );
}

function Item({ icon, children, onSelect }: { icon: React.ReactNode; children: React.ReactNode; onSelect: () => void }) {
  return (
    <DropdownMenu.Item onSelect={onSelect} className="flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded-[10px] px-3 text-[0.875rem] text-ink outline-none data-[highlighted]:bg-surface-muted">
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-[22px] bg-surface p-5 pb-[calc(20px+var(--safe-bottom))] shadow-[var(--shadow-float)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-hairline-strong sm:hidden" aria-hidden />
          <Dialog.Title className="font-serif text-[1.25rem] font-semibold text-ink">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div className="mt-3">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ImproveForm({ company, onDone }: { company: Company; onDone: () => void }) {
  const [type, setType] = useState<(typeof FEEDBACK_OPTIONS)[number]["key"]>("too_many_sector");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const needsText = type === "missed_something" || type === "free_text";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitFeedbackAction({ companyId: company.id, feedbackType: type, body });
          setResult(res.ok ? { ok: true, message: res.data?.suggestionId ? "Thanks. A proposed change to the research instructions is waiting for review." : "Thanks. Your feedback was recorded." } : { ok: false, message: res.error });
        });
      }}
      className="space-y-3"
    >
      <p className="text-[0.8125rem] text-secondary">Feedback about {company.name} becomes a proposed change to the research instructions. Nothing changes until a member applies it.</p>
      <div className="grid gap-1.5">
        {FEEDBACK_OPTIONS.map((o) => (
          <label key={o.key} className={cn("flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-[12px] border px-3 text-[0.875rem]", type === o.key ? "border-ink bg-surface-muted" : "border-hairline")}>
            <input type="radio" name="type" value={o.key} checked={type === o.key} onChange={() => setType(o.key)} className="accent-ink" />
            {o.label}
          </label>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required={needsText}
        placeholder={needsText ? "Tell the research what to look for…" : "Optional detail"}
        rows={3}
        maxLength={1000}
        className="w-full rounded-[12px] border border-hairline-strong bg-surface px-3 py-2 text-[0.875rem] text-ink"
      />
      {result ? <p className={cn("text-[0.8125rem]", result.ok ? "text-green" : "text-red")}>{result.message}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          {result?.ok ? "Close" : "Cancel"}
        </Button>
        {!result?.ok ? (
          <Button type="submit" disabled={pending}>
            {pending ? "Proposing…" : "Propose a change"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
