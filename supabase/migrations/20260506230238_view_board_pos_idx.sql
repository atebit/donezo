-- Composite index: board + position for ordered view-picker rendering.
-- Restores the index defined in 02-supabase-schema.md § Schema (line ~423)
-- that was unintentionally dropped to (board_id) alone in the initial migration.
create index if not exists view_board_pos_idx on public.view(board_id, position);
