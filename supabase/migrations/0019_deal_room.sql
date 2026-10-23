-- The deal room (owner's request, 23 Oct 2026): after a match, a shared
-- due-diligence checklist, documents the family collects, and the decision
-- (considering / invested / passed). Shared across the household; members can
-- read and write all of it. Nothing here touches votes, matches or scores.

create table if not exists public.deal_checks (
  company_id uuid not null references public.companies(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  key text not null,
  label text,
  status text not null default 'todo' check (status in ('todo', 'done', 'na')),
  note text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (company_id, key)
);

create table if not exists public.deal_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime text not null,
  size_bytes bigint not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists deal_documents_company_idx on public.deal_documents (company_id, created_at desc);

create table if not exists public.deal_decisions (
  company_id uuid primary key references public.companies(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  status text not null default 'considering' check (status in ('considering', 'invested', 'passed')),
  amounts jsonb not null default '{}',
  invested_at date,
  scheme text not null default 'unknown' check (scheme in ('SEIS', 'EIS', 'none', 'unknown')),
  stake_pct numeric,
  instrument text not null default '',
  certificate_received boolean not null default false,
  notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.deal_checks enable row level security;
alter table public.deal_documents enable row level security;
alter table public.deal_decisions enable row level security;

create policy deal_checks_all on public.deal_checks for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy deal_documents_all on public.deal_documents for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy deal_decisions_all on public.deal_decisions for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- Private bucket for deal documents. Files are written and read through the
-- app (which checks membership) with short-lived signed links; nothing is public.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('deal-documents', 'deal-documents', false, 20971520)
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;
  end if;
end $$;
