import type { SafeFetcher } from "./fetch";
import type { ResearchImportPayload } from "./imported-model";

/**
 * TechRound's weekly "startups crowdfunding this week" posts are the one
 * readable, regularly updated list of live Crowdcube and Republic Europe
 * campaigns (the platforms themselves sit behind a bot wall). Each week's
 * post becomes a small research batch through the normal pipeline: the
 * company is created or updated with the target and SEIS/EIS as TechRound
 * states them, marked "reported", and the platform page is the way in.
 * Amount raised, valuation and closing date are never in these posts; a
 * member records those from the campaign page ("I checked: it's open").
 */

export interface TechRoundEntry {
  name: string;
  target: { amount: number; currency: string } | null;
  website: string | null;
  eis: "yes_seis" | "yes_eis" | "yes_both" | "pending" | "unknown";
  platform: string;
  about: string;
}

export interface TechRoundPost {
  url: string;
  /** ISO date of the Monday the post covers (from the URL's w-c-DD-MM-YYYY). */
  weekOf: string;
}

const INDEX_URL = "https://techround.co.uk/search/crowdfunding";

export function parseTechRoundIndex(html: string): TechRoundPost[] {
  const seen = new Map<string, TechRoundPost>();
  for (const m of html.matchAll(/https:\/\/techround\.co\.uk\/startups\/[a-z0-9-]*crowdfunding-w-c-(\d{2})-(\d{2})-(\d{4})\//g)) {
    const url = m[0];
    if (!seen.has(url)) seen.set(url, { url, weekOf: `${m[3]}-${m[2]}-${m[1]}` });
  }
  return [...seen.values()].sort((a, b) => b.weekOf.localeCompare(a.weekOf));
}

function stripTags(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/[ \t]+/g, " ");
}

function parseMoney(raw: string): { amount: number; currency: string } | null {
  const m = raw.match(/([£€$])\s?([\d,]+(?:\.\d+)?)\s*([km])?/i);
  if (!m) return null;
  let amount = Number(m[2].replace(/,/g, ""));
  if (m[3]?.toLowerCase() === "k") amount *= 1_000;
  if (m[3]?.toLowerCase() === "m") amount *= 1_000_000;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, currency: m[1] === "£" ? "GBP" : m[1] === "€" ? "EUR" : "USD" };
}

function parseEis(raw: string): TechRoundEntry["eis"] {
  const s = raw.toLowerCase();
  if (/pending/.test(s)) return "pending";
  if (!/yes/.test(s)) return "unknown";
  const seis = /seis/.test(s);
  const eis = /(^|[^s])eis/.test(s);
  return seis && eis ? "yes_both" : seis ? "yes_seis" : "yes_eis";
}

/** The numbered entries of one weekly post. */
export function parseTechRoundPost(html: string): TechRoundEntry[] {
  const text = stripTags(html.replace(/<(h[2-4])[^>]*>/gi, "\n## "));
  const out: TechRoundEntry[] = [];
  for (const block of text.split(/\n## /).slice(1)) {
    const head = block.match(/^\s*(\d+)\.\s*([^\n]+)/);
    if (!head) continue;
    const field = (label: RegExp) => (block.match(new RegExp(label.source + String.raw`\s*:?\s*([^\n]+)`, "i")) ?? [])[1]?.trim() ?? "";
    const platform = field(/Where to invest\??/).replace(/\s+/g, " ").slice(0, 40);
    const site = field(/Website/).replace(/\s.*$/, "");
    const website = site && site !== "N/A" ? (/^https?:\/\//i.test(site) ? site : `https://${site.replace(/^www\./, "")}`) : null;
    const about = (block.match(/About:\s*([\s\S]*?)(?:\n\s*Where to invest|$)/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
    out.push({ name: head[2].trim().replace(/\s+/g, " "), target: parseMoney(field(/How much are they raising\??/)), website, eis: parseEis(field(/SEIS\/EIS\??/)), platform, about });
  }
  return out;
}

const PLATFORMS: { re: RegExp; name: string; listing: string }[] = [
  { re: /crowdcube/i, name: "Crowdcube", listing: "https://www.crowdcube.com/investments" },
  { re: /republic|seedrs/i, name: "Republic Europe", listing: "https://europe.republic.com/discover" },
];

/** The equity-platform entries of a post as a research batch; charity/rewards platforms (Crowdfunder etc.) are left out. */
export function techRoundPayload(post: TechRoundPost, entries: TechRoundEntry[]): ResearchImportPayload | null {
  const week = new Date(post.weekOf + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const companies = entries.flatMap((e) => {
    const platform = PLATFORMS.find((p) => p.re.test(e.platform));
    if (!platform) return [];
    // Euro targets are continental campaigns on Republic Europe; the family wants UK companies.
    if (e.target && e.target.currency !== "GBP") return [];
    const teaser = (e.about.split(/(?<=[.!?])\s/)[0] || `${e.name} is crowdfunding on ${platform.name}.`).slice(0, 160);
    const eisStatus = e.eis === "pending" ? "pending" : e.eis === "unknown" ? "unknown" : "company_claimed";
    const eisNote = e.eis === "yes_both" ? "SEIS and EIS, per TechRound's listing" : e.eis === "yes_seis" ? "SEIS, per TechRound's listing" : e.eis === "yes_eis" ? "EIS, per TechRound's listing" : e.eis === "pending" ? "EIS pending, per TechRound's listing" : "Not stated in TechRound's listing";
    return [
      {
        candidate: {
          name: e.name,
          website: e.website,
          legalName: null,
          sector: "Unknown",
          subSector: null,
          city: null,
          country: null,
          stage: null,
          teaser,
          description: e.about.slice(0, 2000),
          discoverySignal: `Listed by TechRound as crowdfunding in the week of ${week} on ${platform.name}.`,
          researchRuleMatched: "Live equity crowdfunding campaign (TechRound weekly list)",
          tags: [platform.name, "crowdfunding"],
          founders: [],
          round: {
            stage: null,
            target: e.target ? { amount: e.target.amount, currency: e.target.currency, asOf: post.weekOf, sourceUrls: [post.url], evidenceStatus: "third_party_report" } : null,
            preMoney: null,
            postMoney: null,
            reportedCommitted: null,
            claimedStatus: "open",
            closesAt: null,
            leadInvestors: [],
            sourceUrls: [post.url],
            evidenceStatus: "third_party_report",
          },
          access: {
            status: "fundraising_reported",
            routeType: "platform",
            contactOrUrl: platform.listing,
            minCheque: null,
            maxCheque: null,
            currency: "GBP",
            notes: `TechRound lists it as crowdfunding on ${platform.name} in the week of ${week}. Open the campaign on ${platform.name} to see the amount raised, valuation and closing date, then record them here.`.slice(0, 400),
            sourceUrls: [post.url],
            evidenceStatus: "third_party_report",
          },
          eis: { status: eisStatus, note: eisNote, sourceUrls: [post.url], evidenceStatus: "third_party_report" },
          facts: [],
          signals: [{ headline: `Crowdfunding on ${platform.name}`, summary: `TechRound's weekly list for the week of ${week}${e.target ? `: raising £${e.target.amount.toLocaleString("en-GB")}` : ""}.`, type: "funding", materiality: "high", effectiveAt: post.weekOf, sourceUrls: [post.url], evidenceStatus: "third_party_report" }],
          openQuestions: ["Amount raised so far, valuation and closing date (on the campaign page)", "HMRC advance assurance letter", "Is the company UK-registered?"],
        },
      },
    ];
  });
  if (!companies.length) return null;
  return { writeUp: `TechRound's "startups crowdfunding this week" post for the week of ${week}: ${companies.length} equity campaign${companies.length === 1 ? "" : "s"} on Crowdcube or Republic Europe. Targets and SEIS/EIS are as TechRound states them; the platforms themselves cannot be read automatically, so amounts raised, valuations and closing dates are left for a member to record from the campaign page.`, companies, events: [], executiveFindings: [] };
}

export const TECHROUND_LABEL = "TechRound crowdfunding w/c";

/**
 * Once a day: queue any weekly post from the last two months that has not
 * been queued before (the import label is unique per post, so this is safe
 * to call repeatedly). Returns the labels queued.
 */
export async function pollTechRound(input: { householdId: string; fetcher: SafeFetcher; now: Date; alreadyQueued: (label: string) => Promise<boolean>; queue: (label: string, payload: ResearchImportPayload) => Promise<boolean> }): Promise<string[]> {
  const index = await input.fetcher(INDEX_URL, { maxBytes: 600_000, timeoutMs: 15_000 });
  if (!index.ok || !index.text) return [];
  const cutoff = new Date(input.now.getTime() - 62 * 86_400_000).toISOString().slice(0, 10);
  const queued: string[] = [];
  for (const post of parseTechRoundIndex(index.text).filter((p) => p.weekOf >= cutoff)) {
    const label = `${TECHROUND_LABEL} ${post.weekOf}`;
    if (await input.alreadyQueued(label)) continue;
    const page = await input.fetcher(post.url, { maxBytes: 800_000, timeoutMs: 15_000 });
    if (!page.ok || !page.text) continue;
    const payload = techRoundPayload(post, parseTechRoundPost(page.text));
    if (!payload) continue;
    if (await input.queue(label, payload)) queued.push(label);
  }
  return queued;
}
