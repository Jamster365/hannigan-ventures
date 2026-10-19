import type { PromptSuggestion, PromptVersion, ResearchFeedback, ResearchRun } from "@/lib/domain/types";
import { DEFAULT_PREFERENCES, DEFAULT_RESEARCH_PROMPT } from "@/lib/research/default-prompt";
import { BROTHER, JAMIE } from "./members";

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const dateOf = (iso: string) => iso.slice(0, 10);

const v11Text = DEFAULT_RESEARCH_PROMPT.replace(/\n\n9\. Permanent HEC[\s\S]*?institutional rounds\.\n/, "\n");

export const DEMO_PROMPT_VERSIONS: PromptVersion[] = [
  {
    id: "pv-10",
    version: 10,
    promptText: v11Text.replace("Prefer a few well-evidenced findings over volume, and do not re-surface unchanged companies.", "Prefer a few well-evidenced findings over volume."),
    config: { ...DEFAULT_PREFERENCES, discoveryDepth: "light" },
    createdBy: JAMIE.userId,
    createdAt: daysAgo(20),
    active: false,
    changeNote: "Initial household prompt (sample).",
    parentVersionId: null,
  },
  {
    id: "pv-11",
    version: 11,
    promptText: v11Text,
    config: DEFAULT_PREFERENCES,
    createdBy: BROTHER.userId,
    createdAt: daysAgo(12),
    active: false,
    changeNote: "Stop re-surfacing unchanged companies; balanced depth.",
    parentVersionId: "pv-10",
  },
  {
    id: "pv-12",
    version: 12,
    promptText: DEFAULT_RESEARCH_PROMPT,
    config: DEFAULT_PREFERENCES,
    createdBy: JAMIE.userId,
    createdAt: daysAgo(6),
    active: true,
    changeNote: "Added permanent HEC / X-HEC programme watch (priority 9).",
    parentVersionId: "pv-11",
  },
];

export const DEMO_FEEDBACK: ResearchFeedback[] = [
  { id: "fb-1", companyId: "co-ferrule", authorUserId: BROTHER.userId, feedbackType: "too_many_sector", body: "We keep seeing grid/energy software. Fewer of these unless there is a signed pilot.", createdAt: daysAgo(1) },
];

export const DEMO_SUGGESTIONS: PromptSuggestion[] = [
  {
    id: "sg-1",
    feedbackId: "fb-1",
    basePromptVersionId: "pv-12",
    suggestedPatch: [
      {
        find: "Every sector qualifies; there are no thematic quotas.",
        replace: "Every sector qualifies; there are no thematic quotas. Down-weight grid and energy-software companies unless there is evidence of a signed pilot or paying customer.",
      },
    ],
    rationale: "Brother flagged repeated energy-software discoveries without commercial evidence. A conditional down-weight preserves the no-quota rule while raising the evidence bar for that niche.",
    expectedImpact: "Fewer pre-pilot energy-software cards; no effect on other sectors.",
    status: "proposed",
    suggestedBy: "ai",
    approvedBy: null,
    appliedVersionId: null,
    createdAt: hoursAgo(20),
  },
];

export const DEMO_RUNS: ResearchRun[] = [
  {
    id: "run-demo-1",
    localDate: dateOf(hoursAgo(10)),
    runKind: "scheduled",
    promptVersionId: "pv-12",
    status: "published",
    startedAt: hoursAgo(10),
    finishedAt: hoursAgo(9.7),
    model: "sample fixture (no model run)",
    sourceCount: 23,
    candidatesCount: 7,
    publishedCount: 3,
    estimatedCostUsd: 0,
    summary: "3 new dossiers (Northgate Surgical, Mosswick Bio, Oriel Materials), 4 home stories, 2 material updates. Sample run record.",
    errorSummary: null,
  },
  {
    id: "run-demo-2",
    localDate: dateOf(daysAgo(1)),
    runKind: "scheduled",
    promptVersionId: "pv-12",
    status: "published",
    startedAt: daysAgo(1),
    finishedAt: daysAgo(0.98),
    model: "sample fixture (no model run)",
    sourceCount: 19,
    candidatesCount: 5,
    publishedCount: 1,
    estimatedCostUsd: 0,
    summary: "Tidewell application route verified; Ferrule syndicate check; Halyard round expected. Sample run record.",
    errorSummary: null,
  },
  {
    id: "run-demo-3",
    localDate: dateOf(daysAgo(2)),
    runKind: "scheduled",
    promptVersionId: "pv-12",
    status: "no_new_research",
    startedAt: daysAgo(2),
    finishedAt: daysAgo(1.99),
    model: "sample fixture (no model run)",
    sourceCount: 0,
    candidatesCount: 0,
    publishedCount: 0,
    estimatedCostUsd: 0,
    summary: "Search provider unavailable; no new verified research published. Sample run record.",
    errorSummary: "Provider timeout after 3 retries (sample).",
  },
  {
    id: "run-demo-4",
    localDate: dateOf(daysAgo(3)),
    runKind: "manual",
    promptVersionId: "pv-11",
    status: "published",
    startedAt: daysAgo(3),
    finishedAt: daysAgo(2.97),
    model: "sample fixture (no model run)",
    sourceCount: 31,
    candidatesCount: 9,
    publishedCount: 2,
    estimatedCostUsd: 0,
    summary: "Manual run after prompt v11. Sample run record.",
    errorSummary: null,
  },
];
