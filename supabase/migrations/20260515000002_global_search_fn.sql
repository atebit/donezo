-- Epic 11 — global search across boards + tasks in a workspace.
-- security invoker so RLS still enforces visibility for the calling user.

create or replace function public.global_search(p_workspace_id uuid, q text)
returns table(
  kind text,
  id uuid,
  title text,
  board_id uuid,
  board_title text
)
language sql stable security invoker
set search_path = public
as $$
  select 'board' as kind, b.id, b.name as title, b.id as board_id, b.name as board_title
    from public.board b
   where b.workspace_id = p_workspace_id
     and b.name ilike '%' || q || '%'
     and b.deleted_at is null
  union all
  select 'task' as kind, t.id, t.title, t.board_id, b.name as board_title
    from public.task t
    join public.board b on b.id = t.board_id
   where b.workspace_id = p_workspace_id
     and t.title ilike '%' || q || '%'
     and t.deleted_at is null
     and b.deleted_at is null
  order by 1, 3
  limit 20;
$$;

grant execute on function public.global_search(uuid, text) to authenticated;
