# Implementation status

Build date: 19 October 2026. Branch `claude/deal-room-build-ir9ris`.

## Completed

### Milestone A — visual foundation
- Next.js 16 / React 19 / TypeScript strict / Tailwind 4 app with the editorial design tokens from SPEC §3 (Fraunces headings, Inter body, warm ivory, navy controls, 16–22 px radii).
- Bottom thumb navigation (Home / Discover / Shortlist / Updates / More) with safe-area padding; desktop left rail and right research rail at ≥1200 px; iPad shows 2 carousel cards.
- Home: date, greeting, computed stat strip, Today's highlights, New discoveries, Awaiting our views, Our shortlist, Recently changed (AI research vs family activity distinguished), Coming up. Each company appears at most once across the three lifecycle carousels. Carousel scroll positions persist across navigation. Stale-research banner.
- Discover: search, quick filters (All/New/Raising/UK/Pre-seed/Seed/Awaiting/Shortlist/Passed), advanced filters (sector, stage, access, EIS/SEIS, AI priority), six sorts, empty state, desktop table.
- Company profile: hero with permitted-image-or-typographic fallback, collapsing sticky identity bar, seven deep-linkable tabs (Overview, Analysis, Funding, Team, Updates, Family, Sources), card menu with "Why am I seeing this?" and "Improve our research", bookmark separate from vote.
- Shortlist, Updates (All/Company/Family, read state), More, Events, Networks, Family, About/methodology, Account, Research settings (Instructions/Preferences/History) and Research history pages.
- Screenshots at 390 / 820 / 1440 px in `docs/screenshots/`.

### Milestone B — collaborative app
- `supabase/migrations/0001_init.sql`: households, profiles, members, invitations, companies, aliases, sources, media, facts (supersede-only), rounds, access checks, assessments, founders, highlights, votes, bookmarks, comments, runs, updates, stories, notifications, events, networks, prompts, feedback, suggestions, audit; enums, indexes, unique constraints from SPEC §11.
- Family stage computed by a Postgres trigger (2 Interested = shortlisted, 2 Pass = passed, else pending/unreviewed), with audited transitions, one family update per transition and deduplicated notifications to the other members. Comment inserts notify once.
- RLS on every table; integration tests on a real Postgres engine prove outsiders see nothing, members cannot alter each other's votes or comments, only the owner manages invitations.
- Magic-link sign-in with sign-up disabled; owner invitations with hashed single-use tokens; `/auth/callback` and `/invite/[token]`; session refresh proxy.
- Supabase repository behind the same contract as the demo repository; optimistic voting/commenting with server confirmation.

### Milestone C — research automation
- Versioned research instructions: full-text editor with diff preview, change notes, optimistic concurrency (conflict shown, never last-write-wins), version history with restore, preferences saved as versions, immutable policy layer shown separately.
- Feedback → proposed exact-match patch (template engine without a key, model-drafted with one) → Apply/Dismiss by a member; applying creates an audited version.
- Pipeline with provider adapter, SSRF-guarded fetcher, zod schemas for every model output, citation verification, evidence rules, entity resolution, assessment rules (no score below two verified sources; valuation unrated when undisclosed; access capped without a live route), materiality classifier, publish with provenance, Home stories, events, run records with estimated cost, budget stop, failure → "no new verified research" state and notification.
- Scheduler: Vercel Cron at 06:00 and 07:00 UTC gated on the Europe/London hour; idempotent per London day.
- Tests: fixture-model pipeline tests (publish, idempotency, unchanged-skip, no-citation and failed-verification paths, budget stop, ambiguous-entity review).

### Milestone D — hardening and handover
- Lint, typecheck, 66 unit/integration tests, 14 Playwright e2e tests, production build, GitHub Actions workflow.
- PWA manifest and icons, `noindex` headers, security headers.
- `README.md`, `.env.example`, this file.

## Deliberate decisions
- **Demo data is fictional.** The spec's historic companies (Siloton, Unravel Health, Soteria Tools, Veren Surgical, Ninopay, Moree, Spectra Bio, Greencovery, EvoTouch) are not seeded, because no verified current data was available in this session and the spec forbids promoting unverified notes. They can be added as an import queue once re-checked by a research run.
- **Model provider.** The spec names the OpenAI API; `lib/research/provider.ts` wraps it behind a small interface so another provider can be swapped in without touching the pipeline.
- **Imagery.** No licensed company images exist for the sample data, so every card uses the designed typographic fallback. `company_media` records rights status and attribution for real assets.
- **Member count.** The 2-of-3 threshold is a named constant (`SHORTLIST_THRESHOLD`) in TypeScript and a literal in the SQL trigger; both are documented for a future migration.

## Not done / needs the principal
- **Live Supabase and Vercel deployment.** No credentials were available in this session, so nothing was deployed and no preview URL exists. Follow README → Supabase setup and Deploy. The Supabase repository and research store are written against the migration but have only been exercised through the SQL-level integration tests, not against a hosted project.
- **Research runs against the live web.** Require `OPENAI_API_KEY`; the first real runs should be reviewed in Research history, and the audit log shows dropped claims and ambiguous entities for human review.
- **Real-device review** on iPhone Safari / iPad Safari and the family's visual sign-off (SPEC Milestone A approval gate).
- **Supabase Storage** for permitted images: the schema and image policy are in place; the upload/optimisation path is not built because no licensed assets exist yet.
- **Optional items** left out of v1: recent search queries, haptics, Supabase realtime (pages revalidate after each action instead), per-company re-check scheduling UI (the pipeline supports `companyIds`, no UI yet).

## Known limitations
- Demo mode state lives in the server process and resets on restart; it is for review only.
- The Updates tab timeline reads from `company_updates`; family comment edits are not individually timelined (only shortlist transitions and new comments produce entries/notifications), by design.
- Event registration status comes only from a verified page; otherwise it is shown as unknown.
- Cost estimates use configurable list prices; actual billing may differ.

## Verification steps
```bash
npm run lint && npm run typecheck
npm run test:unit
npm run test:integration           # RLS + triggers on pglite
npm run dev &                      # demo mode
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome E2E_BASE_URL=http://localhost:3000 npm run test:e2e
npm run build
```

## Operating costs (estimates)
- Supabase Free/Pro: free tier is sufficient for three users and daily runs.
- Vercel Hobby/Pro: cron requires a plan that allows two daily crons; the research route runs up to 300 s.
- Model: with `gpt-5-mini` at the configured list prices a balanced daily run is roughly $0.10–$1; the daily budget (default $8) caps spend.
