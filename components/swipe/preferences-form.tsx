"use client";

import { useState, useTransition } from "react";
import { savePreferencesAction } from "@/lib/actions/learning";
import type { MemberPreferences } from "@/lib/domain/learning";
import { cn } from "@/lib/utils";

const STAGES = ["Pre-seed", "Seed", "Series A", "Later-stage"];
const EIS: { value: MemberPreferences["eis"]; label: string }[] = [
  { value: "essential", label: "Essential" },
  { value: "prefer", label: "Preferred" },
  { value: "neutral", label: "Doesn’t matter" },
];

/** A member's own preferences. Saved for them only; used to order their deck. */
export function PreferencesForm({ initial, sectors }: { initial: MemberPreferences; sectors: string[] }) {
  const [prefs, setPrefs] = useState<MemberPreferences>(initial);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const set = (patch: Partial<MemberPreferences>) => {
    setPrefs((p) => ({ ...p, ...patch }));
    setMessage(null);
  };
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const sectorState = (s: string) => (prefs.sectorsLike.includes(s) ? "like" : prefs.sectorsAvoid.includes(s) ? "avoid" : "none");
  const cycleSector = (s: string) => {
    const now = sectorState(s);
    if (now === "none") set({ sectorsLike: [...prefs.sectorsLike, s] });
    else if (now === "like") set({ sectorsLike: prefs.sectorsLike.filter((x) => x !== s), sectorsAvoid: [...prefs.sectorsAvoid, s] });
    else set({ sectorsAvoid: prefs.sectorsAvoid.filter((x) => x !== s) });
  };
  const money = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(/[£,\s]/g, "")) || 0)));

  return (
    <div className="space-y-4 rounded-[var(--radius-lg)] border border-hairline bg-surface p-4">
      <Field label="Sectors" hint="Tap once to like, twice to avoid, three times to clear.">
        <div className="flex flex-wrap gap-1.5">
          {sectors.map((s) => {
            const st = sectorState(s);
            return (
              <button key={s} type="button" onClick={() => cycleSector(s)} aria-label={`${s}: ${st === "like" ? "liked" : st === "avoid" ? "avoided" : "no preference"}`} className={cn("min-h-[36px] rounded-full border px-3 text-[0.8125rem] font-medium", st === "like" ? "border-green bg-green/15 text-ink" : st === "avoid" ? "border-red bg-red/10 text-ink line-through" : "border-hairline-strong text-ink")}>
                {s}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="SEIS/EIS">
        <div className="flex flex-wrap gap-1.5">
          {EIS.map((o) => (
            <button key={o.value} type="button" aria-pressed={prefs.eis === o.value} onClick={() => set({ eis: o.value })} className={cn("min-h-[36px] rounded-full border px-3 text-[0.8125rem] font-medium", prefs.eis === o.value ? "border-ink bg-ink text-white" : "border-hairline-strong text-ink")}>
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Stages you prefer">
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => (
            <button key={s} type="button" aria-pressed={prefs.stages.includes(s)} onClick={() => set({ stages: toggle(prefs.stages, s) })} className={cn("min-h-[36px] rounded-full border px-3 text-[0.8125rem] font-medium", prefs.stages.includes(s) ? "border-ink bg-ink text-white" : "border-hairline-strong text-ink")}>
              {s}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Usual cheque (a guide, not a limit)">
        <div className="flex items-center gap-2 text-[0.875rem] text-secondary">
          £<input inputMode="numeric" aria-label="Usual cheque from" value={prefs.chequeMinGbp?.toLocaleString("en-GB") ?? ""} onChange={(e) => set({ chequeMinGbp: money(e.target.value) })} className="min-h-[40px] w-28 rounded-[10px] border border-hairline-strong bg-page px-2 text-ink" />
          to £<input inputMode="numeric" aria-label="Usual cheque to" value={prefs.chequeMaxGbp?.toLocaleString("en-GB") ?? ""} onChange={(e) => set({ chequeMaxGbp: money(e.target.value) })} className="min-h-[40px] w-28 rounded-[10px] border border-hairline-strong bg-page px-2 text-ink" />
        </div>
      </Field>
      <Field label="Anything else the family should know you look for?">
        <textarea value={prefs.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} maxLength={1000} className="w-full rounded-[12px] border border-hairline-strong bg-page px-3 py-2 text-[0.9375rem] text-ink" />
      </Field>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await savePreferencesAction(prefs);
              setMessage(res.ok ? "Saved. Your deck now uses these." : res.error);
            })
          }
          className="inline-flex min-h-[44px] items-center rounded-full bg-ink px-5 text-[0.875rem] font-medium text-white disabled:opacity-60"
        >
          Save preferences
        </button>
        {message ? (
          <p role="status" className="text-[0.8125rem] text-secondary">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[0.8125rem] font-semibold text-ink">{label}</p>
      {hint ? <p className="mb-1.5 text-[0.75rem] text-tertiary">{hint}</p> : <div className="mb-1.5" />}
      {children}
    </div>
  );
}
