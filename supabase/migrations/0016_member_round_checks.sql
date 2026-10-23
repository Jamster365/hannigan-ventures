-- Members can record that they checked a round's page themselves (owner's
-- request, 23 Oct 2026). Crowdfunding platforms block automated reading, so
-- their rounds stay "reported" until one of the family opens the page and
-- says whether it is live. A member check is a direct, dated verification:
-- "open" expires after 48 hours like any other live check.

create policy access_member_insert on public.investment_access_checks
  for insert to authenticated
  with check (
    public.is_household_member(public.company_household(company_id))
    and verifier = 'member:' || auth.uid()::text
    and access_status in ('verified_open', 'closed')
  );
