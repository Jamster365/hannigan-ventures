# Swipe app and classic app

Since 22 October 2026 the app opens as a **swipe app**: everyone ticks or crosses each company, and when all three tick the same one it becomes a match with its own chat. The earlier **classic app** (Home feed, Discover filters, Shortlist, Updates, seven-tab company profiles) is still in the codebase and still works. Both use the same database, votes and comments.

## Where things live

| | Swipe app (default) | Classic app |
|---|---|---|
| Routes | `app/(swipe)/` | `app/(classic)/` |
| Entry | `/` (deck), `/matches`, `/matches/[slug]` (chat), `/matches/[slug]/profile`, `/decisions`, `/me` | `/home`, `/discover`, `/shortlist`, `/updates`, `/more`, `/family`, `/companies/[slug]` |
| Components | `components/swipe/` | `components/home/`, `components/company/`, `components/discover/`, `components/updates/` |
| Rules | `lib/domain/swipe.ts`, `lib/actions/swipe.ts` | `lib/domain/summaries.ts`, `lib/domain/discover.ts` |

Shared pages sit in the swipe group and are linked from both apps: `/research/settings`, `/research/history`, `/events`, `/networks`, `/about`, `/account`. Their back arrow goes to `/me`.

To move between the two apps:
- From the swipe app: **Me → Classic app** (opens `/home`), or **Full research** on a match's profile (opens the classic seven-tab profile and comes back to the match).
- From the classic app: **More → Swipe app**, or **Swipe app** in the desktop sidebar.

## The match rule

- **Two of three** (current, chosen 23 Oct 2026): a company is a match (`family_stage = 'shortlisted'`) when two active members tick it (`interested`); two crosses end it (`passed`). A single cross does not, so everyone still decides. There is no "maybe"; leftover `unsure` votes from the classic app put the company back in that member's deck.
- **Almost a match**: when your cross was the deciding vote (everyone else has decided) and your tick would have made a match, you are told who ticked and can undo. Nobody else is told.
- **Votes are private until a match**, in both apps (`visibleVotes()` in `lib/domain/family-consensus.ts`).
- **Closed rounds** leave the deck for a watch list in Decisions and come back when research records a new round. The deck shows the most investable companies first.
- "Changed their view" notifications are not sent. Match and match-chat notifications link to `/matches/...`; when a match ends, its unread match and chat notifications are cleared.

The rule is defined twice, and the two must agree:
1. TypeScript: `MATCH_RULE` in `lib/domain/family-consensus.ts` (`"two_of_three"` or `"unanimous"`).
2. Postgres: `compute_family_stage()` in `supabase/migrations/0013_two_of_three_matches.sql` (the unanimous version is in `0012_unanimous_matches.sql`).

## Going back to the classic app as the default

1. Swap the home routes: move `app/(swipe)/page.tsx` to `app/(swipe)/swipe/page.tsx` (or delete it), and move `app/(classic)/home/page.tsx` back to `app/(classic)/page.tsx`. Then point the classic "Home" links (`components/navigation/bottom-nav.tsx`, `sidebar.tsx`, `page-header.tsx`, `app/(classic)/companies/[slug]/`) back at `/` instead of `/home`.
2. Optionally move the shared pages back into `app/(classic)/` so they get the classic navigation, and set their back arrow to `/more`.
3. The current rule (two of three) already matches the classic app's original behaviour, so no rule change is needed.
4. Run `npm run typecheck && npm run lint && npm test && npm run test:e2e`. The e2e suite covers both apps.

To keep the unanimous rule with the classic screens, do step 1 (and step 2 if wanted) and skip step 3.
