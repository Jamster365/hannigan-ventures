import { slugify } from "@/lib/domain/format";

/**
 * Entity resolution (SPEC §8.2 step 4). A candidate matches an existing
 * company only on strong signals: canonical domain, registration number or an
 * exact normalised name/alias. Similar-but-different names never merge; they
 * are flagged for human review instead.
 */
export interface KnownCompany {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  legalName: string | null;
  aliases: string[];
  /** When research last checked how to invest (null: never). Used to rotate daily re-checks. */
  lastCheckedAt?: string | null;
  /** The family has matched it (two ticks). */
  matched?: boolean;
}

export type Resolution = { kind: "existing"; companyId: string; reason: string } | { kind: "new"; slug: string } | { kind: "ambiguous"; candidates: { companyId: string; name: string }[]; reason: string };

export function canonicalDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const u = new URL(input.includes("://") ? input : `https://${input}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\b(ltd|limited|plc|inc|llc|gmbh|sas|sarl|bv|ab|oy|co|company|holdings|group|technologies|technology|labs|lab)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveCandidate(candidate: { name: string; website: string | null; legalName?: string | null }, known: KnownCompany[], takenSlugs: Set<string>): Resolution {
  const domain = canonicalDomain(candidate.website);
  if (domain) {
    const byDomain = known.find((k) => canonicalDomain(k.domain) === domain);
    if (byDomain) return { kind: "existing", companyId: byDomain.id, reason: `domain ${domain}` };
  }
  const norm = normaliseName(candidate.name);
  const legal = candidate.legalName ? normaliseName(candidate.legalName) : null;
  const exact = known.filter((k) => normaliseName(k.name) === norm || (legal && k.legalName && normaliseName(k.legalName) === legal) || k.aliases.some((a) => normaliseName(a) === norm));
  if (exact.length === 1) {
    const k = exact[0];
    // Conflicting domains mean two different companies with the same name.
    if (domain && k.domain && canonicalDomain(k.domain) !== domain) {
      return { kind: "ambiguous", candidates: [{ companyId: k.id, name: k.name }], reason: `name matches ${k.name} but domain differs (${canonicalDomain(k.domain)} vs ${domain})` };
    }
    return { kind: "existing", companyId: k.id, reason: "exact name match" };
  }
  if (exact.length > 1) return { kind: "ambiguous", candidates: exact.map((k) => ({ companyId: k.id, name: k.name })), reason: "multiple exact name matches" };

  // Near matches (shared leading token) are never merged automatically.
  const lead = norm.split(" ")[0];
  const near = lead && lead.length >= 4 ? known.filter((k) => normaliseName(k.name).split(" ")[0] === lead) : [];
  if (near.length > 0 && !domain) return { kind: "ambiguous", candidates: near.map((k) => ({ companyId: k.id, name: k.name })), reason: `similar name to ${near.map((k) => k.name).join(", ")}; needs review` };

  let slug = slugify(candidate.name) || "company";
  let i = 2;
  while (takenSlugs.has(slug)) slug = `${slugify(candidate.name)}-${i++}`;
  return { kind: "new", slug };
}
