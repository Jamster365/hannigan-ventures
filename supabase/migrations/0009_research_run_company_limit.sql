-- Per-run cap on new company dossiers (3 for daily runs; a one-off "first fill" may allow more).
alter table public.research_runs add column if not exists new_company_limit int check (new_company_limit between 1 and 12);
