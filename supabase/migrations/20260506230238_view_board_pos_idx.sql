-- Restore the view.position column and its composite index, both dropped
-- from the initial migration. 02-supabase-schema.md § Schema specifies:
--   position numeric not null default 0
--   create index view_board_idx on public.view(board_id, position);
-- The bare view_board_idx (single column on board_id) from the initial
-- migration is left in place per the never-edit-deployed-migrations rule;
-- the composite ships here as view_board_pos_idx.
alter table public.view add column if not exists position numeric not null default 0;
create index if not exists view_board_pos_idx on public.view(board_id, position);
