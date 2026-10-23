"use client";

import { Check, Copy, FileUp } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/primitives";
import { uploadResearchAction, type UploadResult } from "@/lib/actions/import-research";
import { cn } from "@/lib/utils";

/** Step 1: copy the Claude prompt. */
export function CopyPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(prompt);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          }}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-ink px-4 text-[14px] font-medium text-white"
        >
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copied ? "Copied" : "Copy the Claude prompt"}
        </button>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[13px] font-medium text-secondary">Show the prompt</summary>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-[12px] bg-surface-muted p-3 text-[11px] leading-relaxed text-ink">{prompt}</pre>
      </details>
    </div>
  );
}

/** Step 2: paste or choose the JSON Claude produced, then queue it. */
export function UploadForm() {
  const [text, setText] = useState("");
  const [label, setLabel] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setResult(null);
        start(async () => setResult(await uploadResearchAction({ text, label })));
      }}
      className="space-y-3"
    >
      <label className="block">
        <span className="text-[13px] font-medium text-ink">Name for this batch</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="e.g. UK crowdfunding, late October" className="mt-1 block min-h-[44px] w-full rounded-[12px] border border-hairline-strong bg-surface px-3 text-[14px] text-ink" />
      </label>
      <label className="block">
        <span className="text-[13px] font-medium text-ink">Claude’s reply (the JSON)</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} spellCheck={false} placeholder='Paste the whole reply, or just the { "writeUp": …, "companies": [ … ] } block' className="mt-1 block w-full rounded-[12px] border border-hairline-strong bg-surface px-3 py-2 font-mono text-[12px] text-ink" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setText(await f.text());
            e.target.value = "";
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-hairline-strong px-4 text-[14px] font-medium text-ink">
          <FileUp size={16} aria-hidden /> Choose a file
        </button>
        <Button type="submit" disabled={pending || !text.trim()}>
          {pending ? "Checking…" : "Upload"}
        </Button>
      </div>

      {result ? (
        <div role="status" className={cn("rounded-[12px] p-3 text-[13px]", result.ok ? "bg-green-pale text-ink" : "bg-red-pale text-ink")}>
          {result.ok ? (
            <>
              <p className="font-semibold">
                Queued {result.queued} {result.queued === 1 ? "company" : "companies"} in {result.runs} run{result.runs === 1 ? "" : "s"}.
              </p>
              <p className="mt-1 text-secondary">
                One run is processed every few minutes: every source is fetched and checked, and anything unsupported is left out. Follow progress in <Link href="/research/history" className="font-medium text-blue">Research history</Link>.
              </p>
            </>
          ) : (
            <p className="font-semibold">{result.error}</p>
          )}
          {result.rejected?.length ? (
            <div className="mt-2">
              <p className="font-medium">Not queued ({result.rejected.length}):</p>
              <ul className="mt-1 list-disc pl-5 text-secondary">
                {result.rejected.slice(0, 20).map((r) => (
                  <li key={r.name + r.reason}>
                    {r.name}: {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.ok && result.notes.length ? (
            <ul className="mt-2 list-disc pl-5 text-secondary">
              {result.notes.slice(0, 10).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
