-- One-off, environment-specific setup for phone notifications
-- (production project only; do not run against local or test databases).
--
-- After any insert into notifications that includes a phone-worthy type, pg_net
-- POSTs to /api/push/dispatch, which claims unsent notifications and sends them
-- with Web Push. pg_net sends after the transaction commits and never blocks
-- the insert. The bearer token is the research heartbeat's Vault secret (see
-- research-tick-schedule.sql); the 5-minute heartbeat also dispatches, as a
-- fallback. Re-running this script is safe.

create extension if not exists pg_net with schema extensions;

create or replace function public.push_dispatch_url() returns text language sql immutable set search_path = '' as $$ select 'https://hannigan-ventures.vercel.app/api/push/dispatch'::text $$;
revoke all on function public.push_dispatch_url() from public, anon, authenticated;

create or replace function public.on_notifications_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from inserted where notification_type::text in ('shortlist_promoted', 'comment', 'research_applied')) then
    perform net.http_post(
      url := public.push_dispatch_url(),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'research_tick_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  end if;
  return null;
exception when others then
  -- Phone delivery must never block an insert; the heartbeat retries.
  return null;
end;
$$;

revoke all on function public.on_notifications_push() from public, anon, authenticated;

set lock_timeout = '5s';
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
after insert on public.notifications
referencing new table as inserted
for each statement execute function public.on_notifications_push();
