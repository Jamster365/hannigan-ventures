-- Verifies the bearer token sent by the pg_cron research heartbeat. The token is
-- generated inside Supabase Vault (see supabase/ops/research-tick-schedule.sql)
-- and never leaves the database; only the service role may call this.
create or replace function public.verify_research_tick(token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected text;
begin
  select decrypted_secret into expected from vault.decrypted_secrets where name = 'research_tick_secret';
  return expected is not null and token is not null and token = expected;
end;
$$;

revoke all on function public.verify_research_tick(text) from public;
revoke all on function public.verify_research_tick(text) from anon, authenticated;
grant execute on function public.verify_research_tick(text) to service_role;
