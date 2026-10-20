-- Deleting a company cascades to its votes, and each removed vote fired
-- on_vote_change(), which looked the company up (already gone), got no
-- household and failed the audit insert, blocking the delete. When the
-- company no longer exists there is nothing to audit or recompute: stand aside.
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
  select household_id, name, slug, family_stage into hid, cname, cslug, prev from public.companies where id = cid;
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
      values (cid, 'family', 'Promoted to shortlist', actor_name || '''s Interested vote brought the count to 2 of 3.', 'medium', 'promote:' || stamp)
      returning id into upd_id;
      for m in select user_id from public.household_members where household_id = hid and status = 'active' and user_id <> actor loop
        insert into public.notifications (household_id, recipient_user_id, notification_type, company_id, update_id, title, body, importance, href, dedupe_key)
        values (hid, m.user_id, 'shortlist_promoted', cid, upd_id, cname || ' promoted to shortlist', actor_name || '''s Interested vote brought the count to 2 of 3.', 'high', '/companies/' || cslug || '?tab=family', 'promote:' || cid || ':' || stamp)
        on conflict do nothing;
      end loop;
    elsif prev = 'shortlisted' then
      insert into public.company_updates (company_id, update_type, headline, summary, materiality, dedupe_key)
      values (cid, 'family', 'Left the shortlist', actor_name || ' changed their vote; fewer than 2 members are Interested.', 'medium', 'demote:' || stamp)
      returning id into upd_id;
      for m in select user_id from public.household_members where household_id = hid and status = 'active' and user_id <> actor loop
        insert into public.notifications (household_id, recipient_user_id, notification_type, company_id, update_id, title, body, importance, href, dedupe_key)
        values (hid, m.user_id, 'shortlist_demoted', cid, upd_id, cname || ' left the shortlist', actor_name || ' changed their vote; fewer than 2 members are Interested.', 'high', '/companies/' || cslug || '?tab=family', 'demote:' || cid || ':' || stamp)
        on conflict do nothing;
      end loop;
    end if;
  elsif tg_op = 'UPDATE' and new.vote <> old.vote then
    for m in select user_id from public.household_members where household_id = hid and status = 'active' and user_id <> actor loop
      insert into public.notifications (household_id, recipient_user_id, notification_type, company_id, title, body, importance, href, dedupe_key)
      values (hid, m.user_id, 'vote_changed', cid, actor_name || ' changed their view on ' || cname, 'Now ' || new.vote::text || '.', 'normal', '/companies/' || cslug || '?tab=family', 'vote:' || cid || ':' || actor || ':' || stamp)
      on conflict do nothing;
    end loop;
  end if;
  return coalesce(new, old);
end;
$$;

revoke execute on function public.on_vote_change() from public, anon, authenticated;
