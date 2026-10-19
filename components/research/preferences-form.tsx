"use client";

import { useState, useTransition } from "react";
import { savePromptAction } from "@/lib/actions/research";
import type { PromptVersion, ResearchPreferences } from "@/lib/domain/types";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/** Preferences are part of the versioned prompt config; saving creates a new version. */
export function PreferencesForm({ active }: { active: PromptVersion }) {
  const [prefs, setPrefs] = useState<ResearchPreferences>(active.config);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(active.config);
  const set = <K extends keyof ResearchPreferences>(k: K, v: ResearchPreferences[K]) => setPrefs((p) => ({ ...p, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await savePromptAction({ promptText: active.promptText, config: prefs, changeNote: "Preferences updated.", basedOnVersionId: active.id });
          setStatus(res.ok ? { ok: true, text: `Saved as v${res.version.version}; applies from the next run.` } : { ok: false, text: res.error });
        });
      }}
      className="rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Max individual cheque (GBP)" hint="Upper cheque size, not an assumed budget.">
          <input type="number" min={1000} step={1000} value={prefs.maxChequeGbp} onChange={(e) => set("maxChequeGbp", Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Daily research time (London)" hint="Runs once per calendar day, DST-aware.">
          <input type="time" value={prefs.researchTimeLocal} onChange={(e) => set("researchTimeLocal", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Geographic focus">
          <input value={prefs.geographicFocus} onChange={(e) => set("geographicFocus", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Event geography">
          <input value={prefs.eventGeography} onChange={(e) => set("eventGeography", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Discovery depth">
          <select value={prefs.discoveryDepth} onChange={(e) => set("discoveryDepth", e.target.value as ResearchPreferences["discoveryDepth"])} className={inputCls}>
            <option value="light">Light — fewer queries, lowest cost</option>
            <option value="balanced">Balanced</option>
            <option value="deep">Deep — more sources, higher cost</option>
          </select>
        </Field>
        <Field label="Daily budget (USD)" hint="Research stops for the day when reached.">
          <input type="number" min={0} step={1} value={prefs.dailyBudgetUsd} onChange={(e) => set("dailyBudgetUsd", Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Sectors to include" hint="Comma-separated. Empty = every sector qualifies.">
          <input value={prefs.sectorsInclude.join(", ")} onChange={(e) => set("sectorsInclude", splitList(e.target.value))} className={inputCls} />
        </Field>
        <Field label="Sectors to exclude" hint="Comma-separated.">
          <input value={prefs.sectorsExclude.join(", ")} onChange={(e) => set("sectorsExclude", splitList(e.target.value))} className={inputCls} />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save as new version"}
        </Button>
        {status ? <p className={cn("text-[13px]", status.ok ? "text-green" : "text-red")}>{status.text}</p> : null}
      </div>
    </form>
  );
}

const inputCls = "mt-1 block min-h-[44px] w-full rounded-[12px] border border-hairline-strong bg-surface px-3 text-[14px] text-ink";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-tertiary">{hint}</span> : null}
    </label>
  );
}

function splitList(v: string) {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
