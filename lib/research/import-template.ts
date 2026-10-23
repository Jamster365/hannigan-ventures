/**
 * The prompt a member pastes into a Claude chat to research a batch of new
 * companies and get back a file the upload screen accepts. The format mirrors
 * candidateSchema and assessmentSchema in ./schemas.ts.
 */
export function claudeBatchPrompt(opts: { maxChequeGbp: number; known: string[] }): string {
  return `You are researching early-stage companies for a private family angel-investing app (three members, individual cheques up to £${opts.maxChequeGbp.toLocaleString("en-GB")}).

Find as many genuinely investable companies as you can verify (aim for 20–50), mainly in the UK, then Europe:
- Any sector and any size, as long as an individual angel has a real route in: a live or upcoming round, an angel network or syndicate, an SPV, a founder intro, or an equity crowdfunding campaign (Crowdcube, Seedrs/Republic Europe and similar — include these, they are labelled in the app).
- Chase EIS/SEIS: say whether the company has HMRC advance assurance, only claims eligibility, or it is unknown, with the page that says so.
- Prefer rounds open now or opening soon. Skip companies whose last round has closed with no sign of a new one.
- Do not include these, which we already track: ${opts.known.length ? opts.known.join(", ") : "(none yet)"}.

Use web search. Only state what a page you actually read says, and cite that page's full URL next to each claim (sourceUrls). Unknown values are null with evidenceStatus "unknown"; never guess figures. No made-up people, numbers or quotes.

Reply with ONE JSON code block and nothing else, in exactly this shape:

{
  "writeUp": "Two or three paragraphs: what you searched, what you found, what was hard to verify.",
  "companies": [
    {
      "candidate": {
        "name": "Company name",
        "website": "https://…",
        "legalName": "Registered name Ltd or null",
        "sector": "e.g. Climate",
        "subSector": "e.g. Heat pumps or null",
        "city": "London", "country": "United Kingdom",
        "stage": "Pre-seed | Seed | Series A | Series B | Grant-funded | Bootstrapped | null",
        "teaser": "One plain sentence, at most 150 characters.",
        "description": "3–6 sentences: what it does, team, stage and round, traction, main risks.",
        "discoverySignal": "Why it surfaced now (e.g. Crowdcube campaign live until 30 Nov).",
        "researchRuleMatched": "Which brief it fits (e.g. Live EIS round with an angel route).",
        "tags": ["up to 6 short tags"],
        "founders": [{ "name": "…", "role": "CEO", "bio": "One or two sentences.", "profileUrl": "https://… or null", "sourceUrls": ["https://…"], "evidenceStatus": "official_company_claim" }],
        "round": {
          "stage": "Seed",
          "target": { "amount": 1500000, "currency": "GBP", "asOf": "2026-10-20", "sourceUrls": ["https://…"], "evidenceStatus": "official_company_claim" },
          "preMoney": null, "postMoney": null, "reportedCommitted": null,
          "claimedStatus": "open | closed | expected | unknown",
          "closesAt": "2026-11-30 or null",
          "leadInvestors": [],
          "sourceUrls": ["https://…"], "evidenceStatus": "official_company_claim"
        },
        "access": {
          "status": "verified_open | closing_soon | fundraising_reported | expected | contactable | closed | unknown",
          "routeType": "platform | syndicate | spv | founder_intro | official_application | none",
          "contactOrUrl": "https://… (the page where an individual can invest or apply)",
          "minCheque": 10, "maxCheque": null, "currency": "GBP",
          "notes": "How an individual actually gets in.",
          "sourceUrls": ["https://…"], "evidenceStatus": "official_company_claim"
        },
        "eis": { "status": "confirmed_documented | company_claimed | pending | unknown | not_applicable", "note": "e.g. SEIS advance assurance stated on the campaign page", "sourceUrls": ["https://…"], "evidenceStatus": "official_company_claim" },
        "facts": [{ "key": "revenue", "label": "Revenue (FY2025)", "value": "£1.2m", "currency": "GBP", "asOf": "2025-12-31", "sourceUrls": ["https://…"], "evidenceStatus": "official_company_claim" }],
        "signals": [],
        "openQuestions": ["What a careful investor would still need to find out."]
      },
      "assessment": {
        "aiPriority": "high | medium | low | insufficient_evidence",
        "aiScore": 6.5,
        "confidence": "high | medium | low",
        "summary": "One or two sentences, sceptical.",
        "whyInterested": ["…"], "risks": ["…"],
        "bullCase": "…", "bearCase": "…", "whyNow": "…",
        "assumptions": [], "openQuestions": [], "diligenceChecklist": [],
        "nextAction": "The single next step for the family.",
        "breakdown": [
          { "key": "team", "label": "Team", "score": 7, "note": "…", "sourceUrls": [] },
          { "key": "traction", "label": "Traction", "score": 5, "note": "…", "sourceUrls": [] },
          { "key": "valuation", "label": "Valuation", "score": null, "note": "Not disclosed.", "sourceUrls": [] },
          { "key": "access", "label": "Access", "score": 8, "note": "…", "sourceUrls": [] }
        ],
        "changeExplanation": null
      }
    }
  ]
}

evidenceStatus is one of: verified_independent, official_company_claim, third_party_report, analyst_inference, unknown. Use aiScore null with aiPriority "insufficient_evidence" when there is too little evidence. "verified_open" access means you read a live page where an individual can invest today.`;
}
