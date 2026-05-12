-- ============================================================
-- Epic 09 — Slice A
-- comment_reaction table + activity publication
-- ============================================================

-- comment_reaction: one row per (comment, user, emoji); reactions are immutable
-- (toggle = insert/delete). board_id is denormalized for realtime board-scoped filters.
create table public.comment_reaction (
  comment_id uuid not null references public.comment(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null,
  board_id   uuid not null references public.board(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);

create index comment_reaction_comment_idx on public.comment_reaction(comment_id);
create index comment_reaction_board_idx on public.comment_reaction(board_id);

-- Defense-in-depth: board_id always matches the parent comment's board_id.
-- Mirrors the cell_board_id_consistency trigger from Epic 08.
create or replace function public.comment_reaction_board_id_consistency()
returns trigger language plpgsql as $$
begin
  new.board_id = (select c.board_id from public.comment c where c.id = new.comment_id);
  return new;
end $$;

create trigger comment_reaction_board_id_consistency
  before insert or update of comment_id on public.comment_reaction
  for each row execute function public.comment_reaction_board_id_consistency();

alter table public.comment_reaction enable row level security;

-- Realtime: publish reactions for board-scoped postgres_changes.
alter publication supabase_realtime add table public.comment_reaction;

-- Activity was NOT added to supabase_realtime in epic 02. Per-task Activity tab
-- needs live updates. Slice C subscribes to this; without the publication entry,
-- subscriptions are silent.
alter publication supabase_realtime add table public.activity;
