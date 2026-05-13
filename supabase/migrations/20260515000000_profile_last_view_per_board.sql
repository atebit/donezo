-- Epic 11 — per-user "last opened view" memory, scoped per board.
-- Map: { [boardId: uuid]: viewId: uuid }.
alter table public.profile
  add column last_view_per_board jsonb not null default '{}'::jsonb;

-- No index needed; only ever fetched as profile.last_view_per_board for auth.uid().
-- No GIN — we read the whole jsonb on profile load.
