-- Wording only: match notifications say "<names> are interested in <company>"
-- instead of "ticked" (owner's request, 23 Oct 2026). Same logic as 0013.

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
  tickers text;
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
      select string_agg(coalesce(p.display_name, 'A member'), ' and ' order by v.updated_at) into tickers
      from public.member_votes v left join public.profiles p on p.user_id = v.user_id
      where v.company_id = cid and v.vote = 'interested';
      insert into public.company_updates (company_id, update_type, headline, summary, materiality, dedupe_key)
      values (cid, 'family', 'It''s a match', tickers || case when strpos(tickers, ' and ') > 0 then ' are' else ' is' end || ' interested in ' || cname || '.', 'medium', 'promote:' || stamp)
      returning id into upd_id;
      for m in select user_id from public.household_members where household_id = hid and status = 'active' and user_id <> actor loop
        insert into public.notifications (household_id, recipient_user_id, notification_type, company_id, update_id, title, body, importance, href, dedupe_key)
        values (hid, m.user_id, 'shortlist_promoted', cid, upd_id, 'It''s a match: ' || cname, tickers || case when strpos(tickers, ' and ') > 0 then ' are' else ' is' end || ' interested in ' || cname || '. The chat is open.', 'high', '/matches/' || cslug, 'promote:' || cid || ':' || stamp)
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
