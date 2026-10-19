/**
 * SAMPLE DATA — explicitly labelled demo content for design review.
 *
 * Every company in this file is FICTIONAL. Names, founders, figures, sources
 * and events are invented for layout and interaction testing only and are
 * flagged `isDemo: true`. Nothing here is an investment fact. Source links use
 * the reserved `.invalid` TLD so they can never resolve to a real page.
 *
 * Real research output is produced only by the pipeline in lib/research and
 * persisted in Supabase with provenance.
 */
import type {
  AccessCheck,
  AngelNetwork,
  Assessment,
  Comment,
  Company,
  CompanyBundle,
  CompanyFact,
  CompanyMedia,
  CompanyUpdate,
  EventRecord,
  Founder,
  FundingRound,
  HomeStory,
  Notification,
  Source,
  TeamHighlight,
  Vote,
} from "@/lib/domain/types";
import { BROTHER, DAD, JAMIE } from "./members";

export const DEMO_LABEL = "Sample data — fictional companies for design review";

const NOW = Date.now();
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const daysAhead = (d: number) => new Date(NOW + d * 86_400_000).toISOString();

let sourceSeq = 0;
function src(companyId: string | null, partial: Partial<Source> & Pick<Source, "title" | "publisher" | "sourceType">): Source {
  sourceSeq += 1;
  const id = `src-${sourceSeq.toString().padStart(3, "0")}`;
  const { id: _ignoredId, companyId: _ignoredCompany, ...rest } = partial;
  return {
    canonicalUrl: `https://sample.invalid/${companyId ?? "general"}/${id}`,
    retrievedAt: hoursAgo(6),
    publishedAt: daysAgo(3),
    trustTier: "reputable",
    ...rest,
    id,
    companyId,
  };
}

function fact(companyId: string, fieldKey: string, label: string, value: string | number | null, extra: Partial<CompanyFact> = {}): CompanyFact {
  return {
    id: `${companyId}-fact-${fieldKey}`,
    companyId,
    fieldKey,
    label,
    value,
    asOfDate: extra.asOfDate ?? daysAgo(2),
    evidenceStatus: extra.evidenceStatus ?? "unknown",
    sourceId: extra.sourceId ?? null,
    recordedAt: extra.recordedAt ?? daysAgo(2),
    unit: extra.unit,
    currency: extra.currency,
  };
}

function media(companyId: string, altText: string): CompanyMedia[] {
  // No licensed imagery exists for fictional companies: use the designed
  // typographic fallback (rightsStatus = fallback, url = null).
  return [
    {
      id: `${companyId}-media-hero`,
      companyId,
      kind: "hero",
      url: null,
      isPrimary: true,
      rightsStatus: "fallback",
      altText,
      checkedAt: daysAgo(1),
    },
  ];
}

type CompanySeed = Omit<Company, "createdAt" | "updatedAt" | "isDemo" | "tags"> & { tags?: string[]; updatedAt?: string };

function company(seed: CompanySeed): Company {
  return {
    isDemo: true,
    tags: seed.tags ?? [],
    createdAt: seed.firstDiscoveredAt,
    updatedAt: seed.updatedAt ?? seed.lastResearchedAt ?? seed.firstDiscoveredAt,
    ...seed,
  };
}

const MODEL = "demo-fixture (no model run)";
const PROMPT_V = "v12 (sample)";

// ---------------------------------------------------------------------------
// 1. Larkspur Photonics — shortlisted, AI high, access unknown
// ---------------------------------------------------------------------------
const larkspur = company({
  id: "co-larkspur",
  slug: "larkspur-photonics",
  name: "Larkspur Photonics",
  domain: "larkspur-photonics.invalid",
  sector: "Medtech",
  subSector: "Ophthalmology · Photonics",
  city: "Bristol",
  country: "UK",
  stage: "Seed (pre-round)",
  teaser: "Making advanced retinal imaging smaller, cheaper and more accessible.",
  description:
    "Larkspur is developing a photonic-chip imaging platform intended to reduce the cost and size of high-resolution retinal scanners, with potential applications in early detection of eye disease. (Sample company.)",
  firstDiscoveredAt: daysAgo(3),
  lastResearchedAt: hoursAgo(5),
  discoverySignal: "University spinout listed on a regional deeptech programme roster (sample)",
  researchRuleMatched: "Priority 1 · pre-round allocation; Priority 7 · frontier/university founders",
  tags: ["Photonic chips", "Ophthalmology", "Deeptech"],
  eisStatus: "unknown",
  eisNote: "No EIS/SEIS statement located in sample sources.",
  artwork: { hue: 214, motif: "orbit" },
});
const larkspurSources: Source[] = [
  src(larkspur.id, { title: "Larkspur announces development contract for retinal imaging (sample)", publisher: "Gov.uk (sample)", sourceType: "official", publishedAt: daysAgo(5), trustTier: "primary", claimType: "Grant / contract" }),
  src(larkspur.id, { title: "Larkspur's photonic chips could transform eye care (sample)", publisher: "Photonics Journal (sample)", sourceType: "news", publishedAt: daysAgo(17), claimType: "Technology description" }),
  src(larkspur.id, { title: "Company incorporation details (sample)", publisher: "Companies House (sample)", sourceType: "filing", publishedAt: daysAgo(28), trustTier: "primary", claimType: "Incorporation" }),
  src(larkspur.id, { title: "University research background (sample)", publisher: "University of Bristol (sample)", sourceType: "research", publishedAt: daysAgo(31), claimType: "Research lineage" }),
  src(larkspur.id, { title: "Founder public profile (sample)", publisher: "Public profile (sample)", sourceType: "media", publishedAt: daysAgo(40), trustTier: "secondary", claimType: "Founder background" }),
  src(larkspur.id, { title: "Ophthalmic imaging market overview (sample)", publisher: "Industry report (sample)", sourceType: "research", publishedAt: daysAgo(44), claimType: "Market context" }),
];
const larkspurBundle: CompanyBundle = {
  company: larkspur,
  media: media(larkspur.id, "Larkspur Photonics artwork"),
  facts: [
    fact(larkspur.id, "stage", "Stage", "Seed (pre-round)", { evidenceStatus: "analyst_inference", sourceId: larkspurSources[1].id }),
    fact(larkspur.id, "target_raise", "Target raise", null, { evidenceStatus: "unknown" }),
    fact(larkspur.id, "valuation", "Valuation", null, { evidenceStatus: "unknown" }),
    fact(larkspur.id, "grant", "Development contract", "£480k (sample)", { evidenceStatus: "official_company_claim", sourceId: larkspurSources[0].id, currency: "GBP" }),
    fact(larkspur.id, "headcount", "Team size", "6–10 (estimated)", { evidenceStatus: "analyst_inference", sourceId: larkspurSources[4].id }),
  ],
  rounds: [
    {
      id: "rd-larkspur-1",
      companyId: larkspur.id,
      stage: "Seed (pre-round)",
      targetAmount: null,
      currency: null,
      preMoney: null,
      postMoney: null,
      reportedCommitted: null,
      openedAt: null,
      closesAt: null,
      claimedStatus: "unknown",
      leadInvestors: [],
      evidenceStatus: "unknown",
      sourceId: null,
      isCurrent: true,
    },
  ],
  accessChecks: [],
  assessment: {
    id: "as-larkspur",
    companyId: larkspur.id,
    runId: "run-demo-1",
    aiPriority: "high",
    aiScore: 8.2,
    confidence: "medium",
    summary: "High potential, early stage, meaningful technical differentiation. Requires more evidence on clinical validation and commercial strategy.",
    whyInterested: [
      "Potentially differentiated photonic technology with a strong research base.",
      "Large market for earlier and more accessible eye imaging.",
      "Experienced technical founders with relevant academic and industry background.",
    ],
    risks: [
      "Clinical validation still early.",
      "Regulatory pathway and timelines unclear.",
      "Valuation and terms not yet disclosed.",
      "Competing technologies from established players.",
    ],
    bullCase: "If the chip-scale approach reaches clinical-grade resolution at a fraction of device cost, it opens primary-care and home screening markets that incumbents cannot serve.",
    bearCase: "Photonic integration programmes often slip; without disclosed terms or clinical data the opportunity may be priced for optimism before evidence arrives.",
    whyNow: "Recent public development contract and an apparent pre-round window (sample signal).",
    assumptions: ["Technology description from secondary coverage is accurate.", "Founders intend to raise within 6–9 months."],
    openQuestions: ["Pre-money expectations?", "Is an SEIS/EIS advance assurance in place?", "Who holds the foundational IP?"],
    diligenceChecklist: ["Speak to founders about round timing", "Verify grant terms", "Clinical adviser view on validation path"],
    nextAction: "Monitor founder updates and syndicate routes; request intro before a formal round opens.",
    breakdown: [
      { key: "team", label: "Founder / team", score: 8, note: "Relevant academic and industry background (sample).", sourceIds: [larkspurSources[3].id, larkspurSources[4].id] },
      { key: "product", label: "Product / defensibility", score: 8, note: "Photonic-chip approach appears differentiated.", sourceIds: [larkspurSources[1].id] },
      { key: "traction", label: "Traction", score: 6, note: "Public development contract; no customers yet.", sourceIds: [larkspurSources[0].id] },
      { key: "market", label: "Market / model", score: 8, note: "Large, under-served screening market.", sourceIds: [larkspurSources[5].id] },
      { key: "valuation", label: "Valuation / terms", score: null, note: "Unrated — terms undisclosed.", sourceIds: [] },
      { key: "access", label: "Access / timing", score: 5, note: "No confirmed allocation route.", sourceIds: [] },
    ],
    modelVersion: MODEL,
    promptVersion: PROMPT_V,
    createdAt: hoursAgo(5),
    sourceIds: larkspurSources.map((s) => s.id),
  },
  founders: [
    { id: "f-larkspur-1", companyId: larkspur.id, name: "Founder A (sample)", role: "Co-founder & CEO", bio: "Photonics researcher; previously at a deeptech spinout (sample bio).", profileUrl: null, evidenceStatus: "third_party_report", sourceId: larkspurSources[4].id },
    { id: "f-larkspur-2", companyId: larkspur.id, name: "Founder B (sample)", role: "Co-founder & CTO", bio: "Optical engineering background; formerly led a research lab (sample bio).", profileUrl: null, evidenceStatus: "third_party_report", sourceId: larkspurSources[3].id },
  ],
  teamHighlights: [
    { text: "6–10 employees (estimated)", evidenceStatus: "analyst_inference", sourceId: larkspurSources[4].id },
    { text: "Strong academic and industry background", evidenceStatus: "third_party_report", sourceId: larkspurSources[3].id },
    { text: "Advisers from ophthalmology and photonics", evidenceStatus: "official_company_claim", sourceId: larkspurSources[1].id },
  ],
  votes: [
    { companyId: larkspur.id, userId: JAMIE.userId, vote: "interested", score: 8, updatedAt: hoursAgo(2) },
    { companyId: larkspur.id, userId: BROTHER.userId, vote: "interested", score: 7, updatedAt: hoursAgo(5) },
    { companyId: larkspur.id, userId: DAD.userId, vote: "unsure", score: 6, updatedAt: hoursAgo(26) },
  ],
  comments: [
    { id: "c-larkspur-1", companyId: larkspur.id, authorUserId: JAMIE.userId, body: "Really interesting technology. The differentiation looks strong and early cases are encouraging.", createdAt: hoursAgo(2), editedAt: null, deletedAt: null, likedBy: [BROTHER.userId, DAD.userId] },
    { id: "c-larkspur-2", companyId: larkspur.id, authorUserId: BROTHER.userId, body: "Agree, but would like to understand the valuation and likely timeline.", createdAt: hoursAgo(5), editedAt: null, deletedAt: null, likedBy: [JAMIE.userId] },
    { id: "c-larkspur-3", companyId: larkspur.id, authorUserId: DAD.userId, body: "Can you find more on the regulatory pathway and likely time to market?", createdAt: hoursAgo(26), editedAt: null, deletedAt: null, likedBy: [JAMIE.userId] },
  ],
  updates: [
    { id: "u-larkspur-1", companyId: larkspur.id, updateType: "research", headline: "New research added", summary: "Additional details on government contract and early patient imaging.", materiality: "medium", sourceId: larkspurSources[0].id, runId: "run-demo-1", effectiveAt: hoursAgo(5), detectedAt: hoursAgo(5) },
    { id: "u-larkspur-2", companyId: larkspur.id, updateType: "company", headline: "Company update", summary: "Reported development contract worth £480k (sample figure).", change: [{ field: "Development contract", from: null, to: "£480k (sample)" }], materiality: "high", sourceId: larkspurSources[0].id, runId: "run-demo-2", effectiveAt: daysAgo(5), detectedAt: daysAgo(5) },
    { id: "u-larkspur-3", companyId: larkspur.id, updateType: "product", headline: "Media coverage", summary: "Featured in a photonics trade publication (sample).", materiality: "low", sourceId: larkspurSources[1].id, runId: null, effectiveAt: daysAgo(17), detectedAt: daysAgo(17) },
    { id: "u-larkspur-4", companyId: larkspur.id, updateType: "research", headline: "Initial research", summary: "Company incorporated and early technology details.", materiality: "low", sourceId: larkspurSources[2].id, runId: null, effectiveAt: daysAgo(28), detectedAt: daysAgo(28) },
  ],
  sources: larkspurSources,
  bookmarkedBy: [JAMIE.userId],
};

// ---------------------------------------------------------------------------
// 2. Tidewell Diagnostics — shortlisted, closing soon, verified route (sample)
// ---------------------------------------------------------------------------
const tidewell = company({
  id: "co-tidewell",
  slug: "tidewell-diagnostics",
  name: "Tidewell Diagnostics",
  domain: "tidewell.invalid",
  sector: "Healthtech",
  subSector: "Diagnostics",
  city: "London",
  country: "UK",
  stage: "Seed",
  teaser: "Lab-grade hormone diagnostics designed for the home.",
  description: "Tidewell is building at-home hormone testing with the aim of matching laboratory accuracy for personalised care. (Sample company.)",
  firstDiscoveredAt: daysAgo(21),
  lastResearchedAt: hoursAgo(3),
  discoverySignal: "Public application page on an angel platform (sample)",
  researchRuleMatched: "Priority 1 · actual allocation before close",
  tags: ["Diagnostics", "Women's health", "B2C"],
  eisStatus: "company_claimed",
  eisNote: "Company states EIS advance assurance obtained (sample). HMRC advance assurance is not a guarantee of relief for an individual investment.",
  artwork: { hue: 168, motif: "wave" },
});
const tidewellSources: Source[] = [
  src(tidewell.id, { title: "Tidewell seed round application page (sample)", publisher: "Angel platform (sample)", sourceType: "official", publishedAt: daysAgo(9), trustTier: "primary", claimType: "Round terms", retrievedAt: hoursAgo(20) }),
  src(tidewell.id, { title: "Tidewell reports £1.4m first close (sample)", publisher: "Startup news (sample)", sourceType: "news", publishedAt: daysAgo(1), claimType: "Financing" }),
  src(tidewell.id, { title: "Tidewell product page (sample)", publisher: "Company website (sample)", sourceType: "official", publishedAt: daysAgo(60), trustTier: "primary", claimType: "Product" }),
  src(tidewell.id, { title: "Confirmation statement (sample)", publisher: "Companies House (sample)", sourceType: "filing", publishedAt: daysAgo(90), trustTier: "primary", claimType: "Filing" }),
];
const tidewellBundle: CompanyBundle = {
  company: tidewell,
  media: media(tidewell.id, "Tidewell Diagnostics artwork"),
  facts: [
    fact(tidewell.id, "stage", "Stage", "Seed", { evidenceStatus: "official_company_claim", sourceId: tidewellSources[0].id }),
    fact(tidewell.id, "target_raise", "Target raise", 2_000_000, { currency: "GBP", evidenceStatus: "official_company_claim", sourceId: tidewellSources[0].id }),
    fact(tidewell.id, "committed", "Reported committed", 1_400_000, { currency: "GBP", evidenceStatus: "third_party_report", sourceId: tidewellSources[1].id }),
    fact(tidewell.id, "pre_money", "Pre-money valuation", 9_000_000, { currency: "GBP", evidenceStatus: "official_company_claim", sourceId: tidewellSources[0].id }),
    fact(tidewell.id, "revenue", "Revenue", null, { evidenceStatus: "unknown" }),
  ],
  rounds: [
    {
      id: "rd-tidewell-1",
      companyId: tidewell.id,
      stage: "Seed",
      targetAmount: 2_000_000,
      currency: "GBP",
      preMoney: 9_000_000,
      postMoney: null,
      reportedCommitted: 1_400_000,
      openedAt: daysAgo(9),
      closesAt: daysAhead(12),
      claimedStatus: "open",
      leadInvestors: ["Specialist health investor (sample)"],
      evidenceStatus: "official_company_claim",
      sourceId: tidewellSources[0].id,
      isCurrent: true,
    },
  ],
  accessChecks: [
    {
      id: "ac-tidewell-1",
      companyId: tidewell.id,
      accessStatus: "closing_soon",
      routeType: "official_application",
      contactOrUrl: "https://sample.invalid/co-tidewell/apply",
      minCheque: 10_000,
      maxCheque: 100_000,
      currency: "GBP",
      checkedAt: hoursAgo(20),
      expiresAt: daysAhead(12),
      verifier: "research-run (sample)",
      sourceId: tidewellSources[0].id,
      notes: "Public application live with stated minimum (sample). Allocation not guaranteed; final close expected within two weeks.",
    },
  ],
  assessment: {
    id: "as-tidewell",
    companyId: tidewell.id,
    runId: "run-demo-1",
    aiPriority: "high",
    aiScore: 7.4,
    confidence: "medium",
    summary: "Credible consumer diagnostics play with a live, time-limited route. Evidence on accuracy claims is company-provided.",
    whyInterested: ["Live application route with stated minimum cheque.", "Clear consumer need and recurring-test model.", "Strong reported investor demand (sample)."],
    risks: ["Accuracy claims are company-sourced.", "Regulated product; CE/UKCA status not located.", "Consumer acquisition costs unknown."],
    bullCase: "Recurring home testing with clinician integration could become a category leader.",
    bearCase: "Lab-grade accuracy at home is a claim many have made; regulatory and CAC risk remain.",
    whyNow: "Round closing within two weeks (sample deadline).",
    assumptions: ["Application page reflects current terms."],
    openQuestions: ["Independent validation data?", "Post-money and option pool?"],
    diligenceChecklist: ["Request validation study", "Confirm EIS advance assurance letter", "Check regulatory classification"],
    nextAction: "Decide before the stated close; request the validation study first.",
    breakdown: [
      { key: "team", label: "Founder / team", score: 7, note: "Clinical and commercial mix (sample).", sourceIds: [tidewellSources[2].id] },
      { key: "product", label: "Product / defensibility", score: 6, note: "Accuracy claims company-sourced.", sourceIds: [tidewellSources[2].id] },
      { key: "traction", label: "Traction", score: 7, note: "First close reported (sample).", sourceIds: [tidewellSources[1].id] },
      { key: "market", label: "Market / model", score: 7, note: "Recurring consumer diagnostics.", sourceIds: [] },
      { key: "valuation", label: "Valuation / terms", score: 6, note: "Pre-money stated; post-money unknown.", sourceIds: [tidewellSources[0].id] },
      { key: "access", label: "Access / timing", score: 9, note: "Verified live route (sample).", sourceIds: [tidewellSources[0].id] },
    ],
    modelVersion: MODEL,
    promptVersion: PROMPT_V,
    createdAt: hoursAgo(3),
    sourceIds: tidewellSources.map((s) => s.id),
  },
  founders: [
    { id: "f-tidewell-1", companyId: tidewell.id, name: "Founder C (sample)", role: "CEO", bio: "Former clinical biochemist (sample bio).", profileUrl: null, evidenceStatus: "official_company_claim", sourceId: tidewellSources[2].id },
  ],
  teamHighlights: [{ text: "Clinical advisory board listed on company site", evidenceStatus: "official_company_claim", sourceId: tidewellSources[2].id }],
  votes: [
    { companyId: tidewell.id, userId: JAMIE.userId, vote: "interested", score: 7, updatedAt: daysAgo(4) },
    { companyId: tidewell.id, userId: DAD.userId, vote: "interested", score: 8, updatedAt: daysAgo(2) },
  ],
  comments: [
    { id: "c-tidewell-1", companyId: tidewell.id, authorUserId: DAD.userId, body: "Ask about next round timeline and whether individual angels can still get an allocation.", createdAt: daysAgo(2), editedAt: null, deletedAt: null, likedBy: [] },
  ],
  updates: [
    { id: "u-tidewell-1", companyId: tidewell.id, updateType: "funding", headline: "Tidewell reports £1.4m first close", summary: "Strong investor demand reported; final close expected within two weeks (sample).", change: [{ field: "Reported committed", from: "£0.9m (sample)", to: "£1.4m (sample)" }], materiality: "high", sourceId: tidewellSources[1].id, runId: "run-demo-1", effectiveAt: hoursAgo(2), detectedAt: hoursAgo(2) },
    { id: "u-tidewell-2", companyId: tidewell.id, updateType: "funding", headline: "Application route verified", summary: "Public application page live with £10k minimum (sample).", materiality: "high", sourceId: tidewellSources[0].id, runId: "run-demo-2", effectiveAt: daysAgo(1), detectedAt: daysAgo(1) },
    { id: "u-tidewell-3", companyId: tidewell.id, updateType: "family", headline: "Promoted to shortlist", summary: "Dad's Interested vote brought the count to 2 of 3.", materiality: "medium", sourceId: null, runId: null, effectiveAt: daysAgo(2), detectedAt: daysAgo(2) },
  ],
  sources: tidewellSources,
  bookmarkedBy: [],
};

// ---------------------------------------------------------------------------
// 3. Quillon Verify — pending (1 interested), contactable
// ---------------------------------------------------------------------------
const quillon = company({
  id: "co-quillon",
  slug: "quillon-verify",
  name: "Quillon Verify",
  domain: "quillon.invalid",
  sector: "Software",
  subSector: "Developer tools · AI safety",
  city: "London",
  country: "UK",
  stage: "Pre-seed",
  teaser: "Formal verification for AI-written code in safety-critical systems.",
  description: "Quillon applies formal methods to check AI-generated code against specifications before it ships into regulated systems. (Sample company.)",
  firstDiscoveredAt: daysAgo(10),
  lastResearchedAt: hoursAgo(7),
  discoverySignal: "Accelerator cohort announcement (sample)",
  researchRuleMatched: "Priority 4 · accelerator residency; Priority 7 · frontier-lab founders",
  tags: ["Formal methods", "AI tooling", "B2B"],
  eisStatus: "company_claimed",
  eisNote: "SEIS claimed by company in cohort materials (sample).",
  artwork: { hue: 262, motif: "grid" },
});
const quillonSources: Source[] = [
  src(quillon.id, { title: "Accelerator cohort announcement (sample)", publisher: "Accelerator blog (sample)", sourceType: "official", publishedAt: daysAgo(12), trustTier: "primary", claimType: "Programme participation" }),
  src(quillon.id, { title: "Founder talk on verifying generated code (sample)", publisher: "Conference recording (sample)", sourceType: "media", publishedAt: daysAgo(30), claimType: "Technical approach" }),
  src(quillon.id, { title: "Quillon technical blog (sample)", publisher: "Company website (sample)", sourceType: "official", publishedAt: daysAgo(15), trustTier: "primary", claimType: "Product" }),
];
const quillonBundle: CompanyBundle = {
  company: quillon,
  media: media(quillon.id, "Quillon Verify artwork"),
  facts: [
    fact(quillon.id, "stage", "Stage", "Pre-seed", { evidenceStatus: "official_company_claim", sourceId: quillonSources[0].id }),
    fact(quillon.id, "target_raise", "Target raise", null),
    fact(quillon.id, "valuation", "Valuation", null),
    fact(quillon.id, "pilots", "Design partners", "2 pilots (company claim, sample)", { evidenceStatus: "official_company_claim", sourceId: quillonSources[2].id }),
  ],
  rounds: [
    { id: "rd-quillon-1", companyId: quillon.id, stage: "Pre-seed", targetAmount: null, currency: null, preMoney: null, postMoney: null, reportedCommitted: null, openedAt: null, closesAt: null, claimedStatus: "expected", leadInvestors: [], evidenceStatus: "analyst_inference", sourceId: quillonSources[0].id, isCurrent: true },
  ],
  accessChecks: [
    { id: "ac-quillon-1", companyId: quillon.id, accessStatus: "contactable", routeType: "founder_intro", contactOrUrl: "Intro via accelerator partner (sample)", minCheque: null, maxCheque: null, currency: null, checkedAt: daysAgo(1), expiresAt: null, verifier: "research-run (sample)", sourceId: quillonSources[0].id, notes: "Credible intro route; no live round or allocation confirmed." },
  ],
  assessment: {
    id: "as-quillon",
    companyId: quillon.id,
    runId: "run-demo-1",
    aiPriority: "high",
    aiScore: 7.6,
    confidence: "medium",
    summary: "Timely problem with a technically rigorous approach; commercial pull still to be demonstrated.",
    whyInterested: ["Clear need as AI-generated code enters regulated systems.", "Founders have formal-methods depth (sample).", "Accelerator backing and pilots reported."],
    risks: ["Pre-revenue; pilots unpaid.", "Incumbent static-analysis vendors could add similar features.", "Round not yet open."],
    bullCase: "Becomes the compliance layer for AI-written code in aerospace, medical and automotive software.",
    bearCase: "Market may standardise on tooling from model providers themselves.",
    whyNow: "Cohort demo day approaching (sample).",
    assumptions: ["Pilot claims are accurate."],
    openQuestions: ["Pricing model?", "Any paid contracts?"],
    diligenceChecklist: ["Reference call with a pilot", "Review verification benchmarks"],
    nextAction: "Request intro now to be early for the pre-seed.",
    breakdown: [
      { key: "team", label: "Founder / team", score: 8, note: "Formal methods background (sample).", sourceIds: [quillonSources[1].id] },
      { key: "product", label: "Product / defensibility", score: 7, note: "Rigorous but early.", sourceIds: [quillonSources[2].id] },
      { key: "traction", label: "Traction", score: 5, note: "Unpaid pilots.", sourceIds: [quillonSources[2].id] },
      { key: "market", label: "Market / model", score: 8, note: "Growing regulatory pressure.", sourceIds: [] },
      { key: "valuation", label: "Valuation / terms", score: null, note: "Unrated — no terms.", sourceIds: [] },
      { key: "access", label: "Access / timing", score: 7, note: "Warm intro route exists.", sourceIds: [quillonSources[0].id] },
    ],
    modelVersion: MODEL,
    promptVersion: PROMPT_V,
    createdAt: hoursAgo(7),
    sourceIds: quillonSources.map((s) => s.id),
  },
  founders: [
    { id: "f-quillon-1", companyId: quillon.id, name: "Founder D (sample)", role: "Co-founder & CEO", bio: "Formerly a verification engineer at a large lab (sample bio).", profileUrl: null, evidenceStatus: "third_party_report", sourceId: quillonSources[1].id },
    { id: "f-quillon-2", companyId: quillon.id, name: "Founder E (sample)", role: "Co-founder & CTO", bio: "PhD in programming languages (sample bio).", profileUrl: null, evidenceStatus: "third_party_report", sourceId: quillonSources[1].id },
  ],
  teamHighlights: [{ text: "Cohort member of a London accelerator (sample)", evidenceStatus: "official_company_claim", sourceId: quillonSources[0].id }],
  votes: [{ companyId: quillon.id, userId: JAMIE.userId, vote: "interested", score: 7, updatedAt: daysAgo(3) }],
  comments: [{ id: "c-quillon-1", companyId: quillon.id, authorUserId: JAMIE.userId, body: "Worth a look — the timing on AI code verification feels right.", createdAt: daysAgo(3), editedAt: null, deletedAt: null, likedBy: [] }],
  updates: [
    { id: "u-quillon-1", companyId: quillon.id, updateType: "research", headline: "New research", summary: "Technical blog and pilot claims added (sample).", materiality: "medium", sourceId: quillonSources[2].id, runId: "run-demo-1", effectiveAt: hoursAgo(7), detectedAt: hoursAgo(7) },
    { id: "u-quillon-2", companyId: quillon.id, updateType: "team", headline: "Accelerator cohort announced", summary: "Quillon listed in the new cohort (sample).", materiality: "medium", sourceId: quillonSources[0].id, runId: null, effectiveAt: daysAgo(12), detectedAt: daysAgo(10) },
  ],
  sources: quillonSources,
  bookmarkedBy: [JAMIE.userId, BROTHER.userId],
};

// ---------------------------------------------------------------------------
// 4. Northgate Surgical — NEW, no votes, AI high
// ---------------------------------------------------------------------------
const northgate = company({
  id: "co-northgate",
  slug: "northgate-surgical",
  name: "Northgate Surgical",
  domain: "northgate-surgical.invalid",
  sector: "Medtech",
  subSector: "Surgical robotics",
  city: "Cambridge",
  country: "UK",
  stage: "Seed",
  teaser: "Robotic micro-instruments for cochlear implant surgery.",
  description: "Northgate is developing robotic assistance for cochlear implant insertion, targeting fewer complications and shorter procedures. (Sample company.)",
  firstDiscoveredAt: daysAgo(2),
  lastResearchedAt: hoursAgo(4),
  discoverySignal: "Grant award listing and a university programme page (sample)",
  researchRuleMatched: "Priority 3 · Cambridge programmes",
  tags: ["Robotics", "ENT", "Deeptech"],
  eisStatus: "unknown",
  artwork: { hue: 20, motif: "facet" },
});
const northgateSources: Source[] = [
  src(northgate.id, { title: "Grant award listing (sample)", publisher: "Funding body (sample)", sourceType: "official", publishedAt: daysAgo(4), trustTier: "primary", claimType: "Grant" }),
  src(northgate.id, { title: "Programme page (sample)", publisher: "University programme (sample)", sourceType: "research", publishedAt: daysAgo(20), claimType: "Programme participation" }),
  src(northgate.id, { title: "Trade coverage of pre-clinical results (sample)", publisher: "Medical technology news (sample)", sourceType: "news", publishedAt: daysAgo(1), claimType: "Technical milestone" }),
];
const northgateBundle: CompanyBundle = {
  company: northgate,
  media: media(northgate.id, "Northgate Surgical artwork"),
  facts: [
    fact(northgate.id, "stage", "Stage", "Seed", { evidenceStatus: "third_party_report", sourceId: northgateSources[2].id }),
    fact(northgate.id, "target_raise", "Target raise", 4_000_000, { currency: "GBP", evidenceStatus: "third_party_report", sourceId: northgateSources[2].id }),
    fact(northgate.id, "valuation", "Valuation", null),
    fact(northgate.id, "grant", "Grant", "Awarded (amount undisclosed, sample)", { evidenceStatus: "official_company_claim", sourceId: northgateSources[0].id }),
  ],
  rounds: [
    { id: "rd-northgate-1", companyId: northgate.id, stage: "Seed", targetAmount: 4_000_000, currency: "GBP", preMoney: null, postMoney: null, reportedCommitted: null, openedAt: null, closesAt: null, claimedStatus: "unknown", leadInvestors: [], evidenceStatus: "third_party_report", sourceId: northgateSources[2].id, isCurrent: true },
  ],
  accessChecks: [
    { id: "ac-northgate-1", companyId: northgate.id, accessStatus: "fundraising_reported", routeType: "none", contactOrUrl: null, minCheque: null, maxCheque: null, currency: null, checkedAt: hoursAgo(4), expiresAt: null, verifier: "research-run (sample)", sourceId: northgateSources[2].id, notes: "A trade article reports a seed target; no application route or founder contact verified." },
  ],
  assessment: {
    id: "as-northgate",
    companyId: northgate.id,
    runId: "run-demo-1",
    aiPriority: "high",
    aiScore: 7.9,
    confidence: "medium",
    summary: "Strong technical signals and a focused clinical niche; access route not yet established.",
    whyInterested: ["Pre-clinical results reported (sample).", "Grant-backed with university programme support.", "Clear procedure-level value proposition."],
    risks: ["Long regulatory path for surgical robotics.", "Capital intensity relative to a £4m seed (sample).", "No verified access route."],
    bullCase: "Procedure-specific robotics can reach adoption faster than general platforms.",
    bearCase: "Niche volumes may not justify device economics.",
    whyNow: "Newly reported seed target (sample).",
    assumptions: ["Trade coverage reflects founder intent."],
    openQuestions: ["Lead investor?", "Clinical trial timeline?"],
    diligenceChecklist: ["Find syndicate or lead", "ENT surgeon adviser view"],
    nextAction: "Identify the lead and ask for allocation window.",
    breakdown: [
      { key: "team", label: "Founder / team", score: 7, note: "Clinical-engineering mix (sample).", sourceIds: [northgateSources[1].id] },
      { key: "product", label: "Product / defensibility", score: 8, note: "Pre-clinical results (sample).", sourceIds: [northgateSources[2].id] },
      { key: "traction", label: "Traction", score: 5, note: "Pre-revenue.", sourceIds: [] },
      { key: "market", label: "Market / model", score: 7, note: "Defined procedure market.", sourceIds: [] },
      { key: "valuation", label: "Valuation / terms", score: null, note: "Unrated.", sourceIds: [] },
      { key: "access", label: "Access / timing", score: 4, note: "Fundraising reported only.", sourceIds: [northgateSources[2].id] },
    ],
    modelVersion: MODEL,
    promptVersion: PROMPT_V,
    createdAt: hoursAgo(4),
    sourceIds: northgateSources.map((s) => s.id),
  },
  founders: [{ id: "f-northgate-1", companyId: northgate.id, name: "Founder F (sample)", role: "CEO", bio: "Surgical robotics engineer (sample bio).", profileUrl: null, evidenceStatus: "third_party_report", sourceId: northgateSources[1].id }],
  teamHighlights: [{ text: "University programme participant (sample)", evidenceStatus: "official_company_claim", sourceId: northgateSources[1].id }],
  votes: [],
  comments: [],
  updates: [
    { id: "u-northgate-1", companyId: northgate.id, updateType: "research", headline: "New company added", summary: "Discovered via grant listing; seed target reported (sample).", materiality: "high", sourceId: northgateSources[2].id, runId: "run-demo-1", effectiveAt: hoursAgo(4), detectedAt: hoursAgo(4) },
  ],
  sources: northgateSources,
  bookmarkedBy: [],
};

// ---------------------------------------------------------------------------
// 5. Ferrule Grid — pending, stale verification
// ---------------------------------------------------------------------------
const ferrule = company({
  id: "co-ferrule",
  slug: "ferrule-grid",
  name: "Ferrule Grid",
  domain: "ferrule.invalid",
  sector: "Climate",
  subSector: "Energy software",
  city: "Manchester",
  country: "UK",
  stage: "Pre-seed",
  teaser: "Grid-constraint optimisation for distribution network operators.",
  description: "Ferrule's software helps network operators connect more renewables without new copper in the ground. (Sample company.)",
  firstDiscoveredAt: daysAgo(14),
  lastResearchedAt: daysAgo(5),
  discoverySignal: "Angel syndicate deal page (sample)",
  researchRuleMatched: "Priority 6 · angel-network access",
  tags: ["Energy", "B2B SaaS"],
  eisStatus: "pending",
  eisNote: "Advance assurance application reported as submitted (sample).",
  artwork: { hue: 96, motif: "field" },
});
const ferruleSources: Source[] = [
  src(ferrule.id, { title: "Syndicate deal page (sample)", publisher: "Angel syndicate (sample)", sourceType: "official", publishedAt: daysAgo(6), trustTier: "primary", claimType: "Round terms", retrievedAt: daysAgo(5) }),
  src(ferrule.id, { title: "Ferrule wins innovation award (sample)", publisher: "Regional press (sample)", sourceType: "news", publishedAt: daysAgo(40), claimType: "Award" }),
];
const ferruleBundle: CompanyBundle = {
  company: ferrule,
  media: media(ferrule.id, "Ferrule Grid artwork"),
  facts: [
    fact(ferrule.id, "stage", "Stage", "Pre-seed", { evidenceStatus: "official_company_claim", sourceId: ferruleSources[0].id }),
    fact(ferrule.id, "target_raise", "Target raise", 750_000, { currency: "GBP", evidenceStatus: "official_company_claim", sourceId: ferruleSources[0].id }),
    fact(ferrule.id, "pre_money", "Pre-money valuation", 4_000_000, { currency: "GBP", evidenceStatus: "official_company_claim", sourceId: ferruleSources[0].id }),
  ],
  rounds: [
    { id: "rd-ferrule-1", companyId: ferrule.id, stage: "Pre-seed", targetAmount: 750_000, currency: "GBP", preMoney: 4_000_000, postMoney: null, reportedCommitted: null, openedAt: daysAgo(6), closesAt: null, claimedStatus: "open", leadInvestors: [], evidenceStatus: "official_company_claim", sourceId: ferruleSources[0].id, isCurrent: true },
  ],
  accessChecks: [
    { id: "ac-ferrule-1", companyId: ferrule.id, accessStatus: "verified_open", routeType: "syndicate", contactOrUrl: "https://sample.invalid/co-ferrule/syndicate", minCheque: 5_000, maxCheque: null, currency: "GBP", checkedAt: daysAgo(5), expiresAt: null, verifier: "research-run (sample)", sourceId: ferruleSources[0].id, notes: "Syndicate page was live at last check (sample)." },
  ],
  assessment: {
    id: "as-ferrule",
    companyId: ferrule.id,
    runId: "run-demo-2",
    aiPriority: "medium",
    aiScore: 6.4,
    confidence: "low",
    summary: "Relevant problem and an apparent syndicate route, but thin independent evidence and a verification that has gone stale.",
    whyInterested: ["Network constraints are a real bottleneck for renewables.", "Syndicate route existed at last check (sample)."],
    risks: ["Long DNO sales cycles.", "Small team; limited coverage.", "Access status stale — must re-verify."],
    bullCase: "Software-only grid capacity is cheap relative to infrastructure.",
    bearCase: "Procurement timelines could outlast a pre-seed runway.",
    whyNow: "Open syndicate at last check (sample).",
    assumptions: ["Deal page terms unchanged since last check."],
    openQuestions: ["Any signed DNO pilot?"],
    diligenceChecklist: ["Re-verify syndicate status", "Pilot evidence"],
    nextAction: "Re-run access check before any decision.",
    breakdown: [
      { key: "team", label: "Founder / team", score: 6, note: "Energy sector experience (sample).", sourceIds: [ferruleSources[1].id] },
      { key: "product", label: "Product / defensibility", score: 6, note: "Early software.", sourceIds: [] },
      { key: "traction", label: "Traction", score: 4, note: "Award only.", sourceIds: [ferruleSources[1].id] },
      { key: "market", label: "Market / model", score: 7, note: "Clear bottleneck.", sourceIds: [] },
      { key: "valuation", label: "Valuation / terms", score: 7, note: "Pre-money stated on deal page (sample).", sourceIds: [ferruleSources[0].id] },
      { key: "access", label: "Access / timing", score: 6, note: "Stale verification.", sourceIds: [ferruleSources[0].id] },
    ],
    modelVersion: MODEL,
    promptVersion: PROMPT_V,
    createdAt: daysAgo(5),
    sourceIds: ferruleSources.map((s) => s.id),
  },
  founders: [{ id: "f-ferrule-1", companyId: ferrule.id, name: "Founder G (sample)", role: "CEO", bio: "Ex-network operator engineer (sample bio).", profileUrl: null, evidenceStatus: "third_party_report", sourceId: ferruleSources[1].id }],
  teamHighlights: [],
  votes: [
    { companyId: ferrule.id, userId: BROTHER.userId, vote: "interested", score: 6, updatedAt: daysAgo(4) },
    { companyId: ferrule.id, userId: DAD.userId, vote: "unsure", score: null, updatedAt: daysAgo(3) },
  ],
  comments: [{ id: "c-ferrule-1", companyId: ferrule.id, authorUserId: BROTHER.userId, body: "Interesting niche but I'd want to see a signed pilot before going further.", createdAt: daysAgo(4), editedAt: null, deletedAt: null, likedBy: [] }],
  updates: [
    { id: "u-ferrule-1", companyId: ferrule.id, updateType: "funding", headline: "Syndicate route verified", summary: "Deal page live with £5k minimum at time of check (sample).", materiality: "medium", sourceId: ferruleSources[0].id, runId: "run-demo-2", effectiveAt: daysAgo(5), detectedAt: daysAgo(5) },
  ],
  sources: ferruleSources,
  bookmarkedBy: [],
};

// ---------------------------------------------------------------------------
// 6. Halyard Pay — pending, expected round
// ---------------------------------------------------------------------------
const halyard = company({
  id: "co-halyard",
  slug: "halyard-pay",
  name: "Halyard Pay",
  domain: "halyard.invalid",
  sector: "Fintech",
  subSector: "Payroll",
  city: "London",
  country: "UK",
  stage: "Seed",
  teaser: "Payroll and compliance for cross-border contractor teams.",
  description: "Halyard handles contractor payments, tax filings and compliance for distributed teams. (Sample company.)",
  firstDiscoveredAt: daysAgo(30),
  lastResearchedAt: daysAgo(2),
  discoverySignal: "Founder post announcing hiring and 'raising next year' (sample)",
  researchRuleMatched: "Priority 8 · earliest-cheque signals",
  tags: ["Payments", "Compliance", "B2B SaaS"],
  eisStatus: "unknown",
  artwork: { hue: 330, motif: "ring" },
});
const halyardSources: Source[] = [
  src(halyard.id, { title: "Founder post on hiring and next round (sample)", publisher: "Founder blog (sample)", sourceType: "official", publishedAt: daysAgo(8), trustTier: "primary", claimType: "Fundraising intent" }),
  src(halyard.id, { title: "Halyard customer case study (sample)", publisher: "Company website (sample)", sourceType: "official", publishedAt: daysAgo(50), trustTier: "primary", claimType: "Traction" }),
];
const halyardBundle: CompanyBundle = {
  company: halyard,
  media: media(halyard.id, "Halyard Pay artwork"),
  facts: [
    fact(halyard.id, "stage", "Stage", "Seed", { evidenceStatus: "official_company_claim", sourceId: halyardSources[0].id }),
    fact(halyard.id, "arr", "ARR", "Undisclosed", { evidenceStatus: "unknown" }),
    fact(halyard.id, "customers", "Customers", "Named case study (sample)", { evidenceStatus: "official_company_claim", sourceId: halyardSources[1].id }),
  ],
  rounds: [
    { id: "rd-halyard-1", companyId: halyard.id, stage: "Seed", targetAmount: null, currency: null, preMoney: null, postMoney: null, reportedCommitted: null, openedAt: null, closesAt: null, claimedStatus: "expected", leadInvestors: [], evidenceStatus: "official_company_claim", sourceId: halyardSources[0].id, isCurrent: true },
  ],
  accessChecks: [
    { id: "ac-halyard-1", companyId: halyard.id, accessStatus: "expected", routeType: "none", contactOrUrl: null, minCheque: null, maxCheque: null, currency: null, checkedAt: daysAgo(2), expiresAt: null, verifier: "research-run (sample)", sourceId: halyardSources[0].id, notes: "Founder states a round is planned for early next year; nothing open now (sample)." },
  ],
  assessment: {
    id: "as-halyard",
    companyId: halyard.id,
    runId: "run-demo-2",
    aiPriority: "medium",
    aiScore: 5.8,
    confidence: "low",
    summary: "Competitive category; interesting only if traction is well ahead of what public sources show.",
    whyInterested: ["Founder signalling a round ahead of press.", "Case study suggests paying customers (sample)."],
    risks: ["Crowded market with well-funded incumbents.", "No financial disclosure."],
    bullCase: "Niche-specific compliance depth can win against generalists.",
    bearCase: "Incumbents bundle the same features at lower cost.",
    whyNow: "Early signal of a future round.",
    assumptions: ["Founder post reflects plans."],
    openQuestions: ["Revenue scale?"],
    diligenceChecklist: ["Ask for metrics", "Compare with incumbents"],
    nextAction: "Watch for round opening; no action now.",
    breakdown: [
      { key: "team", label: "Founder / team", score: 6, note: "Operator background (sample).", sourceIds: [halyardSources[0].id] },
      { key: "product", label: "Product / defensibility", score: 5, note: "Feature overlap with incumbents.", sourceIds: [] },
      { key: "traction", label: "Traction", score: 5, note: "Case study only.", sourceIds: [halyardSources[1].id] },
      { key: "market", label: "Market / model", score: 6, note: "Large but competitive.", sourceIds: [] },
      { key: "valuation", label: "Valuation / terms", score: null, note: "Unrated.", sourceIds: [] },
      { key: "access", label: "Access / timing", score: 4, note: "Round expected, not open.", sourceIds: [halyardSources[0].id] },
    ],
    modelVersion: MODEL,
    promptVersion: PROMPT_V,
    createdAt: daysAgo(2),
    sourceIds: halyardSources.map((s) => s.id),
  },
  founders: [{ id: "f-halyard-1", companyId: halyard.id, name: "Founder H (sample)", role: "CEO", bio: "Former payroll product lead (sample bio).", profileUrl: null, evidenceStatus: "official_company_claim", sourceId: halyardSources[0].id }],
  teamHighlights: [],
  votes: [
    { companyId: halyard.id, userId: JAMIE.userId, vote: "unsure", score: null, updatedAt: daysAgo(6) },
    { companyId: halyard.id, userId: BROTHER.userId, vote: "interested", score: 6, updatedAt: daysAgo(7) },
  ],
  comments: [],
  updates: [
    { id: "u-halyard-1", companyId: halyard.id, updateType: "funding", headline: "Round expected next year", summary: "Founder post indicates fundraising early next year (sample).", materiality: "low", sourceId: halyardSources[0].id, runId: "run-demo-2", effectiveAt: daysAgo(8), detectedAt: daysAgo(2) },
  ],
  sources: halyardSources,
  bookmarkedBy: [],
};

// ---------------------------------------------------------------------------
// 7. Mosswick Bio — NEW, insufficient evidence (not rated)
// ---------------------------------------------------------------------------
const mosswick = company({
  id: "co-mosswick",
  slug: "mosswick-bio",
  name: "Mosswick Bio",
  domain: "mosswick.invalid",
  sector: "Agtech",
  subSector: "Synthetic biology",
  city: "Oxford",
  country: "UK",
  stage: "Pre-seed",
  teaser: "Engineered soil microbes that cut nitrogen fertiliser use.",
  description: "Mosswick is an early university spinout working on microbial nitrogen fixation for arable crops. (Sample company.)",
  firstDiscoveredAt: daysAgo(1),
  lastResearchedAt: hoursAgo(6),
  discoverySignal: "Spinout listing on a university innovation page (sample)",
  researchRuleMatched: "Priority 5 · Oxford spinouts",
  tags: ["Synthetic biology", "Agriculture"],
  eisStatus: "unknown",
  artwork: { hue: 140, motif: "field" },
});
const mosswickSources: Source[] = [src(mosswick.id, { title: "Spinout listing (sample)", publisher: "University innovation office (sample)", sourceType: "research", publishedAt: daysAgo(3), trustTier: "primary", claimType: "Spinout status" })];
const mosswickBundle: CompanyBundle = {
  company: mosswick,
  media: media(mosswick.id, "Mosswick Bio artwork"),
  facts: [
    fact(mosswick.id, "stage", "Stage", "Pre-seed", { evidenceStatus: "analyst_inference", sourceId: mosswickSources[0].id }),
    fact(mosswick.id, "target_raise", "Target raise", null),
    fact(mosswick.id, "valuation", "Valuation", null),
  ],
  rounds: [{ id: "rd-mosswick-1", companyId: mosswick.id, stage: "Pre-seed", targetAmount: null, currency: null, preMoney: null, postMoney: null, reportedCommitted: null, openedAt: null, closesAt: null, claimedStatus: "unknown", leadInvestors: [], evidenceStatus: "unknown", sourceId: null, isCurrent: true }],
  accessChecks: [],
  assessment: {
    id: "as-mosswick",
    companyId: mosswick.id,
    runId: "run-demo-1",
    aiPriority: "insufficient_evidence",
    aiScore: null,
    confidence: "low",
    summary: "Only a single primary listing located. Not rated until more evidence is available.",
    whyInterested: ["University spinout with IP lineage (sample).", "Fertiliser reduction is a large, policy-supported market."],
    risks: ["Almost no public information.", "Biology timelines are long."],
    bullCase: "Unknown — insufficient evidence.",
    bearCase: "Unknown — insufficient evidence.",
    whyNow: "Newly listed spinout (sample).",
    assumptions: [],
    openQuestions: ["Founding team?", "Any funding to date?", "Field-trial status?"],
    diligenceChecklist: ["Locate founders", "Find TTO contact"],
    nextAction: "Monitor; request a re-check in two weeks.",
    breakdown: [
      { key: "team", label: "Founder / team", score: null, note: "No founder information located.", sourceIds: [] },
      { key: "product", label: "Product / defensibility", score: null, note: "Insufficient evidence.", sourceIds: [] },
      { key: "traction", label: "Traction", score: null, note: "Insufficient evidence.", sourceIds: [] },
      { key: "market", label: "Market / model", score: 7, note: "Policy-supported demand.", sourceIds: [] },
      { key: "valuation", label: "Valuation / terms", score: null, note: "Unrated.", sourceIds: [] },
      { key: "access", label: "Access / timing", score: null, note: "Unknown.", sourceIds: [] },
    ],
    modelVersion: MODEL,
    promptVersion: PROMPT_V,
    createdAt: hoursAgo(6),
    sourceIds: mosswickSources.map((s) => s.id),
  },
  founders: [],
  teamHighlights: [],
  votes: [],
  comments: [],
  updates: [{ id: "u-mosswick-1", companyId: mosswick.id, updateType: "research", headline: "New company added", summary: "Listed as a university spinout; little else verified (sample).", materiality: "medium", sourceId: mosswickSources[0].id, runId: "run-demo-1", effectiveAt: hoursAgo(6), detectedAt: hoursAgo(6) }],
  sources: mosswickSources,
  bookmarkedBy: [],
};

// ---------------------------------------------------------------------------
// 8. Sable Security — passed (2 pass), closed round
// ---------------------------------------------------------------------------
const sable = company({
  id: "co-sable",
  slug: "sable-security",
  name: "Sable Security",
  domain: "sable.invalid",
  sector: "Cybersecurity",
  subSector: "Identity",
  city: "London",
  country: "UK",
  stage: "Seed",
  teaser: "Continuous identity-risk scoring for mid-market SaaS.",
  description: "Sable scores identity risk across SaaS estates and triggers step-up controls automatically. (Sample company.)",
  firstDiscoveredAt: daysAgo(45),
  lastResearchedAt: daysAgo(9),
  discoverySignal: "Cybersecurity angel-graph match (sample)",
  researchRuleMatched: "Priority 10 · cybersecurity founder/angel graph",
  tags: ["Identity", "Security", "B2B"],
  eisStatus: "not_applicable",
  eisNote: "Round closed; EIS status moot for this round.",
  artwork: { hue: 240, motif: "grid" },
});
const sableSources: Source[] = [
  src(sable.id, { title: "Sable closes seed round (sample)", publisher: "Security press (sample)", sourceType: "news", publishedAt: daysAgo(10), claimType: "Financing" }),
  src(sable.id, { title: "Sable product documentation (sample)", publisher: "Company website (sample)", sourceType: "official", publishedAt: daysAgo(70), trustTier: "primary", claimType: "Product" }),
];
const sableBundle: CompanyBundle = {
  company: sable,
  media: media(sable.id, "Sable Security artwork"),
  facts: [
    fact(sable.id, "stage", "Stage", "Seed", { evidenceStatus: "third_party_report", sourceId: sableSources[0].id }),
    fact(sable.id, "raised", "Amount raised", 3_000_000, { currency: "GBP", evidenceStatus: "third_party_report", sourceId: sableSources[0].id }),
    fact(sable.id, "valuation", "Valuation", null),
  ],
  rounds: [{ id: "rd-sable-1", companyId: sable.id, stage: "Seed", targetAmount: 3_000_000, currency: "GBP", preMoney: null, postMoney: null, reportedCommitted: 3_000_000, openedAt: daysAgo(90), closesAt: daysAgo(10), claimedStatus: "closed", leadInvestors: ["Security-focused VC (sample)"], evidenceStatus: "third_party_report", sourceId: sableSources[0].id, isCurrent: true }],
  accessChecks: [{ id: "ac-sable-1", companyId: sable.id, accessStatus: "closed", routeType: "none", contactOrUrl: null, minCheque: null, maxCheque: null, currency: null, checkedAt: daysAgo(9), expiresAt: null, verifier: "research-run (sample)", sourceId: sableSources[0].id, notes: "Press reports the seed round closed (sample)." }],
  assessment: {
    id: "as-sable",
    companyId: sable.id,
    runId: "run-demo-3",
    aiPriority: "low",
    aiScore: 4.9,
    confidence: "medium",
    summary: "Competent team in a crowded identity-security market; round already closed.",
    whyInterested: ["Repeat-founder links in the cybersecurity graph (sample)."],
    risks: ["Round closed; no access.", "Crowded category."],
    bullCase: "Could be a quick acquisition target.",
    bearCase: "Feature, not a company.",
    whyNow: "Not now — closed.",
    assumptions: [],
    openQuestions: [],
    diligenceChecklist: [],
    nextAction: "Track for a future round only.",
    breakdown: [
      { key: "team", label: "Founder / team", score: 7, note: "Repeat operators (sample).", sourceIds: [sableSources[0].id] },
      { key: "product", label: "Product / defensibility", score: 4, note: "Overlapping with incumbents.", sourceIds: [sableSources[1].id] },
      { key: "traction", label: "Traction", score: 5, note: "Undisclosed.", sourceIds: [] },
      { key: "market", label: "Market / model", score: 5, note: "Crowded.", sourceIds: [] },
      { key: "valuation", label: "Valuation / terms", score: null, note: "Unrated.", sourceIds: [] },
      { key: "access", label: "Access / timing", score: 1, note: "Closed.", sourceIds: [sableSources[0].id] },
    ],
    modelVersion: MODEL,
    promptVersion: PROMPT_V,
    createdAt: daysAgo(9),
    sourceIds: sableSources.map((s) => s.id),
  },
  founders: [{ id: "f-sable-1", companyId: sable.id, name: "Founder I (sample)", role: "CEO", bio: "Second-time security founder (sample bio).", profileUrl: null, evidenceStatus: "third_party_report", sourceId: sableSources[0].id }],
  teamHighlights: [],
  votes: [
    { companyId: sable.id, userId: BROTHER.userId, vote: "pass", score: null, updatedAt: daysAgo(8) },
    { companyId: sable.id, userId: DAD.userId, vote: "pass", score: null, updatedAt: daysAgo(8) },
    { companyId: sable.id, userId: JAMIE.userId, vote: "unsure", score: 5, updatedAt: daysAgo(9) },
  ],
  comments: [{ id: "c-sable-1", companyId: sable.id, authorUserId: BROTHER.userId, body: "Round's closed and the space is crowded. Pass for now.", createdAt: daysAgo(8), editedAt: null, deletedAt: null, likedBy: [DAD.userId] }],
  updates: [{ id: "u-sable-1", companyId: sable.id, updateType: "funding", headline: "Seed round closed", summary: "Press reports a £3m seed closed (sample).", change: [{ field: "Access", from: "Fundraising reported", to: "Closed" }], materiality: "high", sourceId: sableSources[0].id, runId: "run-demo-3", effectiveAt: daysAgo(10), detectedAt: daysAgo(9) }],
  sources: sableSources,
  bookmarkedBy: [],
};

// ---------------------------------------------------------------------------
// 9. Oriel Materials — NEW, contactable via syndicate
// ---------------------------------------------------------------------------
const oriel = company({
  id: "co-oriel",
  slug: "oriel-materials",
  name: "Oriel Materials",
  domain: "oriel-materials.invalid",
  sector: "Deeptech",
  subSector: "Battery materials",
  city: "Cambridge",
  country: "UK",
  stage: "Seed",
  teaser: "Silicon-dominant anode materials for higher-energy cells.",
  description: "Oriel is scaling a silicon anode process developed in a university lab. (Sample company.)",
  firstDiscoveredAt: daysAgo(5),
  lastResearchedAt: hoursAgo(9),
  discoverySignal: "Angel-network portfolio update (sample)",
  researchRuleMatched: "Priority 3 · Cambridge; Priority 6 · angel-network access",
  tags: ["Batteries", "Materials", "Deeptech"],
  eisStatus: "unknown",
  artwork: { hue: 40, motif: "facet" },
});
const orielSources: Source[] = [
  src(oriel.id, { title: "Angel network portfolio note (sample)", publisher: "Angel network (sample)", sourceType: "official", publishedAt: daysAgo(6), trustTier: "primary", claimType: "Investor relationship" }),
  src(oriel.id, { title: "Lab publication on silicon anodes (sample)", publisher: "Journal (sample)", sourceType: "research", publishedAt: daysAgo(200), claimType: "Research lineage" }),
];
const orielBundle: CompanyBundle = {
  company: oriel,
  media: media(oriel.id, "Oriel Materials artwork"),
  facts: [
    fact(oriel.id, "stage", "Stage", "Seed", { evidenceStatus: "official_company_claim", sourceId: orielSources[0].id }),
    fact(oriel.id, "target_raise", "Target raise", null),
    fact(oriel.id, "valuation", "Valuation", null),
  ],
  rounds: [{ id: "rd-oriel-1", companyId: oriel.id, stage: "Seed", targetAmount: null, currency: null, preMoney: null, postMoney: null, reportedCommitted: null, openedAt: null, closesAt: null, claimedStatus: "unknown", leadInvestors: ["Regional angel network (sample)"], evidenceStatus: "official_company_claim", sourceId: orielSources[0].id, isCurrent: true }],
  accessChecks: [{ id: "ac-oriel-1", companyId: oriel.id, accessStatus: "contactable", routeType: "syndicate", contactOrUrl: "Guest access via angel network (sample)", minCheque: null, maxCheque: null, currency: null, checkedAt: hoursAgo(9), expiresAt: null, verifier: "research-run (sample)", sourceId: orielSources[0].id, notes: "Network lists Oriel in portfolio; guest co-invest route plausible, allocation unknown." }],
  assessment: {
    id: "as-oriel",
    companyId: oriel.id,
    runId: "run-demo-1",
    aiPriority: "medium",
    aiScore: 6.9,
    confidence: "medium",
    summary: "Credible science lineage and an angel-network route; scale-up risk is the central question.",
    whyInterested: ["Peer-reviewed lineage (sample).", "Angel-network relationship suggests access."],
    risks: ["Materials scale-up risk.", "Capital-intensive path."],
    bullCase: "Drop-in anode improvement sells into existing cell lines.",
    bearCase: "Pilot-line costs outrun seed capital.",
    whyNow: "Network portfolio inclusion (sample).",
    assumptions: ["Portfolio note implies an active round."],
    openQuestions: ["Round size?", "Pilot-line partner?"],
    diligenceChecklist: ["Join network guest session", "Technical adviser review"],
    nextAction: "Apply for guest access to the network's next pitch session.",
    breakdown: [
      { key: "team", label: "Founder / team", score: 7, note: "Lab founders (sample).", sourceIds: [orielSources[1].id] },
      { key: "product", label: "Product / defensibility", score: 7, note: "Published science.", sourceIds: [orielSources[1].id] },
      { key: "traction", label: "Traction", score: 4, note: "Pre-commercial.", sourceIds: [] },
      { key: "market", label: "Market / model", score: 8, note: "Large cell market.", sourceIds: [] },
      { key: "valuation", label: "Valuation / terms", score: null, note: "Unrated.", sourceIds: [] },
      { key: "access", label: "Access / timing", score: 6, note: "Network route.", sourceIds: [orielSources[0].id] },
    ],
    modelVersion: MODEL,
    promptVersion: PROMPT_V,
    createdAt: hoursAgo(9),
    sourceIds: orielSources.map((s) => s.id),
  },
  founders: [{ id: "f-oriel-1", companyId: oriel.id, name: "Founder J (sample)", role: "CEO", bio: "Materials scientist (sample bio).", profileUrl: null, evidenceStatus: "third_party_report", sourceId: orielSources[1].id }],
  teamHighlights: [{ text: "Backed by a regional angel network (sample)", evidenceStatus: "official_company_claim", sourceId: orielSources[0].id }],
  votes: [],
  comments: [],
  updates: [{ id: "u-oriel-1", companyId: oriel.id, updateType: "research", headline: "New company added", summary: "Found via angel-network portfolio update (sample).", materiality: "medium", sourceId: orielSources[0].id, runId: "run-demo-1", effectiveAt: daysAgo(5), detectedAt: daysAgo(5) }],
  sources: orielSources,
  bookmarkedBy: [DAD.userId],
};

// ---------------------------------------------------------------------------
// 10. Kestrel Compute — unreviewed, older, closed
// ---------------------------------------------------------------------------
const kestrel = company({
  id: "co-kestrel",
  slug: "kestrel-compute",
  name: "Kestrel Compute",
  domain: "kestrel.invalid",
  sector: "AI infrastructure",
  subSector: "Edge inference",
  city: "Paris / London",
  country: "FR",
  stage: "Pre-seed",
  teaser: "Inference scheduling for small-model fleets on edge hardware.",
  description: "Kestrel schedules inference workloads across heterogeneous edge devices. (Sample company.)",
  firstDiscoveredAt: daysAgo(20),
  lastResearchedAt: daysAgo(12),
  discoverySignal: "Programme finalist listing (sample)",
  researchRuleMatched: "Priority 9 · HEC / X-HEC programme watch",
  tags: ["AI infrastructure", "Edge"],
  eisStatus: "not_applicable",
  eisNote: "Non-UK company; EIS unlikely to apply.",
  artwork: { hue: 200, motif: "orbit" },
});
const kestrelSources: Source[] = [src(kestrel.id, { title: "Programme finalist list (sample)", publisher: "Programme website (sample)", sourceType: "official", publishedAt: daysAgo(25), trustTier: "primary", claimType: "Programme participation" })];
const kestrelBundle: CompanyBundle = {
  company: kestrel,
  media: media(kestrel.id, "Kestrel Compute artwork"),
  facts: [fact(kestrel.id, "stage", "Stage", "Pre-seed", { evidenceStatus: "official_company_claim", sourceId: kestrelSources[0].id }), fact(kestrel.id, "valuation", "Valuation", null)],
  rounds: [{ id: "rd-kestrel-1", companyId: kestrel.id, stage: "Pre-seed", targetAmount: null, currency: null, preMoney: null, postMoney: null, reportedCommitted: null, openedAt: null, closesAt: null, claimedStatus: "closed", leadInvestors: [], evidenceStatus: "third_party_report", sourceId: kestrelSources[0].id, isCurrent: true }],
  accessChecks: [{ id: "ac-kestrel-1", companyId: kestrel.id, accessStatus: "closed", routeType: "none", contactOrUrl: null, minCheque: null, maxCheque: null, currency: null, checkedAt: daysAgo(12), expiresAt: null, verifier: "research-run (sample)", sourceId: kestrelSources[0].id, notes: "Programme page notes the pre-seed is complete (sample)." }],
  assessment: {
    id: "as-kestrel",
    companyId: kestrel.id,
    runId: "run-demo-3",
    aiPriority: "medium",
    aiScore: 6.1,
    confidence: "low",
    summary: "Interesting programme finalist; current round closed, so a watch-only entry.",
    whyInterested: ["Programme finalist (sample)."],
    risks: ["Closed round.", "Limited information."],
    bullCase: "Edge inference demand grows with small models.",
    bearCase: "Hyperscalers absorb the scheduling layer.",
    whyNow: "Not now.",
    assumptions: [],
    openQuestions: ["Next round timing?"],
    diligenceChecklist: [],
    nextAction: "Watch for next round.",
    breakdown: [
      { key: "team", label: "Founder / team", score: 6, note: "Programme finalists (sample).", sourceIds: [kestrelSources[0].id] },
      { key: "product", label: "Product / defensibility", score: 6, note: "Early.", sourceIds: [] },
      { key: "traction", label: "Traction", score: null, note: "Unknown.", sourceIds: [] },
      { key: "market", label: "Market / model", score: 7, note: "Growing.", sourceIds: [] },
      { key: "valuation", label: "Valuation / terms", score: null, note: "Unrated.", sourceIds: [] },
      { key: "access", label: "Access / timing", score: 2, note: "Closed.", sourceIds: [kestrelSources[0].id] },
    ],
    modelVersion: MODEL,
    promptVersion: PROMPT_V,
    createdAt: daysAgo(12),
    sourceIds: kestrelSources.map((s) => s.id),
  },
  founders: [],
  teamHighlights: [],
  votes: [],
  comments: [],
  updates: [{ id: "u-kestrel-1", companyId: kestrel.id, updateType: "research", headline: "Initial research", summary: "Programme finalist; pre-seed reported complete (sample).", materiality: "low", sourceId: kestrelSources[0].id, runId: "run-demo-3", effectiveAt: daysAgo(12), detectedAt: daysAgo(12) }],
  sources: kestrelSources,
  bookmarkedBy: [],
};

export const DEMO_COMPANIES: CompanyBundle[] = [
  larkspurBundle,
  tidewellBundle,
  quillonBundle,
  northgateBundle,
  ferruleBundle,
  halyardBundle,
  mosswickBundle,
  sableBundle,
  orielBundle,
  kestrelBundle,
];

// ---------------------------------------------------------------------------
// Home stories (today's highlights)
// ---------------------------------------------------------------------------
export const DEMO_STORIES: HomeStory[] = [
  { id: "st-1", runId: "run-demo-1", storyType: "financing", companyId: tidewell.id, headline: "Tidewell Diagnostics reports £1.4m first close", teaser: "Strong investor demand. Final close expected within two weeks (sample).", priority: 100, sourceId: tidewellSources[1].id, createdAt: hoursAgo(2), expiresAt: daysAhead(2) },
  { id: "st-2", runId: "run-demo-1", storyType: "access", companyId: tidewell.id, headline: "Application route verified with £10k minimum", teaser: "Public page live; allocation not guaranteed (sample).", priority: 90, sourceId: tidewellSources[0].id, createdAt: hoursAgo(20), expiresAt: daysAhead(2) },
  { id: "st-3", runId: "run-demo-1", storyType: "signal", companyId: northgate.id, headline: "Northgate Surgical reports pre-clinical results", teaser: "Trade coverage of early results alongside a reported £4m seed target (sample).", priority: 80, sourceId: northgateSources[2].id, createdAt: hoursAgo(4), expiresAt: daysAhead(3) },
  { id: "st-4", runId: "run-demo-1", storyType: "research", companyId: larkspur.id, headline: "Larkspur: more detail on government contract", teaser: "Research added on the £480k development contract and early patient imaging (sample).", priority: 70, sourceId: larkspurSources[0].id, createdAt: hoursAgo(5), expiresAt: daysAhead(3) },
];

// ---------------------------------------------------------------------------
// Notifications (per recipient)
// ---------------------------------------------------------------------------
function notify(recipient: string, partial: Omit<Notification, "recipientUserId" | "id" | "dedupeKey"> & { id: string }): Notification {
  return { ...partial, recipientUserId: recipient, id: `${partial.id}-${recipient.slice(-2)}`, dedupeKey: `${partial.id}:${recipient}` };
}
const notificationTemplates: (Omit<Notification, "recipientUserId" | "id" | "dedupeKey"> & { id: string; exclude?: string })[] = [
  { id: "n-1", notificationType: "round_confirmed", companyId: tidewell.id, updateId: "u-tidewell-1", commentId: null, title: "Tidewell Diagnostics round update", body: "Reports suggest a first close of £1.4m with specialist investors (sample).", importance: "high", readAt: null, createdAt: hoursAgo(2), href: "/companies/tidewell-diagnostics?tab=funding" },
  { id: "n-2", notificationType: "milestone", companyId: larkspur.id, updateId: "u-larkspur-1", commentId: null, title: "New research on Larkspur Photonics", body: "Additional details on government contract and early patient imaging.", importance: "normal", readAt: null, createdAt: hoursAgo(5), href: "/companies/larkspur-photonics?tab=updates" },
  { id: "n-3", notificationType: "comment", companyId: larkspur.id, updateId: null, commentId: "c-larkspur-2", title: "Brother commented", body: "On Larkspur: “Need to understand valuation and timeline.”", importance: "normal", readAt: null, createdAt: hoursAgo(5), href: "/companies/larkspur-photonics?tab=family", exclude: BROTHER.userId },
  { id: "n-4", notificationType: "new_company", companyId: northgate.id, updateId: "u-northgate-1", commentId: null, title: "New company added", body: "Northgate Surgical — surgical robotics (Cambridge).", importance: "normal", readAt: hoursAgo(1), createdAt: hoursAgo(4), href: "/companies/northgate-surgical" },
  { id: "n-5", notificationType: "shortlist_promoted", companyId: tidewell.id, updateId: "u-tidewell-3", commentId: null, title: "Tidewell promoted to shortlist", body: "Dad's Interested vote brought the count to 2 of 3.", importance: "high", readAt: daysAgo(1), createdAt: daysAgo(2), href: "/companies/tidewell-diagnostics?tab=family", exclude: DAD.userId },
  { id: "n-6", notificationType: "round_closed", companyId: sable.id, updateId: "u-sable-1", commentId: null, title: "Sable Security round closed", body: "Press reports the £3m seed has closed (sample).", importance: "normal", readAt: daysAgo(8), createdAt: daysAgo(9), href: "/companies/sable-security?tab=funding" },
  { id: "n-7", notificationType: "research_applied", companyId: null, updateId: null, commentId: null, title: "Research instructions updated", body: "Jamie activated v12: added HEC / X-HEC programme watch.", importance: "normal", readAt: daysAgo(5), createdAt: daysAgo(6), href: "/research/settings?tab=history" },
];
export const DEMO_NOTIFICATIONS: Notification[] = [JAMIE, BROTHER, DAD].flatMap((m) =>
  notificationTemplates.filter((t) => t.exclude !== m.userId).map(({ exclude: _exclude, ...t }) => notify(m.userId, t)),
);

// ---------------------------------------------------------------------------
// Events — SAMPLE listings, not real events
// ---------------------------------------------------------------------------
export const DEMO_EVENTS: EventRecord[] = [
  { id: "ev-1", name: "Cambridge Founders Pitch Night (sample)", organiser: "Sample angel network", eventType: "Pitch evening", startAt: daysAhead(3), endAt: null, timezone: "Europe/London", venue: "Sample venue", city: "Cambridge", isOnline: false, registrationUrl: "https://sample.invalid/events/ev-1", accessStatus: "open", registrationCheckedAt: hoursAgo(10), audienceFit: "Angels and early-stage founders", significance: "Two tracked companies pitching (sample).", nextAction: "Register and request allocation conversations.", relatedCompanyIds: [oriel.id, northgate.id], sourceId: null, importance: "high", memberStatus: { [JAMIE.userId]: "registered" } },
  { id: "ev-2", name: "London Accelerator Demo Day (sample)", organiser: "Sample accelerator", eventType: "Demo day", startAt: daysAhead(5), endAt: null, timezone: "Europe/London", venue: "Sample venue", city: "London", isOnline: false, registrationUrl: "https://sample.invalid/events/ev-2", accessStatus: "waitlist", registrationCheckedAt: hoursAgo(10), audienceFit: "Investors", significance: "Quillon Verify presenting (sample).", nextAction: "Apply for a place.", relatedCompanyIds: [quillon.id], sourceId: null, importance: "high" },
  { id: "ev-3", name: "University Enterprise Showcase (sample)", organiser: "Sample university", eventType: "Showcase", startAt: daysAhead(9), endAt: null, timezone: "Europe/London", venue: "Sample venue", city: "London", isOnline: false, registrationUrl: null, accessStatus: "invitation_only", registrationCheckedAt: daysAgo(1), audienceFit: "Invited investors", significance: "Spinout showcase.", nextAction: "Ask the programme office for an invitation.", relatedCompanyIds: [], sourceId: null, importance: "normal" },
  { id: "ev-4", name: "Programme Finals London (sample)", organiser: "Sample programme", eventType: "Competition final", startAt: daysAhead(17), endAt: null, timezone: "Europe/London", venue: null, city: "London", isOnline: false, registrationUrl: "https://sample.invalid/events/ev-4", accessStatus: "unknown", registrationCheckedAt: null, audienceFit: "Open", significance: "Finalists announced soon.", nextAction: "Check registration status next week.", relatedCompanyIds: [kestrel.id], sourceId: null, importance: "normal" },
];

// ---------------------------------------------------------------------------
// Angel networks — names seeded from the research mandate, details UNVERIFIED
// ---------------------------------------------------------------------------
const networkNames = [
  "Project Ventures",
  "Cambridge Capital Group / Cambridge Angels",
  "Oxford Investment Opportunity Network (OION)",
  "Green Angel Syndicate",
  "SyndicateRoom",
  "HERmesa",
  "Haatch",
  "Angel Academe",
  "UKBAA",
  "Helm",
  "South East Angels",
  "Oxford Technology / WOTAN",
];
export const DEMO_NETWORKS: AngelNetwork[] = networkNames.map((name, i) => ({
  id: `net-${i + 1}`,
  name,
  website: null,
  focus: "Not yet checked",
  region: name.includes("Cambridge") ? "Cambridge" : name.includes("Oxford") ? "Oxford" : "UK",
  eligibility: "Not yet checked",
  joiningUrl: null,
  fees: "Not yet checked",
  chequeRequirements: "Not yet checked",
  coInvestRoute: "Not yet checked",
  contact: null,
  verificationStatus: "unverified",
  accessibilityConfidence: "low",
  lastCheckedAt: null,
  notes: "Seeded from the research mandate (SPEC §10). Details are populated only by a research run with sources; membership never guarantees investment access.",
  portfolioCompanyIds: [],
}));

export const DEMO_AUDIT = [
  { id: "au-1", actorType: "member" as const, actorId: JAMIE.userId, action: "prompt.activate", objectType: "research_prompt", objectId: "pv-12", createdAt: daysAgo(6) },
  { id: "au-2", actorType: "research" as const, actorId: "run-demo-1", action: "company.publish", objectType: "company", objectId: northgate.id, createdAt: hoursAgo(4) },
  { id: "au-3", actorType: "member" as const, actorId: DAD.userId, action: "vote.set", objectType: "company", objectId: tidewell.id, createdAt: daysAgo(2) },
];

export const DEMO_SOURCES: Source[] = DEMO_COMPANIES.flatMap((c) => c.sources);
export type { Founder, TeamHighlight, Vote, Comment, CompanyUpdate, AccessCheck, Assessment, FundingRound };
