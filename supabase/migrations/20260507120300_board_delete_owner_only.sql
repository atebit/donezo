-- ============================================================
-- Epic 04 — Followup F1.1: tighten board_delete to workspace-owner-only
-- Per epic doc § Definition of done: "A board admin can update the
-- board's title but not delete it (workspace owner only)."
-- The original Slice B policy used role_rank(role_for_board(...)) >= 'admin',
-- which incorrectly admits board admins and even board-only owners.
-- This migration drops that policy and recreates it with a direct
-- workspace_member lookup (role_for_board cannot be used because it
-- returns the MAX of workspace and board roles — a board_member with
-- role='owner' would pass an >= 'owner' rank check, which we don't want).
-- ============================================================

drop policy if exists "board_delete" on public.board;

create policy "board_delete" on public.board for delete using (
  exists (
    select 1 from public.workspace_member wm
     where wm.workspace_id = board.workspace_id
       and wm.user_id = (select auth.uid())
       and wm.role = 'owner'
  )
);
