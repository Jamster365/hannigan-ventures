-- Votes and reasons stay private until a match: enforced in the database,
-- not only in the app (security review, 23 Oct 2026).

-- 1. A member reads their own votes; everyone's once the company is a match.
drop policy if exists votes_select on public.member_votes;
create policy votes_select on public.member_votes for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.companies c
      where c.id = company_id and c.family_stage = 'shortlisted' and public.is_household_member(c.household_id)
    )
  );

-- 2. The audit log keeps only the answer, never the reason, and members cannot read vote rows.
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
          case when tg_op = 'INSERT' then null else jsonb_build_object('vote', old.vote) end,
          case when tg_op = 'DELETE' then null else jsonb_build_object('vote', new.vote) end);

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

update public.audit_events
set before_jsonb = case when before_jsonb is null then null else jsonb_build_object('vote', before_jsonb->'vote') end,
    after_jsonb = case when after_jsonb is null then null else jsonb_build_object('vote', after_jsonb->'vote') end
where action like 'vote.%';

drop policy if exists audit_select on public.audit_events;
create policy audit_select on public.audit_events for select to authenticated
  using (public.is_household_member(household_id) and action not like 'vote.%');

-- 3. Research-instruction activations are always in the caller's own name.
create or replace function public.activate_prompt_version(hid uuid, p_prompt_text text, p_config jsonb, p_change_note text, p_based_on uuid, p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  current_active uuid;
  next_version int;
  new_id uuid;
begin
  -- Only your own activations: the caller's session must be p_user.
  if auth.uid() is null or p_user is distinct from auth.uid() then
    raise exception 'not your account' using errcode = '42501';
  end if;
  if not exists (select 1 from public.household_members where household_id = hid and user_id = p_user and status = 'active') then
    raise exception 'not a household member' using errcode = '42501';
  end if;
  -- Serialise activations per household.
  perform pg_advisory_xact_lock(hashtext(hid::text));
  select id into current_active from public.research_prompts where household_id = hid and active;
  if current_active is distinct from p_based_on then
    raise exception 'prompt_conflict' using errcode = 'P0002', detail = coalesce(current_active::text, '');
  end if;
  select coalesce(max(version), 0) + 1 into next_version from public.research_prompts where household_id = hid;
  update public.research_prompts set active = false where household_id = hid and active;
  insert into public.research_prompts (household_id, version, prompt_text, config_jsonb, created_by, active, change_note, parent_version_id)
  values (hid, next_version, p_prompt_text, p_config, p_user, true, coalesce(p_change_note, ''), p_based_on)
  returning id into new_id;
  insert into public.audit_events (household_id, actor_type, actor_id, action, object_type, object_id, before_jsonb, after_jsonb)
  values (hid, 'member', p_user::text, 'prompt.activate', 'research_prompt', new_id::text, jsonb_build_object('version_id', p_based_on), jsonb_build_object('version', next_version));
  -- Tell the other members (once per version).
  insert into public.notifications (household_id, recipient_user_id, notification_type, title, body, importance, href, dedupe_key)
  select hid, m.user_id, 'research_applied', 'Research instructions updated',
         coalesce((select display_name from public.profiles where user_id = p_user), 'A member') || ' activated v' || next_version || case when coalesce(p_change_note, '') <> '' then ': ' || p_change_note else '.' end,
         'normal', '/research/settings?tab=history', 'prompt:' || new_id
  from public.household_members m where m.household_id = hid and m.status = 'active' and m.user_id <> p_user
  on conflict do nothing;
  return new_id;
end;
$$;

-- 4. "Almost a match" without names: true when every other member has answered,
-- exactly one of them is interested, and so this member's yes would have made a match.
create or replace function public.almost_match(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with co as (select household_id from public.companies where id = cid),
       others as (
         select m.user_id from public.household_members m, co
         where m.household_id = co.household_id and m.status = 'active' and m.user_id <> auth.uid()
       ),
       answered as (
         select v.vote from public.member_votes v join others o on o.user_id = v.user_id
         where v.company_id = cid and v.vote <> 'unsure'
       )
  select public.is_household_member((select household_id from co))
     and (select count(*) from answered) = (select count(*) from others)
     and (select count(*) from answered where vote = 'interested') = 1;
$$;
revoke execute on function public.almost_match(uuid) from public, anon;
grant execute on function public.almost_match(uuid) to authenticated;

-- 5. Sign-in hand-offs remember which email they were made for, so only that
-- member's session can be handed over.
alter table public.auth_handoffs add column if not exists email text;

-- 6. Idempotency: a shipped research batch is queued once even if two
-- heartbeats overlap, and only one learning proposal can wait at a time.
create unique index if not exists research_imports_household_label_idx on public.research_imports (household_id, label);
create unique index if not exists prompt_suggestions_one_learning_idx on public.prompt_suggestions (household_id)
  where suggested_by = 'learning' and status = 'proposed';
