-- Epic 08 — denormalize board_id onto cell + comment so Realtime postgres_changes
-- can filter board_id=eq.<id>. Defense-in-depth consistency triggers mirror the
-- existing task_board_id_consistency pattern.

-- 1. Add columns (nullable initially so backfill can run before NOT NULL is enforced).
alter table public.cell    add column board_id uuid references public.board(id) on delete cascade;
alter table public.comment add column board_id uuid references public.board(id) on delete cascade;

-- 2. Backfill from task.board_id (task already carries it, kept in sync by task_board_id_consistency).
update public.cell    set board_id = (select board_id from public.task where id = cell.task_id);
update public.comment set board_id = (select board_id from public.task where id = comment.task_id);

-- 3. Enforce NOT NULL post-backfill.
alter table public.cell    alter column board_id set not null;
alter table public.comment alter column board_id set not null;

-- 4. Indexes for the filter and for FK joins.
create index cell_board_idx    on public.cell(board_id);
create index comment_board_idx on public.comment(board_id);

-- 5. Defense-in-depth consistency triggers — mirror task_board_id_consistency
--    pattern from the initial schema migration (lines 398–408). These derive
--    board_id from the parent task on insert/update, so even a buggy server
--    action that forgets to set board_id cannot break the invariant.
create or replace function public.cell_board_id_consistency()
returns trigger language plpgsql as $$
begin
  new.board_id = (select board_id from public.task where id = new.task_id);
  return new;
end $$;

create trigger cell_board_id_consistency
  before insert or update of task_id on public.cell
  for each row execute function public.cell_board_id_consistency();

create or replace function public.comment_board_id_consistency()
returns trigger language plpgsql as $$
begin
  new.board_id = (select board_id from public.task where id = new.task_id);
  return new;
end $$;

create trigger comment_board_id_consistency
  before insert or update of task_id on public.comment
  for each row execute function public.comment_board_id_consistency();
