/**
 * Validates hand-prepared research before it is imported (see
 * lib/research/imported-model.ts). Merges one or more JSON files, each an array
 * of { candidate, assessment }, checks them against the same schemas and
 * repairs the pipeline uses, and writes a single import payload.
 *
 *   npx tsx scripts/check-research-import.ts out.json label "write-up" in1.json [in2.json ...]
 *
 * This only checks shape. The pipeline still fetches and verifies every URL
 * at import time and strips any claim whose source cannot be verified.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { repairToSchema } from "../lib/research/repair";
import { assessmentSchema, candidateSchema } from "../lib/research/schemas";

const [out, label, writeUp, ...inputs] = process.argv.slice(2);
if (!out || !label || !writeUp || inputs.length === 0) {
  console.error("usage: check-research-import.ts out.json label write-up in1.json [in2.json ...]");
  process.exit(1);
}

type Entry = { candidate: unknown; assessment?: unknown };
const companies: Entry[] = [];
const seen = new Set<string>();
let problems = 0;

for (const file of inputs) {
  const entries = JSON.parse(readFileSync(file, "utf8")) as Entry[];
  for (const entry of entries) {
    const c = repairToSchema(candidateSchema, entry.candidate);
    const name = (entry.candidate as { name?: string })?.name ?? "(unnamed)";
    if (!c.ok) {
      problems++;
      console.log(`✗ ${name} [${file}]: candidate invalid: ${c.reason}`);
      continue;
    }
    const key = (c.data.website ? new URL(c.data.website).hostname.replace(/^www\./, "") : c.data.name).toLowerCase();
    if (seen.has(key)) {
      console.log(`• ${name}: duplicate of an earlier entry, skipped`);
      continue;
    }
    seen.add(key);
    const a = entry.assessment ? repairToSchema(assessmentSchema, entry.assessment) : null;
    if (a && !a.ok) {
      problems++;
      console.log(`✗ ${name}: assessment invalid: ${a.reason}`);
    }
    const urls = new Set<string>();
    JSON.stringify(c.data, (k, v) => {
      if (k === "sourceUrls" && Array.isArray(v)) v.forEach((u) => urls.add(u));
      return v;
    });
    const repairs = [...c.repairs, ...(a?.repairs ?? [])];
    console.log(`✓ ${c.data.name}: ${urls.size} cited URL(s), access ${c.data.access.status}, ${c.data.facts.length} facts, ${c.data.founders.length} founders${repairs.length ? `; repaired: ${repairs.join(", ")}` : ""}`);
    companies.push({ candidate: c.data, assessment: a?.ok ? a.data : undefined });
  }
}

writeFileSync(out, JSON.stringify({ label, payload: { writeUp, companies, events: [], executiveFindings: [] } }));
console.log(`\n${companies.length} companies written to ${out}${problems ? `; ${problems} problem(s) above` : ""}.`);
