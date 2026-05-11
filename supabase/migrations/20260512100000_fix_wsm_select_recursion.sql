-- ============================================================
-- Fix infinite recursion in workspace_member RLS policies.
--
-- The original wsm_select policy authorized a SELECT on workspace_member
-- by subquerying workspace_member itself. Postgres evaluates that inner
-- query under the same policy, producing infinite recursion (42P17).
--
-- The other wsm_* policies and several workspace/board policies follow
-- the same shape. We add two SECURITY DEFINER helpers (matching the
-- existing role_for_board pattern) and rewrite the affected policies
-- to call them, which bypasses RLS for the membership lookup.
-- ============================================================

-- 1. Helpers ---------------------------------------------------

create or replace function public.role_for_workspace(p_workspace_id uuid, p_user_id uuid)
returns text language sql security definer set search_path = public stable as $$
  select role
    from public.workspace_member
   where workspace_id = p_workspace_id
     and user_id = p_user_id
   limit 1
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.workspace_member
     where workspace_id = p_workspace_id
       and user_id = p_user_id
  )
$$;

grant execute on function public.role_for_workspace(uuid, uuid) to authenticated, anon;
grant execute on function public.is_workspace_member(uuid, uuid) to authenticated, anon;

-- 2. workspace_member policies --------------------------------

drop policy if exists "wsm_select" on public.workspace_member;
create policy "wsm_select" on public.workspace_member
  for select using (
    public.is_workspace_member(workspace_member.workspace_id, (select auth.uid()))
  );

drop policy if exists "wsm_update" on public.workspace_member;
create policy "wsm_update" on public.workspace_member
  for update using (
    public.role_rank(public.role_for_workspace(workspace_member.workspace_id, (select auth.uid())))
      >= public.role_rank('admin')
  );

drop policy if exists "wsm_delete" on public.workspace_member;
create policy "wsm_delete" on public.workspace_member
  for delete using (
    user_id = (select auth.uid())
    or public.role_rank(public.role_for_workspace(workspace_member.workspace_id, (select auth.uid())))
         >= public.role_rank('admin')
  );

-- wsm_insert: keep the invitation-gated form from 20260508000000_workspaces_polish.sql,
-- but route the "am I already an admin" check through the helper.
drop policy if exists "wsm_insert" on public.workspace_member;
create policy "wsm_insert" on public.workspace_member for insert with check (
  public.role_rank(public.role_for_workspace(workspace_member.workspace_id, (select auth.uid())))
    >= public.role_rank('admin')
  or (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.invitation i
       where i.workspace_id = workspace_member.workspace_id
         and i.board_id is null
         and lower(i.email) = lower((select email from auth.users where id = (select auth.uid())))
         and i.role = workspace_member.role
         and i.accepted_at is null
         and i.revoked_at is null
         and i.expires_at >= now()
    )
  )
);

-- 3. workspace policies that referenced workspace_member directly ---

drop policy if exists "workspace_select" on public.workspace;
create policy "workspace_select" on public.workspace
  for select using (
    public.is_workspace_member(workspace.id, (select auth.uid()))
  );

drop policy if exists "workspace_update" on public.workspace;
create policy "workspace_update" on public.workspace
  for update using (
    public.role_rank(public.role_for_workspace(workspace.id, (select auth.uid())))
      >= public.role_rank('admin')
  );

drop policy if exists "workspace_delete" on public.workspace;
create policy "workspace_delete" on public.workspace
  for delete using (
    public.role_rank(public.role_for_workspace(workspace.id, (select auth.uid())))
      >= public.role_rank('owner')
  );
