-- Deal leads (owner's request, 23 Oct 2026): a company any member heard of
-- (an angel-network email, a founder they met, a news story) that research
-- has not looked at yet. The next research session turns each one into a
-- full profile through the normal pipeline; until then it is a shared note.

create table if not exists public.deal_leads (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  website text,
  source text not null default '',
  notes text not null default '',
  status text not null default 'new' check (status in ('new', 'researched', 'dismissed')),
  company_id uuid references public.companies(id) on delete set null,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deal_leads_household_idx on public.deal_leads (household_id, status, created_at desc);

alter table public.deal_leads enable row level security;
create policy deal_leads_all on public.deal_leads for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
