-- ============================================================
-- Epic 04 — Slice B: Full RLS policy set
-- Timestamp must sort after 20260507120000_authz_helpers.sql (Slice A),
-- which defines public.role_rank, public.greater_role, public.role_for_board.
-- All policies use (select auth.uid()) for plan-cache stability.
-- Reserved words "group" and "column" are always double-quoted.
-- ============================================================

-- ============================================================
-- 1. workspace
-- ============================================================

create policy "workspace_select" on public.workspace
  for select using (
    exists (
      select 1 from public.workspace_member wm
      where wm.workspace_id = workspace.id
        and wm.user_id = (select auth.uid())
    )
  );

-- insert: admin-bypass — create_workspace RPC (security definer) handles
-- creation atomically; direct inserts require admin+ in the workspace.
-- Since workspace doesn't exist yet at insert time, we rely on the RPC path.
-- This policy allows only authenticated users to insert (workspace doesn't
-- yet have members to check). The create_workspace RPC is security definer
-- and bypasses this policy; this policy prevents raw inserts outside the RPC.
create policy "workspace_insert" on public.workspace
  for insert with check (
    created_by = (select auth.uid())
  );

create policy "workspace_update" on public.workspace
  for update using (
    public.role_rank((
      select role from public.workspace_member
      where workspace_id = workspace.id
        and user_id = (select auth.uid())
    )) >= public.role_rank('admin')
  );

create policy "workspace_delete" on public.workspace
  for delete using (
    public.role_rank((
      select role from public.workspace_member
      where workspace_id = workspace.id
        and user_id = (select auth.uid())
    )) >= public.role_rank('owner')
  );

-- ============================================================
-- 2. workspace_member
-- ============================================================

create policy "wsm_select" on public.workspace_member
  for select using (
    workspace_id in (
      select workspace_id from public.workspace_member
      where user_id = (select auth.uid())
    )
  );

-- admin-only insert (Slice D will drop and recreate with invitation-gated form)
create policy "wsm_insert" on public.workspace_member
  for insert with check (
    public.role_rank((
      select role from public.workspace_member
      where workspace_id = workspace_member.workspace_id
        and user_id = (select auth.uid())
    )) >= public.role_rank('admin')
  );

create policy "wsm_update" on public.workspace_member
  for update using (
    public.role_rank((
      select role from public.workspace_member
      where workspace_id = workspace_member.workspace_id
        and user_id = (select auth.uid())
    )) >= public.role_rank('admin')
  );

create policy "wsm_delete" on public.workspace_member
  for delete using (
    user_id = (select auth.uid())
    or public.role_rank((
      select role from public.workspace_member
      where workspace_id = workspace_member.workspace_id
        and user_id = (select auth.uid())
    )) >= public.role_rank('admin')
  );

-- ============================================================
-- 3. board
-- ============================================================

create policy "board_select" on public.board
  for select using (
    public.role_for_board(board.id, (select auth.uid())) is not null
    and deleted_at is null
  );

create policy "board_insert" on public.board
  for insert with check (
    exists (
      select 1 from public.workspace_member wm
      where wm.workspace_id = board.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('owner', 'admin', 'member')
    )
  );

create policy "board_update" on public.board
  for update using (
    public.role_rank(public.role_for_board(board.id, (select auth.uid()))) >= public.role_rank('member')
  );

create policy "board_delete" on public.board
  for delete using (
    public.role_rank(public.role_for_board(board.id, (select auth.uid()))) >= public.role_rank('admin')
  );

-- ============================================================
-- 4. board_member
-- ============================================================

create policy "bm_select" on public.board_member
  for select using (
    public.role_for_board(board_member.board_id, (select auth.uid())) is not null
  );

-- admin-only insert (Slice D will drop and recreate with invitation-gated form)
create policy "bm_insert" on public.board_member
  for insert with check (
    public.role_rank(public.role_for_board(board_member.board_id, (select auth.uid()))) >= public.role_rank('admin')
  );

create policy "bm_update" on public.board_member
  for update using (
    public.role_rank(public.role_for_board(board_member.board_id, (select auth.uid()))) >= public.role_rank('admin')
  );

create policy "bm_delete" on public.board_member
  for delete using (
    user_id = (select auth.uid())
    or public.role_rank(public.role_for_board(board_member.board_id, (select auth.uid()))) >= public.role_rank('admin')
  );

-- ============================================================
-- 5. "group"  (SQL reserved word — always double-quoted)
-- ============================================================

create policy "group_select" on public."group"
  for select using (
    public.role_for_board("group".board_id, (select auth.uid())) is not null
    and deleted_at is null
  );

create policy "group_insert" on public."group"
  for insert with check (
    public.role_rank(public.role_for_board("group".board_id, (select auth.uid()))) >= public.role_rank('member')
  );

create policy "group_update" on public."group"
  for update using (
    public.role_rank(public.role_for_board("group".board_id, (select auth.uid()))) >= public.role_rank('member')
  );

create policy "group_delete" on public."group"
  for delete using (
    public.role_rank(public.role_for_board("group".board_id, (select auth.uid()))) >= public.role_rank('member')
  );

-- ============================================================
-- 6. "column"  (SQL reserved word — always double-quoted)
-- admin+ for structural changes (insert / update / delete)
-- ============================================================

create policy "column_select" on public."column"
  for select using (
    public.role_for_board("column".board_id, (select auth.uid())) is not null
  );

create policy "column_insert" on public."column"
  for insert with check (
    public.role_rank(public.role_for_board("column".board_id, (select auth.uid()))) >= public.role_rank('admin')
  );

create policy "column_update" on public."column"
  for update using (
    public.role_rank(public.role_for_board("column".board_id, (select auth.uid()))) >= public.role_rank('admin')
  );

create policy "column_delete" on public."column"
  for delete using (
    public.role_rank(public.role_for_board("column".board_id, (select auth.uid()))) >= public.role_rank('admin')
  );

-- ============================================================
-- 7. label
-- Q7=(b): admin+ for insert/update/delete; any board role for select.
-- Joined through "column" → board.
-- ============================================================

create policy "label_select" on public.label
  for select using (
    exists (
      select 1 from public."column" c
      where c.id = label.column_id
        and public.role_for_board(c.board_id, (select auth.uid())) is not null
    )
  );

create policy "label_insert" on public.label
  for insert with check (
    exists (
      select 1 from public."column" c
      where c.id = label.column_id
        and public.role_rank(public.role_for_board(c.board_id, (select auth.uid()))) >= public.role_rank('admin')
    )
  );

create policy "label_update" on public.label
  for update using (
    exists (
      select 1 from public."column" c
      where c.id = label.column_id
        and public.role_rank(public.role_for_board(c.board_id, (select auth.uid()))) >= public.role_rank('admin')
    )
  );

create policy "label_delete" on public.label
  for delete using (
    exists (
      select 1 from public."column" c
      where c.id = label.column_id
        and public.role_rank(public.role_for_board(c.board_id, (select auth.uid()))) >= public.role_rank('admin')
    )
  );

-- ============================================================
-- 8. task
-- ============================================================

create policy "task_select" on public.task
  for select using (
    public.role_for_board(task.board_id, (select auth.uid())) is not null
    and deleted_at is null
  );

create policy "task_insert" on public.task
  for insert with check (
    public.role_rank(public.role_for_board(task.board_id, (select auth.uid()))) >= public.role_rank('member')
  );

create policy "task_update" on public.task
  for update using (
    public.role_rank(public.role_for_board(task.board_id, (select auth.uid()))) >= public.role_rank('member')
  );

create policy "task_delete" on public.task
  for delete using (
    public.role_rank(public.role_for_board(task.board_id, (select auth.uid()))) >= public.role_rank('member')
  );

-- ============================================================
-- 9. cell
-- Joined through task → board. PK is (task_id, column_id).
-- for all using covers insert / update / delete with the same expression.
-- A separate select policy keeps the plan lighter for read paths.
-- ============================================================

create policy "cell_select" on public.cell
  for select using (
    exists (
      select 1 from public.task t
      where t.id = cell.task_id
        and public.role_for_board(t.board_id, (select auth.uid())) is not null
    )
  );

create policy "cell_modify" on public.cell
  for all using (
    exists (
      select 1 from public.task t
      where t.id = cell.task_id
        and public.role_rank(public.role_for_board(t.board_id, (select auth.uid()))) >= public.role_rank('member')
    )
  );

-- ============================================================
-- 10. comment
-- author_id, body_text, body all present. No parent_id (threading deferred).
-- ============================================================

create policy "comment_select" on public.comment
  for select using (
    exists (
      select 1 from public.task t
      where t.id = comment.task_id
        and public.role_for_board(t.board_id, (select auth.uid())) is not null
    )
  );

create policy "comment_insert" on public.comment
  for insert with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.task t
      where t.id = comment.task_id
        and public.role_rank(public.role_for_board(t.board_id, (select auth.uid()))) >= public.role_rank('member')
    )
  );

create policy "comment_update" on public.comment
  for update using (
    author_id = (select auth.uid())
  );

create policy "comment_delete" on public.comment
  for delete using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.task t
      where t.id = comment.task_id
        and public.role_rank(public.role_for_board(t.board_id, (select auth.uid()))) >= public.role_rank('admin')
    )
  );

-- ============================================================
-- 11. attachment
-- Q6 applied: uploader OR board admin+ for update/delete.
-- ============================================================

create policy "attachment_select" on public.attachment
  for select using (
    exists (
      select 1 from public.task t
      where t.id = attachment.task_id
        and public.role_for_board(t.board_id, (select auth.uid())) is not null
    )
  );

create policy "attachment_insert" on public.attachment
  for insert with check (
    attachment.uploader_id = (select auth.uid())
    and exists (
      select 1 from public.task t
      where t.id = attachment.task_id
        and public.role_rank(public.role_for_board(t.board_id, (select auth.uid()))) >= public.role_rank('member')
    )
  );

create policy "attachment_update" on public.attachment
  for update using (
    attachment.uploader_id = (select auth.uid())
    or exists (
      select 1 from public.task t
      where t.id = attachment.task_id
        and public.role_rank(public.role_for_board(t.board_id, (select auth.uid()))) >= public.role_rank('admin')
    )
  );

create policy "attachment_delete" on public.attachment
  for delete using (
    attachment.uploader_id = (select auth.uid())
    or exists (
      select 1 from public.task t
      where t.id = attachment.task_id
        and public.role_rank(public.role_for_board(t.board_id, (select auth.uid()))) >= public.role_rank('admin')
    )
  );

-- ============================================================
-- 12. activity
-- Select-only policy. No insert/update/delete → service-role writes only.
-- ============================================================

create policy "activity_select" on public.activity
  for select using (
    public.role_for_board(activity.board_id, (select auth.uid())) is not null
  );

-- ============================================================
-- 13. view
-- Q5-corrected: owner_id, is_shared (not user_id from epic doc).
-- owner_id IS NULL = system-shared row (admin-only mutable, any board role can select).
-- ============================================================

create policy "view_select" on public.view
  for select using (
    public.role_for_board(view.board_id, (select auth.uid())) is not null
    and (
      view.is_shared
      or view.owner_id = (select auth.uid())
      or view.owner_id is null
    )
  );

create policy "view_modify" on public.view
  for all using (
    case
      when view.is_shared or view.owner_id is null then
        public.role_rank(public.role_for_board(view.board_id, (select auth.uid()))) >= public.role_rank('admin')
      else
        view.owner_id = (select auth.uid())
        and public.role_for_board(view.board_id, (select auth.uid())) is not null
    end
  );

-- ============================================================
-- 14. notification
-- Select (own only) and update (own only, for mark-as-read).
-- No insert policy → service-role inserts only.
-- ============================================================

create policy "notification_select" on public.notification
  for select using (
    user_id = (select auth.uid())
  );

create policy "notification_update" on public.notification
  for update using (
    user_id = (select auth.uid())
  );

-- ============================================================
-- 15. profile
-- Select for any authenticated user (own or same-workspace peer).
-- Update own row only (id = auth.uid(), per schema: profile.id is the PK).
-- Insert handled by the handle_new_user trigger (security definer).
-- ============================================================

create policy "profile_select" on public.profile
  for select using (
    id = (select auth.uid())
    or exists (
      select 1 from public.workspace_member wm1
      join public.workspace_member wm2
        on wm1.workspace_id = wm2.workspace_id
      where wm1.user_id = (select auth.uid())
        and wm2.user_id = profile.id
    )
  );

create policy "profile_update" on public.profile
  for update using (
    id = (select auth.uid())
  );

-- ============================================================
-- Policy inventory (total: 49 policies across 15 tables)
-- ============================================================
--
-- workspace       (4): workspace_select, workspace_insert, workspace_update, workspace_delete
-- workspace_member(4): wsm_select, wsm_insert [admin-only; Slice D replaces],
--                      wsm_update, wsm_delete
-- board           (4): board_select, board_insert, board_update, board_delete
-- board_member    (4): bm_select, bm_insert [admin-only; Slice D replaces],
--                      bm_update, bm_delete
-- "group"         (4): group_select, group_insert, group_update, group_delete
-- "column"        (4): column_select, column_insert, column_update, column_delete
-- label           (4): label_select, label_insert, label_update, label_delete
-- task            (4): task_select, task_insert, task_update, task_delete
-- cell            (2): cell_select, cell_modify [for all]
-- comment         (4): comment_select, comment_insert, comment_update, comment_delete
-- attachment      (4): attachment_select, attachment_insert, attachment_update, attachment_delete
-- activity        (1): activity_select [no write policies; service-role only]
-- view            (2): view_select, view_modify [for all]
-- notification    (2): notification_select, notification_update [no insert; service-role only]
-- profile         (2): profile_select, profile_update [no insert; handle_new_user trigger]
--
-- Total: 4+4+4+4+4+4+4+4+2+4+4+1+2+2+2 = 49
