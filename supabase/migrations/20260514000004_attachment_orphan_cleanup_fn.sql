create or replace function public.purge_orphan_attachments()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  removed int;
begin
  with deleted as (
    delete from public.attachment
    where is_uploaded = false
      and created_at < now() - interval '1 hour'
    returning 1
  )
  select count(*) into removed from deleted;
  return removed;
end $$;

revoke all on function public.purge_orphan_attachments() from public;
grant execute on function public.purge_orphan_attachments() to service_role;
