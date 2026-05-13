-- ============================================================
-- The original public.current_user_email() helper used
-- `language sql security definer set search_path = public stable`,
-- where the `stable` keyword followed the SET clause's value and
-- was almost certainly being parsed as part of the search_path
-- literal rather than as the function's volatility marker.
-- Combined with `language sql`, the function was effectively
-- VOLATILE and (worse) the planner appears to have inlined it
-- into the surrounding policy expression in some plans — defeating
-- SECURITY DEFINER and re-introducing the "permission denied
-- for table users" / silent-NULL behaviour that the helper was
-- meant to dodge. Test 5 in 40_invitation.sql (invitee setting
-- accepted_at on their own invite) hit the silent-NULL path and
-- WITH CHECK failed with 42501.
--
-- Rewrite the helper in plpgsql with explicit STABLE / SECURITY
-- DEFINER / SET clauses in canonical order, and read the email
-- from public.profile (populated by the on_auth_user_created
-- trigger) — profile is in the public schema with no GRANT
-- gymnastics needed even for the authenticated role.
-- ============================================================

create or replace function public.current_user_email()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email::text into v_email
    from public.profile
    where id = (select auth.uid());
  return v_email;
end
$$;

grant execute on function public.current_user_email() to authenticated, anon;
