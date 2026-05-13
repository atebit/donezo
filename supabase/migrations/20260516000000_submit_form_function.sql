-- ============================================================
-- Epic 12 Slice F — submit_form SECURITY DEFINER function
--
-- Implements Q24 option (b): a SECURITY DEFINER SQL function that allows
-- viewer-role board members to submit a form (creating a task + cells)
-- without granting them broader INSERT privileges on task or cell.
--
-- Authorization model:
--   The function checks role_for_board(p_board_id, auth.uid()) IS NOT NULL,
--   meaning any board member (viewer, member, admin, owner) may submit.
--   The elevated privileges come from SECURITY DEFINER (runs as the function
--   owner, not as the authenticated role), so RLS INSERT policies on `task`
--   and `cell` that require >= member do not block viewer submits.
--
-- MEMORY note: SECURITY DEFINER functions MUST set search_path explicitly to
--   prevent search_path injection attacks. We set it to public, pg_temp.
--
-- Signature:
--   submit_form(
--     p_board_id uuid,
--     p_view_id  uuid,
--     p_group_id uuid,
--     p_values   jsonb   -- array of {column_id, value_type, value_json}
--   ) RETURNS uuid       -- the new task id
--
-- p_values element shape:
--   {
--     "column_id":     "<uuid>",
--     "text_value":    "<string | null>",
--     "number_value":  <number | null>,
--     "boolean_value": <boolean | null>,
--     "date_value":    "<iso_string | null>",
--     "date_end_value": "<iso_string | null>",
--     "label_id":      "<uuid | null>",
--     "json_value":    <json | null>
--   }
--
-- The server action (submitForm) extracts each column's value type using
-- the cell registry's toRow() and passes the full column payload here.
-- The function inserts exactly the fields it receives; unused value columns
-- default to null (upsert sets them explicitly for clarity).
-- ============================================================

create or replace function public.submit_form(
  p_board_id   uuid,
  p_view_id    uuid,
  p_group_id   uuid,
  p_values     jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id    uuid;
  v_role       text;
  v_task_id    uuid;
  v_max_pos    numeric;
  v_col_id     uuid;
  v_elem       jsonb;
begin
  -- 1. Resolve the calling user.
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'submit_form: unauthenticated' using errcode = '42501';
  end if;

  -- 2. Membership check — any board role (viewer+) may submit.
  v_role := public.role_for_board(p_board_id, v_user_id);
  if v_role is null then
    raise exception 'submit_form: not a board member' using errcode = '42501';
  end if;

  -- 3. Verify the target group belongs to the specified board (cross-board safety).
  if not exists (
    select 1 from public."group"
     where id = p_group_id
       and board_id = p_board_id
       and deleted_at is null
  ) then
    raise exception 'submit_form: group not found or belongs to different board'
      using errcode = '42501';
  end if;

  -- 4. Compute an end-of-list position in the target group.
  select coalesce(max(position), 0) + 1
    into v_max_pos
    from public.task
   where group_id = p_group_id
     and deleted_at is null;

  -- 5. Insert the new task.
  --    board_id is explicitly provided here; the task_board_id_consistency
  --    BEFORE INSERT trigger will also set it from group_id (defense in depth).
  insert into public.task (
    group_id,
    board_id,
    title,
    position,
    created_by,
    updated_by
  ) values (
    p_group_id,
    p_board_id,
    '',
    v_max_pos,
    v_user_id,
    v_user_id
  )
  returning id into v_task_id;

  -- 6. Upsert cells from p_values (one element per field).
  --    The server action passes a pre-processed jsonb array where each element
  --    contains exactly the cell row columns to write (others are null).
  if jsonb_typeof(p_values) = 'array' then
    for v_elem in select jsonb_array_elements(p_values) loop
      -- Skip elements with no column_id.
      if v_elem->>'column_id' is null then
        continue;
      end if;

      v_col_id := (v_elem->>'column_id')::uuid;

      -- Verify the column belongs to this board (security check).
      if not exists (
        select 1 from public."column"
         where id = v_col_id and board_id = p_board_id
      ) then
        continue;  -- silently skip columns that don't belong to this board
      end if;

      insert into public.cell (
        task_id,
        column_id,
        board_id,
        text_value,
        number_value,
        boolean_value,
        date_value,
        date_end_value,
        label_id,
        json_value,
        updated_by
      ) values (
        v_task_id,
        v_col_id,
        p_board_id,
        v_elem->>'text_value',
        (v_elem->>'number_value')::numeric,
        (v_elem->>'boolean_value')::boolean,
        (v_elem->>'date_value')::timestamptz,
        (v_elem->>'date_end_value')::timestamptz,
        case when v_elem->>'label_id' is not null
             then (v_elem->>'label_id')::uuid
             else null end,
        v_elem->'json_value',
        v_user_id
      )
      on conflict (task_id, column_id) do update set
        board_id       = excluded.board_id,
        text_value     = excluded.text_value,
        number_value   = excluded.number_value,
        boolean_value  = excluded.boolean_value,
        date_value     = excluded.date_value,
        date_end_value = excluded.date_end_value,
        label_id       = excluded.label_id,
        json_value     = excluded.json_value,
        updated_by     = excluded.updated_by;
    end loop;
  end if;

  -- 7. Log activity (best-effort — never fails the function).
  begin
    insert into public.activity (
      board_id,
      task_id,
      actor_id,
      type,
      payload
    ) values (
      p_board_id,
      v_task_id,
      v_user_id,
      'task.created_via_form',
      jsonb_build_object(
        'view_id',  p_view_id,
        'group_id', p_group_id
      )
    );
  exception when others then
    -- Swallow; activity log is best-effort.
    null;
  end;

  return v_task_id;
end $$;

-- Grant execute to authenticated users.
-- anon is excluded: the form route is internal-only (auth-gated at the Next.js level).
grant execute on function public.submit_form(uuid, uuid, uuid, jsonb) to authenticated;
