-- Soft-delete tasks via SECURITY DEFINER RPCs.
--
-- Why: task soft-delete is `update task set deleted_at = now()`. The
-- `task_select` policy requires `deleted_at is null`, and Postgres enforces the
-- SELECT policy against the post-update row during an UPDATE, so the soft-delete
-- write itself fails with "new row violates row-level security policy for table
-- task". Routing the write through a SECURITY DEFINER function (with its own
-- board-role check) is the canonical fix and matches the existing privileged-RPC
-- pattern in this repo.

create or replace function public.soft_delete_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board uuid;
begin
  select board_id into v_board
    from public.task
   where id = p_task_id and deleted_at is null;

  if v_board is null then
    raise exception 'task not found' using errcode = 'NTFND';
  end if;

  if public.role_rank(public.role_for_board(v_board, (select auth.uid())))
       < public.role_rank('member') then
    raise exception 'insufficient permissions' using errcode = '42501';
  end if;

  update public.task
     set deleted_at = now(), updated_by = (select auth.uid())
   where id = p_task_id and deleted_at is null;

  return p_task_id;
end $$;

create or replace function public.soft_delete_tasks(p_task_ids uuid[])
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_board_count int;
  v_board uuid;
begin
  select count(distinct board_id) into v_board_count
    from public.task
   where id = any(p_task_ids) and deleted_at is null;

  if v_board_count = 0 then
    raise exception 'no live tasks found' using errcode = 'NTFND';
  end if;
  if v_board_count > 1 then
    raise exception 'tasks span multiple boards' using errcode = '22023';
  end if;

  select distinct board_id into v_board
    from public.task
   where id = any(p_task_ids) and deleted_at is null;

  if public.role_rank(public.role_for_board(v_board, (select auth.uid())))
       < public.role_rank('member') then
    raise exception 'insufficient permissions' using errcode = '42501';
  end if;

  return query
    update public.task
       set deleted_at = now(), updated_by = (select auth.uid())
     where id = any(p_task_ids) and deleted_at is null
    returning id;
end $$;

grant execute on function public.soft_delete_task(uuid)    to authenticated;
grant execute on function public.soft_delete_tasks(uuid[]) to authenticated;
