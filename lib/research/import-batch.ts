import type { ResearchImportPayload } from "./imported-model";
import { repairToSchema } from "./repair";
import { assessmentSchema, candidateSchema } from "./schemas";

/** The pipeline extracts at most this many companies per run, so uploads are split into runs of this size. */
export const IMPORT_BATCH_SIZE = 12;
/** Upper bound per upload, to keep one upload's work (and source fetching) reasonable. */
export const MAX_IMPORT_COMPANIES = 240;

export interface ImportPlan {
  batches: ResearchImportPayload[];
  accepted: string[];
  rejected: { name: string; reason: string }[];
  /** Companies kept but whose assessment was dropped (the pipeline then assesses nothing for them). */
  notes: string[];
}

/**
 * Turns uploaded research (prepared in a Claude chat) into runs of at most
 * IMPORT_BATCH_SIZE companies. Accepts the full payload
 * `{ writeUp, sources?, companies: [{ candidate, assessment? }], events? }`,
 * or a bare list of `{ candidate, assessment? }` / candidates. Each candidate
 * is checked against the pipeline's schema up front so the uploader sees
 * problems immediately; the pipeline still verifies every source before
 * anything is published.
 */
export function planImport(raw: unknown): { ok: true; plan: ImportPlan } | { ok: false; error: string } {
  const root = raw as Partial<ResearchImportPayload> & { candidates?: unknown[] };
  const list: unknown[] | null = Array.isArray(raw) ? raw : Array.isArray(root?.companies) ? root.companies : Array.isArray(root?.candidates) ? root.candidates : null;
  if (!list) return { ok: false, error: "No companies found. Expected { \"writeUp\": …, \"companies\": [ … ] } or a list of companies." };
  if (list.length === 0) return { ok: false, error: "The upload has no companies in it." };
  if (list.length > MAX_IMPORT_COMPANIES) return { ok: false, error: `Up to ${MAX_IMPORT_COMPANIES} companies per upload; this has ${list.length}. Split it into smaller files.` };

  const writeUp = typeof root?.writeUp === "string" && root.writeUp.trim() ? root.writeUp.trim() : "Research prepared in a Claude chat and uploaded by a member.";
  const accepted: ResearchImportPayload["companies"] = [];
  const rejected: ImportPlan["rejected"] = [];
  const notes: string[] = [];
  const seen = new Set<string>();

  list.forEach((item, i) => {
    const entry = item as { candidate?: unknown; assessment?: unknown };
    const candidate = entry && typeof entry === "object" && "candidate" in entry ? entry.candidate : item;
    const name = String((candidate as { name?: unknown })?.name ?? `company ${i + 1}`).trim();
    const checked = repairToSchema(candidateSchema, candidate);
    if (!checked.ok) {
      rejected.push({ name, reason: checked.reason });
      return;
    }
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) {
      rejected.push({ name, reason: "listed twice in this upload" });
      return;
    }
    seen.add(key);
    let assessment: unknown;
    if (entry && typeof entry === "object" && "assessment" in entry && entry.assessment) {
      const a = repairToSchema(assessmentSchema, entry.assessment);
      if (a.ok) assessment = a.data;
      else notes.push(`${name}: assessment ignored (${a.reason})`);
    }
    accepted.push(assessment ? { candidate: checked.data, assessment } : { candidate: checked.data });
  });

  const batches: ResearchImportPayload[] = [];
  for (let i = 0; i < accepted.length; i += IMPORT_BATCH_SIZE) {
    batches.push({
      writeUp,
      sources: Array.isArray(root?.sources) ? root.sources.filter((s): s is string => typeof s === "string") : [],
      companies: accepted.slice(i, i + IMPORT_BATCH_SIZE),
      // Events and findings travel with the first batch only.
      events: i === 0 && Array.isArray(root?.events) ? root.events : [],
      executiveFindings: i === 0 && Array.isArray(root?.executiveFindings) ? root.executiveFindings : [],
    });
  }
  return { ok: true, plan: { batches, accepted: accepted.map((c) => (c.candidate as { name: string }).name), rejected, notes } };
}
