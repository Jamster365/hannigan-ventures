-- Each member's investing preferences (owner's request, 23 Oct 2026). They
-- are preferences, not rules: the matcher uses them as a head start when
-- ordering that member's deck, alongside what it learns from their answers.

create table if not exists public.member_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  prefs jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

alter table public.member_preferences enable row level security;

create policy member_prefs_select_own on public.member_preferences for select to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id));
create policy member_prefs_insert_own on public.member_preferences for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));
create policy member_prefs_update_own on public.member_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_household_member(household_id));
