import type { z } from "zod";
import type { ModelUsage, ResearchCheck, ResearchModel } from "./provider";
import { repairToSchema } from "./repair";
import { assessmentSchema, extractionSchema } from "./schemas";

/**
 * Research prepared outside the automated provider (for example, researched by
 * hand in a Claude chat) and imported through the normal pipeline. This model
 * hands the prepared write-up, candidates and assessments to the pipeline in
 * place of provider calls, so everything downstream is unchanged: every cited
 * URL is fetched and verified, unverified claims are stripped, assessment hard
 * rules apply, imagery and Home stories are produced. No provider cost.
 */
export interface ResearchImportPayload {
  writeUp: string;
  /** Extra pages consulted that are not attached to a specific claim. */
  sources?: string[];
  companies: { candidate: unknown; assessment?: unknown }[];
  events?: unknown[];
  executiveFindings?: string[];
}

export class ImportedResearchModel implements ResearchModel {
  readonly name: string;
  readonly usage: ModelUsage = { inputTokens: 0, outputTokens: 0, webSearchCalls: 0, estimatedCostUsd: 0 };
  lastError: string | null = null;
  lastNotes: string[] = [];

  constructor(
    private readonly payload: ResearchImportPayload,
    label = "imported research",
  ) {
    this.name = label;
  }

  async startResearch(): Promise<string> {
    throw new Error("Imported research has no provider job to start.");
  }

  async checkResearch(): Promise<ResearchCheck> {
    const urls = new Set<string>(this.payload.sources ?? []);
    collectUrls(this.payload.companies.map((c) => c.candidate), urls);
    collectUrls(this.payload.events ?? [], urls);
    return { state: "done", text: this.payload.writeUp, citations: [...urls].map((url) => ({ url, title: url, origin: "linked" as const })), searchCalls: 0 };
  }

  async structured<T>({ schema, schemaName, input }: { schema: z.ZodType<T>; schemaName: string; input: string }): Promise<T | null> {
    this.lastError = null;
    this.lastNotes = [];
    if (schemaName === "research_extraction") {
      const r = repairToSchema(extractionSchema, { candidates: this.payload.companies.map((c) => c.candidate), events: this.payload.events ?? [], executiveFindings: this.payload.executiveFindings ?? [] });
      if (!r.ok) {
        this.lastError = `imported extraction: ${r.reason}`;
        return null;
      }
      this.lastNotes = r.repairs;
      return r.data as T;
    }
    if (schemaName === "company_assessment") {
      // The pipeline embeds the candidate as JSON; match the longest name that appears.
      const match = this.payload.companies
        .filter((c) => c.assessment && input.includes(JSON.stringify((c.candidate as { name?: string })?.name ?? "\u0000")))
        .sort((a, b) => String((b.candidate as { name?: string }).name).length - String((a.candidate as { name?: string }).name).length)[0];
      if (!match) return null;
      const r = repairToSchema(assessmentSchema, match.assessment);
      if (!r.ok) {
        this.lastError = `imported assessment: ${r.reason}`;
        return null;
      }
      return r.data as T;
    }
    // Home story curation falls back to the pipeline's own story inputs.
    void schema;
    return null;
  }
}

function collectUrls(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) return value.forEach((v) => collectUrls(v, out));
  if (!value || typeof value !== "object") return;
  for (const [key, v] of Object.entries(value)) {
    if ((key === "sourceUrls" || key === "website" || key === "registrationUrl") && v) {
      for (const u of Array.isArray(v) ? v : [v]) if (typeof u === "string" && /^https?:\/\//.test(u)) out.add(u);
    } else collectUrls(v, out);
  }
}
