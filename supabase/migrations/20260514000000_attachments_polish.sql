-- Epic 10 — schema additions for the attachments pipeline.

-- 1. Display filename (preserved across storage_path sanitization).
alter table public.attachment add column filename text;
update public.attachment set filename = regexp_replace(storage_path, '^.*/', '') where filename is null;
alter table public.attachment alter column filename set not null;

-- 2. Two-stage upload flag — server action confirmUpload flips this to true after HEAD-verifying
--    the storage object exists. UI lists only `is_uploaded = true` rows.
alter table public.attachment add column is_uploaded boolean not null default false;

-- 3. Virus-scan status (deferred scanning; default 'skipped' for v1).
alter table public.attachment add column scan_status text not null default 'skipped'
  check (scan_status in ('pending','clean','infected','skipped'));

-- 4. Realtime board-scoped filter — denormalized board_id mirrors Epic-08 pattern on cell/comment.
alter table public.attachment add column board_id uuid references public.board(id) on delete cascade;
update public.attachment set board_id = (select board_id from public.task where id = attachment.task_id);
alter table public.attachment alter column board_id set not null;
create index attachment_board_idx on public.attachment(board_id);

-- 5. Consistency trigger — derive board_id from parent task on insert/update of task_id.
--    Mirrors public.cell_board_id_consistency from migration 20260512000000.
create or replace function public.attachment_board_id_consistency()
returns trigger language plpgsql as $$
begin
  new.board_id = (select board_id from public.task where id = new.task_id);
  return new;
end $$;

create trigger attachment_board_id_consistency
  before insert or update of task_id on public.attachment
  for each row execute function public.attachment_board_id_consistency();

-- 6. Orphan-purge support: index pending rows by created_at.
create index attachment_pending_idx on public.attachment(is_uploaded, created_at)
  where is_uploaded = false;
