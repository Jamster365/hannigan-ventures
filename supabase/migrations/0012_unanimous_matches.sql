-- Swipe app: a company becomes a match (family_stage 'shortlisted') only when
-- every active household member has ticked it. A single cross ends it
-- ('passed'). Votes stay private until a match, so "changed their view"
-- notifications are no longer sent, and match/comment notifications open the
-- match chat.
--
-- The classic 2-of-3 rule lives in 0001_init.sql / 0008; see
-- docs/classic-app.md for how to restore it.

create or replace function public.compute_family_stage(cid uuid)
returns public.family_stage language sql stable set search_path = public as $$
  with active as (
    select m.user_id
    from public.household_members m
    join public.companies c on c.household_id = m.household_id
    where c.id = cid and m.status = 'active'
  ),
  t as (
    select
      count(*) filter (where v.vote = 'interested' and v.user_id in (select user_id from active)) as interested,
      count(*) filter (where v.vote = 'pass') as pass,
      count(*) as total,
      (select count(*) from active) as members
    from public.member_votes v where v.company_id = cid
  )
  select case
    when members > 0 and interested >= members then 'shortlisted'::public.family_stage
    when pass >= 1 then 'passed'::public.family_stage
    when total = 0 then 'unreviewed'::public.family_stage
    else 'pending'::public.family_stage
  end from t;
$$;

create or replace function public.on_vote_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cid uuid := coalesce(new.company_id, old.company_id);
  actor uuid := coalesce(new.user_id, old.user_id);
  hid uuid;
  cname text;
  cslug text;
  prev public.family_stage;
  nxt public.family_stage;
  actor_name text;
  m record;
  upd_id uuid;
  stamp text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
begin
  -- Lock the company row so concurrent votes are counted one after another:
  -- two "last" ticks committing together must still produce one match.
  select household_id, name, slug, family_stage into hid, cname, cslug, prev from public.companies where id = cid for update;
  if hid is null then
    return coalesce(new, old);
  end if;
  nxt := public.compute_family_stage(cid);
  select display_name into actor_name from public.profiles where user_id = actor;
  actor_name := coalesce(actor_name, 'A member');

  insert into public.audit_events (household_id, actor_type, actor_id, action, object_type, object_id, before_jsonb, after_jsonb)
  values (hid, 'member', actor::text, 'vote.' || lower(tg_op), 'company', cid::text,
          case when tg_op = 'INSERT' then null else to_jsonb(old) end,
          case when tg_op = 'DELETE' then null else to_jsonb(new) end);

  if nxt <> prev then
    update public.companies set family_stage = nxt where id = cid;

    if nxt = 'shortlisted' then
      insert into public.company_updates (company_id, update_type, headline, summary, materiality, dedupe_key)
      values (cid, 'family', 'It''s a match', 'Everyone ticked ' || cname || '.', 'medium', 'promote:' || stamp)
      returning id into upd_id;
      for m in select user_id from public.household_members where household_id = hid and status = 'active' and user_id <> actor loop
        insert into public.notifications (household_id, recipient_user_id, notification_type, company_id, update_id, title, body, importance, href, dedupe_key)
        values (hid, m.user_id, 'shortlist_promoted', cid, upd_id, 'It''s a match: ' || cname, 'Everyone ticked ' || cname || '. The chat is open.', 'high', '/matches/' || cslug, 'promote:' || cid || ':' || stamp)
        on conflict do nothing;
      end loop;
    elsif prev = 'shortlisted' then
      -- The chat has closed: unread match and chat notifications would point at nothing.
      update public.notifications set read_at = now()
      where company_id = cid and read_at is null and notification_type in ('shortlist_promoted', 'comment');
      insert into public.company_updates (company_id, update_type, headline, summary, materiality, dedupe_key)
      values (cid, 'family', 'No longer a match', actor_name || ' changed their mind.', 'medium', 'demote:' || stamp)
      returning id into upd_id;
      for m in select user_id from public.household_members where household_id = hid and status = 'active' and user_id <> actor loop
        insert into public.notifications (household_id, recipient_user_id, notification_type, company_id, update_id, title, body, importance, href, dedupe_key)
        values (hid, m.user_id, 'shortlist_demoted', cid, upd_id, cname || ' is no longer a match', actor_name || ' changed their mind.', 'high', '/matches', 'demote:' || cid || ':' || stamp)
        on conflict do nothing;
      end loop;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.on_vote_change() from public, anon, authenticated;

create or replace function public.on_comment_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
  cname text;
  cslug text;
  cstage public.family_stage;
  actor_name text;
  m record;
begin
  select household_id, name, slug, family_stage into hid, cname, cslug, cstage from public.companies where id = new.company_id;
  select display_name into actor_name from public.profiles where user_id = new.author_user_id;
  actor_name := coalesce(actor_name, 'A member');
  for m in select user_id from public.household_members where household_id = hid and status = 'active' and user_id <> new.author_user_id loop
    insert into public.notifications (household_id, recipient_user_id, notification_type, company_id, comment_id, title, body, importance, href, dedupe_key)
    values (hid, m.user_id, 'comment', new.company_id, new.id, actor_name || ' commented', 'On ' || cname || ': "' || left(new.body, 90) || case when char_length(new.body) > 90 then '…' else '' end || '"', 'normal',
            case when cstage = 'shortlisted' then '/matches/' || cslug else '/companies/' || cslug || '?tab=family' end,
            'comment:' || new.id)
    on conflict do nothing;
  end loop;
  return new;
end;
$$;

revoke execute on function public.on_comment_insert() from public, anon, authenticated;

-- "All members" changes when someone joins or leaves: re-derive that
-- household's stages quietly (no notifications).
create or replace function public.on_membership_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hid uuid := coalesce(new.household_id, old.household_id);
begin
  update public.companies set family_stage = public.compute_family_stage(id)
  where household_id = hid and family_stage is distinct from public.compute_family_stage(id);
  return coalesce(new, old);
end;
$$;

revoke execute on function public.on_membership_change() from public, anon, authenticated;

create trigger household_members_restage
after insert or delete or update of status on public.household_members
for each row execute function public.on_membership_change();

-- Re-derive every company's stage under the new rule (no notifications).
update public.companies set family_stage = public.compute_family_stage(id)
where family_stage is distinct from public.compute_family_stage(id);
