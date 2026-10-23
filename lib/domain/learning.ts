import type { CompanyBundle, Vote } from "./types";

/**
 * The matcher's learning layer: each member's taste, learned from their own
 * yes/no answers and the reasons they give, plus the preferences they set,
 * plus a lighter family-wide taste. It only reorders the deck; nothing is
 * hidden because of it, and it never touches the AI's own score.
 *
 * Privacy: votes stay private until a match. Family taste is built from
 * features (sector, stage, SEIS/EIS...) across everyone's answers, and the
 * company being ranked is always left out, so another member's vote on that
 * company can never move it.
 */

export interface MemberPreferences {
  sectorsLike: string[];
  sectorsAvoid: string[];
  /** How much SEIS/EIS matters to this member. */
  eis: "essential" | "prefer" | "neutral";
  /** Stages this member prefers, e.g. ["Pre-seed", "Seed"]. */
  stages: string[];
  /** Usual cheque range in GBP (a preference, not a limit). */
  chequeMinGbp: number | null;
  chequeMaxGbp: number | null;
  notes: string;
}

export const DEFAULT_MEMBER_PREFERENCES: MemberPreferences = { sectorsLike: [], sectorsAvoid: [], eis: "prefer", stages: [], chequeMinGbp: 50_000, chequeMaxGbp: 250_000, notes: "" };

/** Plain-English names for features, used in "why this is here" lines and the taste page. */
export function featureName(f: string): string {
  const [kind, value] = [f.slice(0, f.indexOf(":")), f.slice(f.indexOf(":") + 1)];
  switch (kind) {
    case "sector":
      return `${value} companies`;
    case "stage":
      return `${value} rounds`;
    case "eis":
      return value === "yes" ? "SEIS/EIS companies" : value === "no" ? "companies without SEIS/EIS" : "companies with unknown SEIS/EIS";
    case "val":
      return value === "small" ? "small valuations (≤£5m)" : value === "mid" ? "mid valuations (£5m–£20m)" : "big valuations (£20m+)";
    case "route":
      return value === "platform" ? "crowdfunding rounds" : value === "syndicate" ? "angel-syndicate rounds" : value === "founder_intro" ? "founder-intro rounds" : `${value.replace("_", " ")} routes`;
    case "region":
      return `companies in ${value}`;
    case "ai":
      return `AI-rated ${value} companies`;
    default:
      return value;
  }
}

const SCOTLAND = /edinburgh|glasgow|aberdeen|dundee|stirling|inverness|scotland/i;
const WALES = /cardiff|swansea|newport|bangor|wrexham|tremadog|wales/i;
const NI = /belfast|derry|northern ireland/i;
const NORTH = /manchester|liverpool|leeds|sheffield|newcastle|york|bradford|hull|sunderland|durham|lancaster|preston|bolton|north shields|middlesbrough|nantwich|chester|warrington/i;
const MIDLANDS = /birmingham|nottingham|leicester|coventry|derby|wolverhampton|stoke|loughborough|warwick/i;
const LONDON = /london/i;
const SOUTHWEST = /bristol|bath|exeter|plymouth|cornwall|truro|gloucester|cheltenham/i;
const EAST = /cambridge|norwich|ipswich|colchester|peterborough/i;
const OXFORD = /oxford|reading|milton keynes|harwell|abingdon/i;

function region(city: string): string | null {
  for (const [re, name] of [[LONDON, "London"], [SCOTLAND, "Scotland"], [WALES, "Wales"], [NI, "Northern Ireland"], [NORTH, "the North"], [MIDLANDS, "the Midlands"], [SOUTHWEST, "the South West"], [EAST, "the East of England"], [OXFORD, "Oxford and the Thames Valley"]] as const) if (re.test(city)) return name;
  return null;
}

function stageBucket(stage: string): string | null {
  const s = stage.toLowerCase();
  if (/pre-?seed|angel/.test(s)) return "Pre-seed";
  if (/seed/.test(s)) return "Seed";
  if (/series a/.test(s)) return "Series A";
  if (/series [b-z]|growth|late/.test(s)) return "Later-stage";
  if (/grant/.test(s)) return "Grant-funded";
  return null;
}

/** What the matcher knows about a company, as a short list of features. */
export function companyFeatures(bundle: CompanyBundle): string[] {
  const { company } = bundle;
  const out: string[] = [];
  if (company.sector && company.sector !== "Unknown") out.push(`sector:${company.sector}`);
  const stage = stageBucket(company.stage ?? "");
  if (stage) out.push(`stage:${stage}`);
  out.push(`eis:${company.eisStatus === "confirmed_documented" || company.eisStatus === "company_claimed" || company.eisStatus === "pending" ? "yes" : company.eisStatus === "not_applicable" ? "no" : "unknown"}`);
  const round = bundle.rounds.find((r) => r.isCurrent) ?? null;
  const val = round?.preMoney ?? round?.postMoney ?? null;
  if (val !== null && (round?.currency ?? "GBP") === "GBP") out.push(`val:${val <= 5_000_000 ? "small" : val < 20_000_000 ? "mid" : "big"}`);
  const latest = [...bundle.accessChecks].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))[0];
  if (latest && latest.routeType !== "none") out.push(`route:${latest.routeType}`);
  const reg = region(company.city ?? "");
  if (reg) out.push(`region:${reg}`);
  return out;
}

/** Which features a reason chip speaks to, so a reason counts extra for them. */
const REASON_FEATURES: Record<string, string[]> = {
  "Love the sector": ["sector"],
  "Not our sector": ["sector"],
  "EIS/SEIS": ["eis"],
  "No EIS/SEIS": ["eis"],
  "Early and cheap": ["stage", "val"],
  "Too late stage": ["stage"],
  "Valuation too high": ["val"],
  "Easy route in": ["route"],
  "No route in": ["route"],
};

/** The reason chips picked in a saved note ("Chip, Chip. free text"). */
export function reasonChips(note: string | undefined): string[] {
  if (!note) return [];
  const head = note.split(". ")[0];
  return head.split(", ").filter((c) => c in REASON_FEATURES || ["Strong team", "Real traction", "Team not convincing"].includes(c));
}

type Counts = Map<string, { yes: number; no: number }>;

function bump(counts: Counts, f: string, yes: number, no: number) {
  const c = counts.get(f) ?? { yes: 0, no: 0 };
  c.yes += yes;
  c.no += no;
  counts.set(f, c);
}

export interface Taste {
  /** Answers this model learned from. */
  answers: number;
  yes: number;
  counts: Counts;
}

/** Learns a taste from yes/no answers (and their reasons) plus stated preferences. */
export function learnTaste(votes: Vote[], featuresOf: Map<string, string[]>, prefs?: MemberPreferences | null): Taste {
  const counts: Counts = new Map();
  let answers = 0;
  let yes = 0;
  for (const v of votes) {
    if (v.vote !== "interested" && v.vote !== "pass") continue;
    const features = featuresOf.get(v.companyId);
    if (!features) continue;
    answers++;
    const y = v.vote === "interested" ? 1 : 0;
    yes += y;
    const stressed = new Set(reasonChips(v.note).flatMap((c) => REASON_FEATURES[c] ?? []));
    for (const f of features) {
      // A reason that names this kind of feature counts double.
      const w = stressed.has(f.slice(0, f.indexOf(":"))) ? 2 : 1;
      bump(counts, f, y * w, (1 - y) * w);
    }
  }
  if (prefs) {
    for (const s of prefs.sectorsLike) bump(counts, `sector:${s}`, 3, 0);
    for (const s of prefs.sectorsAvoid) bump(counts, `sector:${s}`, 0, 3);
    for (const s of prefs.stages) bump(counts, `stage:${s}`, 2, 0);
    if (prefs.eis === "essential") {
      bump(counts, "eis:yes", 4, 0);
      bump(counts, "eis:no", 0, 6);
    } else if (prefs.eis === "prefer") {
      bump(counts, "eis:yes", 2, 0);
      bump(counts, "eis:no", 0, 2);
    }
  }
  return { answers, yes, counts };
}

export interface Contribution {
  feature: string;
  points: number;
  yes: number;
  no: number;
}

/**
 * How much a taste likes a company's features, in deck points (roughly
 * −40…+40). Each feature's lean is the smoothed log-odds of a yes against the
 * member's usual yes rate, trusted more as evidence builds up.
 */
export function scoreWithTaste(taste: Taste, features: string[]): { points: number; parts: Contribution[] } {
  const base = (taste.yes + 1) / (taste.answers + 2);
  const parts: Contribution[] = [];
  for (const f of features) {
    const c = taste.counts.get(f);
    if (!c) continue;
    const n = c.yes + c.no;
    const p = (c.yes + 2 * base) / (n + 2);
    const lean = Math.log(p / (1 - p)) - Math.log(base / (1 - base));
    const trust = n / (n + 3);
    parts.push({ feature: f, points: 12 * lean * trust, yes: c.yes, no: c.no });
  }
  const points = Math.max(-40, Math.min(40, parts.reduce((s, x) => s + x.points, 0)));
  return { points, parts: parts.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)) };
}

/** How little this taste knows about a company's features (0 = well known, 1 = new ground). */
export function novelty(taste: Taste, features: string[]): number {
  if (features.length === 0) return 0;
  return features.filter((f) => (taste.counts.get(f)?.yes ?? 0) + (taste.counts.get(f)?.no ?? 0) < 2).length / features.length;
}

export interface Matcher {
  mine: Taste;
  family: Taste;
  featuresOf: Map<string, string[]>;
  /** Learned points for this member and company, and a one-line reason. */
  score(bundle: CompanyBundle): { points: number; why: string | null; novelty: number };
}

/**
 * Builds the matcher for one member from every company's votes. Family taste
 * is relearned per company with that company's votes left out (see privacy
 * note above); it weighs half as much as the member's own taste.
 */
export function buildMatcher(bundles: CompanyBundle[], userId: string, prefs?: MemberPreferences | null): Matcher {
  const featuresOf = new Map(bundles.map((b) => [b.company.id, companyFeatures(b)]));
  const allVotes = bundles.flatMap((b) => b.votes);
  const mine = learnTaste(allVotes.filter((v) => v.userId === userId), featuresOf, prefs);
  const family = learnTaste(allVotes, featuresOf);
  return {
    mine,
    family,
    featuresOf,
    score(bundle) {
      const features = featuresOf.get(bundle.company.id) ?? companyFeatures(bundle);
      const own = scoreWithTaste(mine, features);
      // Leave this company's own votes out of the family taste.
      const others = bundle.votes.filter((v) => v.vote === "interested" || v.vote === "pass");
      const fam = others.length ? learnTaste(allVotes.filter((v) => v.companyId !== bundle.company.id), featuresOf) : family;
      const famScore = scoreWithTaste(fam, features);
      const points = own.points + 0.5 * famScore.points;
      return { points, why: explain(own.parts, prefs), novelty: novelty(mine, features) };
    },
  };
}

function explain(parts: Contribution[], prefs?: MemberPreferences | null): string | null {
  const top = parts.find((p) => p.points >= 3);
  if (!top) return null;
  const sector = top.feature.startsWith("sector:") ? top.feature.slice(7) : null;
  if (sector && prefs?.sectorsLike.includes(sector)) return `You said you like ${sector}.`;
  const answered = top.yes + top.no;
  if (answered >= 2) return `You’ve said yes to ${top.yes} of ${answered} ${featureName(top.feature)}.`;
  return `Fits what you’ve liked: ${featureName(top.feature)}.`;
}

/** A member's strongest learned likes and dislikes, for the taste page. */
export function tasteSummary(taste: Taste): { likes: Contribution[]; dislikes: Contribution[] } {
  const all = [...taste.counts.keys()].map((f) => scoreWithTaste(taste, [f]).parts[0]).filter(Boolean);
  return {
    likes: all.filter((p) => p.points >= 2).sort((a, b) => b.points - a.points).slice(0, 6),
    dislikes: all.filter((p) => p.points <= -2).sort((a, b) => a.points - b.points).slice(0, 6),
  };
}
