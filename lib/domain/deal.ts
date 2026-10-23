/**
 * The deal room: what happens after a match. A due-diligence checklist the
 * family ticks off together, documents they collect (deck, term sheet, HMRC
 * letters), and the decision: considering, invested (how much, which scheme,
 * certificate received) or passed. Everything here is shared across the
 * household; it never affects the deck, the match rule or the AI score.
 */

export type DealCheckStatus = "todo" | "done" | "na";

export interface DealCheckTemplate {
  key: string;
  label: string;
  hint: string;
  /** Checks grouped into the stages of a deal, in order. */
  stage: "meet" | "verify" | "terms" | "invest" | "after";
}

export const DEAL_STAGES: { key: DealCheckTemplate["stage"]; label: string }[] = [
  { key: "meet", label: "Get to know them" },
  { key: "verify", label: "Check the facts" },
  { key: "terms", label: "Agree the deal" },
  { key: "invest", label: "Invest" },
  { key: "after", label: "Afterwards" },
];

/** The checklist every match starts with. Members can add their own items too. */
export const DEAL_CHECKLIST: DealCheckTemplate[] = [
  { key: "founders_call", label: "Speak to the founders", hint: "A call or a visit. Who are they, why this, why now?", stage: "meet" },
  { key: "deck_and_model", label: "Read the deck and the financial model", hint: "Ask for the investor deck and a simple forecast with the assumptions behind it.", stage: "meet" },
  { key: "product_demo", label: "See the product working", hint: "A demo, a trial, or a visit to where it is used.", stage: "meet" },
  { key: "companies_house", label: "Check Companies House", hint: "Incorporation date, directors, filed accounts, charges, confirmation statements.", stage: "verify" },
  { key: "advance_assurance", label: "See the HMRC advance assurance letter", hint: "For SEIS/EIS relief: the letter itself, and that this round is covered.", stage: "verify" },
  { key: "cap_table", label: "See the cap table and the valuation", hint: "Who owns what today, the pre-money valuation, and what share this round buys.", stage: "verify" },
  { key: "customer_refs", label: "Talk to two customers or users", hint: "Do they pay, would they pay more, what would make them leave?", stage: "verify" },
  { key: "founder_refs", label: "Take founder references", hint: "Former colleagues, earlier investors, co-founders who left.", stage: "verify" },
  { key: "market_check", label: "Check the market and the competitors", hint: "Who else does this, and why this team wins.", stage: "verify" },
  { key: "runway", label: "Understand the use of funds and runway", hint: "What this round pays for and how many months it buys.", stage: "verify" },
  { key: "terms", label: "Review the term sheet and shareholders' agreement", hint: "Share class, pre-emption, information rights, drag/tag, any liquidation preference.", stage: "terms" },
  { key: "our_cheque", label: "Agree our cheque and who invests what", hint: "Total, split between us, and whether it fits the SEIS limits.", stage: "terms" },
  { key: "self_cert", label: "Investor self-certification done", hint: "Most issuers need a sophisticated or high-net-worth investor statement.", stage: "invest" },
  { key: "money_sent", label: "Money sent and share certificate received", hint: "Keep the certificate and the subscription confirmation.", stage: "invest" },
  { key: "tax_cert", label: "SEIS3 / EIS3 certificate received", hint: "Needed to claim the tax relief; the company applies for it after the round.", stage: "after" },
  { key: "updates", label: "Investor updates arriving", hint: "Ask for a short update every quarter.", stage: "after" },
];

export interface DealCheck {
  companyId: string;
  key: string;
  status: DealCheckStatus;
  note: string;
  updatedBy: string | null;
  updatedAt: string;
  /** For items a member added, their own label. */
  label?: string;
}

export interface DealDocument {
  id: string;
  companyId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
  /** A short-lived download link, filled in when the page is rendered. */
  url: string | null;
}

export type DealStatus = "considering" | "invested" | "passed";

export interface DealDecision {
  companyId: string;
  status: DealStatus;
  /** Amount each member put in, in GBP. */
  amounts: Record<string, number>;
  investedAt: string | null;
  scheme: "SEIS" | "EIS" | "none" | "unknown";
  stakePct: number | null;
  instrument: string;
  certificateReceived: boolean;
  notes: string;
  updatedBy: string | null;
  updatedAt: string;
}

export interface Deal {
  checks: DealCheck[];
  documents: DealDocument[];
  decision: DealDecision | null;
}

export const EMPTY_DEAL: Deal = { checks: [], documents: [], decision: null };

export function emptyDecision(companyId: string): DealDecision {
  return { companyId, status: "considering", amounts: {}, investedAt: null, scheme: "unknown", stakePct: null, instrument: "", certificateReceived: false, notes: "", updatedBy: null, updatedAt: new Date(0).toISOString() };
}

export interface ChecklistItem extends DealCheckTemplate {
  status: DealCheckStatus;
  note: string;
  updatedBy: string | null;
  updatedAt: string | null;
  custom: boolean;
}

/** The template merged with what the family has recorded, in stage order. */
export function checklistFor(deal: Deal): ChecklistItem[] {
  const byKey = new Map(deal.checks.map((c) => [c.key, c]));
  const items: ChecklistItem[] = DEAL_CHECKLIST.map((t) => {
    const c = byKey.get(t.key);
    return { ...t, status: c?.status ?? "todo", note: c?.note ?? "", updatedBy: c?.updatedBy ?? null, updatedAt: c?.updatedAt ?? null, custom: false };
  });
  for (const c of deal.checks) {
    if (DEAL_CHECKLIST.some((t) => t.key === c.key)) continue;
    items.push({ key: c.key, label: c.label ?? c.key, hint: "", stage: "verify", status: c.status, note: c.note, updatedBy: c.updatedBy, updatedAt: c.updatedAt, custom: true });
  }
  const order = new Map(DEAL_STAGES.map((s, i) => [s.key, i]));
  return items.sort((a, b) => (order.get(a.stage) ?? 9) - (order.get(b.stage) ?? 9));
}

export interface DealProgress {
  done: number;
  total: number;
  documents: number;
  status: DealStatus;
  totalInvestedGbp: number;
}

/** One line of where a deal stands, for banners and lists. */
export function dealProgress(deal: Deal): DealProgress {
  const items = checklistFor(deal).filter((i) => i.status !== "na");
  return {
    done: items.filter((i) => i.status === "done").length,
    total: items.length,
    documents: deal.documents.length,
    status: deal.decision?.status ?? "considering",
    totalInvestedGbp: deal.decision?.status === "invested" ? Object.values(deal.decision.amounts).reduce((s, n) => s + (n || 0), 0) : 0,
  };
}

export function dealStatusLabel(status: DealStatus): string {
  return status === "invested" ? "Invested" : status === "passed" ? "Passed" : "Considering";
}

const SAFE_NAME = /[^A-Za-z0-9._ ()-]+/g;

/** A document name that is safe as a storage path and still readable. */
export function safeDocumentName(name: string): string {
  const cleaned = name.replace(SAFE_NAME, "_").replace(/\s+/g, " ").trim().slice(0, 120);
  return cleaned || "document";
}

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_MIMES = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/msword", "application/vnd.ms-excel", "application/vnd.ms-powerpoint", "text/plain", "text/csv"]);
