import type { SafeFetcher } from "./fetch";

/**
 * Companies House is the one public, authoritative record of what a company
 * actually did: when it was formed, who its directors are, and — the part
 * that matters after a crowdfunding or angel round — the SH01 "statement of
 * capital following an allotment of shares" filed once new shares are issued.
 * An SH01 is independent confirmation that a round (or a tranche) completed.
 * Only the public web pages are read; no API key, no login.
 */

export const COMPANIES_HOUSE = "https://find-and-update.company-information.service.gov.uk";

export interface Filing {
  date: string; // ISO
  type: string; // SH01, AA, CS01...
  description: string;
}

export interface Allotment extends Filing {
  /** The allotment date Companies House prints ("on 4 June 2026"), ISO. */
  allottedOn: string | null;
  /** The statement-of-capital total printed with the filing, e.g. "GBP 26.85" (nominal capital, not money raised). */
  capital: string | null;
}

const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

function isoDate(d: string): string | null {
  const m = d.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  if (!m) return null;
  const mm = MONTHS[m[2].toLowerCase()];
  return mm ? `${m[3]}-${mm}-${m[1].padStart(2, "0")}` : null;
}

function clean(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every filing on a filing-history page, newest first as Companies House lists them. */
export function parseFilingHistory(html: string): Filing[] {
  const out: Filing[] = [];
  for (const row of html.matchAll(/<tr>\s*<td class="nowrap">\s*([^<]+?)\s*<\/td>\s*<td class="filing-type[^"]*">\s*([^<]+?)\s*<\/td>\s*<td>([\s\S]*?)<\/td>/g)) {
    const date = isoDate(row[1]);
    if (!date) continue;
    out.push({ date, type: row[2].trim(), description: clean(row[3]) });
  }
  return out;
}

/** The share allotments (SH01) among the filings, with the allotment date and capital line. */
export function allotments(filings: Filing[]): Allotment[] {
  return filings
    .filter((f) => f.type === "SH01" || /allotment of shares/i.test(f.description))
    .map((f) => {
      const on = f.description.match(/allotment of shares on (\d{1,2} [A-Za-z]+ \d{4})/i);
      const cap = f.description.match(/\b([A-Z]{3} [\d,]+(?:\.\d+)?)\b/);
      return { ...f, allottedOn: on ? isoDate(on[1]) : null, capital: cap ? cap[1] : null };
    });
}

/**
 * Company numbers and names from a Companies House search: the endpoint answers
 * JSON when asked for it (what our fetcher does) and HTML otherwise, so both
 * are read. Dissolved companies are left out.
 */
export function parseSearch(body: string): { number: string; name: string }[] {
  const out: { number: string; name: string }[] = [];
  if (body.trimStart().startsWith("{")) {
    try {
      const items = (JSON.parse(body) as { items?: { title?: string; company_number?: string; company_status?: string }[] }).items ?? [];
      for (const it of items) if (it.company_number && it.title && it.company_status !== "dissolved") out.push({ number: it.company_number, name: clean(it.title) });
      return out;
    } catch {
      return out;
    }
  }
  for (const m of body.matchAll(/<a[^>]*href="\/company\/([0-9A-Z]{8})"[^>]*>\s*([^<]+?)\s*</g)) out.push({ number: m[1], name: clean(m[2]) });
  return out;
}

const SUFFIX = /\b(ltd|limited|plc|llp|cic|uk|co|company)\b\.?/gi;

export function normaliseName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(SUFFIX, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The one search result whose name is the company's (ignoring Ltd/Limited); null when none or several match. */
export function pickCompany(results: { number: string; name: string }[], names: string[]): { number: string; name: string } | null {
  const wanted = new Set(names.map(normaliseName).filter(Boolean));
  const hits = results.filter((r) => wanted.has(normaliseName(r.name)));
  const distinct = [...new Map(hits.map((h) => [h.number, h])).values()];
  return distinct.length === 1 ? distinct[0] : null;
}

export async function findCompanyNumber(names: string[], fetcher: SafeFetcher): Promise<{ number: string; name: string } | null> {
  for (const name of names.filter(Boolean)) {
    const res = await fetcher(`${COMPANIES_HOUSE}/search/companies?q=${encodeURIComponent(name)}`, { maxBytes: 400_000, timeoutMs: 15_000 });
    if (!res.ok || !res.text) continue;
    const hit = pickCompany(parseSearch(res.text), names);
    if (hit) return hit;
  }
  return null;
}

export function filingHistoryUrl(companyNumber: string): string {
  return `${COMPANIES_HOUSE}/company/${companyNumber}/filing-history`;
}

export async function latestAllotment(companyNumber: string, fetcher: SafeFetcher): Promise<{ allotment: Allotment | null; filings: Filing[] } | null> {
  const res = await fetcher(filingHistoryUrl(companyNumber), { maxBytes: 600_000, timeoutMs: 15_000 });
  if (!res.ok || !res.text) return null;
  const filings = parseFilingHistory(res.text);
  const all = allotments(filings).sort((a, b) => (b.allottedOn ?? b.date).localeCompare(a.allottedOn ?? a.date));
  return { allotment: all[0] ?? null, filings };
}
