# THE DEAL ROOM
## Product, UX, Data, AI Research & Engineering Specification
**Version:** 1.0 — 19 October 2026  
**Status:** Build-ready specification for implementation in Claude Code  
**Primary platform:** Mobile-first private progressive web app (PWA), with tablet and desktop layouts  
**Stack:** Next.js + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Vercel + server-side AI research pipeline

> **Implementation mandate:** Build a polished, functioning application that follows the supplied mobile v3 design reference. This document is authoritative for behaviour, information architecture, data integrity and implementation. The screenshots are authoritative for visual character, not for example numbers or factual company details. Work in a **new project/repository**; do not alter any existing project. Do not fabricate valuations, scores, financing terms, sources or events that merely appear in a concept image.

### Included design references
- `design-references/mobile-v3-primary.png` — **primary** reference, 10 mobile screens (home, discovery, company overview, analysis, funding, team, updates, family, sources, research settings).
- `design-references/mobile-v2-reference.png` — complementary early mobile concepts and editorial visual direction.
- `design-references/desktop-original-reference.jpg` — supplementary desktop dashboard reference; **mobile takes priority**.

---

# 1. Product vision

The Deal Room is a **private family investment-discovery and research app** for three members: Jamie, his brother and his dad. The experience should feel like **an elegant editorial investment journal crossed with a lightweight research terminal and a shared family conversation**. It must be enjoyable to open on an iPhone for a few minutes, scroll beautiful real-world company cards, inspect research, react to companies and converse — without needing to read a long AI-generated essay.

An AI research process runs every morning, identifies credible potential angel investments and significant changes in followed companies, checks sources, and populates structured company profiles and feed cards. Family members independently decide which businesses are interesting. When **two out of the three** vote Interested, the company automatically joins the family shortlist. The AI's opinion is visible but **never mixed mathematically with family votes**.

**Success moment:** A member opens the app in the morning, notices an image-led company card, understands the opportunity in under 20 seconds, opens a polished profile, reads the thesis and risks, casts an Interested/Unsure/Pass vote, optionally scores it, adds a shared comment, and sees whether the family shortlist changed. If material news arrived overnight, they immediately see what changed, why it matters and the original source.

## Core product principles
1. **Mobile-first, scroll-first.** Primarily used on iPhone; excellent on iPad; desktop remains useful.
2. **Editorial first.** Real company imagery and readable narratives, not rows of tiny metrics.
3. **Research before recommendation.** Sceptical, commercially literate, source-linked analysis.
4. **No false certainty.** Unknown stays unknown; financing access is not inferred from announcements.
5. **Family opinions drive curation.** Two Interested votes = dynamic shortlist; AI assessment is separate.
6. **Change-focused intelligence.** Surface important developments; do not repeatedly re-promote unchanged companies.
7. **Source-grounded profiles.** Material claims link to their evidence, and full sources appear on each company page.
8. **Private by default.** Exactly three invite-only users initially; their comments and votes are shared within the private household.
9. **Simple v1.** This is not a brokerage, portfolio-accounting suite or investor CRM.

## MVP goals / non-goals
**Goals:** working home feed carousels, discovery, company detail pages, family voting and comments, shortlist, important updates, events, source links, research settings with approval workflow, actual Supabase persistence, authentication, scheduled AI research runs and change detection.

**Not in MVP:** investment execution, transferring money, cap-table management, paid subscriptions, external public social feed, messaging between users outside a company, real-time push notifications, SMS, complex numerical portfolio analytics, automatic outbound contact to founders, unsupervised changes to research instructions, scraping paywalled or private LinkedIn pages, arbitrary AI-generated company images passed off as real photos.

---

# 2. Confirmed product decisions

| Topic | Final decision |
|---|---|
| Primary use | Phone, then iPad, then desktop |
| Look and feel | Blend of premium dashboard + editorial investment journal + compact research terminal |
| Home organisation | Separate horizontal carousel sections |
| Company imagery | Real, attributable company/product/founder images; elegant typographic fallback |
| Card arrangement | One prominent card with next card visibly peeking; not cramped two-column phone cards |
| Company profile | Exceptional, image-led, sourced, tabbed, easy to skim |
| Bottom navigation | Home / Discover / Shortlist / Updates / More |
| Family evaluation | Interested / Unsure / Pass + **optional** 1–10 score |
| Shortlist rule | **Dynamic:** at least 2 of 3 active family members Interested |
| Losing a vote | Immediately demote if only one remains Interested; retain history |
| AI assessment | Separate AI research rating and written explanation; never blend with family average |
| Comments | One shared chronological company thread, visible to all three |
| Notifications | In-app only; important events and meaningful family activity |
| Daily briefing | Integrated as story/cards throughout Home, not a mandatory long separate article |
| Editing research prompt | All three members can directly edit the full prompt |
| Feedback on discoveries | AI proposes prompt changes; a member must review/apply them |
| Evidence | Inline links for material claims + comprehensive Sources tab |
| Roles | Equal family member permissions in MVP; owner may manage invitations/secrets |

### Important interpretation
The design-board example texts, dates, scores, logos, portraits, financial amounts and photos are **illustrative, sometimes inaccurate or synthetic**. None are seed facts. In particular, do not copy the fictional named founders, valuations or specific investor access statuses shown inside generated mockups. Seed data must be either clearly labelled demo material or re-verified against real sources before publication.

---

# 3. Visual design system

## 3.1 Art direction
Aim for **The Economist / high-end venture research note meets modern iOS product** — understated, beautiful, credible. Minimal gradients, very subtle elevation, neutral surfaces, generous spacing. Never make it resemble a noisy fundraising marketplace or retail crypto dashboard.

- **Headings:** tasteful editorial serif (e.g. Newsreader or Fraunces), used sparingly for page titles, company names and major section headers.
- **UI/body:** modern sans (e.g. Inter) for controls, facts, labels, company cards and analysis body.
- **Palette, starting tokens** (adjust during visual QA to match primary screenshot):
  - Ink/navy: `#142033`
  - Deep navy: `#0F1A2D`
  - Warm ivory page: `#F8F7F3`
  - Card surface: `#FFFFFF`
  - Secondary text: `#6B7480`
  - Hairline borders: `#E9EAEB`
  - Blue action: `#315C91`
  - Positive green: `#17865D`, pale `#E7F5EE`
  - Amber caution: `#A56A11`, pale `#FFF4DA`
  - Red critical: `#B64045`, pale `#FCE9E8`
- Rounded card corners 16–22 px; pills 999 px; restrained borders/shadows.
- Strong baseline typography and ample line height; no microscopic text from the screenshot. Minimum 12 px for secondary metadata, ideally >=13 px.
- Imagery full-bleed with controlled cropping; hero image default 16:9 or 4:3 (choose responsive), distinct visual treatment per company.
- Use mild haptics only if supported without compromising web/PWA compatibility (not essential).
- Status colours have **semantic meaning**, never colour alone.

## 3.2 Device layout
**Phone 320–479 px:** canonical. Single-column content. Bottom nav fixed above safe-area inset. Company carousel shows one ~82–90vw card plus a hint of the next. Company tab bar scrolls horizontally. Hero has enough height to feel editorial without hiding all information. Touch targets >=44×44 px.

**Large phone 480–767 px:** same structure with cards capped to readable width.

**iPad 768–1199 px:** wider editorial grid: Home may show 1.5–2 carousel cards, optional accompanying highlights panel. Maintain familiar nav; bottom navigation may switch to left rail at spacious breakpoints only after review. Company hero + a narrow sticky summary sidebar is permissible.

**Desktop >=1200 px:** use reference desktop screenshot as a secondary guide: sidebar, central feed/table, right research/activity rail. Desktop is an enhancement, not a separate product.

## 3.3 Navigation + micro-interactions
- Sticky lightweight top app bar: logo/wordmark on Home, search and notification icons, unread dot/count.
- **Persistent bottom navigation:** Home (house), Discover (compass), Shortlist (bookmark), Updates (bell), More (menu). Highlight active tab. Respect iPhone safe-area; never cover inputs.
- Selecting a company opens a full detail route (deep-linkable), with **back restoring previous Home carousel position, filters and scroll**.
- Primary company page may use sticky collapsing hero: image scrolls away, then company name + tabs stay available.
- Horizontal tab strip with clear underline: Overview / Analysis / Funding / Team / Updates / Family / Sources. Use scroll snapping and accessible tab semantics. Avoid confusing the page's horizontal carousel with tab swipes; buttons and tab strip are reliable.
- Search available from header, with keyboard focus and recent queries (optional for MVP).
- Cards open by tap. The separate bookmark/vote affordance must not accidentally navigate.
- Loading skeletons match final card shapes; all views have intentional empty/error states.

## 3.4 Image policy
**Hierarchy**: (1) company-provided original imagery with permission/allowable use; (2) properly attributable company website media or public OG image after checking usage conditions; (3) real founder/product press imagery with permissible reuse; (4) actual company logo with editorial gradient / tasteful typographic fallback.

Capture `image_url/storage_path`, `origin_url`, `source_id`, `creator_or_owner`, `license_or_permission`, `attribution`, `asset_kind`, `alt_text`, `last_checked_at`. Prefer store permissible optimized assets in Supabase Storage with size limits; no blind hotlinking; respect site usage restrictions and branding rules.

**Do not** generate photorealistic images and present them as a company's actual chip, device, founders, office or product. **Do not** scrape logged-in LinkedIn content. If imagery cannot be legitimately used, fallback to a large designed logo/name card. Show credited sources when required. If a remote asset breaks, fallback gracefully.

---

# 4. Information architecture and routes

```text
/                          Home feed (requires login)
/discover                  Browse, search, filter all companies
/shortlist                 Dynamically promoted family shortlist
/updates                   Important alerts + research and family changes
/more                      Events, networks, family, research settings, account
/companies/[slug]          Company detail (tab query params or nested routes)
/events                    Upcoming and archived founder/investor events
/networks                  Angel networks and access routes
/research/settings          Prompt, editable instructions, preferences, suggestions, versions
/research/history           Daily research-run history and errors (inside More)
/family                     Family activity + three member profiles
/auth/sign-in               Email magic-link or approved auth flow
/auth/callback              Secure auth callback
/invite/[token]             Invite redemption
```

An optional `/briefings/[date]` archive route is useful for accountability but **not** the primary daily experience. Build Home first; the research run publishes structured story cards into it.

---

# 5. Screen-by-screen product specification

## 5.1 Home — editorial daily overview
**Purpose:** Make today's research discoverable in 30 seconds and support casual scrolling.

Top: brand header, date localized to Europe/London, search, important notifications; warm editorial title (e.g., “Good morning”) and short context statement. Optional **compact** metric strip only (number of new companies, meaningful updates, shortlisted items). Counts must be computed from DB, not illustrative constants.

**Home sections in order** (hide empty sections or show thoughtful empty states):
1. **Today's highlights** — 2–4 compact editorial cards: major financing news, unusually important newly verified access, urgent deadlines, substantive market/founder signals. Swipe horizontally.
2. **New discoveries** — large image-led company cards for companies first discovered in the last 7 days and not yet reviewed; horizontal carousel. Show `NEW`, company, one-liner, sector/city, AI assessment if adequately evidenced, one meaningful evidence cue, and perhaps new-update indicator.
3. **Awaiting our views** — companies with at least one vote or conversation but no shortlist/majority pass; more compact horizontal carousel; e.g. “1 of 3 interested · 2 yet to vote”.
4. **Our shortlist** — companies with >=2 Interested votes. Prioritise material changes, confirmed investment urgency and recent family discussion; show family avatars/indicators.
5. **Recently changed** — meaningful changes to any tracked company, including passed companies **only** if evidence is genuinely consequential. Distinguish `AI research` from `Family activity` visually.
6. **Coming up** — 2–3 real upcoming events, registration/status, venue/date; optional “See all”.

Each company is shown **once at most** across the three principal lifecycle carousels (New / Pending / Shortlist). Highlights/Recently changed may link to the same company but should be editorial stories, not duplicate plain company cards.

Cards: tap open; small bookmark icon saves personal watch interest (optional), separate from Interested vote. A compact action button can go straight to Family assessment. Distinguish `new` company from `new material update`.

### Carousel mechanics
- Horizontal scroll snap, smooth finger drag; always partial next card visible on phone.
- Card widths approximately 82–88vw (max ~350 px); 12–16 px gaps.
- Do not force auto-scroll; no animation that moves a card while reading.
- Preserve carousel positions when visiting a profile and returning.
- “See all” opens Discover pre-filtered to that section.

## 5.2 Discover
Searchable curated list of **all** tracked companies; default filter All. Filter chips: All / New / Raising / UK / Pre-seed / Sector. Advanced filter sheet: sector, geography, investment stage, funding/access status, EIS/SEIS status, evidence quality, company freshness, AI priority. Sort: relevant, newest, latest material change, estimated deadline, AI assessment (where available), family interest.

Default discovery feed uses image-led one-column cards (not a financial spreadsheet). iPad can display two columns. No claims of a company being available to invest solely on the basis of a historical raise or a source calling it “fundraising”. Clear no-results state and reset filters.

## 5.3 Shortlist
All companies with `interested_vote_count >= 2` out of the three active family members. **Dynamic**: if a vote changes and interested count falls below two, immediately remove from Shortlist and send it to Pending/Passed as appropriate, preserving history. Render editorial cards with a compact three-avatar consensus strip, family average score if rated, separate AI score if supported, last meaningful development and next suggested action.

Sort default: verified funding urgency, material update recency, family discussion activity, family interest. Allow chronological/alphabetical sorting. Past rounds can be shortlisted, because “we like the company” differs from “we can invest today”.

## 5.4 Updates
Important in-app notifications only; tabs **All / Company / Family**.

Company examples: a round was **confirmed** open/closed; a materially changed valuation; company announces significant customer/clinical milestone; an actionable application deadline; a major risk has emerged; major funding secured; new investor information that changes access.

Family examples: second Interested vote triggered promotion; a member added a substantial comment/question; someone replied or materially changed vote; research instructions applied. Do **not** notify everyone for each passive view or every daily unchanged AI assessment.

Each entry has icon, headline, one-sentence explanation, company, timestamp, read/unread and direct link to relevant screen. A source-backed factual update opens to a detail or source list. Header badge counts unread **important** notifications. Notifications generated once per event, deduplicated per user. No email/push in v1.

## 5.5 More
An elegant menu with Events, Networks, Family, Research instructions, Research history, About/methodology, Account. Invite management available only to owner/admin; all three can edit research instructions and review suggestions.

## 5.6 Company detail — exceptional premium profile
Company pages are the centrepiece. **Seven tabs** with a persistent company identity header:

**Hero:** real attributable image or typography/logo fallback; clean overlay with company name (or title below), bookmark, share/deep link, image attribution if needed. Avoid adding fictional founder portraits. Below: name, one-sentence pitch, sector/location/stage chips, separate `family_status`, `investment_access_status` and `AI assessment` label. A small “last researched [time]” indicator.

**Overview:** concise “In a sentence”; 2–4 key funding/traction facts with labels and confidence (not invented); Why it matters; what changed recently; investment thesis; next action; quick route to Family vote and AI analysis. Can read in 60–90 seconds.

**Analysis:** AI research score (0–10 **only when evidence sufficient**, otherwise `Not rated`), source-grounded breakdown by founder/team, product/technical defensibility, traction, market/business model, valuation/terms, access/timing; “Why we're interested” and “Reasons to hesitate”; explicit assumptions, unresolved questions, diligence checklist; links to evidence. Score is a **research-priority opinion**, not probability of success or investment advice; model version and research date visible.

**Funding:** stage; round target; total subscribed; pre/post-money valuation (explicit labels), cheque minimum/maximum; amount actually available **only if verified**; funding status and check time; lead investors; EIS/SEIS classification and evidence; previous rounds timeline; exact access route (official application, trusted syndicate contact or named founder intro), link, expiry date; unknown values displayed as `Unknown`. Never show a fake valuation from illustrative UI mockups.

**Team:** verified founders/roles/bios, relevant experience and links to public verified profiles; investor/backer relationships and source provenance. No invented photos, employment histories or named angel investors.

**Updates:** chronological, searchable timeline of material developments and family changes. Distinct icons and source evidence; highlight **what changed** relative to previous state. Allow categories Company / Funding / Product / Team / Family, and mark read.

**Family:** all three independent Interested/Unsure/Pass votes and optional numerical scores; family average (only among submitted scores), dynamic shortlist status and rule explanation; single shared threaded-in-time chronological comment feed (flat messages in MVP), compose box; votes/comments update persistently. Each member can edit their own vote and comment, not others'. No hidden private comments in MVP.

**Sources:** bibliography grouped by News/Official/Filings/Research/Media/Other, dates, publisher, linked URL, date checked, source quality/claim type. Every material AI statement must point to a source or be labelled inference. External links open safely with `noopener noreferrer`, preserve app state.

**Tab navigation:** comfortable thumb-height horizontal strip. Deep links to specific tabs using URL query state, so notifications open the correct context. Back preserves parent position.

---

# 6. Family voting, consensus and comments: precise rules

**Members:** 3 invited household users at initial launch. Every member has one independent company vote: `Interested`, `Unsure`, `Pass` or **Not reviewed** (no record). Score 1–10 is optional and independent; ability to clear it. Changing score alone does not change shortlist membership.

**Computed family stage** (not hand-edited):
1. `SHORTLISTED` if interested >= 2.
2. Else `PASSED` if pass >= 2.
3. Else `UNREVIEWED` if no members have cast a vote.
4. Else `PENDING`.

This priority order is deterministic; with three users, a company cannot have two Interested and two Pass simultaneously. A single Pass alone **never deletes a company**. Passed companies remain searchable and retain research; meaningful new evidence may reopen discussion but must not silently change votes.

**Transitions:** perform on vote insert/update/delete; calculate server-side or from a single canonical query; avoid race conditions. Emit a single activity event for stage transitions; if shortlisted after second Interested, notify other members. If it falls out of shortlist after a withdrawn vote, move immediately and record a reversible audit event. No overriding/moving by AI.

**Ratings:** optional family scores 1–10. `family_avg` = arithmetic mean over submitted ratings only, displayed with number of raters (e.g., “7.5/10 · 2 rated”). No score shown if zero ratings. AI score separate; never combine them. Family vote **means willingness to investigate**, not a commitment to invest.

**Comments:** shared, newest-last chronological flat thread; author/time; append; edit/delete own messages with edit marker; plain text initially (sanitize input), basic links, no rich file uploads in MVP. Mentioning a member optional. Significant new comments create in-app notifications for other household members. Moderator/admin can remove abusive content if future members added; three-family-member MVP can remain simple.

**Optional per-member bookmark** must be distinct from Interest vote; bookmark is a personal read-later flag and does not affect family stage.

---

# 7. AI research assessment and evidence rules

## 7.1 AI score
Separate **AI research assessment** from family preference:
- `ai_score`: nullable decimal 0.0–10.0, optional; only assign if primary evidence is sufficient to justify an assessment.
- `ai_priority`: High / Medium / Low / Insufficient evidence.
- `score_breakdown`: named categories with brief explanation and evidence links. Consider founder quality, product/IP, traction, market, valuation, access, timing, downside/risk.
- `assessment_confidence`: High / Medium / Low, reflecting evidence completeness, **not** investment success probability.
- Timestamp, model version, policy/prompt version, sources and calibration disclaimers.
- If valuation is unknown, the valuation/terms dimension is **unrated**, not assumed cheap or average.
- Explain why rating changed; avoid pseudo-precision from weak data.

## 7.2 Evidence & financing status are separate entities
Each material fact has `value`, units, as-of timestamp, provenance, source, and one of: `verified_independent`, `official_company_claim`, `third_party_report`, `analyst_inference`, `unknown`.

An official fundraising announcement is strong evidence the **company says it is fundraising**; it is **not** definitive evidence that £25k from a new angel can be accepted today.

**Investment access statuses:**
- `UNKNOWN`: no verified access route.
- `FUNDRAISING_REPORTED`: company/fund states it is raising; no verified live angel application.
- `CONTACTABLE`: credible direct founder, syndicate or investor-intro route exists; allocation unknown.
- `VERIFIED_OPEN`: publicly live application or direct operator confirmation recently validated, supports a cheque <=£100k, and key qualification/minimum terms identified.
- `EXPECTED`: planned future round, not open.
- `CLOSING_SOON`: confirmed live with specific credible imminent deadline.
- `CLOSED`: source/issuer confirms completion or closure.
- `STALE`: last open check too old; cannot claim live access.

**“CAN INVEST NOW” is permitted only** when `VERIFIED_OPEN` is recently checked (configurable default within 48 hours), an actionable route is stored, cheque terms are compatible and no confirmed closure conflicts. Explain the nuance that **an application route does not guarantee allocation**. Expire badge automatically to `STALE` without re-verification; opening an old article never renews it.

**EIS/SEIS:** distinguish `confirmed_documented` (documented eligibility/advance assurance details, carefully worded), `company_claimed`, `pending`, `unknown`, `not_applicable`. **HMRC advance assurance is not the same as guaranteed relief for an individual investment.** Include evidence and tax-year context if material. Never mark confirmed merely because an EIS fund has invested previously.

**Financials:** always label pre-money vs post-money, currency, dates, and whether revenue is recognised revenue/ARR/GMV/passthrough. Mark funding amount reported vs amount actually available. Do not divide valuations by undisclosed revenue or imply a meaningful multiple without comparable definitions.

---

# 8. Research engine: scheduled, source-grounded, change-focused

## 8.1 Daily schedule
Default **07:00 Europe/London** each morning; editable in research settings. Time zone and DST must be handled correctly. Vercel Cron is UTC-based: schedule checks at `06:00` and `07:00` UTC and execute only when Europe/London local hour equals configured 07:00; use a unique DB constraint on `(household_id, local_research_date, run_kind)` plus lock/idempotency to prevent duplicate runs. Alternatively implement a reliable DST-aware scheduler. Publish results atomically when complete enough; don't produce duplicate notifications on retries.

Trigger types: scheduled daily, manual authorised “Run research now” (cost-warning/limits), optional narrow company re-check when a financing deadline is approaching. The latter is **not required** for initial MVP.

## 8.2 End-to-end pipeline
1. **Load config:** active immutable base safety/data integrity rules + latest approved family research prompt version + research preferences + companies currently tracked + seen-source hashes.
2. **Source discovery:** approved public web retrieval/search covering the established broad-sector sourcing mandate. Respect rate limits, site terms and copyright. Gather company websites, posts, programme rosters, funding pages, government grants, filings, investor announcements and relevant press.
3. **Candidate extraction:** structured schema (company identity, URL, people, sector, geography, opportunity signal, company/finance facts, events, sources, observed date) with required provenance.
4. **Entity resolution/deduplication:** match by canonical domain, registration number if available, legal name, aliases and human review if ambiguous. **Never overwrite a different company** because names are similar.
5. **Evidence validation:** check source existence/URL, publication vs observation date, independent corroboration for material claims and conflicting values. Keep contrary evidence visible. No invented source URLs, names, valuations, founders or round status.
6. **Access check:** record precise route and freshness when possible; if unable to verify, mark `CONTACTABLE`/`FUNDRAISING_REPORTED`/`UNKNOWN`, not `VERIFIED_OPEN`.
7. **Company update:** upsert structured facts with history; only replace an existing fact with new evidence and create field-level change records.
8. **Assessment:** generate short thesis, bull/bear, why now, risk, access path, next action, AI priority/score only if supportable; attach citation IDs.
9. **Materiality classifier:** separate novelty, material financing changes, risk, real access, major traction/founder change and routine marketing noise. Only meaningful changes produce notifications.
10. **Publish:** curate section-specific Home feed cards; update company profile timeline; write audit and research-run cost/status; notifications for high-priority material developments.
11. **Quality checks:** reject/correct malformed or uncited facts; log unverified candidates for review, not as polished verified opportunities.

Architecture must allow re-running research against only a subset of tracked companies without recrawling the whole internet.

## 8.3 Discovery priorities — preserve all ten
The active default research prompt must implement the principal's current mandate:

1. **Actual allocation before close:** Find quality companies where a <=£100,000 cheque genuinely can be invested or plausibly gained pre-close; live EIS/SEIS, residual allocations, extensions, SPVs, founder-direct, secondaries; verify availability, price and ability to execute.
2. **Project Ventures / Imperial:** New Project Ventures investments, Enterprise Lab, grant-winning Imperial spinouts and outside-angel/co-investment possibilities.
3. **Cambridge:** SPARK, Cambridge SYNC, King's E-Lab, Cambridge Capital Group/Angels; track founders from cohort to financing.
4. **Antler London:** Track residency inception, team formation, investment and outside seed rounds; find exceptional founders before press announcements.
5. **Oxford:** StEP, Moonshot, OUI spinouts, Oxford Innovation Finance/OION, Wilbe; weight university IP and objective validation ahead of big rounds.
6. **Angel-network access:** Cambridge networks, OION, Green Angel Syndicate, SyndicateRoom, HERmesa, Haatch, Angel Academe, UKBAA, Helm, South East Angels, Project Ventures and others; concrete joining, guest, SPV and co-invest routes.
7. **Frontier/repeat founders:** DeepMind, OpenAI, Anthropic, Meta FAIR, Nvidia, Microsoft Research, Arm, universities, repeat founders following meaningful exits; departures, incorporations, stealth and hiring signals.
8. **Reverse-engineer earliest cheques:** Identify earliest angels/syndicates/accelerators and signals visible pre-funding for breakout companies; access nearby founders today.
9. **Permanent HEC / X-HEC programme watch:** HEC Paris, X-HEC Entrepreneurs, Startup Launchpad and London-facing competition/demo-day finalists. Track Fleuret-like companies at early shortlist/product/customer-validation stage; incorporation, contracts, hiring, financing and founder links before institutional rounds.
10. **Permanent cybersecurity founder/angel graph:** Stoïk, GitGuardian, Vade, Almond founders/operators/angels, disclosed investments, adviser/customer ties, portfolio and repeat coinvestor links; multiple independent connections as upstream signal **not proof**; assess actual warm-intro/individual access route.

**Every sector qualifies** without thematic quotas; avoid repeated concentration by weak relevance. UK/London/Cambridge/Oxford gets extra weight, global outstanding opportunities considered. Prefer real source evidence and quality over large volumes. Track London Demo Day and Imperial/UCL/King's/LSE/Queen Mary/EF/Antler/X-HEC/Cambridge/Oxford demo days with lists/decks/videos/follow-up funding. Surface relevant London in-person events (date/time/venue/registration/audience/action), prefer smaller curated founder/investor rooms. Investigate first-cheque pathways for funded breakouts. Evaluate valuation relative to appropriately defined revenue/gross profit when available. Avoid recirculating unchanged watchlist entries.

## 8.4 Output schema (conceptual)
Each run publishes 5–8 concise executive findings internally, and a variable number of Home stories and at most 3 truly noteworthy new company dossiers. No need to display a long daily report as default.

For any new/reassessed company store: official name/website, sector/geo, stage, founders, product summary, raise/valuation/cheque/equity terms, EIS/SEIS evidence, traction and source dates, investors, bull case, bear case, why now, early signal, actual access route, next action, status, source IDs and missing questions. **Fewer than 3** featured investment leads is fine.

A key UX element: card menu **“Why am I seeing this?”** should show the discovery signal, research rule matched, exact source(s), and what is new relative to yesterday.

## 8.5 Source and hallucination guardrails
- Search/research service must support citations or attach verified retrieved source URLs itself. Never instruct the model to invent sources.
- Store original URL and title, publisher, publication and retrieval timestamps, text excerpt where permissible, source type and provenance.
- Cite material numeric claims and named investor/founder claims. If an important claim has no sourced evidence, omit or flag unverified.
- Researcher may infer with a clearly tagged hypothesis and supporting rationale; keep it separate from fact.
- Untrusted webpages can contain prompt injections; never treat their text as instructions. Keep source text in a data context separate from system constraints.
- No paid-site scraping or bypassing authentication, robots or legal access controls.
- Cache/deduplicate web queries and use run-level API/token budget settings; handle provider unavailability with a dated “No new verified research” state rather than recycling fake activity.
- Give the user an explicit research method/source transparency view.

---

# 9. Editable research instructions + feedback

**All 3** family members can open **More → Research instructions**, read and edit the complete main prompt, save versions, and view who changed what and when. An explicit active prompt version ID is used for each run.

### Two editing flows
**Direct edit:** Any member edits full text; preview diff; confirm Save & Activate. Store previous immutable version and author; optionally include an explanatory change note. If another user saved a new version since the edit began, show conflict/diff and require user decision (optimistic concurrency), not last-write-wins silently.

**Feedback suggestion:** From any company card, `… → Improve our research` with choices such as “Too many in this sector”, “Find more pre-seed”, “Research missed something”, “Not interested in this model”, or free text. AI proposes a **specific prompt diff**, the rationale and expected impact. A member may **Apply** or **Dismiss**; no AI/autonomous instruction edits. Applying creates an audited prompt version and takes effect from next scheduled run. All three may approve.

**Layered prompts:** Immutable enforcement for evidence/security/source policy and formatting reliability stays outside user-editable instructions. The **editable discovery prompt** contains sector/geographic priorities, ten upstream channels and briefing style. Explicitly show this distinction in UI.

**Preferences page:** max cheque default £100k, geographic emphasis UK-first/global exceptions, discovery depth, event geography London, optional research time, sector inclusion/exclusion as user preferences; changing these requires a versioned save. `£100k` means upper individual cheque, not assumed liquid budget.

MVP UI: Instructions / Preferences / History top tabs; version history with restore and audit log; suggestions queue with Apply/Dismiss; manual `Run research now` gated by daily budget and explicit confirmation.

---

# 10. Events and investor networks

## Events
Card: title, programme/organiser, event type, date and **Europe/London-local start/end**, verified venue/city, official registration link, booking status **as of check date**, audience fit, significance, next action, related companies, source URL. `Registration status unknown` if not verified; no phantom dates/venues. Event feed sorted by upcoming dates; archive older ones for research history. Saved/bookmarked events optionally in v1. In-person London events get prominence; Cambridge/Oxford or online may appear where exceptional, clearly tagged.

## Angel networks
Directory for Project Ventures, Cambridge Capital Group/Angels, OION, Green Angel Syndicate, SyndicateRoom, HERmesa, Haatch, Angel Academe, UKBAA, Helm, South East Angels, Oxford Technology WOTAN and new credible networks. Each record: focus, region, membership/guest rules, fees if verified, usual cheque requirements, co-investment route, exact public contact URL/email if sourced, accessibility confidence, last checked date and linked portfolio companies. **Never assume membership guarantees investment access.**

---

# 11. Supabase data model (minimum recommended)

All private household tables include `household_id UUID NOT NULL` and audit timestamps. Generate typed Supabase client definitions. Put DB schema changes in versioned SQL migrations. Prefer Postgres enums or constrained text with controlled migration procedure.

| Table | Core columns | Notes |
|---|---|---|
| `households` | id, name, created_at | One private household initially |
| `profiles` | user_id (auth uid), display_name, avatar, created_at | Display names are configurable; don't hardcode real names into logic |
| `household_members` | household_id, user_id, role (owner/member), status, joined_at | 3 invited people initially; owner manages invites |
| `invitations` | household_id, invited_email, token_hash, expires_at, status | Secure single-use invite flow |
| `companies` | id, household_id, name, slug, legal_name?, domain?, sector?, sub_sector?, city?, country?, stage?, teaser?, description?, created_at, updated_at, first_discovered_at | Canonical company identity |
| `company_aliases` | company_id, alias, source_id? | Entity resolution |
| `company_media` | company_id, storage_path/url, kind, is_primary, rights_status, origin_url, attribution, alt_text, checked_at | Real images only; safe fallback |
| `sources` | id, company_id nullable, household_id, canonical_url, title, publisher, source_type, published_at, retrieved_at, content_hash, trust_tier | Citations/provenance |
| `company_facts` | company_id, field_key, value_jsonb, currency?, as_of_date, evidence_status, source_id, effective_from, effective_to, recorded_at | Historic, sourced facts; never destructive overwrite |
| `funding_rounds` | company_id, stage, target_amount, currency, pre_money, post_money, reported_committed, opened_at, closes_at, claimed_status, source_id | Nullable numbers; distinguish pre/post |
| `investment_access_checks` | company_id, access_status, route_type, contact_or_url, min_cheque, max_cheque, currency, checked_at, expires_at, verifier, source_id, notes | Truth source for “Can invest now” |
| `company_assessments` | company_id, run_id, ai_priority, ai_score nullable, confidence, summary, bull_case, bear_case, score_breakdown_jsonb, model_version, created_at | Versioned AI opinions |
| `member_votes` | company_id, user_id, vote, score nullable, updated_at | Unique(company_id,user_id); one vote per member |
| `member_bookmarks` | company_id, user_id, created_at | Optional personal read-later |
| `comments` | id, company_id, author_user_id, body, created_at, edited_at, deleted_at | Flat shared chronological comments |
| `company_updates` | id, company_id, update_type, headline, summary, materiality, source_id?, run_id?, effective_at, detected_at, change_jsonb | Research and significant family changes separated by type |
| `home_stories` | id, household_id, run_id, story_type, company_id nullable, headline, teaser, priority, source_id?, created_at, expires_at | Today's highlights and feed stories |
| `notifications` | id, household_id, recipient_user_id, notification_type, company_id?, update_id?, comment_id?, title, body, importance, read_at?, created_at, dedupe_key | In-app only |
| `events` | id, household_id, name, organiser, start_at, end_at, timezone, venue, city, registration_url, access_status, registration_checked_at, importance, source_id | No invented registration state |
| `angel_networks` | id, household_id, name, website, eligibility, joining_url, fees, contact, verification_status, last_checked_at, notes | Networks directory |
| `research_prompts` | id, household_id, version, prompt_text, config_jsonb, created_by, created_at, active, change_note, parent_version_id | Immutable history; exactly one active per household |
| `research_feedback` | id, household_id, company_id?, author_user_id, feedback_type, body, created_at | Feedback source |
| `prompt_suggestions` | id, household_id, feedback_id, base_prompt_version_id, suggested_patch, rationale, status, approved_by?, applied_version_id?, created_at | Explicit approval |
| `research_runs` | id, household_id, local_date, run_kind, prompt_version_id, status, started_at, finished_at, model, source_count, candidates_count, published_count, estimated_cost, error_summary | Run trace/idempotency |
| `audit_events` | id, household_id, actor_type, actor_id?, action, object_type, object_id, before_jsonb?, after_jsonb?, created_at | Decisions, prompt edits, corrections |

**Indexes/constraints:** unique company slug per household; unique canonical domain if valid within household with collision handling; unique vote per user/company; unique source canonical URL/content hash where useful; unique notification dedupe key per recipient; unique research run per household/day/kind; indexes on company timelines, stage/sector, prompts, updated_at and unread notifications.

**Data hygiene:** do not store unverifiable data as confidently verified; maintain field-level source and effective date; supersede historical facts rather than deleting their provenance. If articles contradict, retain conflict and surface uncertainty. Backfill timestamps carefully from original publication dates, not current import times.

## 11.1 Authentication and RLS
- Supabase Auth via email magic link or similarly simple secure method; three invite-only accounts. Disable public signup.
- Every read/write scoped to authenticated household membership with **Supabase Row Level Security (RLS)**. Even if only one household exists, design tenant-safe.
- Users may read household companies/research/comments/votes. Users may change **only their own** vote, bookmark and comment; all members can edit research prompt via secure audited server action. Owner manages invites.
- Never send Supabase `service_role` key to client. Server-only AI/API keys; encrypt secrets in host environment variables.
- Research runner uses service role in restricted server environment with explicit household target, server-side schema validation and logging.
- Validate all mutations server-side; request throttling for comments, research runs and invitation endpoints; CSRF protections consistent with framework auth approach.
- Sanitize content / avoid XSS; safe external URLs and remote image sources; SSRF-defended retrieval (block localhost/private address metadata endpoints; allowlist scheme and size/time limits).
- All email addresses, memberships and private family commentary stay within the private service; no public indexed content. Add `noindex`, auth gating and avoid inadvertently leaking generated routes through social preview metadata.

---

# 12. Technical architecture

## Recommended stack
- Next.js App Router, latest compatible stable version; React + TypeScript strict mode.
- Tailwind CSS + shadcn/ui primitives + lucide-react icons. Custom editorial UI components, not generic default shadcn appearance.
- Supabase Postgres, Auth, Storage (where image rights allow); `@supabase/ssr`-appropriate server/client integration.
- Vercel deployments with Preview/Production environments and cron endpoints (or equivalent reliable task infrastructure).
- OpenAI API for structured extraction, assessments and summarisation using an available web-research tool or separately integrated public web-search provider. Never assume the ChatGPT conversation scheduler can directly write the website.
- Use server actions / route handlers for secure writes and background tasks. Use a `zod` schema for every AI output and network-sourced payload; reject invalid shapes.
- Optional TanStack Query for client-side updates; Supabase realtime for live votes/comments if straightforward, else fast revalidation/polling.
- Use conventional typed components and maintainable files; avoid unnecessary microservices.

## Suggested directory structure
```text
the-deal-room/
  app/
    (auth)/sign-in/page.tsx
    (auth)/invite/[token]/page.tsx
    (app)/layout.tsx
    (app)/page.tsx
    (app)/discover/page.tsx
    (app)/shortlist/page.tsx
    (app)/updates/page.tsx
    (app)/companies/[slug]/page.tsx
    (app)/events/page.tsx
    (app)/networks/page.tsx
    (app)/family/page.tsx
    (app)/research/settings/page.tsx
    api/research/run/route.ts
    api/research/propose-prompt-change/route.ts
  components/
    navigation/BottomNav.tsx
    home/HomeHighlights.tsx
    home/CompanyCarousel.tsx
    company/CompanyCard.tsx
    company/CompanyHero.tsx
    company/CompanyTabs.tsx
    company/FamilyAssessment.tsx
    company/SourceList.tsx
    company/CompanyTimeline.tsx
    research/PromptEditor.tsx
    research/PromptSuggestionReview.tsx
  lib/
    supabase/client.ts
    supabase/server.ts
    research/discover.ts
    research/extract.ts
    research/resolve.ts
    research/verify.ts
    research/assess.ts
    research/publish.ts
    research/policy.ts
    domain/company-status.ts
    domain/family-consensus.ts
    schemas/*.ts
  supabase/migrations/*.sql
  tests/unit/
  tests/integration/
  tests/e2e/
  public/
  README.md
  .env.example
```

## Recommended user-facing response behaviour
- Optimistic UI for votes and comments, with rollback/error toast on failure.
- Database-backed and secure mutations; no purely local React state masquerading as persisted actions.
- Robust empty states: No new companies; No shortlist yet; Research currently running; No verified access; No sources available (suppress unsupported company rather than fake citations).
- Freshness labels based on `checked_at` and `published_at`, not hardcoded dates.
- Data hydration: server-render initial feed, client components for carousels/voting/chat and dynamic tabs.
- Image rendering uses Next Image with configured domain allowlists / locally licensed assets and coherent placeholders.
- Secure and audit system changes; clear research-failure banner when stale so users don't mistake old discoveries for today's news.

---

# 13. Performance, accessibility and quality

- First-load fast on iPhone cellular. Target Core Web Vitals: LCP <= 2.5s (p75), CLS <= 0.1, INP <= 200ms where realistically achievable.
- Proper responsive image `sizes`, compressed variants, lazy load images below the fold, preload only hero/first card.
- Keyboard/screen reader navigability, visible focus, semantic buttons, accessible carousel labels, status not conveyed only by colour, WCAG AA contrast, reduced-motion support.
- Safe-area-aware sticky navigation, iOS overscroll and keyboard behaviour, scroll retention and no horizontal viewport overflow.
- PWA installability: manifest, app icons, appropriate theme, sensible offline shell. **Offline editing/sync not required**; don't pretend comments or ratings saved when offline.
- Testing on iPhone Safari, Android Chrome, iPad Safari and desktop Chrome/Safari; physical iPhone visual review before release.
- Error telemetry appropriate to a private app; keep API tokens, personal comments and unpublished research out of logs.
- Cost controls: daily maximum AI/search budget (configurable), per-run query limits, retries/backoff and alerts on failed or unexpectedly expensive runs.

---

# 14. Implementation sequence and milestones

## Milestone A — visual foundation (first reviewable deployment)
- New repo, Next.js app, responsive design tokens, auth-shaped routes and bottom navigation.
- Build realistic **read-only** Home, Discover and detail pages matching **mobile-v3-primary.png**.
- Use **explicitly labelled demo data** and local static image placeholders/legitimate assets; don't invent real company facts.
- Polish one end-to-end company route with all seven tabs, visible Sources tab and mobile-safe interactions.
- Deploy Vercel preview and provide screenshots at 390px phone, 820px iPad and 1440px desktop.
- **Approval gate:** principal reviews UI appearance and flow before complex backend.

## Milestone B — actual collaborative app
- Supabase Auth, invites, RLS, migrations, family profiles.
- Persistent company content, sources, images, votes/ratings, shortlist status, comments, bookmarks, activity timeline, in-app notifications.
- Events/networks directory and source-linked company updates.
- Seed a handful of properly cited previously discussed companies only after verifying current data; otherwise keep them labelled historical sample data.
- Deploy working private preview; validate three separate accounts and row-level permissions.

## Milestone C — research automation
- Versioned editable research prompt and suggestion review workflow.
- Reliable scheduled runner 07:00 UK local time, source ingestion/extraction/dedupe/evidence, strict access status, company timeline, source links, material updates, editorial Home stories.
- Manual run, research history/cost, transparent failure/staleness states.
- Full ten-priority research mandate preserved; source-bound results, never create fictitious facts.

## Milestone D — production hardening
- Performance/mobile accessibility QA, end-to-end tests, fallback/error states, robust alerts, image licensing audit, secrets and RLS review, scheduled reliability and idempotency checks.
- Final original-device iPhone review with family feedback.
- Production deploy with domain, monitoring and handover docs.

**Build philosophy:** Ship a high-quality vertical slice first; avoid developing backend automation so far ahead of the user experience that the product becomes hard to change.

---

# 15. Acceptance criteria / test scenarios

### UI and navigation
- [ ] Screenshot QA shows strong fidelity to primary mobile v3 mockup: serif headline, warm ivory, navy controls, beautifully spaced real-image card, bottom navigation.
- [ ] Phone: next carousel card peeks; swipe works smoothly; keyboard and bottom nav don't overlap content.
- [ ] Company page loads all 7 tabs and preserves image identity; moving between tabs is clear.
- [ ] Back from detail restores Home scroll position and carousel index.
- [ ] iPad layout uses extra space elegantly, without cramped phone proportions.
- [ ] Search/filter/sort function on real structured data and empty states.

### Family mechanics
- [ ] With 0 votes: Unreviewed; 1 Interested: Pending; 2 Interested: Shortlisted.
- [ ] If one of two Interested changes to Unsure, it immediately leaves Shortlist, audit and activity retained.
- [ ] 2 Pass votes = Passed unless there are >=2 Interested (not possible with 3 people).
- [ ] Ratings 1–10 are optional; average uses only submitted ratings; AI score remains separate.
- [ ] Member A cannot edit Member B's vote/comment via UI or API; all three can see shared comments.
- [ ] Meaningful new comment and shortlist transition create one non-duplicated in-app notification; passive views do not.

### Data integrity
- [ ] Unknown valuations, cheque minima or EIS status display Unknown rather than empty or fabricated.
- [ ] `CAN INVEST NOW` label is impossible without fresh verified route + suitable cheque terms.
- [ ] Expired access checks downgrade automatically and visibly; closing date alone doesn't imply confirmed closure.
- [ ] Every material number/named investor claim in published research has source provenance.
- [ ] Finance fields distinguish amount targeted, committed, pre-money, post-money and currency.
- [ ] Re-running same research payload creates no duplicate company, source, update or notification.
- [ ] Entity resolver does not merge separate companies with similar names.

### Research controls
- [ ] All three can edit full research prompt, with version history, attribution and next-run effect.
- [ ] Concurrent prompt edits warn before overwrite; previous prompt restorable.
- [ ] `Improve our research` creates a proposed diff, not immediate unapproved instruction change.
- [ ] Applying suggestion creates new version; dismissing it leaves instructions unchanged.
- [ ] Daily run executes once per Europe/London calendar day at selected time despite BST/GMT transition.
- [ ] Research-source failures produce clear stale/failure status; no fake morning news.
- [ ] Research history shows date, prompt version, run status, source counts, summary and estimated API cost.

### Security and release
- [ ] Public signup disabled; only invited household members can authenticate.
- [ ] Supabase RLS tests prove outside users cannot read/write household content.
- [ ] Client JS does not contain service-role, API or cron secrets.
- [ ] Scraped web text cannot override research/security instructions.
- [ ] Image provenance recorded; no synthetic product/founder images portrayed as authentic.
- [ ] Production smoke tests cover Home, company, voting, prompt editing, scheduled research, updates and sign out.

---

# 16. Seed content and content strategy

The historic ChatGPT conversation discussed many businesses including **Siloton, Unravel Health, Soteria Tools, Veren Surgical, Ninopay, Moree, Spectra Bio, Greencovery and EvoTouch**. Use them as a candidate **import queue**, not as verified current records. Historical notes may be imported with original observation dates and `company_reported`/`unverified` flags; **re-check** official links and sources before advertising a currently live raise or terms. The visual screenshot may contain nonexistent placeholder companies, hypothetical prices or incorrect dates; do not use those as factual seed data.

Start with 6–10 cards for design QA, including diversity beyond medtech, because the discovery engine explicitly has **no sector specialisation**. No need to add numerous filler companies to hit cosmetic counters. Stats reflect actual database counts.

Onboarding: invite Jamie, brother and dad (email addresses to be supplied by user), assign owner/admin to initial creator for account management; display names editable. Never embed private personal email addresses in source code or migrations.

---

# 17. Definition of done and handover deliverables

Claude should return:
1. **Runnable repository** with complete source and migrations.
2. `.env.example` listing all required environment variables (no secrets committed).
3. `README.md` with one-command local setup, Supabase project setup, auth invitation, seed/import notes, how to run unit/e2e tests, research schedule and deploy Vercel.
4. A secured initial admin/onboarding flow.
5. Vercel **preview URL** after connecting with the user's explicit permitted Vercel/GitHub scope; do not fabricate a live URL or claim deployed unless verified.
6. Screenshots of mobile (390px), iPad (820px) and desktop (1440px) states to compare with reference.
7. A short `IMPLEMENTATION_STATUS.md` detailing completed features, intentionally deferred items, known limitations, verification steps and operating costs.
8. Research reproducibility: saved prompt versions, model/source metadata, costs and run history.

### Guidance to Claude Code
- Treat this spec as the **product contract**. Primary image `design-references/mobile-v3-primary.png` sets the visual direction.
- Work in milestone order; get the UI strong and share a preview before implementing advanced daily research.
- Do not silently downgrade requirements (especially 2-of-3 voting, source provenance, in-app notifications, dynamic shortlist, prompt suggestions/approval and real-image policies).
- Make reasonable default decisions for small implementation ambiguities; document them rather than blocking progress. Ask for credentials, real invitation emails or deployment approvals only when actually required.
- Never claim funding availability or financial values from mockup artwork. Keep absence of facts visible.
- Ensure the architecture is simple enough for a small private family app; no needless complex ops stack.

---

# 18. Open details with sensible defaults (not blockers)

These do not require the initial build to pause:
- **App brand:** “The Deal Room”, tagline “Family investment intelligence”.
- **Morning research time:** 07:00 Europe/London; editable.
- **Account auth:** passwordless email magic links and invitation-only signup.
- **Home highlights:** 3 stories max initially; other carousels 3 visible on initial feed, See all.
- **Company AI score:** 0–10 nullable, with evidence confidence label and explanations.
- **Family ratings:** interested vote + optional 1–10 numerical score (distinct concepts).
- **Company-card image fallback:** typographic company name/real logo on tasteful designed background.
- **Shortlist semantics:** dynamic threshold, no manual override in v1.
- **Research prompt permissions:** all members can activate edited versions; feedback suggestions are approval-gated.
- **Comments:** shared flat chronological feed, author edit own, no private notes.
- **Notifications:** important in-app only; no email/push yet.
- **iPad nav:** initially bottom nav for consistency, with possible left-rail enhancement.
- **Languages/currency:** English (UK), dates London local; retain original round currency and show conversion only if sourced and timestamped.
- **User-count semantics:** initial membership exactly 3; code should not assume three forever except the v1 rule threshold of 2 of 3, which can be explicitly migrated later.

# Final product test

A family member should be able to **discover** a genuinely new company, **understand** it through real imagery and a source-grounded analysis, **decide** Interested/Unsure/Pass in two taps, **discuss** it with the other two family members, watch it **automatically enter or leave** the family shortlist, see meaningful **new developments** the next morning, and **refine** what the research AI looks for — all from an elegant, private iPhone web app.
