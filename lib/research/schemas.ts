import { z } from "zod";

/** Zod schemas for every model output and network payload (SPEC §12). */

export const evidenceStatusSchema = z.enum(["verified_independent", "official_company_claim", "third_party_report", "analyst_inference", "unknown"]);
export const accessStatusSchema = z.enum(["unknown", "fundraising_reported", "contactable", "verified_open", "expected", "closing_soon", "closed"]);
export const eisStatusSchema = z.enum(["confirmed_documented", "company_claimed", "pending", "unknown", "not_applicable"]);
export const sourceTypeSchema = z.enum(["news", "official", "filing", "research", "media", "other"]);

export const citedSchema = z.object({
  /** URLs from the retrieved set that support this value. */
  sourceUrls: z.array(z.string().url()).default([]),
  evidenceStatus: evidenceStatusSchema.default("unknown"),
});

export const moneySchema = z.object({
  amount: z.number().nullable(),
  currency: z.string().min(3).max(3).nullable(),
  asOf: z.string().nullable(),
}).merge(citedSchema);

export const candidateSchema = z.object({
  name: z.string().min(1).max(120),
  website: z.string().url().nullable(),
  legalName: z.string().max(160).nullable(),
  sector: z.string().min(1).max(60),
  subSector: z.string().max(80).nullable(),
  city: z.string().max(60).nullable(),
  country: z.string().max(60).nullable(),
  stage: z.string().max(40).nullable(),
  teaser: z.string().min(1).max(160),
  description: z.string().max(800),
  discoverySignal: z.string().max(300),
  researchRuleMatched: z.string().max(200),
  tags: z.array(z.string().max(40)).max(6).default([]),
  founders: z.array(z.object({ name: z.string().max(120), role: z.string().max(80), bio: z.string().max(400), profileUrl: z.string().url().nullable() }).merge(citedSchema)).max(6).default([]),
  round: z
    .object({
      stage: z.string().max(40).nullable(),
      target: moneySchema.nullable(),
      preMoney: moneySchema.nullable(),
      postMoney: moneySchema.nullable(),
      reportedCommitted: moneySchema.nullable(),
      claimedStatus: z.enum(["open", "closed", "expected", "unknown"]).default("unknown"),
      closesAt: z.string().nullable(),
      leadInvestors: z.array(z.string().max(100)).max(6).default([]),
    })
    .merge(citedSchema)
    .nullable(),
  access: z
    .object({
      status: accessStatusSchema,
      routeType: z.enum(["official_application", "syndicate", "founder_intro", "spv", "platform", "none"]).default("none"),
      contactOrUrl: z.string().max(300).nullable(),
      minCheque: z.number().nullable(),
      maxCheque: z.number().nullable(),
      currency: z.string().max(3).nullable(),
      notes: z.string().max(400).default(""),
    })
    .merge(citedSchema),
  eis: z.object({ status: eisStatusSchema, note: z.string().max(300).nullable() }).merge(citedSchema),
  facts: z.array(z.object({ key: z.string().max(40), label: z.string().max(60), value: z.string().max(200), currency: z.string().max(3).nullable(), asOf: z.string().nullable() }).merge(citedSchema)).max(8).default([]),
  signals: z.array(z.object({ headline: z.string().max(120), summary: z.string().max(400), type: z.enum(["company", "funding", "product", "team", "risk"]), materiality: z.enum(["high", "medium", "low"]), effectiveAt: z.string().nullable() }).merge(citedSchema)).max(6).default([]),
  openQuestions: z.array(z.string().max(200)).max(8).default([]),
});
export type Candidate = z.infer<typeof candidateSchema>;

export const extractionSchema = z.object({
  candidates: z.array(candidateSchema).max(12),
  events: z
    .array(
      z.object({
        name: z.string().max(160),
        organiser: z.string().max(120),
        eventType: z.string().max(60),
        startAtIso: z.string(),
        endAtIso: z.string().nullable(),
        venue: z.string().max(160).nullable(),
        city: z.string().max(60),
        isOnline: z.boolean().default(false),
        registrationUrl: z.string().url().nullable(),
        accessStatus: z.enum(["open", "invitation_only", "waitlist", "closed", "unknown"]).default("unknown"),
        audienceFit: z.string().max(200),
        significance: z.string().max(300),
        nextAction: z.string().max(200),
      }).merge(citedSchema),
    )
    .max(8)
    .default([]),
  executiveFindings: z.array(z.string().max(300)).max(8).default([]),
});
export type Extraction = z.infer<typeof extractionSchema>;

export const assessmentSchema = z.object({
  aiPriority: z.enum(["high", "medium", "low", "insufficient_evidence"]),
  /** Only when evidence is sufficient; otherwise null. */
  aiScore: z.number().min(0).max(10).nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  summary: z.string().min(10).max(400),
  whyInterested: z.array(z.string().max(200)).max(5),
  risks: z.array(z.string().max(200)).max(6),
  bullCase: z.string().max(400),
  bearCase: z.string().max(400),
  whyNow: z.string().max(300),
  assumptions: z.array(z.string().max(200)).max(5).default([]),
  openQuestions: z.array(z.string().max(200)).max(6).default([]),
  diligenceChecklist: z.array(z.string().max(160)).max(6).default([]),
  nextAction: z.string().max(200),
  breakdown: z
    .array(
      z.object({
        key: z.enum(["team", "product", "traction", "market", "valuation", "access", "timing", "risk"]),
        label: z.string().max(40),
        score: z.number().min(0).max(10).nullable(),
        note: z.string().max(200),
        sourceUrls: z.array(z.string().url()).default([]),
      }),
    )
    .min(4)
    .max(8),
  changeExplanation: z.string().max(300).nullable(),
});
export type AssessmentOutput = z.infer<typeof assessmentSchema>;

export const homeStorySchema = z.object({
  stories: z
    .array(
      z.object({
        storyType: z.enum(["financing", "access", "deadline", "signal", "research"]),
        companyName: z.string().max(120).nullable(),
        headline: z.string().max(110),
        teaser: z.string().max(200),
        priority: z.number().int().min(0).max(100),
        sourceUrl: z.string().url().nullable(),
      }),
    )
    .max(4),
});
