-- Scheduled and re-check runs stay at most one per household per London day
-- (the cron fires twice to cover BST/GMT). Manual "Run research now" runs may
-- repeat; they are limited by the daily budget in the server action instead.
alter table public.research_runs drop constraint if exists research_runs_household_id_local_date_run_kind_key;
create unique index if not exists research_runs_one_automatic_per_day
  on public.research_runs (household_id, local_date, run_kind)
  where run_kind <> 'manual';
