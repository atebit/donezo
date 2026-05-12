-- Storage RLS policies on storage.objects for the 'attachments' bucket.
-- Pattern: derive board_id from the first path segment, authorize via role_for_board.
-- Path layout: <board_id>/<task_id>/<attachment_id>/<filename>

create policy "attachment_read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'attachments'
  and public.role_for_board(((storage.foldername(name))[1])::uuid, auth.uid()) is not null
);

create policy "attachment_write"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'attachments'
  and public.role_rank(
        public.role_for_board(((storage.foldername(name))[1])::uuid, auth.uid())
      ) >= public.role_rank('member')
);

create policy "attachment_delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'attachments'
  and exists (
    select 1
    from public.attachment a
    join public.task t on t.id = a.task_id
    where a.storage_path = storage.objects.name
      and (a.uploader_id = auth.uid()
           or public.role_rank(public.role_for_board(t.board_id, auth.uid())) >= public.role_rank('admin'))
  )
);

-- No UPDATE policy on storage.objects — attachments are immutable. Replace = delete + insert.
