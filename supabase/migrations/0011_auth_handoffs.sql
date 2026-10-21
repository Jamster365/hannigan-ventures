-- Sign-in hand-off between browsers. On iPhone the home-screen app and the
-- browser that opens an email link keep separate cookies, so a magic link
-- signs in the browser, not the app. The device that requests the link keeps
-- a secret and waits; the link page, after the member confirms the matching
-- code, stores the new session here; the waiting device claims it with the
-- secret and the row is deleted. Rows live at most an hour.
-- Service role only: RLS on, no policies.
create table if not exists public.auth_handoffs (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  code text not null,
  access_token text,
  refresh_token text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.auth_handoffs enable row level security;
create index if not exists auth_handoffs_created_at_idx on public.auth_handoffs (created_at);
