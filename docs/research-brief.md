# Research brief: Hannigan Ventures first set (today is 21 October 2026)

You are researching REAL early-stage companies for a UK family of angel investors (cheques up to £250,000, UK first, all sectors). Your output is imported into their app and every URL you cite is fetched and checked by the app; claims whose URLs cannot be fetched are removed. So:

## Hard rules
- Never invent anything. Every fact must come from a page you actually opened with WebFetch today. If you could not confirm something, leave it null / "unknown" and add it to openQuestions.
- Cite pages that a plain HTTP fetch can open: company websites, university / accelerator / programme pages, official press releases, gov.uk / Companies House (find-and-update.company-information.service.gov.uk), reputable news (Sifted, UKTN, BusinessCloud, Tech.eu, BBC, FT may block). Do NOT cite LinkedIn, Crunchbase, Dealroom, PitchBook, X/Twitter, Reddit (they block automated fetches). Check each cited URL loads with WebFetch.
- Prefer companies that are genuinely early-stage (pre-seed to Series A), UK-based or UK-founded, with activity in 2025–2026. Prefer ones where an individual angel has a concrete route (live public round, angel-network/syndicate listing, accelerator demo-day contact) — but never claim a round is open unless a current page says so.
- Quality over quantity. 2–3 well-evidenced companies is better than 5 thin ones.

## Output
Write a JSON file (path given in your task) containing an array. Each element:
```json
{
  "candidate": {
    "name": "Company name",
    "website": "https://company.example",
    "legalName": "Company Ltd or null",
    "sector": "Short sector, e.g. Climate tech",
    "subSector": "e.g. Long-duration energy storage or null",
    "city": "London or null", "country": "UK or null",
    "stage": "Pre-seed | Seed | Series A | Grant-funded | Bootstrapped | null",
    "teaser": "One plain sentence, max 150 chars",
    "description": "3–6 factual sentences, max ~1500 chars: what it does, team, stage/round, traction/validation, main risks.",
    "discoverySignal": "Why it surfaced (e.g. 'Oxford University Innovation spinout, Seed round announced Sep 2026'), max 300 chars",
    "researchRuleMatched": "Which family priority it matches, e.g. 'Oxford spinouts'",
    "tags": ["max 6 short tags"],
    "founders": [{ "name": "", "role": "", "bio": "1–2 sentences or empty string", "profileUrl": "company team page URL or null", "sourceUrls": ["https://..."], "evidenceStatus": "official_company_claim" }],
    "round": null OR { "stage": "Seed", "target": {"amount": 2000000, "currency": "GBP", "asOf": "2026-09-01", "sourceUrls": ["..."], "evidenceStatus": "third_party_report"} or null, "preMoney": null, "postMoney": null, "reportedCommitted": {"amount": ..., "currency": "GBP", "asOf": "...", "sourceUrls": ["..."], "evidenceStatus": "..."} or null, "claimedStatus": "open|closed|expected|unknown", "closesAt": "YYYY-MM-DD or null", "leadInvestors": ["..."], "sourceUrls": ["..."], "evidenceStatus": "..." },
    "access": { "status": "unknown|fundraising_reported|contactable|verified_open|expected|closing_soon|closed", "routeType": "official_application|syndicate|founder_intro|spv|platform|none", "contactOrUrl": "public contact page/URL or null", "minCheque": null, "maxCheque": null, "currency": null, "notes": "how an angel could approach, or 'no public route found'", "sourceUrls": ["..."], "evidenceStatus": "..." },
    "eis": { "status": "confirmed_documented|company_claimed|pending|unknown|not_applicable", "note": null, "sourceUrls": [], "evidenceStatus": "unknown" },
    "facts": [{ "key": "snake_case", "label": "Short label", "value": "max 200 chars", "currency": null, "asOf": "YYYY-MM-DD or YYYY-MM or null", "sourceUrls": ["..."], "evidenceStatus": "..." }],
    "signals": [{ "headline": "max 120", "summary": "max 400", "type": "company|funding|product|team|risk", "materiality": "high|medium|low", "effectiveAt": "YYYY-MM-DD or null", "sourceUrls": ["..."], "evidenceStatus": "..." }],
    "openQuestions": ["What you could not confirm, max 8"]
  },
  "assessment": {
    "aiPriority": "high|medium|low|insufficient_evidence",
    "aiScore": 0-10 or null (null unless at least 2 independent verified sources),
    "confidence": "high|medium|low",
    "summary": "max 400 chars, sceptical angel view",
    "whyInterested": ["max 5, each max 200 chars"],
    "risks": ["max 6"],
    "bullCase": "max 400", "bearCase": "max 400", "whyNow": "max 300",
    "assumptions": [], "openQuestions": [], "diligenceChecklist": ["max 6"],
    "nextAction": "max 200",
    "breakdown": [ { "key": "team|product|traction|market|valuation|access|timing|risk", "label": "Team", "score": 0-10 or null, "note": "max 200", "sourceUrls": [] } ]  // 4 to 8 entries; valuation score null unless pre/post-money is sourced
    ,"changeExplanation": null
  }
}
```
evidenceStatus values: verified_independent (independent reputable source), official_company_claim (company/university page), third_party_report (news/blog), analyst_inference (your reasoning), unknown.

Every sourceUrls entry must be a full https URL you opened. Keep strings within the max lengths.

When finished, reply with: the file path, company names, and for each company the 1–2 strongest sources and anything you were unsure about.
