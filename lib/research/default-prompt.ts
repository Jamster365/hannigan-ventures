import type { ResearchPreferences } from "@/lib/domain/types";

/**
 * The EDITABLE discovery prompt. All household members can edit this through
 * More → Research instructions. It carries the ten discovery priorities from
 * SPEC §8.3 and the briefing style. Evidence, security and formatting rules
 * live in lib/research/policy.ts and are NOT editable.
 */
export const DEFAULT_RESEARCH_PROMPT = `Find early-stage investment opportunities across all sectors, with emphasis on the UK (London, Cambridge, Oxford), university spinouts, accelerators (Antler, EF, X-HEC) and genuine pre-round access for an individual angel writing cheques of up to £250,000. Every sector qualifies; there are no thematic quotas. Prefer a few well-evidenced findings over volume, and do not re-surface unchanged companies.

Scope: UK first, then the rest of Europe. Any company size or stage with a real route in for an individual angel. Equity crowdfunding campaigns count (the app labels them). Chase EIS/SEIS status (HMRC advance assurance, a company claim, or unknown) for every UK company.

Discovery priorities (keep all ten):

1. Actual allocation before close. Find quality companies where a cheque of up to £250,000 can genuinely be invested or plausibly obtained before the round closes: live EIS/SEIS rounds, residual allocations, extensions, SPVs, founder-direct and secondaries. Verify availability, price and the ability to execute.

2. Project Ventures / Imperial. New Project Ventures investments, Enterprise Lab companies, grant-winning Imperial spinouts, and any outside-angel or co-investment possibilities.

3. Cambridge. SPARK, Cambridge SYNC, King's E-Lab, Cambridge Capital Group and Cambridge Angels. Track founders from cohort through to financing.

4. Antler London. Track residency inception, team formation, investment and outside seed rounds. Find exceptional founders before press announcements.

5. Oxford. StEP, Moonshot, OUI spinouts, Oxford Innovation Finance / OION and Wilbe. Weight university IP and objective validation ahead of large rounds.

6. Angel-network access. Cambridge networks, OION, Green Angel Syndicate, SyndicateRoom, HERmesa, Haatch, Angel Academe, UKBAA, Helm, South East Angels, Project Ventures and others. Record concrete joining, guest, SPV and co-invest routes.

7. Frontier and repeat founders. Departures, incorporations, stealth and hiring signals from DeepMind, OpenAI, Anthropic, Meta FAIR, Nvidia, Microsoft Research, Arm and universities, plus repeat founders after meaningful exits.

8. Reverse-engineer earliest cheques. For breakout companies, identify the earliest angels, syndicates and accelerators and the signals that were visible before funding; apply those signals to find comparable founders today.

9. Permanent HEC / X-HEC programme watch. HEC Paris, X-HEC Entrepreneurs, Startup Launchpad and London-facing competition and demo-day finalists. Track companies at shortlist, product and customer-validation stage: incorporation, contracts, hiring, financing and founder links before institutional rounds.

10. Permanent cybersecurity founder/angel graph. Founders, operators and angels around Stoïk, GitGuardian, Vade and Almond: disclosed investments, adviser and customer ties, portfolio and repeat co-investor links. Treat multiple independent connections as an upstream signal, not proof, and assess the actual warm-intro or individual access route.

Also track London Demo Day and the Imperial, UCL, King's, LSE, Queen Mary, EF, Antler, X-HEC, Cambridge and Oxford demo days, including lists, decks, videos and follow-up funding. Surface relevant in-person London events with date, time, venue, registration, audience and a next action, preferring smaller curated founder/investor rooms. Where revenue or gross profit is available with a clear definition, evaluate valuation relative to it.

Briefing style: short, sceptical, commercially literate. Lead with what changed and why it matters. Keep unknowns visibly unknown.`;

export const DEFAULT_PREFERENCES: ResearchPreferences = {
  maxChequeGbp: 250_000,
  geographicFocus: "UK first (all regions), then Europe",
  discoveryDepth: "balanced",
  eventGeography: "London",
  researchTimeLocal: "07:00",
  sectorsInclude: [],
  sectorsExclude: [],
  dailyBudgetUsd: 2,
  dailyMode: "update_only",
};
