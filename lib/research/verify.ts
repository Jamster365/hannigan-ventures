import { canonicaliseUrl, extractTitle, htmlToText, type SafeFetcher } from "./fetch";
import type { Candidate } from "./schemas";

/**
 * Evidence validation (SPEC §8.2 step 5, §8.5).
 *  - every cited URL must come from the provider's own citation set or be
 *    retrievable now; URLs that fail verification are dropped;
 *  - material claims (money, investors, founders, access) that lose all their
 *    sources are downgraded to unknown rather than published;
 *  - access status can never be upgraded by verification, only downgraded.
 */
export interface VerifiedSource {
  url: string;
  title: string;
  publisher: string;
  publishedAt: string | null;
  excerpt: string | null;
  contentHash: string | null;
  verified: boolean;
}

export interface VerificationReport {
  sources: Map<string, VerifiedSource>;
  dropped: { url: string; reason: string }[];
}

export async function verifySources(urls: string[], fetcher: SafeFetcher, opts: { concurrency?: number; citationTitles?: Map<string, string> } = {}): Promise<VerificationReport> {
  const unique = [...new Set(urls.map(canonicaliseUrl))];
  const sources = new Map<string, VerifiedSource>();
  const dropped: { url: string; reason: string }[] = [];
  const concurrency = opts.concurrency ?? 4;
  let i = 0;
  async function worker() {
    while (i < unique.length) {
      const url = unique[i++];
      const res = await fetcher(url, { maxBytes: 800_000, timeoutMs: 10_000 });
      if (!res.ok || !res.text) {
        dropped.push({ url, reason: res.error ?? `HTTP ${res.status}` });
        continue;
      }
      const text = htmlToText(res.text);
      const title = extractTitle(res.text) ?? opts.citationTitles?.get(url) ?? url;
      sources.set(url, { url, title, publisher: publisherFromUrl(url), publishedAt: findPublishedDate(res.text), excerpt: text.slice(0, 600) || null, contentHash: await sha256(text.slice(0, 20_000)), verified: true });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return { sources, dropped };
}

export function publisherFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return "unknown";
  }
}

export function findPublishedDate(html: string): string | null {
  const m = html.match(/(?:article:published_time|datePublished|date)["']?\s*(?:content|:)\s*=?\s*["']([0-9]{4}-[0-9]{2}-[0-9]{2}[^"']{0,20})["']/i);
  if (!m) return null;
  const d = new Date(m[1]);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function sha256(text: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(text).digest("hex");
}

/** Keep only verified URLs on a cited object; downgrade evidence if none remain. */
function keepVerified<T extends { sourceUrls: string[]; evidenceStatus: Candidate["access"]["evidenceStatus"] }>(obj: T, verified: Set<string>): T {
  const sourceUrls = obj.sourceUrls.map(canonicaliseUrl).filter((u) => verified.has(u));
  const evidenceStatus = sourceUrls.length === 0 && obj.evidenceStatus !== "analyst_inference" ? "unknown" : obj.evidenceStatus;
  return { ...obj, sourceUrls, evidenceStatus };
}

/**
 * Apply the evidence rules to a candidate. Returns the sanitised candidate and
 * a list of what was removed, so the run log can show it.
 */
export function sanitiseCandidate(c: Candidate, verified: Set<string>): { candidate: Candidate; removed: string[] } {
  const removed: string[] = [];
  const money = <M extends { amount: number | null; sourceUrls: string[]; evidenceStatus: Candidate["access"]["evidenceStatus"] } | null>(m: M, label: string): M => {
    if (!m) return m;
    const kept = keepVerified(m, verified);
    if (kept.sourceUrls.length === 0 && m.amount !== null) {
      removed.push(`${label}: amount dropped (no verified source)`);
      return { ...kept, amount: null } as M;
    }
    return kept;
  };

  const founders = c.founders
    .map((f) => keepVerified(f, verified))
    .filter((f) => {
      if (f.sourceUrls.length === 0) {
        removed.push(`founder ${f.name}: dropped (no verified source)`);
        return false;
      }
      return true;
    });

  const round = c.round
    ? {
        ...keepVerified(c.round, verified),
        target: money(c.round.target, "round target"),
        preMoney: money(c.round.preMoney, "pre-money"),
        postMoney: money(c.round.postMoney, "post-money"),
        reportedCommitted: money(c.round.reportedCommitted, "committed"),
        leadInvestors: keepVerified(c.round, verified).sourceUrls.length ? c.round.leadInvestors : (() => {
          if (c.round.leadInvestors.length) removed.push("lead investors dropped (no verified source)");
          return [];
        })(),
      }
    : null;

  let access = keepVerified(c.access, verified);
  if ((access.status === "verified_open" || access.status === "closing_soon") && (access.sourceUrls.length === 0 || !access.contactOrUrl)) {
    removed.push(`access downgraded from ${access.status} (no verified route)`);
    access = { ...access, status: c.access.contactOrUrl ? "contactable" : "fundraising_reported" };
  }

  const eis = keepVerified(c.eis, verified);
  const eisStatus = eis.status === "confirmed_documented" && eis.sourceUrls.length === 0 ? "company_claimed" : eis.status;
  if (eisStatus !== eis.status) removed.push("EIS documented claim downgraded to company_claimed");

  const facts = c.facts.map((f) => keepVerified(f, verified)).filter((f) => f.sourceUrls.length > 0 || f.evidenceStatus === "analyst_inference");
  const signals = c.signals.map((s) => keepVerified(s, verified)).filter((s) => {
    if (s.sourceUrls.length === 0) {
      removed.push(`signal "${s.headline}" dropped (no verified source)`);
      return false;
    }
    return true;
  });

  return { candidate: { ...c, founders, round, access, eis: { ...eis, status: eisStatus }, facts, signals }, removed };
}
