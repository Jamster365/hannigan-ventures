import "server-only";
import OpenAI from "openai";
import type { z } from "zod";
import { linksInText } from "./links";
import { repairToSchema } from "./repair";

/**
 * Thin, swappable model adapter. The research pipeline only depends on this
 * interface so the provider can be changed without touching pipeline logic.
 *
 * `structured` returns a zod-validated object or null. Web research is long,
 * so it runs in the provider's background mode: `startResearch` returns a
 * handle at once and `checkResearch` later returns text plus the provider's
 * own URL citations (the pipeline independently verifies every URL before
 * anything is stored). This keeps every app request well inside the hosting
 * time limit however long the search takes.
 */
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  webSearchCalls: number;
  estimatedCostUsd: number;
}

export interface ResearchCitation {
  url: string;
  title: string;
  /** How the provider pointed at it: an inline citation, a link written in the text, or a page the search returned/opened. */
  origin: "cited" | "linked" | "searched";
}

export type ResearchCheck = { state: "pending" } | { state: "failed"; error: string } | { state: "done"; text: string; citations: ResearchCitation[]; searchCalls: number };

export interface ResearchModel {
  readonly name: string;
  /**
   * Returns schema-valid output or null. Presentation slips are repaired first
   * (see repair.ts); `salvage` may then keep the valid parts of an otherwise
   * invalid result. On null, `lastError` says why.
   */
  structured<T>(args: { schema: z.ZodType<T>; schemaName: string; system: string; input: string; maxOutputTokens?: number; reasoningEffort?: "low" | "medium" | "high"; salvage?: (raw: unknown) => { data: T; dropped: string[] } | null }): Promise<T | null>;
  /** Why the last structured call returned null, and what was repaired or dropped on the last success. */
  lastError?: string | null;
  lastNotes?: string[];
  /** Starts a web-grounded research job in the background; returns its handle. */
  startResearch(args: { system: string; input: string; maxOutputTokens?: number }): Promise<string>;
  /** Polls a research job; usage is counted once, when it completes. */
  checkResearch(handle: string): Promise<ResearchCheck>;
  readonly usage: ModelUsage;
}

const DEFAULT_MODEL = process.env.RESEARCH_MODEL ?? "gpt-5-mini";
// Rough list prices per 1M tokens for cost estimation only (configurable).
const INPUT_PRICE = Number(process.env.RESEARCH_MODEL_INPUT_USD_PER_M ?? "0.25");
const OUTPUT_PRICE = Number(process.env.RESEARCH_MODEL_OUTPUT_USD_PER_M ?? "2");
// Reasoning models spend output tokens on hidden reasoning (and on web searches)
// before writing the answer. Callers size `maxOutputTokens` for the visible
// answer; this headroom stops reasoning from consuming the whole allowance.
// Web search calls are billed per call on top of tokens (rough list price, configurable).
const SEARCH_CALL_PRICE = Number(process.env.RESEARCH_WEB_SEARCH_USD_PER_CALL ?? "0.01");
const REASONING_HEADROOM = Number(process.env.RESEARCH_REASONING_HEADROOM_TOKENS ?? "20000");

class OpenAIResearchModel implements ResearchModel {
  readonly name = DEFAULT_MODEL;
  readonly usage: ModelUsage = { inputTokens: 0, outputTokens: 0, webSearchCalls: 0, estimatedCostUsd: 0 };
  // Structured calls must finish inside one request; background research jobs are polled instead.
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 200_000, maxRetries: 1 });

  private track(u?: { input_tokens?: number; output_tokens?: number } | null, searchCalls = 0) {
    this.usage.inputTokens += u?.input_tokens ?? 0;
    this.usage.outputTokens += u?.output_tokens ?? 0;
    this.usage.webSearchCalls += searchCalls;
    this.usage.estimatedCostUsd = (this.usage.inputTokens * INPUT_PRICE + this.usage.outputTokens * OUTPUT_PRICE) / 1_000_000 + this.usage.webSearchCalls * SEARCH_CALL_PRICE;
  }

  lastError: string | null = null;
  lastNotes: string[] = [];

  async structured<T>({ schema, schemaName, system, input, maxOutputTokens = 4000, reasoningEffort, salvage }: { schema: z.ZodType<T>; schemaName: string; system: string; input: string; maxOutputTokens?: number; reasoningEffort?: "low" | "medium" | "high"; salvage?: (raw: unknown) => { data: T; dropped: string[] } | null }): Promise<T | null> {
    this.lastError = null;
    this.lastNotes = [];
    const { toJSONSchema } = await import("zod");
    const jsonSchema = toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
    const res = await this.client.responses.create({
      model: this.name,
      instructions: system,
      input,
      max_output_tokens: maxOutputTokens + REASONING_HEADROOM,
      ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {}),
      text: { format: { type: "json_schema", name: schemaName, schema: jsonSchema, strict: false } },
    });
    this.track(res.usage);
    const text = res.output_text;
    if (!text) {
      this.lastError = `${schemaName}: empty output (${res.status}${res.incomplete_details?.reason ? `, ${res.incomplete_details.reason}` : ""}, ${res.usage?.output_tokens ?? "?"} output tokens)`;
      return null;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.lastError = `${schemaName}: output was not complete JSON (${res.status}${res.incomplete_details?.reason ? `, ${res.incomplete_details.reason}` : ""}, ${text.length} chars)`;
      return null;
    }
    const repaired = repairToSchema(schema, raw);
    if (repaired.ok) {
      this.lastNotes = repaired.repairs;
      return repaired.data;
    }
    const kept = salvage?.(raw);
    if (kept) {
      this.lastNotes = [...kept.dropped.map((d) => `dropped ${d}`)];
      return kept.data;
    }
    this.lastError = `${schemaName}: ${repaired.reason}`;
    return null;
  }

  async startResearch({ system, input, maxOutputTokens = 8000 }: { system: string; input: string; maxOutputTokens?: number }) {
    const res = await this.client.responses.create({
      model: this.name,
      instructions: system,
      input,
      background: true,
      max_output_tokens: maxOutputTokens + REASONING_HEADROOM,
      tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
    });
    return res.id;
  }

  async checkResearch(handle: string): Promise<ResearchCheck> {
    // Source lists are only returned when asked for again on retrieval.
    const res = await this.client.responses.retrieve(handle, { include: ["web_search_call.action.sources"] });
    if (res.status === "queued" || res.status === "in_progress") return { state: "pending" };
    this.track(res.usage, res.output.filter((item) => item.type === "web_search_call").length);
    if (res.status === "failed" || res.status === "cancelled") return { state: "failed", error: `Research job ${res.status}${res.error?.message ? `: ${res.error.message}` : ""}` };
    if (res.status === "incomplete" && !res.output_text) {
      return { state: "failed", error: `Research response incomplete (${res.incomplete_details?.reason ?? "unknown reason"}) after ${res.usage?.output_tokens ?? "?"} output tokens.` };
    }
    const text = res.output_text ?? "";
    const cited: ResearchCitation[] = [];
    const searched: ResearchCitation[] = [];
    for (const item of res.output) {
      if (item.type === "message") {
        for (const part of item.content) {
          if (part.type === "output_text") {
            for (const a of part.annotations ?? []) {
              if (a.type === "url_citation") cited.push({ url: a.url, title: a.title, origin: "cited" });
            }
          }
        }
      }
      if (item.type === "web_search_call") {
        const action = item.action as { type?: string; url?: string | null; sources?: { url: string }[] } | undefined;
        if (action?.type === "open_page" && action.url) searched.push({ url: action.url, title: action.url, origin: "searched" });
        for (const src of action?.sources ?? []) searched.push({ url: src.url, title: src.url, origin: "searched" });
      }
    }
    const linked = linksInText(text).map((url) => ({ url, title: url, origin: "linked" as const }));
    // Best evidence first; the pipeline verifies every URL itself before any of it can support a claim.
    return { state: "done", text, citations: dedupe([...cited, ...linked, ...searched]).slice(0, MAX_RESEARCH_URLS), searchCalls: res.output.filter((item) => item.type === "web_search_call").length };
  }
}

const MAX_RESEARCH_URLS = 40;

function dedupe<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}

export function getResearchModel(): ResearchModel {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAIResearchModel();
}
