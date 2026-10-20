-- Live progress for a running research run, polled by the "Run research now" UI.
alter table public.research_runs
  add column if not exists progress_stage text,
  add column if not exists progress_detail text,
  add column if not exists progress_at timestamptz;
