"use client";

import { useState, useTransition } from "react";
import { restorePromptAction } from "@/lib/actions/research";
import { formatDateTime } from "@/lib/domain/format";
import type { Member, PromptVersion } from "@/lib/domain/types";
import { diffLines } from "@/lib/research/patch";
import { Button, Pill } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function VersionHistory({ versions, members }: { versions: PromptVersion[]; members: Member[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byId = new Map(versions.map((v) => [v.id, v]));
  return (
    <ol className="space-y-2">
      {versions.map((v) => {
        const author = members.find((m) => m.userId === v.createdBy)?.displayName ?? "Member";
        const parent = v.parentVersionId ? byId.get(v.parentVersionId) : null;
        const isOpen = open === v.id;
        const diff = isOpen && parent ? diffLines(parent.promptText, v.promptText).filter((l) => l.kind !== "same") : [];
        return (
          <li key={v.id} className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[0.875rem] font-semibold text-ink">
                  v{v.version} {v.active ? <Pill tone="green" className="ml-1">Active</Pill> : null}
                </p>
                <p className="text-[0.75rem] text-secondary">
                  {author} · {formatDateTime(v.createdAt)}
                </p>
                {v.changeNote ? <p className="mt-1 text-[0.8125rem] text-text">{v.changeNote}</p> : null}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setOpen(isOpen ? null : v.id)}>
                  {isOpen ? "Hide" : "Diff"}
                </Button>
                {!v.active ? (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => { await restorePromptAction(v.id); })}>
                    Restore
                  </Button>
                ) : null}
              </div>
            </div>
            {isOpen ? (
              <pre className="mt-3 max-h-[320px] overflow-auto whitespace-pre-wrap rounded-[12px] border border-hairline bg-page p-3 text-[0.75rem] leading-relaxed">
                {parent ? (
                  diff.length ? (
                    diff.map((l, i) => (
                      <span key={i} className={cn("block px-1", l.kind === "added" ? "bg-green-pale text-green" : "bg-red-pale text-red line-through")}>
                        {l.kind === "added" ? "+ " : "− "}
                        {l.text}
                      </span>
                    ))
                  ) : (
                    <span className="text-secondary">Instruction text unchanged (preferences only).</span>
                  )
                ) : (
                  v.promptText
                )}
              </pre>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
