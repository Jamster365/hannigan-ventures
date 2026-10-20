import type { z } from "zod";

/**
 * Model output often slips on presentation limits the provider does not
 * enforce (a description a little over its length cap, a URL without a scheme,
 * one enum value outside the list). Rejecting a whole extraction for that
 * throws away good, sourced research. This repairs only such shape slips,
 * guided by the schema's own validation issues: truncate over-long text,
 * shorten over-long lists, null out malformed URLs, map unknown enum values to
 * "unknown"/"none" when the schema offers them. It never invents content:
 * anything else still fails validation, and evidence rules run afterwards.
 */
export function repairToSchema<T>(schema: z.ZodType<T>, input: unknown, maxPasses = 6): { ok: true; data: T; repairs: string[] } | { ok: false; reason: string; repairs: string[] } {
  const value: unknown = structuredClone(input);
  const repairs: string[] = [];
  for (let pass = 0; pass < maxPasses; pass++) {
    const parsed = schema.safeParse(value);
    if (parsed.success) return { ok: true, data: parsed.data, repairs };
    let changed = false;
    for (const issue of parsed.error.issues) {
      const path = issue.path as (string | number)[];
      if (path.length === 0) continue;
      const parent = getAt(value, path.slice(0, -1));
      const key = path[path.length - 1];
      if (parent === null || typeof parent !== "object") continue;
      const container = parent as Record<string | number, unknown>;
      const current = container[key];
      const at = path.join(".");
      const i = issue as { code: string; maximum?: number | bigint; format?: string; values?: unknown[]; expected?: string };
      if (i.code === "too_big" && typeof i.maximum === "number") {
        if (typeof current === "string") {
          container[key] = current.length > i.maximum ? `${current.slice(0, Math.max(0, i.maximum - 1)).trimEnd()}…` : current;
          repairs.push(`trimmed ${at}`);
          changed = true;
        } else if (Array.isArray(current)) {
          container[key] = current.slice(0, i.maximum);
          repairs.push(`shortened ${at}`);
          changed = true;
        }
      } else if (i.code === "invalid_format" && i.format === "url" && typeof current === "string") {
        const fixed = withScheme(current);
        container[key] = fixed ?? null;
        repairs.push(fixed ? `added https:// to ${at}` : `removed malformed URL at ${at}`);
        changed = true;
      } else if (i.code === "invalid_value" && Array.isArray(i.values)) {
        const fallback = ["unknown", "none", "insufficient_evidence", "other"].find((v) => i.values!.includes(v));
        if (fallback !== undefined && current !== fallback) {
          container[key] = fallback;
          repairs.push(`set ${at} to ${fallback}`);
          changed = true;
        }
      } else if (i.code === "invalid_type" && i.expected === "string" && (typeof current === "number" || typeof current === "boolean")) {
        container[key] = String(current);
        repairs.push(`stringified ${at}`);
        changed = true;
      } else if (i.code === "invalid_type" && i.expected === "number" && typeof current === "string" && current.trim() !== "" && Number.isFinite(Number(current.replace(/[,£$€\s]/g, "")))) {
        container[key] = Number(current.replace(/[,£$€\s]/g, ""));
        repairs.push(`parsed number at ${at}`);
        changed = true;
      }
    }
    if (!changed) return { ok: false, reason: summarise(parsed.error.issues), repairs };
  }
  const last = schema.safeParse(value);
  return last.success ? { ok: true, data: last.data, repairs } : { ok: false, reason: summarise(last.error.issues), repairs };
}

function getAt(root: unknown, path: (string | number)[]): unknown {
  let node: unknown = root;
  for (const p of path) {
    if (node === null || typeof node !== "object") return null;
    node = (node as Record<string | number, unknown>)[p];
  }
  return node;
}

function withScheme(raw: string): string | null {
  const s = raw.trim();
  for (const candidate of [s, `https://${s.replace(/^\/\//, "")}`]) {
    try {
      const u = new URL(candidate);
      if ((u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".")) return u.href;
    } catch {
      // try the next form
    }
  }
  return null;
}

function summarise(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues
    .slice(0, 4)
    .map((x) => `${x.path.join(".") || "(root)"}: ${x.message}`)
    .join("; ")
    .slice(0, 400);
}
