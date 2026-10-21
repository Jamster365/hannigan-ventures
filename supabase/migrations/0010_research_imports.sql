-- Research prepared outside the automated provider (e.g. researched in a
-- Claude chat), imported through the normal pipeline. A run whose provider
-- handle is "import:<id>" reads its write-up, candidates and assessments from
-- here; every source is still fetched and verified before anything is published.
-- Service role only: RLS on, no policies.
create table if not exists public.research_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null default 'imported research',
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.research_imports enable row level security;
