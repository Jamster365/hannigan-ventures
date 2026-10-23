# Handover for the next Claude Code session

Read this first, then `IMPLEMENTATION_STATUS.md` (section "Live environment") and `README.md`.

## Swipe app (22 October 2026, branch `claude/swipe-company-matching-0k7ozv`)
- Feedback was that the app was too complicated, so it now opens as a tick-or-cross swipe app with unanimous matches, "almost a match", undo and one chat per match. The classic app still works at `/home`. Details: `docs/classic-app.md`.
- **Live (23 October 2026).** Production (`claude/deal-room-build-ir9ris`) was fast-forwarded to this branch and deployed (`dpl_Fjz5oTjthubcusnBuFpifEGUqYKC`). Earlier note, kept for history: **Half live.** Migration `0012_unanimous_matches.sql` is applied to the live database (no votes or comments existed, so no data changed). Production still deploys `claude/deal-room-build-ir9ris` (the classic app); the push to switch it was blocked pending Jamie's permission. To finish: fast-forward `claude/deal-room-build-ir9ris` to this branch, or set Vercel's production branch to this branch.
- A Vercel preview of this branch uses the live database (Preview env vars are set), so every swipe there is a real vote.

## Where things stand (20 October 2026)
- **Hannigan Ventures** (the app formerly called The Deal Room) is built on branch `claude/deal-room-build-ir9ris`: Next.js 16 / TypeScript / Tailwind 4, Supabase (Postgres, Auth, RLS), versioned research instructions, and the source-grounded research pipeline. Lint, typecheck, 66 unit/integration tests, 16 Playwright e2e tests and the production build all pass.
- **Supabase is live**: project `kqvuqtpeyosyvhezjxvy` (eu-west-2). Migrations applied. Household `4ddcccb4-d611-4d58-af2d-9ed5496df283` has three confirmed members who sign in by magic link only: Jamie (owner), George and Chris. The 10 labelled, fictional sample companies, stories, events and 12 angel networks are seeded. Cheque ceiling default is £250,000.
- **Vercel is deployed** at https://hannigan-ventures.vercel.app, project `hannigan-ventures` on team "Jamster365's projects" (`team_pCEVGQHNu7AQlEn5UMJxbDph`), production branch `claude/deal-room-build-ir9ris`. All env vars except `OPENAI_API_KEY` are set.
- The previous session could not read the Vercel project (connector authorised before the project existed) and could not reach the vercel.app host from its container, so **the live deployment has not been verified yet**.

## Findings on 20 October 2026 (second session)
- The Vercel connector sees team `team_pCEVGQHNu7AQlEn5UMJxbDph` but lists zero projects, so deployment, build-log and runtime-error reads still fail (403/404). Jamie needs to reconnect it with access to the `hannigan-ventures` project.
- Supabase logs show the live app is in Supabase mode: at 13:20 UTC it requested a magic link with `redirect_to=https://hannigan-ventures.vercel.app/auth/callback?next=/`. The link verified (`login`), but Supabase redirected to `http://localhost:3000` because the Site URL and redirect allow-list were not set yet.
- Email templates can only be edited after custom SMTP is configured (Supabase free plan). Branded templates that use `token_hash` (so links work in any iPhone browser) are in `supabase/templates/`.

- Later that day: Jamie signed in successfully on iPhone (14:00 UTC) and Home loaded live data. Chris hit Supabase's built-in email limit (`over_email_send_rate_limit`) and will retry after an hour. Jamie chose **not** to set up custom SMTP for now (three users, long-lived sessions); revisit only if the limit keeps getting in the way. If it does, use Resend on `puzzleroyale.co.uk` (DNS at Cloudflare), then paste `supabase/templates/`.

## First set of real companies (21 October 2026)
- All sample data has been deleted from the live database. (Superseded: the first 11 real companies were imported later the same day — see the summary below.)
- Jamie chose to build the first set by researching **in a Claude chat** (Max plan, no API cost), not via OpenAI. The daily 07:00 OpenAI run stays as the ongoing top-up ($2/day budget, max 3 new companies/run).
- Chat research needs the cloud environment's **Network access** widened (title bar → environment → Edit): this session could search but every page fetch was denied by the network policy. Once pages can be opened:
  1. Research per `docs/research-brief.md` (areas: Imperial/London spinouts, Cambridge/Oxford, live angel-access rounds, Antler/EF/frontier founders; ~8–10 companies). Leads from search only (unconfirmed): Certain Energy (Imperial, £10m Series A Aug 2026), Pfentech (AI TCR design), Stateful Robotics (Oxford), Semarion (Cambridge, £2.1m seed), Sealeo, Arti, Orbion Connect, PLAYBACK, Find Care Compare.
  2. `npx tsx scripts/check-research-import.ts out.json "Claude chat research" "<write-up>" area1.json …` to validate shape.
  3. Insert `{label, payload}` into `research_imports`, then a `research_runs` row with `phase='discovering'`, `provider_response_id='import:<id>'`, `new_company_limit=12`, `status='running'`, `run_kind='manual'`; nudge `/api/research/tick` via `net.http_post` with the Vault secret. The normal pipeline verifies every URL, strips unverified claims, applies assessment rules, fetches imagery, publishes. Zero provider cost.

## First set imported (21 October 2026, third session) — summary for Jamie
Researched in this session (full network access), imported through the normal pipeline as run `0ed65ea1-ef26-40a6-ac1e-8113bb4a96ca` (import `950b1459-c853-473b-a968-e5538950664d`, label "Claude chat research — first set (21 Oct 2026)"). Result: **11 of 11 companies published**, 63 sources stored, zero provider cost. No company has a verified open round; EIS is unknown for all; no valuations are shown.

| Company | Area | Round (as reported) | Access | AI view |
|---|---|---|---|---|
| Certain Energy (ex-RFC Power) | Imperial spinout, flow batteries | £10m Series A, closed Aug 2026 | Closed; contact form | Medium, 5/10 |
| Polaron | Imperial spinout, AI for materials | $8m seed, closed Feb 2026 | Closed; general email | Medium, 6/10 |
| Nanomox | Imperial spinout, zinc oxide / metal recovery | £2.4m seed (equity + grants), UK angels took part | Closed; founder email | Medium, 5/10 |
| Stateful Robotics | Oxford spinout, robot decision software | $4.8m pre-seed, closed Mar 2026 | Unknown; founder intro | Medium, 6/10 |
| Semarion | Cambridge spinout, cell-assay microcarriers | $3.8m, closed Mar 2026 | Unknown; founder intro | Medium, 6/10 |
| Sealeo | Imperial, seaweed cold-chain packaging | Not public; pitched London Demo Day 2026 | Fundraising reported; founder email | Medium, no score |
| Find Care Compare | King's, NHS/private care comparison | Not public; 2026 share allotments at Companies House | Fundraising reported; founder email | Medium, no score |
| Arti | LSE, AI compliance training | Not public; pitched London Demo Day 2026 | Fundraising reported; founder email | Insufficient evidence |
| Affinity Labs | Antler London, creator app studio | $2M pre-seed, closed Oct 2026 | Contactable | Medium, 5/10 |
| First Concepts | Antler co-led, AI for creative agencies | £750k / $1M pre-seed, closed Mar 2026 | Unknown | Medium, 5/10 |
| Souk | Antler-backed, AI partner manager | $1.6M pre-seed, closed Sep 2026 | Unknown; no route | Low, no score |

The three London Demo Day companies (Sealeo, Find Care Compare, Arti) are the only ones with a live-looking route for an angel; the event page publishes founder emails and says the cohort sought £100k–£2m each.

What was changed or stripped:
- Stripped by the pipeline: `statefulrobotics.com` returned HTTP 403 to the app's fetcher, so claims citing only that page (target sectors) were dropped. Nothing else was removed.
- Removed by me before import: Certain Energy's "c.£12m post-money" (from Ceres's stock-exchange notice) as a valuation, because it does not add up after a £10m raise; it stays in open questions and the description. Sealeo and Find Care Compare have no AI score (only one independent source each).
- Leads dropped: Pfentech and Orbion Connect (no trace found); PLAYBACK (no Entrepreneur First link found).
- Imagery: logos/hero images taken from company sites for 8 companies (attributed); Stateful Robotics, Sealeo and Semarion's hero use the typographic fallback.
- Bug fixed (`lib/research/supabase-store.ts`): round currency was only taken from target/pre-money, so a reported amount raised lost its currency and showed as £ (e.g. Polaron's $8m showed as £8m). Code fixed and the 8 live rows corrected.

Housekeeping Jamie may want to do in the Supabase table editor (the SQL tool holds deletes for confirmation): `research_imports` has 16 leftover rows from loading the payload in pieces — one empty row (`e9bb0cc1-…`) and 15 labelled "staging chunk (not a run input) NN". They are unused and safe to delete.

## "Raising now" set imported (21 October 2026, fourth session) — summary for Jamie
Goal: UK early-stage companies raising now or within ~3 months, with an individual angel route (no crowdfunding platforms). Researched in this session, imported through the normal pipeline as run `2eab98af-09b9-4658-b294-0c75bde4262a` (import `ddca488a-7dbd-4e8f-9397-3218c93814b4`, label "Claude chat research — raising now (21 Oct 2026)"). Result: **8 of 8 published**, 32 sources stored, zero provider cost. No valuations shown; EIS unknown except where noted.

| Company | What it is | Raising evidence | Access | AI view |
|---|---|---|---|---|
| Biosecure ID | Alderley Park forensic-genetics tools | Own investor page: "Seed Round — open now", $1.5M (≈£1.0M) target, SEIS/EIS advance assurance claimed | **Verified open** (company page); founder email / investor portal | Low, no score |
| Unravel Health | Glasgow-licensed saliva hormone "Micro Lab" | £2.5M round announced 16 Oct 2026, >£2M closed, rest "in coming weeks"; Conduit EIS Impact Fund + Wrightwood co-lead | Fundraising reported; general email only | Medium, 6/10 |
| Milbotix | Bristol SmartSocks for dementia care | Investors page invites investment enquiries; no live round claimed | Contactable (investor form) | Medium, 6/10 |
| NeuroPrognostix | King's spinout, Alzheimer's risk blood test | King's (Jul 2026): "now seeking additional grant and pre-seed investment"; £900k+ grants, patent | Fundraising reported; website contact | Medium, 6/10 |
| SLANT | Bristol e-assist cargo trailers for couriers | Catapult/Business West (May 2026): seeking private investment; £109k DfT grant; Envestors deal | Fundraising reported; Envestors (angel network) | Medium, 5/10 |
| Synaptive | UCL, EEG electrode for textured hair | London Demo Day 2026 (event for startups seeking £100k–£2m) | Fundraising reported; founder email | Medium, 5/10 |
| Precise Therapeutics | King's spinout, anti-scarring eye drug | King's (Jul 2026): "now raising funding to take the drug into clinical trials" | Fundraising reported; via King's | Medium, no score |
| Opis Health | AI data capture for clinical trials | London Demo Day 2026; site invites investment enquiries; only £4k raised | Fundraising reported; founder email | Low, 4/10 |

**Best to look at first:**
1. **Unravel Health** — strongest company (university IP, three patents, >£1M grants, institutional co-leads). The round is mostly allocated, so ask about room in the final tranche or the next round.
2. **NeuroPrognostix** — credible science and an explicit pre-seed ask from King's; confirm it has been incorporated (no Companies House entry found).
3. **Biosecure ID** — the only round verified open, with SEIS/EIS claimed, but thin disclosure (no named team, no revenue) and the page is still headed "Seed Round 2025". Ask for the investor pack and check Companies House officers before a call. Its verified-open status expires on 23 Oct unless re-checked.

Notes:
- Pipeline dropped two Milbotix claims (team page and investors page failed verification for the app's fetcher): founder Jacqui Arnold and the "investors page" signal. Access stays "contactable".
- Angel networks (Cambridge Angels, CCG, OION, Green Angel, Angel Academe, Archangels, SFC, Haatch, HERmesa) do not publish live deals on openable pages, so none could be verified that way. Envestors' deals page is JavaScript-only and cannot be cited. Upcoming events worth attending for live deal flow: OION Showcase 22 Oct, CCG Autumn Investment Convention 22 Oct, Green Angel pitch 11 Nov, SETsquared Investment Futures 24 Nov.
- Leads dropped: HVN Labs, Lambda agri, Exact Comms, Metal Morph, Sorted Technologies (rounds closed or no citable raising page); Lunor Pay (press release 403).
- Housekeeping: the hosted SQL tool held `UPDATE` statements as well as `DELETE`s, so the payload was loaded as insert-only staging rows labelled "staging (not a run input) raising-now 21 Oct" / "staging chunk raising-now 21 Oct (not a run input) 02–05". They are unused and safe to delete. One of them (`6d028e54-…`, chunk 04) has a malformed tail typed by mistake; only its verified first 19,406 characters went into the import, which was checked by md5 against the validated file.

## Staying signed in (21 October 2026)
Jamie asked for members to stay signed in for weeks without a new magic link. The app already allows that: `@supabase/ssr` sets the session cookies for 400 days (fixed by the library), Supabase sessions never expire on this plan, and `proxy.ts` refreshes the session on each visit.

The early sign-outs come from Supabase's refresh-token reuse detection. Auth logs on 21 Oct show a normal refresh for George at 14:17, then the browser presenting the old refresh token at 14:22 and 14:54 (`refresh_token_already_used`, "Possible abuse attempt"), which revoked the session; Jamie then needed a new link at 14:55. This happens when a refreshed token never reaches the browser, usually because a phone request (often a prefetch) is cancelled after the server has already rotated the token. Supabase's own docs describe this as a cause of "sudden and unexpected session termination".

Fix (Supabase dashboard, Jamie; no tool in this session can change Auth settings):
1. Authentication → Sessions (Advanced): turn **off** "Detect and revoke potentially compromised refresh tokens". This alone stops the sign-outs.
2. Optional: raise the access token (JWT) expiry from 3600 s to 86400 s (1 day), so tokens are refreshed far less often. The trade-off: a removed member's access token keeps working for up to a day.
Done 21 Oct 2026: Jamie turned off step 1 (reuse detection); step 2 not changed. Leave "Time-box user sessions" and "Inactivity timeout" unset (they are paid-plan features anyway). After the change, check `auth_logs` for `refresh_token_already_used` over the following days.

## Magic links fixed for any browser (21 October 2026)
Jamie got "That sign-in link is invalid or has expired" straight after requesting a link. Auth logs (16:00–16:01 UTC): Supabase accepted the link, but no PKCE code exchange followed, because the code-verifier cookie lives in the browser that requested the link, and the email opened elsewhere (on iPhone, Mail / Safari / the home-screen app keep separate cookies). A second tap 9 s later then really was "already used", and the resend 15 s later hit Supabase's 15-second cooldown, which the app wrongly called the hourly limit.

Fix (commit `0d0bf6d`, deployed `dpl_8PzZqBxZNSWeT1YriXWScBq97cUz`; started by hand because the GitHub push did not trigger a build): magic links now use the implicit flow (`lib/supabase/auth.ts`). `/auth/callback` returns a small page that posts the URL-fragment tokens to `/auth/session` (same-origin only), which validates them with Supabase and sets the cookies. A used link tapped again continues into the app if already signed in. Invite links (admin client, already implicit) use the same path. The redirect URL is unchanged, so the Supabase allow-list needs no edit.

Still to do: delete the 21 unused rows in `research_imports` (the hosted SQL tool holds deletes). In the Supabase SQL editor:
`delete from research_imports i where not exists (select 1 from research_runs r where r.provider_response_id = 'import:' || i.id);`
This keeps the two imports runs used (`950b1459-…`, `ddca488a-…`).

## Home-screen app sign-in hand-off (21 October 2026)
On iPhone, email links open in the default browser (Jamie: Chrome), never in the home-screen app, which has its own cookies, so the link signed in Chrome and the app stayed on the sign-in page. Fix (commit `5563db5`, migration `0011_auth_handoffs.sql`, applied live): the requesting screen gets a hand-off id, a secret (kept on that device only) and a 3-digit code, and polls `/auth/handoff`. The email link goes `/auth/callback` → `/auth/confirm`, which shows the same code; after the member taps "It matches: sign in there", the session is stored on the hand-off row and the waiting screen claims it (row deleted) and signs in. A link opened in the same browser signs in directly; "Use this browser instead" signs in the link's browser. Rows expire after an hour and are pruned on the next request. Checked live: inspect / claim / wrong secret / fake tokens / cross-origin all behave. A real end-to-end test on Jamie's iPhone is still to be confirmed.
A 6-digit code typed into the app would be simpler, but needs a custom email template, which needs custom SMTP.

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

## Research refresh, prompt v3 and 8 new companies (23 October 2026)
- **Research instructions v3** activated as Jamie (`a7abc5b3-478c-4ff9-9e04-09678db9100d`): keeps all ten priorities, adds a sector-breadth section (life sciences, medtech and healthtech capped at about a third of new companies), accelerators beyond universities, UK regions, and broad `sectorsInclude` preferences. The daily 07:00 run uses it from 24 Oct.
- **All 25 tracked companies re-verified** against their sources, company sites and Companies House, and **8 new non-health companies** added: Fruga (insurtech), Relace (regtech AI), Ossprey (cybersecurity), VerbaFlo (proptech AI), INTUNE Drinks (food and drink), stampfree.ai (logistics), Foudys (women's football retail), AKT London (beauty). Three of the new consumer ones raise via Crowdcube/Republic, which Jamie earlier asked to avoid as the route; they are listed as "fundraising reported" with that noted.
- Imported through the normal pipeline in three runs (the extraction schema caps a run at 12 candidates): `9c4b8332-…` (12 updated), `cd2ebf87-…` (12 updated), `64c2dfc4-…` (1 updated, 8 new). 365 sources verified; dropped: two Milbotix news signals and one Caudal Energy team member (sites blocked the fetcher).
- Notable corrections: Tewke (Seed, London, £1.5m Feb 2026), Neubond (seed led by Waseda University Ventures, not Project Ventures), Big Picture Bio (Deep Science Ventures company, formerly Masar Bio), SLANT / NeuroPrognostix / Precise Therapeutics rounds now "expected", not "open"; NeuroPrognostix and Precise Therapeutics have no registered company yet. Certain Energy's "c.£12m post-money" (Ceres RNS) is kept only as a caveated fact, not as a valuation, because it does not reconcile with a £10m raise.
- Housekeeping: `research_imports` gained 7 staging rows labelled "staging refresh 23 Oct (not a run input) 01–07" (unused; safe to delete) plus the full import `a69eed7b-…` and its parts 2 and 3.

## Review answers and step 1, "deck quality" (23 October 2026)
Jamie answered the 37-question review (artifact https://claude.ai/artifact/3u7KQkHZCgAXKYAxgpToY8, answers pasted in chat). Plan in Jamie's priority order: 1 deck quality (live 23 Oct); 2 live chat, phone push notifications, a "Research" member posting company updates into match chats, auto-archive matches when the round closes, notify on research-instruction changes; 3 research: private upload screen in Me (auto-split into runs of 12), daily paid run switched to update-only (new companies come from big Claude-chat batches on Jamie's Max plan), chase EIS/SEIS, UK and Europe (mainly UK), crowdfunding included but labelled, any size with an angel route; 4 structure: keep only classic company pages as "Full research", simple research form for everyone, dark mode following the phone, two panes on iPad/desktop; 5 engineering: protected `main` branch, free error tracking that emails Jamie, no backups beyond Supabase free; 6 learning: weekly taste profile from ticks/crosses/chats that re-ranks the deck and proposes prompt changes for approval.

Step 1 delivered: two-of-three matches (migration `0013_two_of_three_matches.sql`, applied live 23 Oct), everyone still decides, votes private until a match in both apps, closed rounds parked on a watch list, most-investable-first ordering, skip-to-back, a Decisions tab (change any vote), essentials-first profile with "Show more", one-line AI view, logo-on-colour hero fallback, Crowdfunding label, slim action bar above the tabs, one-time tip, vaguer "waiting on you" banner.

## Step 2, "chat" (23 October 2026)
- **Live chat**: match chats and the Matches list refresh as messages arrive (Supabase Realtime on `comments`, RLS-filtered; `components/live/`). They also refresh when the app comes back to the foreground.
- **Research member**: migration `0014_research_member_and_push.sql`. `comments.author_kind = 'research'` (no user) marks AI messages. Research opens each new match's chat with the latest assessment, and posts every medium/high-materiality research update for a matched company into its chat. Those posts notify everyone once (they share the pipeline's `update:<id>` dedupe key). In TypeScript a Research message has `authorUserId = RESEARCH_AUTHOR_ID` ("research").
- **Phone notifications** (Web Push): Me → Notifications → "Turn on for this device". On iPhone/iPad the app must be opened from the Home Screen first (iOS 16.4+). Pushed types: new match, match-chat messages (including Research posts), research-instruction changes (`lib/push/rules.ts`). Delivery: `supabase/ops/push-dispatch-trigger.sql` (applied in production) calls `/api/push/dispatch` through pg_net after notification inserts, and the 5-minute research heartbeat dispatches anything missed. Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional `VAPID_SUBJECT`. Service worker: `public/sw.js` (notifications only, no offline cache).
- **Old matches**: a match whose round has closed moves to "Archived · round closed" at the bottom of Matches; its chat stays readable.
- **Instruction changes** already notified the other members (`activate_prompt_version`); they now also reach phones.

## Step 3, "research" (23 October 2026)
- **Upload research** (Me → Upload research, owner only; `app/(swipe)/research/upload`): copy the Claude prompt (`lib/research/import-template.ts`, it lists every tracked company so Claude skips them), run it in a Claude chat with web search, paste the reply or choose the file, Upload. `lib/research/import-batch.ts` checks every company against the pipeline schema (missing optional values become unknown; unreadable or duplicate companies are listed back), and splits the upload into runs of 12 (`research_imports` + a manual `research_runs` row with handle `import:<id>`). The 5-minute heartbeat processes one uploaded run per tick, through the normal verification (every source re-fetched, unsupported claims stripped). Up to 240 companies / 3 MB per upload.
- **Daily run is update-only** (`dailyMode: "update_only"`, the default, switchable in Research instructions → Preferences): it re-checks 10 tracked companies a day, matches first, then whichever was checked longest ago (`pickDailyRechecks`), including EIS/SEIS and crowdfunding progress, and adds no new companies. With ~40 companies the whole list is refreshed about every four days.
- **Research instructions v4** (live, activated for Jamie with a change note; George and Chris were notified): UK first then Europe, any size with a real angel route, equity crowdfunding included (labelled in the app), chase EIS/SEIS. `DEFAULT_RESEARCH_PROMPT` carries the same scope for new households.
