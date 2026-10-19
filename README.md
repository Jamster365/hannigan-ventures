# The Deal Room

A private family investment-discovery and research app for three household members. Mobile-first PWA built with Next.js 16, TypeScript, Tailwind CSS 4, Supabase (Postgres, Auth, RLS) and a server-side, source-grounded AI research pipeline. See `SPEC.md` for the product contract and `IMPLEMENTATION_STATUS.md` for what is done, deferred and known.

## One-command local start (demo mode)

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase variables the app runs in **demo mode**: a labelled, fictional sample dataset is served from memory, sign-in is bypassed, and a banner lets you switch between the three sample members (Jamie, Brother, Dad) to try the 2-of-3 shortlist rule. Nothing in demo mode is an investment fact and changes reset when the server restarts.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js dev server, production build, production server |
| `npm run lint` / `npm run typecheck` | ESLint and strict TypeScript |
| `npm run test:unit` | Domain logic, evidence rules, pipeline with fixture model (vitest) |
| `npm run test:integration` | Applies `supabase/migrations` to an in-process Postgres (pglite) and proves RLS, triggers and the 2-of-3 rule |
| `npm run test:e2e` | Playwright smoke tests against demo mode on iPhone and desktop profiles |
| `npm run screenshots -- http://localhost:3000 docs/screenshots` | Captures 390 / 820 / 1440 px screenshots |
| `npm run seed:demo` | Seeds a Supabase project with the household, members, default instructions, networks and the labelled demo companies |
| `npm run supabase:types` | Regenerates `lib/supabase/database.types.ts` from a linked project (optional; hand-written row types live in `lib/supabase/rows.ts`) |

In this container Playwright uses the pre-installed browser: `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

## Supabase setup (real persistence)

1. Create a Supabase project. In **Authentication → Providers → Email**, enable Email and **disable "Allow new users to sign up"**. Keep magic links enabled. Set the Site URL and add `https://<your-domain>/auth/callback` (and the localhost equivalent) to the redirect allow-list.
2. Apply the migration: `supabase db push` with the CLI, or paste `supabase/migrations/0001_init.sql` into the SQL editor. It creates every table, enum, index, trigger and RLS policy.
3. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL`.
4. Seed the household and members (owner first). Emails are only read from the environment and never stored in the repo:
   ```bash
   SEED_MEMBER_EMAILS="owner@example.com,brother@example.com,dad@example.com" npm run seed:demo
   # add --no-demo-companies to skip the fictional sample companies
   ```
   The seed creates confirmed auth users for those emails, so each member signs in by requesting a magic link at `/auth/sign-in`. Further invitations are sent by the owner from **More → Account** and expire after 7 days.
5. Run `npm run dev`. Votes, comments, bookmarks, notifications and prompt versions now persist; family stage transitions are computed by Postgres triggers.

### Row Level Security

Every household table is RLS-protected. Members read household content; each member can change only their own vote, bookmark and comments; notifications are visible only to their recipient; the owner alone manages invitations; research content is written only by the service role. `npm run test:integration` proves these rules against the real migration.

## Research automation

Set `OPENAI_API_KEY`, `CRON_SECRET` and `RESEARCH_HOUSEHOLD_ID` (the household uuid printed by the seed script). Optional: `RESEARCH_MODEL` (default `gpt-5-mini`) and the two price variables used for cost estimates.

- **Schedule**: `vercel.json` runs `/api/research/run` at 06:00 and 07:00 UTC. The handler executes only when the Europe/London hour equals the configured local time (default 07:00, editable in Research settings → Preferences), which keeps the run at 07:00 across BST and GMT. The database's unique `(household, local_date, run_kind)` constraint guarantees one run per London day.
- **Manual run**: Research settings → "Run research now" (confirmation and daily budget apply). Operators can also call `GET /api/research/run?force=1` with `Authorization: Bearer <CRON_SECRET>`.
- **Pipeline** (`lib/research/`): web-grounded discovery with provider citations → independent retrieval of every cited URL through an SSRF-guarded fetcher → zod-validated extraction → evidence rules (unsourced money, investors, founders and signals are dropped; access can only be downgraded) → entity resolution that never merges similar names → assessment with the AI score withheld when evidence is thin → materiality classifier → publish with provenance → editorial Home stories → run record with source counts and estimated cost.
- **Instructions**: the editable discovery prompt (all ten priorities) is versioned per household; the evidence/security policy in `lib/research/policy.ts` is immutable and prepended to every call. Web text is passed as data inside `<source_text>` blocks.
- **Costs**: each run records estimated spend; the daily budget in Preferences stops a run that exceeds it. Expect roughly $0.10–$1 per balanced run with a small model, depending on how many sources are retrieved.

## Deploy to Vercel

1. Import the repository in Vercel; the framework preset is Next.js.
2. Add the environment variables from `.env.example` (Production and Preview). `CRON_SECRET` is sent automatically by Vercel Cron.
3. Set `NEXT_PUBLIC_SITE_URL` to the deployment URL and add it to the Supabase redirect allow-list.
4. Deploy. Preview deployments without Supabase variables run in demo mode.

## Project layout

```
app/                 routes (App Router), API routes, auth callback, invite redemption
components/          navigation, home, company (hero, tabs, voting, comments), research, ui
lib/domain/          pure rules: family consensus, access status, summaries, formatting
lib/data/            Repository contract + demo (in-memory) and Supabase implementations
lib/supabase/        server/admin clients, session, auth, invitations, row types
lib/research/        policy, schemas, fetch guard, discover, verify, resolve, assess, materiality, pipeline, stores
lib/actions/         server actions (votes, comments, bookmarks, prompts, feedback, account)
supabase/migrations/ versioned SQL schema with RLS and triggers
scripts/             seed, screenshots, icons
tests/               unit, integration (pglite), e2e (Playwright)
docs/                design references and screenshots
```
