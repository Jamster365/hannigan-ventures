# Claude Code instructions — The Deal Room

Build the new **The Deal Room** web app from `SPEC.md`, matching the primary design image at `design-references/mobile-v3-primary.png`. Treat the spec as authoritative for functionality and evidence. The screen mockups contain illustrative financial figures and sometimes synthetic portraits/images — NEVER promote those into actual company facts.

## Recommended delivery approach
1. Review the spec and all three reference images.
2. Initialize a **new** Next.js TypeScript project. Don't touch any existing projects.
3. Build the pixel-polished mobile UI first (Home, Discover, company hero with seven tabs, bottom navigation), using explicitly labelled demo content as necessary.
4. Share implementation screenshots/preview and refine against the screenshot before adding backend complexity.
5. Add Supabase Auth + Postgres + RLS, then three-member voting, dynamic shortlist, comments and notifications.
6. Add editable research instructions + feedback suggestions with approval, version history and robust source-linked research ingestion.
7. Test, deploy to Vercel with user-approved credentials/scope, and document environment, costs and operational limits.

## Do not compromise
- Real permissible company imagery; premium typographic fallback instead of synthetic factual imagery.
- Dynamic family shortlist computed from votes: two of three ticks make a match and two crosses end it (owner's choice, 23 Oct 2026; unanimous remains selectable, see `docs/classic-app.md`). Votes stay private until a match, in both apps. AI score independent from family ratings.
- One shared comment thread per company (the match chat in the swipe app); in-app important notifications only.
- All members may edit full research prompt; proposed AI changes require approval.
- `CAN INVEST NOW` only if directly verified and fresh; unknown financials visibly unknown.
- Reproducible citations, source lineage and research runs.
- Mobile/iPad-first responsive, bottom thumb navigation, smooth horizontal carousels.

When something is unavailable (e.g., keys, deployment rights, paid APIs, image rights), provide a clean local or preview version and an explicit handover checklist. Never fake completion.
