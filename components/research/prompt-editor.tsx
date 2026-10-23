"use client";

import { useMemo, useState, useTransition } from "react";
import { savePromptAction } from "@/lib/actions/research";
import type { PromptVersion, ResearchPreferences } from "@/lib/domain/types";
import { diffLines } from "@/lib/research/patch";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * Full-prompt editor with diff preview, change note and optimistic concurrency:
 * if someone else activated a newer version while editing, the save is refused
 * and the conflict is shown rather than overwritten.
 */
export function PromptEditor({ active, config }: { active: PromptVersion; config: ResearchPreferences }) {
  const [text, setText] = useState(active.promptText);
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"read" | "edit" | "preview">("read");
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ tone: "green" | "red" | "amber"; text: string; conflict?: PromptVersion } | null>(null);
  const dirty = text !== active.promptText;
  const diff = useMemo(() => (mode === "preview" ? diffLines(active.promptText, text) : []), [mode, active.promptText, text]);

  const save = () =>
    start(async () => {
      const res = await savePromptAction({ promptText: text, config, changeNote: note, basedOnVersionId: active.id });
      if (res.ok) {
        setStatus({ tone: "green", text: `Saved and activated as v${res.version.version}. It takes effect from the next research run.` });
        setMode("read");
        setNote("");
      } else setStatus({ tone: res.conflict ? "amber" : "red", text: res.error, conflict: res.conflict });
    });

  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.875rem] font-semibold text-ink">
          Current instructions <span className="text-secondary">(v{active.version})</span>
        </p>
        {mode === "read" ? (
          <Button size="sm" variant="outline" onClick={() => setMode("edit")}>
            Edit
          </Button>
        ) : null}
      </div>

      {mode === "read" ? (
        <ReadView text={active.promptText} />
      ) : mode === "edit" ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={18} className="mt-3 w-full rounded-[12px] border border-hairline-strong bg-page px-3 py-2 font-sans text-[0.875rem] leading-relaxed text-ink" aria-label="Research instructions" />
      ) : (
        <pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-[12px] border border-hairline bg-page p-3 text-[0.8125rem] leading-relaxed">
          {diff.map((l, i) => (
            <span key={i} className={cn("block px-1", l.kind === "added" && "bg-green-pale text-green", l.kind === "removed" && "bg-red-pale text-red line-through")}>
              {l.kind === "added" ? "+ " : l.kind === "removed" ? "− " : "  "}
              {l.text}
            </span>
          ))}
        </pre>
      )}

      {mode !== "read" ? (
        <div className="mt-3 space-y-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="What changed and why (optional)" className="min-h-[44px] w-full rounded-[12px] border border-hairline-strong bg-surface px-3 text-[0.875rem] text-ink" aria-label="Change note" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setMode("read"); setText(active.promptText); setStatus(null); }} disabled={pending}>
              Cancel
            </Button>
            {mode === "edit" ? (
              <Button size="sm" variant="outline" onClick={() => setMode("preview")} disabled={!dirty}>
                Preview diff
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setMode("edit")}>
                Back to editing
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={!dirty || pending || text.trim().length < 50}>
              {pending ? "Saving…" : "Save & activate"}
            </Button>
          </div>
        </div>
      ) : null}

      {status ? (
        <div role="status" className={cn("mt-3 rounded-[12px] px-3 py-2 text-[0.8125rem]", status.tone === "green" && "bg-green-pale text-green", status.tone === "red" && "bg-red-pale text-red", status.tone === "amber" && "bg-amber-pale text-amber")}>
          {status.text}
          {status.conflict ? (
            <span className="mt-1 block">
              v{status.conflict.version} was activated at {new Date(status.conflict.createdAt).toLocaleString("en-GB")}. Reload to see it and re-apply your edit; your text has not been lost.
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="mt-3 text-[0.75rem] text-tertiary">All members can edit. Every save creates a numbered, attributable version. Evidence, security and formatting rules are enforced separately and cannot be edited here.</p>
    </div>
  );
}

function ReadView({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const short = text.length > 700 && !expanded;
  return (
    <div className="mt-3">
      <p className={cn("whitespace-pre-wrap text-[0.875rem] leading-relaxed text-text", short && "clamp-6")} style={short ? { display: "-webkit-box", WebkitLineClamp: 8, WebkitBoxOrient: "vertical", overflow: "hidden" } : undefined}>
        {text}
      </p>
      {text.length > 700 ? (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1 text-[0.8125rem] font-medium text-blue">
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
