-- ============================================================
-- Epic 09 — Slice A
-- RLS policies for comment_reaction
-- ============================================================

-- SELECT: any board role can see reactions on comments in that board.
create policy "comment_reaction_select" on public.comment_reaction
  for select using (
    public.role_for_board(comment_reaction.board_id, (select auth.uid())) is not null
  );

-- INSERT: user can insert only their own reaction; must be board member or higher.
create policy "comment_reaction_insert" on public.comment_reaction
  for insert with check (
    comment_reaction.user_id = (select auth.uid())
    and public.role_rank(public.role_for_board(comment_reaction.board_id, (select auth.uid())))
        >= public.role_rank('member')
  );

-- DELETE: user can delete only their own reaction.
create policy "comment_reaction_delete" on public.comment_reaction
  for delete using (
    comment_reaction.user_id = (select auth.uid())
  );

-- No UPDATE policy — reactions are immutable. Toggle = insert/delete.
