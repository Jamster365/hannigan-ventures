"use client";

import { useState, useTransition } from "react";
import { runResearchNowAction } from "@/lib/actions/run-research";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function RunNowButton({ mode }: { mode: "demo" | "supabase" }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  if (mode === "demo") return <p className="text-[13px] text-tertiary">Manual runs need Supabase and a research API key. See README for setup.</p>;
  return (
    <div className="space-y-2">
      {!confirm ? (
        <Button variant="outline" onClick={() => setConfirm(true)}>
          Run research now
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-text">This will call the research provider and may cost money. Continue?</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await runResearchNowAction();
                setResult(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
                setConfirm(false);
              })
            }
          >
            {pending ? "Running…" : "Yes, run now"}
          </Button>
        </div>
      )}
      {result ? <p className={cn("text-[13px]", result.ok ? "text-green" : "text-red")}>{result.text}</p> : null}
    </div>
  );
}
