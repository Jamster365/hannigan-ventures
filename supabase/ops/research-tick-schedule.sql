-- One-off, environment-specific setup for the research scheduler heartbeat
-- (production project only; do not run against local or test databases).
--
-- Every 5 minutes pg_cron POSTs to /api/research/tick, which advances runs
-- whose web research is running as a background job at the provider, clears
-- stuck runs, and starts the daily scheduled run at the configured London hour.
-- The bearer token is generated inside Vault and verified by
-- public.verify_research_tick(); it never appears in app configuration or logs.
-- Re-running this script is safe: the secret is kept and the job is replaced.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'research_tick_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'research_tick_secret', 'Bearer token for the pg_cron research heartbeat');
  end if;
end $$;

select cron.schedule(
  'research-tick',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://hannigan-ventures.vercel.app/api/research/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'research_tick_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $cron$
);
