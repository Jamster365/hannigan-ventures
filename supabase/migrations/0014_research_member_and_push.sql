-- Match chats get a "Research" member, chat updates arrive live, and members
-- can receive phone (Web Push) notifications.
--
-- 1. comments.author_kind: 'member' (a person, author_user_id set) or
--    'research' (the AI analyst, author_user_id null). Research comments are
--    only written by the triggers below, never by members.
-- 2. When a matched company gets a medium- or high-materiality research update,
--    Research posts it in the match chat. When a company becomes a match,
--    Research posts a short opener with the latest assessment.
-- 3. comments is added to the supabase_realtime publication (Supabase only).
-- 4. push_subscriptions stores each member's devices; notifications.pushed_at
--    marks notifications already sent to phones.

-- ---------------------------------------------------------------------------
-- 1. Research authors
-- ---------------------------------------------------------------------------
alter table public.comments add column author_kind text not null default 'member' check (author_kind in ('member', 'research'));
alter table public.comments alter column author_user_id drop not null;
alter table public.comments add column update_id uuid references public.company_updates(id) on delete set null;
alter table public.comments add constraint comments_author_matches_kind check ((author_kind = 'member') = (author_user_id is not null));
create unique index comments_research_update_idx on public.comments(update_id) where update_id is not null;

-- Member comments notify the other members. Research update comments notify
-- everyone, sharing the research pipeline's dedupe key so nobody gets the same
-- update twice. The Research opener (no update) does not notify: the match
-- notification already covers it.
create or replace function public.on_comment_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
  cname text;
  cslug text;
  cstage public.family_stage;
  actor_name text;
  link text;
begin
  select household_id, name, slug, family_stage into hid, cname, cslug, cstage from public.companies where id = new.company_id;
  link := case when cstage = 'shortlisted' then '/matches/' || cslug else '/companies/' || cslug || '?tab=family' end;

  if new.author_kind = 'research' then
    if new.update_id is null then
      return new;
    end if;
    insert into public.notifications (household_id, recipient_user_id, notification_type, company_id, update_id, comment_id, title, body, importance, href, dedupe_key)
    select hid, m.user_id, 'comment', new.company_id, new.update_id, new.id, 'Research · ' || cname,
           left(new.body, 140) || case when char_length(new.body) > 140 then '…' else '' end,
           'normal', link, 'update:' || new.update_id
    from public.household_members m where m.household_id = hid and m.status = 'active'
    on conflict do nothing;
    return new;
  end if;

  select display_name into actor_name from public.profiles where user_id = new.author_user_id;
  actor_name := coalesce(actor_name, 'A member');
  insert into public.notifications (household_id, recipient_user_id, notification_type, company_id, comment_id, title, body, importance, href, dedupe_key)
  select hid, m.user_id, 'comment', new.company_id, new.id, actor_name || ' · ' || cname,
         left(new.body, 140) || case when char_length(new.body) > 140 then '…' else '' end,
         'normal', link, 'comment:' || new.id
  from public.household_members m
  where m.household_id = hid and m.status = 'active' and m.user_id is distinct from new.author_user_id
  on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.on_comment_insert() from public, anon, authenticated;

-- Research posts material changes to matched companies in their chat.
create or replace function public.on_company_update_research_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cstage public.family_stage;
  msg text;
begin
  if new.update_type = 'family' or new.materiality = 'low' then
    return new;
  end if;
  select family_stage into cstage from public.companies where id = new.company_id;
  if cstage is distinct from 'shortlisted' then
    return new;
  end if;
  msg := new.headline || case when coalesce(new.summary, '') <> '' then E'\n' || new.summary else '' end;
  insert into public.comments (company_id, author_kind, author_user_id, update_id, body)
  values (new.company_id, 'research', null, new.id, left(msg, 2000))
  on conflict do nothing;
  return new;
end;
$$;

revoke execute on function public.on_company_update_research_post() from public, anon, authenticated;

create trigger company_updates_research_post after insert on public.company_updates
for each row execute function public.on_company_update_research_post();

-- Research opens each new match's chat with where things stand.
create or replace function public.on_match_research_opener()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  latest text;
  msg text;
begin
  if new.family_stage <> 'shortlisted' or old.family_stage = 'shortlisted' then
    return new;
  end if;
  -- Re-matches keep the chat history; one opener per company is enough.
  if exists (select 1 from public.comments where company_id = new.id and author_kind = 'research' and update_id is null) then
    return new;
  end if;
  select summary into latest from public.company_assessments where company_id = new.id order by created_at desc limit 1;
  msg := 'I''m Research, the family''s AI analyst. I''ll post here whenever something changes for ' || new.name || ': the round, the team, risks or how to invest.';
  if coalesce(latest, '') <> '' then
    msg := msg || E'\n\nWhere things stand: ' || left(latest, 700);
  end if;
  insert into public.comments (company_id, author_kind, author_user_id, body)
  values (new.id, 'research', null, left(msg, 2000));
  return new;
end;
$$;

revoke execute on function public.on_match_research_opener() from public, anon, authenticated;

create trigger companies_match_research_opener after update of family_stage on public.companies
for each row execute function public.on_match_research_opener();

-- ---------------------------------------------------------------------------
-- 3. Live chat (Supabase Realtime respects the comments RLS policies)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments') then
    execute 'alter publication supabase_realtime add table public.comments';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Phone notifications
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_subscriptions_insert_own on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy push_subscriptions_update_own on public.push_subscriptions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

alter table public.notifications add column pushed_at timestamptz;
-- Nothing already in the inbox goes to phones.
update public.notifications set pushed_at = created_at where pushed_at is null;
