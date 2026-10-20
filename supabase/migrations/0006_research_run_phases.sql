-- Research runs span several requests: the web research runs as a background
-- job at the provider ("discovering"), then one caller claims the run to
-- verify, assess and publish ("processing").
alter table public.research_runs
  add column if not exists phase text check (phase in ('discovering', 'processing')),
  add column if not exists provider_response_id text;
create index if not exists research_runs_active_idx on public.research_runs (household_id, started_at) where status = 'running';
