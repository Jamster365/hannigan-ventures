-- The Deal Room — initial schema
-- Tenant-safe private household app. Every household table carries household_id
-- and is protected by Row Level Security. Family stage is computed server-side.


-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'member');
create type public.member_status as enum ('active', 'invited', 'removed');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.vote_value as enum ('interested', 'unsure', 'pass');
create type public.family_stage as enum ('unreviewed', 'pending', 'shortlisted', 'passed');
create type public.access_status as enum ('unknown', 'fundraising_reported', 'contactable', 'verified_open', 'expected', 'closing_soon', 'closed', 'stale');
create type public.route_type as enum ('official_application', 'syndicate', 'founder_intro', 'spv', 'platform', 'none');
create type public.evidence_status as enum ('verified_independent', 'official_company_claim', 'third_party_report', 'analyst_inference', 'unknown');
create type public.eis_status as enum ('confirmed_documented', 'company_claimed', 'pending', 'unknown', 'not_applicable');
create type public.ai_priority as enum ('high', 'medium', 'low', 'insufficient_evidence');
create type public.confidence as enum ('high', 'medium', 'low');
create type public.source_type as enum ('news', 'official', 'filing', 'research', 'media', 'other');
create type public.trust_tier as enum ('primary', 'reputable', 'secondary', 'unverified');
create type public.media_kind as enum ('hero', 'logo', 'product', 'founder', 'other');
create type public.rights_status as enum ('permitted', 'attributed', 'fallback');
create type public.round_status as enum ('open', 'closed', 'expected', 'unknown');
create type public.update_type as enum ('company', 'funding', 'product', 'team', 'risk', 'research', 'family');
create type public.materiality as enum ('high', 'medium', 'low');
create type public.story_type as enum ('financing', 'access', 'deadline', 'signal', 'research', 'family');
create type public.notification_type as enum ('round_confirmed', 'round_closed', 'valuation_changed', 'milestone', 'deadline', 'risk', 'access_changed', 'new_company', 'shortlist_promoted', 'shortlist_demoted', 'comment', 'vote_changed', 'research_applied', 'research_failed');
create type public.importance as enum ('high', 'normal');
create type public.event_access as enum ('open', 'invitation_only', 'waitlist', 'closed', 'unknown');
create type public.verification_status as enum ('verified', 'partially_verified', 'unverified');
create type public.feedback_type as enum ('too_many_sector', 'more_preseed', 'missed_something', 'not_this_model', 'free_text');
create type public.suggestion_status as enum ('proposed', 'applied', 'dismissed');
create type public.run_kind as enum ('scheduled', 'manual', 'recheck');
create type public.run_status as enum ('queued', 'running', 'published', 'failed', 'no_new_research');
create type public.actor_type as enum ('member', 'research', 'system');

-- ---------------------------------------------------------------------------
-- Households, profiles, membership, invitations
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Member',
  avatar_initial text generated always as (upper(left(display_name, 1))) stored,
  accent text not null default 'blue' check (accent in ('blue','green','red','violet','amber')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  status public.member_status not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members(user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  invited_email text not null,
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index invitations_household_idx on public.invitations(household_id, status);

-- ---------------------------------------------------------------------------
-- Companies and evidence
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  slug text not null,
  legal_name text,
  domain text,
  sector text not null default 'Unknown',
  sub_sector text,
  city text not null default 'Unknown',
  country text not null default 'Unknown',
  stage text not null default 'Unknown',
  teaser text not null default '',
  description text not null default '',
  is_demo boolean not null default false,
  first_discovered_at timestamptz not null default now(),
  last_researched_at timestamptz,
  discovery_signal text,
  research_rule_matched text,
  tags text[] not null default '{}',
  eis_status public.eis_status not null default 'unknown',
  eis_note text,
  artwork_hue int not null default 214,
  artwork_motif text not null default 'orbit',
  family_stage public.family_stage not null default 'unreviewed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, slug)
);
create unique index companies_household_domain_idx on public.companies(household_id, lower(domain)) where domain is not null;
create index companies_household_stage_idx on public.companies(household_id, family_stage);
create index companies_household_sector_idx on public.companies(household_id, sector);
create index companies_updated_idx on public.companies(household_id, updated_at desc);

create table public.company_aliases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  alias text not null,
  source_id uuid,
  unique (company_id, alias)
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  canonical_url text not null,
  title text not null,
  publisher text not null default '',
  source_type public.source_type not null default 'other',
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  content_hash text,
  trust_tier public.trust_tier not null default 'unverified',
  excerpt text,
  claim_type text,
  created_at timestamptz not null default now(),
  unique (household_id, canonical_url)
);
create index sources_company_idx on public.sources(company_id);

create table public.company_media (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind public.media_kind not null default 'hero',
  storage_path text,
  url text,
  is_primary boolean not null default false,
  rights_status public.rights_status not null default 'fallback',
  origin_url text,
  source_id uuid references public.sources(id) on delete set null,
  creator_or_owner text,
  license_or_permission text,
  attribution text,
  alt_text text not null default '',
  checked_at timestamptz,
  created_at timestamptz not null default now()
);
create index company_media_company_idx on public.company_media(company_id);

create table public.company_facts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  field_key text not null,
  label text not null,
  value_jsonb jsonb,
  unit text,
  currency text,
  as_of_date date,
  evidence_status public.evidence_status not null default 'unknown',
  source_id uuid references public.sources(id) on delete set null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  recorded_at timestamptz not null default now()
);
create index company_facts_company_idx on public.company_facts(company_id, field_key, effective_to);

create table public.funding_rounds (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  stage text not null,
  target_amount numeric,
  currency text,
  pre_money numeric,
  post_money numeric,
  reported_committed numeric,
  opened_at timestamptz,
  closes_at timestamptz,
  claimed_status public.round_status not null default 'unknown',
  lead_investors text[] not null default '{}',
  evidence_status public.evidence_status not null default 'unknown',
  source_id uuid references public.sources(id) on delete set null,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create index funding_rounds_company_idx on public.funding_rounds(company_id);

create table public.investment_access_checks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  access_status public.access_status not null default 'unknown',
  route_type public.route_type not null default 'none',
  contact_or_url text,
  min_cheque numeric,
  max_cheque numeric,
  currency text,
  checked_at timestamptz not null default now(),
  expires_at timestamptz,
  verifier text not null default 'research',
  source_id uuid references public.sources(id) on delete set null,
  notes text not null default ''
);
create index access_checks_company_idx on public.investment_access_checks(company_id, checked_at desc);

create table public.company_assessments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  run_id uuid,
  ai_priority public.ai_priority not null default 'insufficient_evidence',
  ai_score numeric(3,1) check (ai_score is null or (ai_score >= 0 and ai_score <= 10)),
  confidence public.confidence not null default 'low',
  summary text not null default '',
  why_interested text[] not null default '{}',
  risks text[] not null default '{}',
  bull_case text not null default '',
  bear_case text not null default '',
  why_now text not null default '',
  assumptions text[] not null default '{}',
  open_questions text[] not null default '{}',
  diligence_checklist text[] not null default '{}',
  next_action text not null default '',
  score_breakdown_jsonb jsonb not null default '[]',
  source_ids uuid[] not null default '{}',
  model_version text not null default '',
  prompt_version text not null default '',
  created_at timestamptz not null default now()
);
create index assessments_company_idx on public.company_assessments(company_id, created_at desc);

create table public.founders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  role text not null default '',
  bio text not null default '',
  profile_url text,
  evidence_status public.evidence_status not null default 'unknown',
  source_id uuid references public.sources(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.team_highlights (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  text text not null,
  evidence_status public.evidence_status not null default 'unknown',
  source_id uuid references public.sources(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Family: votes, bookmarks, comments
-- ---------------------------------------------------------------------------
create table public.member_votes (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote public.vote_value not null,
  score smallint check (score is null or (score >= 1 and score <= 10)),
  note text,
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table public.member_bookmarks (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index comments_company_idx on public.comments(company_id, created_at);

-- ---------------------------------------------------------------------------
-- Timeline, stories, notifications
-- ---------------------------------------------------------------------------
create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  local_date date not null,
  run_kind public.run_kind not null,
  prompt_version_id uuid,
  status public.run_status not null default 'queued',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  model text not null default '',
  source_count int not null default 0,
  candidates_count int not null default 0,
  published_count int not null default 0,
  estimated_cost numeric(10,4),
  summary text not null default '',
  error_summary text,
  triggered_by uuid references auth.users(id) on delete set null,
  unique (household_id, local_date, run_kind)
);

create table public.company_updates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  update_type public.update_type not null,
  headline text not null,
  summary text not null default '',
  materiality public.materiality not null default 'low',
  source_id uuid references public.sources(id) on delete set null,
  run_id uuid references public.research_runs(id) on delete set null,
  effective_at timestamptz not null default now(),
  detected_at timestamptz not null default now(),
  change_jsonb jsonb,
  dedupe_key text,
  unique (company_id, dedupe_key)
);
create index company_updates_company_idx on public.company_updates(company_id, effective_at desc);

create table public.home_stories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  run_id uuid references public.research_runs(id) on delete set null,
  story_type public.story_type not null,
  company_id uuid references public.companies(id) on delete cascade,
  headline text not null,
  teaser text not null default '',
  priority int not null default 0,
  source_id uuid references public.sources(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index home_stories_household_idx on public.home_stories(household_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type public.notification_type not null,
  company_id uuid references public.companies(id) on delete cascade,
  update_id uuid references public.company_updates(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  title text not null,
  body text not null default '',
  importance public.importance not null default 'normal',
  href text not null default '/updates',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  dedupe_key text not null,
  unique (recipient_user_id, dedupe_key)
);
create index notifications_unread_idx on public.notifications(recipient_user_id, created_at desc) where read_at is null;

-- ---------------------------------------------------------------------------
-- Events and networks
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  organiser text not null default '',
  event_type text not null default '',
  start_at timestamptz not null,
  end_at timestamptz,
  timezone text not null default 'Europe/London',
  venue text,
  city text not null default '',
  is_online boolean not null default false,
  registration_url text,
  access_status public.event_access not null default 'unknown',
  registration_checked_at timestamptz,
  audience_fit text not null default '',
  significance text not null default '',
  next_action text not null default '',
  related_company_ids uuid[] not null default '{}',
  source_id uuid references public.sources(id) on delete set null,
  importance public.importance not null default 'normal',
  created_at timestamptz not null default now(),
  unique (household_id, name, start_at)
);
create index events_household_start_idx on public.events(household_id, start_at);

create table public.event_member_status (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('registered','interested')),
  primary key (event_id, user_id)
);

create table public.angel_networks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  website text,
  focus text not null default 'Not yet checked',
  region text not null default 'UK',
  eligibility text not null default 'Not yet checked',
  joining_url text,
  fees text not null default 'Not yet checked',
  cheque_requirements text not null default 'Not yet checked',
  co_invest_route text not null default 'Not yet checked',
  contact text,
  verification_status public.verification_status not null default 'unverified',
  accessibility_confidence public.confidence not null default 'low',
  last_checked_at timestamptz,
  notes text not null default '',
  portfolio_company_ids uuid[] not null default '{}',
  unique (household_id, name)
);

-- ---------------------------------------------------------------------------
-- Research instructions, feedback, suggestions, audit
-- ---------------------------------------------------------------------------
create table public.research_prompts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  version int not null,
  prompt_text text not null,
  config_jsonb jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  active boolean not null default false,
  change_note text not null default '',
  parent_version_id uuid references public.research_prompts(id) on delete set null,
  unique (household_id, version)
);
create unique index research_prompts_one_active_idx on public.research_prompts(household_id) where active;

alter table public.research_runs add constraint research_runs_prompt_fk foreign key (prompt_version_id) references public.research_prompts(id) on delete set null;
alter table public.company_assessments add constraint assessments_run_fk foreign key (run_id) references public.research_runs(id) on delete set null;

create table public.research_feedback (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  feedback_type public.feedback_type not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create table public.prompt_suggestions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  feedback_id uuid references public.research_feedback(id) on delete set null,
  base_prompt_version_id uuid not null references public.research_prompts(id) on delete cascade,
  suggested_patch jsonb not null default '[]',
  suggested_text text,
  rationale text not null default '',
  expected_impact text not null default '',
  status public.suggestion_status not null default 'proposed',
  suggested_by text not null default 'ai',
  approved_by uuid references auth.users(id) on delete set null,
  applied_version_id uuid references public.research_prompts(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_type public.actor_type not null,
  actor_id text,
  action text not null,
  object_type text not null,
  object_id text not null,
  before_jsonb jsonb,
  after_jsonb jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_household_idx on public.audit_events(household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.is_household_member(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.is_household_owner(hid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.status = 'active' and m.role = 'owner'
  );
$$;

create or replace function public.company_household(cid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.companies where id = cid;
$$;

create or replace function public.current_household()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.household_members
  where user_id = auth.uid() and status = 'active'
  order by joined_at limit 1;
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger companies_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email, 'member'), '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Family stage: computed server-side on every vote change (SPEC §6)
-- ---------------------------------------------------------------------------
create or replace function public.compute_family_stage(cid uuid)
returns public.family_stage language sql stable as $$
  with t as (
    select
      count(*) filter (where vote = 'interested') as interested,
      count(*) filter (where vote = 'pass') as pass,
      count(*) as total
    from public.member_votes where company_id = cid
  )
  select case
    when interested >= 2 then 'shortlisted'::public.family_stage
    when pass >= 2 then 'passed'::public.family_stage
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
  select household_id, name, slug, family_stage into hid, cname, cslug, prev from public.companies where id = cid;
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
create trigger member_votes_change after insert or update or delete on public.member_votes for each row execute function public.on_vote_change();

-- Comments notify the other household members (once per comment).
create or replace function public.on_comment_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
  cname text;
  cslug text;
  actor_name text;
  m record;
begin
  select household_id, name, slug into hid, cname, cslug from public.companies where id = new.company_id;
  select display_name into actor_name from public.profiles where user_id = new.author_user_id;
  actor_name := coalesce(actor_name, 'A member');
  for m in select user_id from public.household_members where household_id = hid and status = 'active' and user_id <> new.author_user_id loop
    insert into public.notifications (household_id, recipient_user_id, notification_type, company_id, comment_id, title, body, importance, href, dedupe_key)
    values (hid, m.user_id, 'comment', new.company_id, new.id, actor_name || ' commented', 'On ' || cname || ': "' || left(new.body, 90) || case when char_length(new.body) > 90 then '…' else '' end || '"', 'normal', '/companies/' || cslug || '?tab=family', 'comment:' || new.id)
    on conflict do nothing;
  end loop;
  return new;
end;
$$;
create trigger comments_notify after insert on public.comments for each row execute function public.on_comment_insert();

-- Research prompt activation: exactly one active version per household.
create or replace function public.activate_prompt_version(hid uuid, p_prompt_text text, p_config jsonb, p_change_note text, p_based_on uuid, p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  current_active uuid;
  next_version int;
  new_id uuid;
begin
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

-- Invitation redemption: the signed-in user joins the household if the token is valid.
create or replace function public.redeem_invitation(p_token_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations;
  uid uuid := auth.uid();
  user_email text;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into inv from public.invitations where token_hash = p_token_hash for update;
  if inv.id is null then raise exception 'invalid invitation' using errcode = 'P0002'; end if;
  if inv.status <> 'pending' or inv.expires_at < now() then raise exception 'invitation expired' using errcode = 'P0002'; end if;
  select email into user_email from auth.users where id = uid;
  if lower(user_email) <> lower(inv.invited_email) then raise exception 'invitation is for a different email' using errcode = '42501'; end if;
  insert into public.household_members (household_id, user_id, role, status)
  values (inv.household_id, uid, 'member', 'active')
  on conflict (household_id, user_id) do update set status = 'active';
  update public.invitations set status = 'accepted', accepted_by = uid where id = inv.id;
  insert into public.audit_events (household_id, actor_type, actor_id, action, object_type, object_id)
  values (inv.household_id, 'member', uid::text, 'invitation.accept', 'invitation', inv.id::text);
  return inv.household_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.household_members enable row level security;
alter table public.invitations enable row level security;
alter table public.companies enable row level security;
alter table public.company_aliases enable row level security;
alter table public.sources enable row level security;
alter table public.company_media enable row level security;
alter table public.company_facts enable row level security;
alter table public.funding_rounds enable row level security;
alter table public.investment_access_checks enable row level security;
alter table public.company_assessments enable row level security;
alter table public.founders enable row level security;
alter table public.team_highlights enable row level security;
alter table public.member_votes enable row level security;
alter table public.member_bookmarks enable row level security;
alter table public.comments enable row level security;
alter table public.research_runs enable row level security;
alter table public.company_updates enable row level security;
alter table public.home_stories enable row level security;
alter table public.notifications enable row level security;
alter table public.events enable row level security;
alter table public.event_member_status enable row level security;
alter table public.angel_networks enable row level security;
alter table public.research_prompts enable row level security;
alter table public.research_feedback enable row level security;
alter table public.prompt_suggestions enable row level security;
alter table public.audit_events enable row level security;

-- Households & membership
create policy households_select on public.households for select to authenticated using (public.is_household_member(id));
create policy profiles_select on public.profiles for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.household_members a join public.household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = profiles.user_id and a.status = 'active'
  )
);
create policy profiles_update_own on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_select on public.household_members for select to authenticated using (public.is_household_member(household_id));
create policy invitations_owner_select on public.invitations for select to authenticated using (public.is_household_owner(household_id));
create policy invitations_owner_insert on public.invitations for insert to authenticated with check (public.is_household_owner(household_id) and invited_by = auth.uid());
create policy invitations_owner_update on public.invitations for update to authenticated using (public.is_household_owner(household_id));

-- Household content: members read everything; research content is written by the service role only.
create policy companies_select on public.companies for select to authenticated using (public.is_household_member(household_id));
create policy aliases_select on public.company_aliases for select to authenticated using (public.is_household_member(public.company_household(company_id)));
create policy sources_select on public.sources for select to authenticated using (public.is_household_member(household_id));
create policy media_select on public.company_media for select to authenticated using (public.is_household_member(public.company_household(company_id)));
create policy facts_select on public.company_facts for select to authenticated using (public.is_household_member(public.company_household(company_id)));
create policy rounds_select on public.funding_rounds for select to authenticated using (public.is_household_member(public.company_household(company_id)));
create policy access_select on public.investment_access_checks for select to authenticated using (public.is_household_member(public.company_household(company_id)));
create policy assessments_select on public.company_assessments for select to authenticated using (public.is_household_member(public.company_household(company_id)));
create policy founders_select on public.founders for select to authenticated using (public.is_household_member(public.company_household(company_id)));
create policy highlights_select on public.team_highlights for select to authenticated using (public.is_household_member(public.company_household(company_id)));
create policy updates_select on public.company_updates for select to authenticated using (public.is_household_member(public.company_household(company_id)));
create policy stories_select on public.home_stories for select to authenticated using (public.is_household_member(household_id));
create policy runs_select on public.research_runs for select to authenticated using (public.is_household_member(household_id));
create policy events_select on public.events for select to authenticated using (public.is_household_member(household_id));
create policy networks_select on public.angel_networks for select to authenticated using (public.is_household_member(household_id));
create policy audit_select on public.audit_events for select to authenticated using (public.is_household_member(household_id));

-- Votes, bookmarks, comments: read all household rows; change only your own.
create policy votes_select on public.member_votes for select to authenticated using (public.is_household_member(public.company_household(company_id)));
create policy votes_insert_own on public.member_votes for insert to authenticated with check (user_id = auth.uid() and public.is_household_member(public.company_household(company_id)));
create policy votes_update_own on public.member_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy votes_delete_own on public.member_votes for delete to authenticated using (user_id = auth.uid());

create policy bookmarks_select on public.member_bookmarks for select to authenticated using (public.is_household_member(public.company_household(company_id)));
create policy bookmarks_insert_own on public.member_bookmarks for insert to authenticated with check (user_id = auth.uid() and public.is_household_member(public.company_household(company_id)));
create policy bookmarks_delete_own on public.member_bookmarks for delete to authenticated using (user_id = auth.uid());

create policy comments_select on public.comments for select to authenticated using (public.is_household_member(public.company_household(company_id)));
create policy comments_insert_own on public.comments for insert to authenticated with check (author_user_id = auth.uid() and public.is_household_member(public.company_household(company_id)));
create policy comments_update_own on public.comments for update to authenticated using (author_user_id = auth.uid()) with check (author_user_id = auth.uid());

create policy event_status_select on public.event_member_status for select to authenticated using (exists (select 1 from public.events e where e.id = event_id and public.is_household_member(e.household_id)));
create policy event_status_upsert_own on public.event_member_status for insert to authenticated with check (user_id = auth.uid());
create policy event_status_update_own on public.event_member_status for update to authenticated using (user_id = auth.uid());
create policy event_status_delete_own on public.event_member_status for delete to authenticated using (user_id = auth.uid());

-- Notifications: only the recipient; may mark read.
create policy notifications_select_own on public.notifications for select to authenticated using (recipient_user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());

-- Research instructions: members read; writes go through activate_prompt_version().
create policy prompts_select on public.research_prompts for select to authenticated using (public.is_household_member(household_id));
create policy feedback_select on public.research_feedback for select to authenticated using (public.is_household_member(household_id));
create policy feedback_insert_own on public.research_feedback for insert to authenticated with check (author_user_id = auth.uid() and public.is_household_member(household_id));
create policy suggestions_select on public.prompt_suggestions for select to authenticated using (public.is_household_member(household_id));
create policy suggestions_insert on public.prompt_suggestions for insert to authenticated with check (public.is_household_member(household_id));
create policy suggestions_update on public.prompt_suggestions for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

-- Function grants
grant execute on function public.activate_prompt_version(uuid, text, jsonb, text, uuid, uuid) to authenticated;
grant execute on function public.redeem_invitation(text) to authenticated;
grant execute on function public.compute_family_stage(uuid) to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.company_household(uuid) to authenticated;
grant execute on function public.current_household() to authenticated;
