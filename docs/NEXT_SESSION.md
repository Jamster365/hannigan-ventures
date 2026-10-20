# Handover for the next Claude Code session

Read this first, then `IMPLEMENTATION_STATUS.md` (section "Live environment") and `README.md`.

## Where things stand (20 October 2026)
- **Hannigan Ventures** (the app formerly called The Deal Room) is built on branch `claude/deal-room-build-ir9ris`: Next.js 16 / TypeScript / Tailwind 4, Supabase (Postgres, Auth, RLS), versioned research instructions, and the source-grounded research pipeline. Lint, typecheck, 66 unit/integration tests, 16 Playwright e2e tests and the production build all pass.
- **Supabase is live**: project `kqvuqtpeyosyvhezjxvy` (eu-west-2). Migrations applied. Household `4ddcccb4-d611-4d58-af2d-9ed5496df283` has three confirmed members who sign in by magic link only: Jamie (owner), George and Chris. The 10 labelled, fictional sample companies, stories, events and 12 angel networks are seeded. Cheque ceiling default is £250,000.
- **Vercel is deployed** at https://hannigan-ventures.vercel.app, project `hannigan-ventures` on team "Jamster365's projects" (`team_pCEVGQHNu7AQlEn5UMJxbDph`), production branch `claude/deal-room-build-ir9ris`. All env vars except `OPENAI_API_KEY` are set.
- The previous session could not read the Vercel project (connector authorised before the project existed) and could not reach the vercel.app host from its container, so **the live deployment has not been verified yet**.

## Do next, in order
1. Verify the deployment with the Vercel connector: latest deployment state and build log, runtime errors, then fetch `/auth/sign-in` and confirm it is the Supabase-mode sign-in page (no amber "Demo mode" banner).
2. Confirm Supabase Auth settings with Jamie: Site URL `https://hannigan-ventures.vercel.app`, redirect allow-list includes `https://hannigan-ventures.vercel.app/auth/callback`, and "Allow new users to sign up" is off. Then have Jamie request a magic link and check `auth_logs` / `edge_logs` in Supabase to confirm the session and the Home page load.
3. Fix anything the real device review turns up (iPhone Safari first, then iPad), keeping to `SPEC.md` and the design reference in `docs/design-references/`.
4. When Jamie provides an OpenAI key: add `OPENAI_API_KEY` in Vercel, trigger a manual run from Research settings (or `GET /api/research/run?force=1` with the `CRON_SECRET` bearer), review the first run in Research history and the audit log. Never promote unverified claims into company facts.
5. Optional: regenerate `docs/screenshots` with the Hannigan Ventures wordmark.

## Rules that still apply
- Work only on branch `claude/deal-room-build-ir9ris`; commit and push there; no PR unless asked.
- Never invent investment facts; sample data stays labelled as demo.
- Do not put secrets in the repo. The service-role key lives only in Vercel and the Supabase dashboard.
- The hosted Supabase SQL tool holds `DELETE` statements for confirmation (they time out in autonomous sessions); use `scripts/demo-sql.ts`-style idempotent inserts instead.
