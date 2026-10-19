import { BookmarkCheck, CircleAlert, CircleCheck, CircleDashed, Sparkles, Zap } from "lucide-react";
import { Pill, type Tone } from "@/components/ui/primitives";
import { accessLabel, accessTone, priorityLabel, type EffectiveAccess } from "@/lib/domain/company-status";
import { stageLabel } from "@/lib/domain/family-consensus";
import type { AiPriority, FamilyStage } from "@/lib/domain/types";
import type { CompanySummary } from "@/lib/domain/summaries";

export function FamilyStagePill({ stage }: { stage: FamilyStage }) {
  const tone: Tone = stage === "shortlisted" ? "green" : stage === "passed" ? "red" : stage === "pending" ? "amber" : "neutral";
  const Icon = stage === "shortlisted" ? BookmarkCheck : stage === "passed" ? CircleAlert : CircleDashed;
  return (
    <Pill tone={tone} icon={<Icon size={13} aria-hidden />}>
      {stageLabel(stage)}
    </Pill>
  );
}

export function AccessPill({ access, compact }: { access: EffectiveAccess; compact?: boolean }) {
  if (access.canInvestNow) {
    return (
      <Pill tone="green" icon={<CircleCheck size={13} aria-hidden />} className="font-semibold uppercase tracking-[0.04em]">
        Can invest now
      </Pill>
    );
  }
  if (compact && access.status === "unknown") return null;
  return <Pill tone={accessTone(access.status)}>{accessLabel(access.status)}</Pill>;
}

export function AiPriorityPill({ priority, score }: { priority: AiPriority; score?: number | null }) {
  const tone: Tone = priority === "high" ? "green" : priority === "medium" ? "amber" : priority === "low" ? "neutral" : "neutral";
  return (
    <Pill tone={tone} icon={<Sparkles size={12} aria-hidden />}>
      {priorityLabel(priority)}
      {score !== null && score !== undefined ? <span className="tnum opacity-80"> · {score.toFixed(1)}</span> : null}
    </Pill>
  );
}

/** Compact "AI: High" text with a status dot, as used in card footers. */
export function AiInline({ priority }: { priority: AiPriority | null }) {
  if (!priority) return <span className="text-[12px] text-tertiary">AI: Not rated</span>;
  const dot = priority === "high" ? "bg-green" : priority === "medium" ? "bg-amber" : priority === "low" ? "bg-tertiary" : "bg-hairline-strong";
  const text = priority === "high" ? "text-green" : priority === "medium" ? "text-amber" : "text-secondary";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${text}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
      {priorityLabel(priority)}
    </span>
  );
}

export function UpdateCue({ summary }: { summary: CompanySummary }) {
  if (summary.recentUpdateCount === 0) return null;
  const label = summary.latestUpdate?.updateType === "research" && summary.recentUpdateCount === 1 ? "New research" : `${summary.recentUpdateCount} update${summary.recentUpdateCount === 1 ? "" : "s"}`;
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-blue">
      <Zap size={12} aria-hidden />
      {label}
    </span>
  );
}

export function CardFlag({ summary }: { summary: CompanySummary }) {
  if (summary.isNew) return <Pill tone="ink">New</Pill>;
  if (summary.access.canInvestNow) return <Pill tone="green">Open</Pill>;
  if (summary.currentRound?.claimedStatus === "open") return <Pill tone="ink">Raising</Pill>;
  if (summary.familyStage === "pending") return <Pill tone="amber">Pending</Pill>;
  return null;
}
