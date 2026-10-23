"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { advanceResearchAction, runResearchNowAction } from "@/lib/actions/run-research";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const STEPS = [
  { stage: "searching", label: "Searching the web" },
  { stage: "verifying", label: "Checking sources" },
  { stage: "reading", label: "Reading the evidence" },
  { stage: "assessing", label: "Assessing companies" },
  { stage: "publishing", label: "Publishing" },
] as const;

type Progress = { stage: string | null; detail: string | null };

export function RunNowButton({ mode }: { mode: "demo" | "supabase" }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [progress, setProgress] = useState<Progress>({ stage: null, detail: null });
  const [active, setActive] = useState<{ runId: string; startedAt: number } | null>(null);

  // Pick up a run that is already in progress (started earlier, by someone else, or by the schedule).
  useEffect(() => {
    if (mode !== "supabase") return;
    let cancelled = false;
    fetch("/api/research/progress", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { run: { id: string; status: string; startedAt: string } | null } | null) => {
        const run = body?.run;
        if (!cancelled && run?.status === "running" && Date.now() - Date.parse(run.startedAt) < 3 * 60 * 60_000) setActive({ runId: run.id, startedAt: Date.parse(run.startedAt) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // While a run is active, keep advancing it: each call returns quickly while the
  // web research is still going, and does the verifying/publishing once it is done.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      for (;;) {
        let r: Awaited<ReturnType<typeof advanceResearchAction>>;
        try {
          r = await advanceResearchAction(active.runId);
        } catch {
          r = { done: false };
        }
        if (cancelled) return;
        if (r.done) {
          setResult({ ok: r.ok, text: r.message });
          setActive(null);
          router.refresh();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 6000));
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, router]);

  if (mode === "demo") return <p className="text-[0.8125rem] text-tertiary">Manual runs need Supabase and a research API key. See README for setup.</p>;

  const run = async () => {
    setResult(null);
    setProgress({ stage: null, detail: null });
    setConfirm(false);
    setStarting(true);
    const r = await runResearchNowAction().catch(() => ({ ok: false as const, error: "Could not start the run. Try again." }));
    setStarting(false);
    if (r.ok) setActive({ runId: r.runId, startedAt: Date.now() });
    else setResult({ ok: false, text: r.error });
  };

  return (
    <div className="space-y-3">
      {active ? (
        <RunProgress startedAt={active.startedAt} progress={progress} onProgress={setProgress} />
      ) : !confirm ? (
        <Button variant="outline" disabled={starting} onClick={() => setConfirm(true)}>
          {starting ? "Starting…" : "Run research now"}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.8125rem] text-text">This will call the research provider and may cost money. Continue?</span>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={run}>
            Yes, run now
          </Button>
        </div>
      )}
      {result ? <p className={cn("rounded-[12px] px-3 py-2.5 text-[0.8125rem]", result.ok ? "bg-green-pale text-green" : "bg-red-pale text-red")}>{result.text}</p> : null}
    </div>
  );
}

/**
 * Live run tracker. Progress is read from the run's own record (written by the
 * pipeline at each step) via a plain GET route, independently of the advance
 * loop, whose server actions are queued per client and can take a while.
 */
// `onProgress` is a state setter, so it is stable and safe as an effect dependency.
function RunProgress({ startedAt, progress, onProgress }: { startedAt: number; progress: Progress; onProgress: (p: Progress) => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/research/progress", { cache: "no-store" });
        if (!res.ok) return;
        const { run } = (await res.json()) as { run: { startedAt: string; stage: string | null; detail: string | null } | null };
        // Ignore an earlier run until this one has been created.
        if (!cancelled && run && Date.parse(run.startedAt) >= startedAt - 10_000) onProgress({ stage: run.stage, detail: run.detail });
      } catch {
        // Polling is best-effort; the run's own result still arrives.
      }
    };
    const timer = setInterval(poll, 2000);
    const first = setTimeout(poll, 800);
    return () => {
      cancelled = true;
      clearInterval(tick);
      clearInterval(timer);
      clearTimeout(first);
    };
  }, [startedAt, onProgress]);

  const activeIndex = Math.max(0, STEPS.findIndex((s) => s.stage === progress.stage));
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const fill = ((activeIndex + 0.5) / STEPS.length) * 100;

  return (
    <div className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="relative flex size-9 shrink-0 items-center justify-center" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-pulse rounded-full bg-blue/15" />
          <span className="absolute inline-flex size-6 rounded-full bg-blue/15" />
          <svg viewBox="0 0 24 24" className="relative size-[18px] text-blue" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[1.0625rem] font-semibold text-ink">Researching</p>
          <p className="text-[0.75rem] text-secondary">A thorough search can take 5–15 minutes. You can leave; it finishes on its own.</p>
        </div>
        <span className="tnum text-[0.8125rem] font-medium text-secondary">{clock}</span>
      </div>

      <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className="absolute inset-y-0 left-0 rounded-full bg-blue transition-[width] duration-700 ease-out" style={{ width: `${fill}%` }} />
        <div className="run-progress-sheen absolute inset-y-0 w-1/3 rounded-full" />
      </div>

      <ol className="mt-4 space-y-3">
        {STEPS.map((step, i) => {
          const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
          return (
            <li key={step.stage} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center" aria-hidden="true">
                {state === "done" ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-green text-white">
                    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3.5 8.5 3 3 6-7" />
                    </svg>
                  </span>
                ) : state === "active" ? (
                  <span className="size-5 animate-spin rounded-full border-2 border-blue/25 border-t-blue" />
                ) : (
                  <span className="size-2 rounded-full bg-hairline-strong" />
                )}
              </span>
              <div className="min-w-0">
                <p className={cn("text-[0.875rem]", state === "todo" ? "text-tertiary" : "font-medium text-ink")}>
                  {step.label}
                  <span className="sr-only">{state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}</span>
                </p>
                {state === "active" ? (
                  <p key={progress.detail ?? "starting"} className="run-progress-detail mt-0.5 text-[0.75rem] text-secondary">
                    {progress.detail ?? "Starting the research run…"}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
