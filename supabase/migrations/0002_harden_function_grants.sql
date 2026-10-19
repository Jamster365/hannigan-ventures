-- Pin search_path on the two functions the Supabase linter flagged.
alter function public.compute_family_stage(uuid) set search_path = public;
alter function public.set_updated_at() set search_path = public;

-- Supabase grants EXECUTE to public by default. Trigger functions must not be
-- callable through the API at all; helper and RPC functions only by signed-in users.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.on_vote_change() from public, anon, authenticated;
revoke execute on function public.on_comment_insert() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

revoke execute on function public.activate_prompt_version(uuid, text, jsonb, text, uuid, uuid) from public, anon;
revoke execute on function public.redeem_invitation(text) from public, anon;
revoke execute on function public.compute_family_stage(uuid) from public, anon;
revoke execute on function public.is_household_member(uuid) from public, anon;
revoke execute on function public.is_household_owner(uuid) from public, anon;
revoke execute on function public.company_household(uuid) from public, anon;
revoke execute on function public.current_household() from public, anon;
