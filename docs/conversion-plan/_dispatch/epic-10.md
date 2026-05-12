# Epic 10 — Dispatch (auto-approved by scheduled task)

> Approved by autonomous scheduled task on 2026-05-12.
> Orchestrator: this user was not online, so the scheduled task accepted the epic-researcher's recommended defaults on every open question. Decisions captured below; executors should treat them as authoritative.

## Autonomous decisions

All 20 open questions from the researcher's plan were resolved per the researcher's recommended default. The substantive ones:

- **Q1 — `uploader_id` vs `uploaded_by`:** standardize on `uploader_id` (matches deployed schema). Every slice uses `uploader_id`.
- **Q2 — denormalized `board_id` on `attachment`:** ADD it. Required so realtime board channels can filter attachment events.
- **Q3 — `filename` column:** ADD `text not null`.
- **Q4 — `is_uploaded` + `scan_status` columns:** ADD both, with the partial pending index for the orphan sweeper.
- **Q5 — upload path:** direct client PUT to a signed-upload URL; server-action `requestUpload`/`confirmUpload` pair.
- **Q6 — MIME/size limits:** 50 MB cap, MIME allowlist per epic doc.
- **Q7 — bucket layout:** private bucket `attachments`, path `<board_id>/<task_id>/<attachment_id>/<filename>`.
- **Q8 — image transforms:** use Supabase image-render endpoint for v1 (no Edge Function).
- **Q9 — EXIF stripping:** **DEFER to a followup epic.** This was the only question the researcher flagged as scope-affecting enough to escalate. The autonomous decision is to ship v1 without EXIF stripping to stay aligned with MVP scope; a followup slice or Epic 14 polish can land it later. Note: this is documented in `_dispatch/epic-10.md` so it can be revisited.
- **Q10 — virus scanning:** wire schema columns now (`scan_status default 'skipped'`), no scanner Edge Function in v1.
- **Q11 — PDF preview:** native `<embed>` with Download fallback.
- **Q12 — image lightbox:** hand-rolled Base UI Dialog + keyboard arrows (no `react-zoom-pan-pinch`).
- **Q13 — orphan-cleanup schedule:** ship the SQL function in this epic; defer pg_cron / Edge-Function scheduling to a post-merge ops step (not blocking epic merge).
- **Q14 — comment image embed:** Tiptap Image extension with custom attrs `{ attachmentId, alt }`; NodeView fetches signed URLs at render.
- **Q15 — per-board / per-workspace size caps:** out of scope for v1.
- **Q16 — file cell value shape:** keep `{ attachmentIds: string[] }`.
- **Q17 — per-board attachment fetch:** add `board.attachments` round-trip in board page, mirror existing comments hydration.
- **Q18 — activity entries:** YES — `attachment.uploaded` + `attachment.deleted`.
- **Q19 — sanitized filename in storage path:** keep original `filename` in DB; storage path uses `[a-zA-Z0-9._-]+` sanitization.
- **Q20 — storage RLS test harness:** pgTAP spec under `tests/policies/`.

Deferred to followup work (do NOT in-scope this epic):
- EXIF stripping (Q9).
- Linking comment ↔ attachment via `comment_id` on the post-create flip (researcher risk note #4).
- Orphan-storage-object reconciliation (researcher risk note #8).
- Realtime back-pressure tuning (researcher risk note #7).

---


# Epic 10: Attachments & File Storage — Dispatch Plan

## Preconditions verified

**Merged dependencies:**

- Epic 02 — schema. `public.attachment` table exists at `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260506224930_initial_schema.sql:286-298`. **Important divergence from the epic doc:** the column is `uploader_id` (not `uploaded_by`), there is a nullable `comment_id` FK already in place (epic 02's `_dispatch/epic-02.md` Q17), and the columns `filename`, `is_uploaded`, `scan_status`, and `board_id` are **all absent**. The epic doc's SQL snippets reference `uploaded_by` — the dispatch must standardize on `uploader_id`.
- Epic 03 — `avatars` bucket + 4 storage RLS policies already provisioned (`20260507003509_avatars_bucket.sql`). Avatar upload flow is **already wired and working** in `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/account/actions.ts` (`_uploadAvatar`) and the corresponding UI in `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/account/account-settings.tsx` (`AvatarSection`). The epic doc Task 6 ("Wire avatar upload") is therefore a verify-only step, not net-new work.
- Epic 04 — RLS for `attachment` exists in `20260507120100_rls_policies.sql:334-371` (select/insert/update/delete). Helpers `role_for_board`, `role_rank`, and `greater_role` ship in `20260507120000_authz_helpers.sql`.
- Epic 06 — `lib/activity.ts` activity logger uses `adminClient()`, accepts `type` (NOT `action` — preserved naming), and is best-effort.
- Epic 07 — file cell type is registered (`lib/cells/registry.ts:63`), with a stub `Cell` (count badge) and a disabled `Editor` (tooltip "Coming in epic 10") at `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/{Cell,Editor,def}.tsx`. Value shape: `{ attachmentIds: string[] }` stored in `cell.json_value`. `editorMode: "inline"` is the current placeholder; Epic 10 may switch this to `"popover"` to use the orchestrator-provided Popover shell.
- Epic 08 — Realtime channel `board:<boardId>` lives in `hooks/use-board-realtime.ts`. Postgres-changes are filtered by `board_id=eq.<id>`, so to broadcast attachment inserts/deletes we must add a denormalized `board_id` column on `attachment` (mirroring the Epic-08 pattern from `cell` and `comment`).
- Epic 09 — Task drawer shell `<TaskDrawer>` is shipped at `/Volumes/SSD1T/DEV WORK/donezo/components/board/TaskDrawer.tsx` with three tabs. `FilesTab` is a placeholder at `/Volumes/SSD1T/DEV WORK/donezo/components/board/tabs/FilesTab.tsx` ("Attachments coming soon (Epic 10)"). Both the intercepting route `app/(app)/.../@modal/(.)t/[taskId]/page.tsx` and the full-page route `t/[taskId]/page.tsx` exist and currently fetch comments / reactions / activity in parallel — Epic 10 must add an attachments fetch here. `<RichTextEditor>` already ships with an `imagePastePluginKey` no-op seam at `components/rich-text/RichTextEditor.tsx:30-74` explicitly waiting on Epic 10 to wire to storage upload.

**Stack defaults present:**

- `pnpm` package manager. `@base-ui/react`, Tiptap 3.23, Zod 4, RHF 7.75, Zustand 5, sonner, dnd-kit, frimousse all installed (`package.json`).
- **Not installed** (Epic 10 will add): `react-dropzone`, an image-zoom/pan lib (epic doc suggests `react-zoom-pan-pinch` but doesn't lock it), `@tiptap/extension-image`. `react-pdf` is explicitly deferred per epic doc; PDFs use native `<embed>`.
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (optional in schema; required for admin-client storage HEAD checks) — all present in `lib/env.ts`. No new env vars required for v1.
- pgTAP tests live under `tests/policies/`; vitest unit tests under `tests/unit/`. Storage-policy testing has no precedent in this repo — must use SQL-level assertions (set local jwt claims, attempt storage.objects writes) per Epic 04 pattern.

**Files already wired and waiting on Epic 10:**

- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Editor.tsx` — disabled stub. Will be replaced.
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/tabs/FilesTab.tsx` — placeholder. Will be replaced.
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/RichTextEditor.tsx:30-74` — `buildImagePastePlugin` is a no-op that warns in dev. Replace with real upload pipeline (or via `extraExtensions` from a comment-specific wrapper — see slice E).

## Open questions for the user

Each question has a **recommended default** (so the orchestrator can auto-approve sensible defaults); items flagged **NEEDS USER** are scope-affecting enough that I won't pick.

1. **Attachment column naming on RLS migration: `uploader_id` (repo) vs `uploaded_by` (epic doc).**
   **Default:** Use `uploader_id` everywhere. The schema is already deployed, all RLS policies reference `uploader_id`, and renaming a column at this point is pure churn. Update the dispatch language so every slice spec uses `uploader_id`. (No user input needed; this is a doc-vs-reality reconciliation only.)

2. **Add `board_id` denormalization on `attachment` for Realtime?**
   **Default:** Yes. Mirror the Epic-08 pattern on `cell`/`comment`: nullable column, backfill from `task.board_id`, set NOT NULL, add a `before insert or update of task_id` consistency trigger, add `board_id` index, add `public.attachment` to `supabase_realtime` publication. Without this, attachment inserts/deletes can't reach a board-scoped channel and the "drag a file → other tab sees it" DoD item fails. (No user input needed.)

3. **Add `filename` column to `attachment`?**
   **Default:** Yes. The schema currently has no human filename — only `storage_path`. The epic doc treats `filename` as a first-class display field (downloads with original name, lightbox titles, etc.). Add as `text not null` in the same polish migration. (No user input needed.)

4. **`is_uploaded` + `scan_status` columns per epic doc?**
   **Default:** Yes to both. `is_uploaded boolean not null default false` is load-bearing for the two-stage request/confirm flow. `scan_status text not null default 'skipped' check (in ('pending','clean','infected','skipped'))` lets future virus scanning land without another migration. Add the partial index `attachment_pending_idx on (is_uploaded, created_at) where is_uploaded = false` for the cleanup sweeper. (No user input needed.)

5. **Direct-client upload (signed URL PUT) vs streaming through a server action?**
   **Default:** Direct client upload, server-action `requestUpload` issues the signed-upload URL after authz + size/mime checks, server-action `confirmUpload` validates the object exists in Storage (HEAD via admin client) and flips `is_uploaded = true`. This matches the epic doc verbatim and avoids Vercel bandwidth. (No user input needed.)

6. **Allowed MIME types and max size for v1.**
   **Default:** 50 MB cap on `attachments` bucket. Allowed types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`, `application/pdf`, `text/plain`, `text/markdown`, `text/csv`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/zip`. Server action also rejects anything starting with `application/x-` or `application/javascript`. (No user input needed; matches epic doc verbatim.)

7. **Storage bucket name + path layout.**
   **Default:** Bucket `attachments`, private. Path `<board_id>/<task_id>/<attachment_id>/<filename>`. This matches the epic doc — including `board_id` as the first path segment is what lets Storage RLS authorize writes via `role_for_board(((storage.foldername(name))[1])::uuid, auth.uid())`. (No user input needed.)

8. **Image transformations: Supabase render endpoint vs pre-generated thumbnails?**
   **Default:** Supabase image-transform endpoint (`/storage/v1/render/image/sign/attachments/...?width=N`) for v1. Free on the Pro tier, no Edge Function to ship. Flag for re-evaluation if bandwidth costs spike. (No user input needed; matches epic doc.)

9. **EXIF stripping on image upload?** Epic doc Open Question.
   **NEEDS USER.** The doc itself flags this as "Recommend doing this in v1 — small, high value" but doesn't lock it. Server-side EXIF stripping requires a Supabase Edge Function (Sharp/Deno-image) or a Vercel-side serverless transform — both add infra. **My recommendation:** defer to a small followup epic (call it 10.5 or fold into Epic 14 polish) so v1 ships sooner. Flag this so the user can confirm whether to in-scope it now.

10. **Virus scanning hook activation in v1?**
    **Default:** Add schema and `scan_status` column wiring (already covered in Q4), but leave `default 'skipped'` and don't ship a scanner Edge Function. UI shows the file as available regardless of `scan_status`. When/if scanning is enabled, default flips to `'pending'` and download/preview gates on `'clean'`. (No user input needed; matches epic doc verbatim.)

11. **PDF preview library.**
    **Default:** Native `<embed>` for v1 with a "Download" fallback button. No `react-pdf` install. (No user input needed; matches epic doc.)

12. **Image lightbox: `react-zoom-pan-pinch` vs hand-rolled?**
    **Default:** Hand-rolled minimal lightbox using shadcn/Base UI Dialog + native CSS `object-fit: contain` + keyboard arrows for next/prev across the task's images. Adds zero dependencies. Zoom/pan can land in Epic 14 polish if users ask. (Senior-eng default; the epic doc itself says "or hand-rolled".)

13. **Orphan-cleanup scheduling.**
    **Default:** Ship the cleanup SQL function in this epic; schedule it via pg_cron (Supabase supports the `pg_cron` extension on Pro tier). If pg_cron isn't available on the user's plan, expose the function as a Supabase Edge Function reachable from Vercel Cron and document. (No user input needed for the code; flag during landing if scheduling needs the user to enable pg_cron in the dashboard.)

14. **Comment image embed: Tiptap `attachment_id`-attribute node vs. inline URL?**
    **Default:** Per epic doc — Tiptap Image extension is configured with custom attrs `{ attachmentId, alt }`. The renderer fetches a signed URL on render via a server action `getSignedDisplayUrl`. Don't store signed URLs in the body JSON (they expire). (No user input needed.)

15. **Per-board / per-workspace size limits.**
    **Default:** Out of scope for v1. Global 50 MB cap. Schema is forward-compatible; can add `workspace.attachment_size_limit_bytes` later. (Matches epic doc.)

16. **File-column cell value: keep `{ attachmentIds: string[] }` shape?**
    **Default:** Yes, exactly the current shape from `components/cells/file/def.ts:23`. The renderer joins `attachmentIds` to attachment rows fetched alongside the board (see slice C). New uploads inserted via the file-cell editor append to `attachmentIds` via the existing `setCellValue` server action. (No user input needed.)

17. **Where does the per-board attachment fetch live?**
    **Default:** Add a `board.attachments` round-trip in `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` after the cells fetch, filtered by `board_id = <boardId>` and `is_uploaded = true`. Hydrate into a new `attachmentsByTask: Map<string, AttachmentRow[]>` slice on the board store. (No user input needed; mirrors how comments hydrate in the task drawer pages.)

18. **Do we ship an "Activity log" entry for attachment uploads/deletes in this epic?**
    **Default:** Yes — `attachment.uploaded` and `attachment.deleted` activity types, added to the `ActivityType` union in `lib/activity.ts` and an activity-renderer per the Epic-09 pattern. Activity feed already lives in `components/activity/`; one renderer file per action. (No user input needed; matches epic doc.)

19. **"Stable filename" within `storage_path`.**
    **Default:** Path filename component = original filename sanitized to `[a-zA-Z0-9._-]+` with whitespace → `_`. The DB `filename` column preserves the original display name. This avoids collisions and bad path chars without losing the user-visible name. (Senior-eng default; epic doc is silent on this.)

20. **Storage RLS policy testing harness.**
    **Default:** Add pgTAP specs in `tests/policies/attachment_storage_rls.spec.sql` that simulate `auth.uid()` and attempt `storage.objects` inserts/selects/deletes with various board-role memberships. The test setup files (`00_setup.sql`, etc.) already provide the role-as-user pattern. (No user input needed.)

## Stack reminders (CLAUDE.md — do not drift)

- pnpm only.
- Next.js 15 App Router, RSC-first. `"use client"` only for interactivity.
- **Server Actions** for mutations. **No `/api` route handlers** except webhooks. (The attachment-image renderer fetches signed URLs via a server action, not a route handler.)
- TypeScript strict; regen Supabase types via `pnpm db:types`.
- Tailwind v4 + shadcn/ui + Base UI (`@base-ui/react`) primitives. No MUI, no SCSS.
- Forms: React Hook Form + Zod v4. One schema validates client + server.
- DnD: dnd-kit. Rich text: Tiptap. Tables: TanStack Table+Virtual. Toasts: sonner.
- RLS is the source of truth for auth. Service role only via `adminClient()`, server-only.
- All ids `uuid v4` from Postgres `gen_random_uuid()`. All times `timestamptz`. Activity column is `type` (NOT `action`).
- Soft delete via `deleted_at timestamptz null` for parent entities; attachments use **hard delete** (storage object goes away too).
- Migrations under `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Next free timestamp: `>20260513000001`.
- Server actions in `app/**/actions.ts` next to the route.

---

## Stage 1 — five parallel slices, A is the blocker

Slice A (schema + storage buckets + RLS) is the only Stage-1 pre-req for the others. B, C, D, E run in parallel after A merges. Slice F (Stage 2) waits on all of A–E and is the integration pass. Slice G (Stage 3) is the e2e and the avatar-flow verification — only after F.

---

### Slice A — Schema polish, storage buckets, storage RLS, types

**Branch:** `epic/10-attachments/a-storage-foundation`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260514000000_attachments_polish.sql` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260514000001_attachments_bucket.sql` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260514000002_attachments_storage_rls.sql` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260514000003_attachments_realtime_publication.sql` (new — `alter publication supabase_realtime add table public.attachment`)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260514000004_attachment_orphan_cleanup_fn.sql` (new — `purge_orphan_attachments()`)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/types.ts` (regen via `pnpm db:reset && pnpm db:types`)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/activity.ts` (extend `ActivityType` union only — append `attachment.uploaded`, `attachment.deleted`, with JSDoc payload table)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/attachment_storage_rls.spec.sql` (new pgTAP — storage RLS)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/attachment_board_id_consistency.spec.sql` (new pgTAP — trigger)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/attachment_orphan_cleanup.spec.sql` (new pgTAP — cleanup fn)

**Forbidden:** Any file under `app/`, `components/`, `hooks/`, `stores/`, `lib/` other than `lib/activity.ts` and `lib/supabase/types.ts`. No edits to existing RLS policies on `public.attachment` (those stay correct; this slice only adds storage-bucket policies and schema columns).

**Depends on:** none.

**Spec (self-contained):**

#### A.1 — Migration: `20260514000000_attachments_polish.sql`

```sql
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
```

#### A.2 — Migration: `20260514000001_attachments_bucket.sql`

```sql
-- attachments bucket: private, 50 MB cap, mime allowlist.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  52428800, -- 50 MB
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/svg+xml',
    'application/pdf',
    'text/plain','text/markdown','text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
```

#### A.3 — Migration: `20260514000002_attachments_storage_rls.sql`

```sql
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
```

#### A.4 — Migration: `20260514000003_attachments_realtime_publication.sql`

```sql
alter publication supabase_realtime add table public.attachment;
```

#### A.5 — Migration: `20260514000004_attachment_orphan_cleanup_fn.sql`

```sql
-- Hourly cleanup function. Schedule via pg_cron after deployment, or via a Supabase
-- Edge Function invoked by Vercel Cron. Function does NOT touch storage objects —
-- it only removes DB rows for never-confirmed pending uploads. Storage objects are
-- cleaned best-effort by the deleteAttachment server action and accept some drift.

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
```

#### A.6 — Type regen

Run `pnpm db:reset && pnpm db:types`. Commit the regenerated `lib/supabase/types.ts`. Verify:
- `attachment.filename`, `attachment.is_uploaded`, `attachment.scan_status`, `attachment.board_id` are all present and non-null.
- `Database["public"]["Functions"]["purge_orphan_attachments"]` is present.

#### A.7 — Activity vocabulary extension

Edit `lib/activity.ts`. Append to the `ActivityType` union (preserve all existing comment-activity JSDoc):

```ts
| "attachment.uploaded"
| "attachment.deleted"
```

Document payload shapes in a JSDoc block above the union:
- `attachment.uploaded`: `{ attachmentId: string; filename: string; mimeType: string; sizeBytes: number; viaCommentId?: string }` — `viaCommentId` set when uploaded via comment image-paste flow; absent when via file column or Files tab.
- `attachment.deleted`: `{ attachmentId: string; filename: string }`

#### A.8 — Tests

Add three pgTAP specs (model from `tests/policies/board_id_consistency.spec.sql`):

1. `attachment_storage_rls.spec.sql` — assertions:
   - A viewer of board X **cannot** insert into `storage.objects` for path `<X>/<task>/<att>/file.png`.
   - A viewer **can** select an existing object at `<X>/...`.
   - A non-member of board X **cannot** select an object at `<X>/...`.
   - A member of board X **can** insert.
   - The uploader of attachment A **can** delete the storage object; a different member **cannot**; an admin of the board **can**.

2. `attachment_board_id_consistency.spec.sql` — inserting an `attachment` with a wrong `board_id` results in the row landing with the parent task's `board_id` (trigger overwrites).

3. `attachment_orphan_cleanup.spec.sql` — `purge_orphan_attachments()` deletes only rows with `is_uploaded = false` and `created_at < now() - 1 hour`; leaves confirmed rows and recent pending rows untouched.

**Definition of done:**
- All five migrations apply cleanly on a fresh DB and on the current local DB.
- `attachments` bucket exists, private, 50 MB cap, mime-list applied.
- Storage RLS policies exist on `storage.objects` for the `attachments` bucket.
- `attachment` table has `filename`, `is_uploaded`, `scan_status`, `board_id` columns and a `before insert or update of task_id` trigger.
- `public.attachment` is a member of `supabase_realtime`.
- `purge_orphan_attachments()` returns an `int` and only the service role can execute it.
- `ActivityType` union includes the two new types with a JSDoc payload block.
- Generated types reflect all changes; `pnpm tsc --noEmit` is clean.
- pgTAP suite passes locally.

**Escalation triggers:**
- If `pnpm tsc --noEmit` surfaces breakage in files outside this slice's scope after type regen, stop and return a `needs-direction` report listing failures.
- If `storage.foldername(name)` does not return a usable array in the target Supabase version, surface as a coordination issue (this is the documented Storage helper but version drift has happened before).
- If the realtime publication can't be altered on the project (some Supabase plans require dashboard ops), surface — we may need to dashboard-apply.

---

### Slice B — Upload pipeline server actions + storage helpers

**Branch:** `epic/10-attachments/b-server-actions`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/lib/validations/attachment.ts` (new — Zod schemas)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/attachments/constants.ts` (new — `MAX_FILE_SIZE_BYTES`, `ALLOWED_MIME_TYPES` array, `SIGNED_UPLOAD_URL_TTL_SECONDS`, `SIGNED_DISPLAY_URL_TTL_SECONDS`)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/attachments/path.ts` (new — `buildStoragePath`, `sanitizeFilename`)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/attachments/server.ts` (new — server-only helper that uses `adminClient()` to HEAD-check storage objects)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions.ts` (new — five server actions)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/attachment-validations.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/attachment-path.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/attachment-actions.test.ts` (new — mocked Supabase per the cell-actions pattern)

**Forbidden:** Any UI file. Any other server-action file. The board store. The realtime hook. Do not edit `lib/activity.ts` (Slice A owns the union extension).

**Depends on:** Slice A merged (needs `is_uploaded`, `filename`, `board_id`, `scan_status` columns and the regenerated types).

**Spec:**

#### B.1 — Constants

`lib/attachments/constants.ts`:

```ts
export const MAX_FILE_SIZE_BYTES = 52_428_800; // 50 MB; must match bucket file_size_limit
export const ALLOWED_MIME_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
  "application/pdf",
  "text/plain", "text/markdown", "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const SIGNED_UPLOAD_URL_TTL_SECONDS = 600;   // 10 min
export const SIGNED_DISPLAY_URL_TTL_SECONDS = 300;  // 5 min
export const SIGNED_DOWNLOAD_URL_TTL_SECONDS = 300; // 5 min
```

#### B.2 — Path helpers

`lib/attachments/path.ts`:

```ts
/** Sanitize a filename for use in a storage path. Preserves extension. */
export function sanitizeFilename(name: string): string;

/** Build the canonical storage path. */
export function buildStoragePath(args: {
  boardId: string;
  taskId: string;
  attachmentId: string;
  filename: string;
}): string;
// Returns `<boardId>/<taskId>/<attachmentId>/<sanitized-filename>`.
```

Unit-test both for: NFC-normalize, replace whitespace, strip control chars, collapse double `_`, preserve extension, fall back to `file` if entire name is invalid.

#### B.3 — Zod schemas

`lib/validations/attachment.ts`:

```ts
import { z } from "zod";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/attachments/constants";

export const RequestUploadSchema = z.object({
  taskId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  /** Optional: when the upload is initiated from a comment composer / image-paste flow. */
  commentId: z.string().uuid().optional(),
});

export const ConfirmUploadSchema = z.object({
  attachmentId: z.string().uuid(),
});

export const DeleteAttachmentSchema = z.object({
  attachmentId: z.string().uuid(),
});

export const GetDownloadUrlSchema = z.object({
  attachmentId: z.string().uuid(),
});

export const GetSignedDisplayUrlSchema = z.object({
  attachmentId: z.string().uuid(),
  /** Optional Supabase render transform — only sent when fetching for thumbnail/inline image. */
  transform: z.object({ width: z.number().int().min(1).max(2000) }).optional(),
});
```

Re-export inferred `Input` types.

#### B.4 — Server-only HEAD helper

`lib/attachments/server.ts` (server-only — Biome `noRestrictedImports` boundary already in place for `adminClient`):

```ts
// biome-ignore lint/style/noRestrictedImports: server-only storage HEAD check
import { adminClient } from "@/lib/supabase/admin";

/** Returns true if the storage object exists at the path. */
export async function storageObjectExists(path: string): Promise<boolean>;
```

Implementation: `adminClient().storage.from("attachments").list(<parent-folder>, { search: <filename> })` and check the returned list. Do not throw if the call errors — return false. Wrap in try/catch.

#### B.5 — Server actions

In `app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions.ts`:

```ts
"use server";
// All five actions wrap withUser. All five parse via Zod.

export const requestUpload = withUser(async ({ supabase, userId }, raw) => { /* ... */ });
export const confirmUpload = withUser(async ({ supabase, userId }, raw) => { /* ... */ });
export const deleteAttachment = withUser(async ({ supabase, userId }, raw) => { /* ... */ });
export const getDownloadUrl = withUser(async ({ supabase, userId }, raw) => { /* ... */ });
export const getSignedDisplayUrl = withUser(async ({ supabase, userId }, raw) => { /* ... */ });
```

**`requestUpload` algorithm:**
1. Parse input via `RequestUploadSchema`.
2. Load task → get `board_id`. NOT_FOUND if missing.
3. `await requireBoardRole(task.board_id, "member")`.
4. (If `commentId` provided) verify comment exists and is on the same task.
5. Generate `attachmentId = uuid v4` (Postgres `gen_random_uuid()` — let the insert return it).
6. Sanitize filename. Compute `storage_path = buildStoragePath(...)`.
7. Insert `attachment` row via user client (RLS enforces uploader_id = auth.uid()): `{ id, task_id, board_id, comment_id?, uploader_id: userId, storage_path, filename, mime_type, size_bytes, is_uploaded: false, scan_status: 'skipped' }`. **Bind the generated id explicitly** so the storage path's `<attachment_id>` segment matches.
8. Create a signed upload URL: `supabase.storage.from("attachments").createSignedUploadUrl(storagePath)` (Supabase JS API). Returns `{ signedUrl, token, path }`.
9. Return `{ attachmentId, storagePath, signedUrl, token, expiresInSeconds: SIGNED_UPLOAD_URL_TTL_SECONDS }`. Do NOT log activity yet — the row is `is_uploaded = false`.

**`confirmUpload` algorithm:**
1. Parse input.
2. Load the attachment row by id; throw NOT_FOUND if missing. (RLS allows author/admin/member via select; user client suffices.)
3. Throw FORBIDDEN if `attachment.uploader_id !== userId` (defense-in-depth; RLS already enforces select access).
4. If `attachment.is_uploaded` is already true → return idempotently with the row.
5. HEAD-check via `storageObjectExists(attachment.storage_path)`. If false → throw `{ code: "STORAGE_MISSING", message: "Upload did not complete." }`.
6. Update `attachment` set `is_uploaded = true` via user client.
7. Best-effort `logActivity({ boardId: attachment.board_id, actorId: userId, type: "attachment.uploaded", taskId: attachment.task_id, payload: { attachmentId, filename, mimeType: attachment.mime_type, sizeBytes: attachment.size_bytes, viaCommentId: attachment.comment_id ?? undefined } })`.
8. Return the row (with `is_uploaded: true`).

**`deleteAttachment` algorithm:**
1. Parse + load row + verify `is_uploaded = true`. NOT_FOUND if missing.
2. Auth: RLS allows author or board-admin+. The action additionally calls `await requireBoardRole(boardId, "viewer")` first as a sanity check.
3. Delete storage object via admin client: `adminClient().storage.from("attachments").remove([storage_path])`. If the storage delete fails, log a warning but still proceed with DB delete (object will be cleaned up by future orphan sweep; we never want a "ghost row pointing at deleted object").
4. Delete DB row via user client. (RLS verifies authority.)
5. Best-effort `logActivity({ type: "attachment.deleted", payload: { attachmentId, filename } })`.
6. Return `{ ok: true }`.

**`getDownloadUrl` algorithm:**
1. Parse + load row (user client; RLS enforces read).
2. Create signed URL with `download = filename`: `supabase.storage.from("attachments").createSignedUrl(storage_path, SIGNED_DOWNLOAD_URL_TTL_SECONDS, { download: filename })`.
3. Return `{ url, expiresInSeconds }`.

**`getSignedDisplayUrl` algorithm:**
1. Parse + load row.
2. If `transform` provided AND row is an image MIME type, call `createSignedUrl(path, ttl, { transform: { width } })`.
3. Otherwise `createSignedUrl(path, ttl)`.
4. Return `{ url, expiresInSeconds, attachmentId }`.

#### B.6 — Tests

- `attachment-validations.test.ts`: every schema rejects bad input (oversized, wrong mime, bad uuid).
- `attachment-path.test.ts`: `sanitizeFilename` and `buildStoragePath` round-trip cases.
- `attachment-actions.test.ts` (mock Supabase per `tests/unit/cell-actions.test.ts` and `tests/unit/comment-actions.test.ts` patterns):
  - `requestUpload` denies a non-member (mocked `requireBoardRole` throw).
  - `requestUpload` rejects an oversized payload before touching the DB.
  - `confirmUpload` is idempotent when `is_uploaded` is already true.
  - `confirmUpload` throws `STORAGE_MISSING` when the HEAD check fails.
  - `deleteAttachment` calls the admin client `.remove([path])` exactly once.
  - `getSignedDisplayUrl` passes the `transform` arg only for image MIME types.

**Definition of done:**
- Five server actions exist, each `withUser`-wrapped, each Zod-validated, each returning `ActionResult<T>` per the repo's `lib/actions` contract.
- `lib/attachments/constants.ts` mirrors the bucket configuration (size + mime allowlist) verbatim — single source of truth, server-side check is redundant-by-design to the bucket.
- `lib/attachments/path.ts` exports `buildStoragePath` and `sanitizeFilename`; both unit-tested.
- `lib/attachments/server.ts` exports `storageObjectExists`.
- Unit tests pass under `pnpm test`.

**Escalation triggers:**
- If Supabase JS `createSignedUploadUrl` API surface differs from current docs (it's been renamed before), surface as a coordination issue.
- If `storageObjectExists` cannot be implemented from `storage.from(...).list()` alone (e.g., the search filter doesn't match exact paths), surface and propose `adminClient().storage.from("attachments").download(path)` as the HEAD substitute.

---

### Slice C — Board store: attachments slice + hydration + realtime apply

**Branch:** `epic/10-attachments/c-store-and-realtime`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/stores/types/attachments.ts` (new — `AttachmentRow` type re-export and any per-store derived shapes)
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts` (extend in place — add `attachmentsByTask`, `hydrateAttachmentsForBoard`, `applyAttachmentUpsert`, `applyAttachmentDelete`, `selectAttachmentsForTask`)
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-realtime.ts` (extend in place — add one `postgres_changes` handler for `attachment`)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` (extend — add a parallel `.from("attachment").select("*").eq("board_id", boardId).eq("is_uploaded", true)` round-trip, pass to `<BoardTable>`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/table/BoardTable.tsx` (extend — accept `attachments` in the `initial` prop and call `hydrateAttachmentsForBoard` in the existing mount-time hydrate)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/@modal/(.)t/[taskId]/page.tsx` (extend — add a per-task attachments fetch alongside comments/reactions/activity)
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/t/[taskId]/page.tsx` (extend — mirror)
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/TaskDrawer.tsx` (extend — pass attachments through to `<FilesTab>`; hydrate via store on mount)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/board-store-attachments.test.ts` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/use-board-realtime-attachments.test.ts` (new)

**Reads (no write):**
- `lib/supabase/types.ts` — for `AttachmentRow` shape (after Slice A regen).
- Existing hydrate/apply patterns in `board-store.ts` (mirror `applyCommentUpsert`/`hydrateCommentsForTask`).

**Forbidden:** Any file under `components/cells/file/`, `components/comments/`, or `components/rich-text/`. Any file under `app/(app)/account/`. The dropzone primitive (Slice D). The Files tab UI (Slice E). The server actions (Slice B). Storage migrations (Slice A).

**Depends on:** Slice A merged (needs `attachment.board_id`, `is_uploaded`, regen types, realtime publication).

**Spec:**

#### C.1 — Type alias

`stores/types/attachments.ts`:

```ts
import type { Database } from "@/lib/supabase/types";
export type AttachmentRow = Database["public"]["Tables"]["attachment"]["Row"];
```

(Mirror `stores/types/comments.ts`.)

#### C.2 — Board store extensions

Append a banner-commented section "Epic 10 — Attachments state" in `stores/board-store.ts` AFTER the Epic-09 block. Do not touch existing fields/methods.

New transient field (added to `transientInitial`):
```ts
attachmentsByTask: new Map<string, AttachmentRow[]>(), // sorted oldest-first (created_at asc)
```

New action signatures (declared on `BoardState`, implemented in the body):
```ts
hydrateAttachmentsForBoard: (rows: AttachmentRow[]) => void;
applyAttachmentUpsert: (row: AttachmentRow) => void;
applyAttachmentDelete: (attachmentId: string) => void;
```

New selector (named export, NOT a store method):
```ts
export function selectAttachmentsForTask(state: BoardState, taskId: string): AttachmentRow[];
// Returns state.attachmentsByTask.get(taskId) ?? EMPTY_ARRAY (stable empty reference).
```

Implementation notes (must follow repo norm — `useShallow` warning in MEMORY.md):
- All mutations produce a new outer `Map` and a new inner array per touched task to keep React selectors stable but new-reference.
- `applyAttachmentUpsert`:
  - Hydrate-side idempotency: if an existing row with the same `id` is present AND `created_at` is the same, no-op. (Attachments are immutable — there's no `updated_at`; identity by `id` is enough.)
  - **Skip** rows where `is_uploaded = false`. The store only carries confirmed uploads. (Realtime will fire UPDATE when `confirmUpload` flips the flag — that's when the row enters the store.)
- `applyAttachmentDelete`: remove the row from `attachmentsByTask.get(taskId)` for the matching `id`. If unknown, no-op.
- `reset()` clears `attachmentsByTask`.

#### C.3 — Realtime subscription

In `hooks/use-board-realtime.ts`, add another `channel.on("postgres_changes", { ...attachment, filter: 'board_id=eq.<id>' }, ...)` block between the existing `activity` handler and the presence handlers. Mirror the comment handler exactly:

- INSERT: `applyAttachmentUpsert(e.new)` (the store filters out non-`is_uploaded`).
- UPDATE: `applyAttachmentUpsert(e.new)` (catches the `is_uploaded` flip from confirmUpload).
- DELETE: `applyAttachmentDelete(e.old.id)`.

#### C.4 — Page-level data fetches

`app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx`:
- Extend the existing `Promise.all` second round (after tasks/cells) to include:
  ```ts
  supabase.from("attachment").select("*").eq("board_id", boardId).eq("is_uploaded", true)
  ```
- Pass `attachments` through to `<BoardTable initial={{ groups, tasks, cells, columns, attachments }} />`.

`@modal/(.)t/[taskId]/page.tsx` and `t/[taskId]/page.tsx`:
- Extend the existing parallel fetch to include `attachment` filtered by `task_id` and `is_uploaded = true`, ordered `created_at asc`.
- Pass `attachments` through to `<TaskDrawer>`.

#### C.5 — `<BoardTable>` and `<TaskDrawer>` hydration

`<BoardTable>`: extend the `initial` prop to include `attachments?: AttachmentRow[]` (optional for backward compat). In the existing mount-time hydrate effect, call `useBoardStore.getState().hydrateAttachmentsForBoard(initial.attachments ?? [])`.

`<TaskDrawer>`: extend props to include `attachments: AttachmentRow[]`. Add `hydrateAttachmentsForBoard` to the mount effect's dependency array (it's a no-op idempotent merge — won't double-insert). Pass `attachments` through to `<FilesTab>` only (Files tab still reads via the store selector — props are just for SSR-first render).

#### C.6 — Tests

`tests/unit/board-store-attachments.test.ts`:
- `hydrateAttachmentsForBoard` groups by `task_id` and sorts oldest-first.
- `applyAttachmentUpsert` is idempotent on `id`.
- `applyAttachmentUpsert` skips `is_uploaded = false` rows.
- `applyAttachmentDelete` removes by id and no-ops on unknown.
- `reset()` clears `attachmentsByTask`.
- `selectAttachmentsForTask` returns the stable `EMPTY_ARRAY` when no entries (so React selectors don't infinite-loop — MEMORY.md item).

`tests/unit/use-board-realtime-attachments.test.ts`:
- Mocks the supabase channel per the existing `use-board-realtime-comments.test.ts` pattern.
- Asserts the channel registers a postgres_changes handler for `table: "attachment"`, `filter: 'board_id=eq.<id>'`.
- Asserts INSERT/UPDATE/DELETE events route to the corresponding store actions with the correct args.

**Definition of done:**
- Board store has `attachmentsByTask` + three actions + one selector; all tested and idempotent.
- Board page hydrates attachments for all tasks on a board.
- Task drawer page (both intercepting and full-page routes) fetches per-task attachments and hydrates.
- `useBoardRealtime` subscribes to `attachment` and routes events to the store.
- `selectAttachmentsForTask` returns a stable reference (`useShallow` not strictly needed because the array reference is itself stable when unchanged; document in the JSDoc).

**Escalation triggers:**
- If extending `BoardTable.tsx`'s `initial` prop breaks any callsite (the prop is exposed through several layers), stop and return the failing files. Do not refactor.
- If realtime delivers an UPDATE for `is_uploaded` flipping `true → false` (it shouldn't — server actions never do this), the store currently would re-skip — flag as an open question rather than papering over.

---

### Slice D — `<FileDropzone />` primitive + `<AttachmentImage />` renderer

**Branch:** `epic/10-attachments/d-dropzone-and-image`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/attachments/FileDropzone.tsx` (new — generic drop/click/paste uploader)
- `/Volumes/SSD1T/DEV WORK/donezo/components/attachments/AttachmentImage.tsx` (new — signed-URL-fetching `<img>` for Tiptap and lightbox)
- `/Volumes/SSD1T/DEV WORK/donezo/components/attachments/AttachmentThumb.tsx` (new — small thumbnail variant used by the file column)
- `/Volumes/SSD1T/DEV WORK/donezo/components/attachments/AttachmentTile.tsx` (new — full tile with filename, size, icon, used by Files tab + file-column-overflow)
- `/Volumes/SSD1T/DEV WORK/donezo/components/attachments/AttachmentLightbox.tsx` (new — Base UI Dialog + keyboard arrows for image preview)
- `/Volumes/SSD1T/DEV WORK/donezo/components/attachments/AttachmentPdfEmbed.tsx` (new — native `<embed>` with download fallback)
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-attachment-uploader.ts` (new — the upload state machine: requestUpload → PUT → confirmUpload; exposes `{ upload, progress, error }`)
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-signed-display-url.ts` (new — fetches + caches per-tab signed display URLs by attachment id)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/attachments/mime-icons.ts` (new — map mime → Lucide icon component)
- `/Volumes/SSD1T/DEV WORK/donezo/package.json` (add `react-dropzone` only)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/use-attachment-uploader.test.ts` (new — mocked actions + global fetch)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/use-signed-display-url.test.ts` (new — caching + TTL eviction)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/FileDropzone.test.tsx` (new — react-testing-library)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/AttachmentImage.test.tsx` (new)

**Reads (no write):**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions.ts` (Slice B's actions — imported)
- `lib/attachments/constants.ts` (Slice B)

**Forbidden:** Anything in `app/`, `stores/`, `components/cells/file/`, `components/comments/`, `components/rich-text/`, `components/board/tabs/`. Do not edit `lib/activity.ts`. Do not edit the realtime hook.

**Depends on:** Slice B merged (needs the five server actions and constants).

**Spec:**

#### D.1 — `<FileDropzone />` props

```ts
export interface FileDropzoneProps {
  taskId: string;
  /** Required when uploading via a comment image-paste flow; absent for Files tab / file column. */
  commentId?: string;
  /** Accept attribute for the underlying <input type=file>. Defaults to ALLOWED_MIME_TYPES joined. */
  accept?: string;
  multiple?: boolean;
  /** Called once each file's full request→PUT→confirm cycle completes. */
  onComplete?: (attachment: AttachmentRow) => void;
  onError?: (err: { code: string; message: string; filename?: string }) => void;
  /** Composition slot — caller renders the drop target visuals. */
  children?: ReactNode;
  className?: string;
}
```

Behavior:
- Uses `react-dropzone` for drag/click. Accept-on-paste of `image/*` is wired via `onPaste` on the wrapper div (react-dropzone's paste support is limited; native paste handler is fine).
- For each file: client-side validate size+mime against `MAX_FILE_SIZE_BYTES` and `ALLOWED_MIME_TYPES` before calling `requestUpload`.
- Calls `useAttachmentUploader().upload(file)` per file. Progress UI rendered inline as a small per-file row with `<progress>` element.
- On success, calls `onComplete(attachmentRow)`. On error, calls `onError`. Both are best-effort; the uploader sets internal error state for surface display.

#### D.2 — `useAttachmentUploader`

State machine:
1. `requestUpload({ taskId, filename, sizeBytes, mimeType, commentId? })` → `{ ok, data: { attachmentId, storagePath, signedUrl, token } }`.
2. PUT the file body via global `fetch(signedUrl, { method: "PUT", body: file, headers: { "x-upsert": "false" } })`. Use `XMLHttpRequest` instead if progress is needed (Vercel/Edge serverless does not stream uploads; client-side XHR is fine and gives `onprogress`).
3. `confirmUpload({ attachmentId })` → `{ ok, data: AttachmentRow }`.
4. Optimistically: do NOT insert into the store; the Slice C realtime UPDATE handler will fire when the row's `is_uploaded` flips true, picking up the row through the existing channel. (Idempotency: the same row arriving via realtime is a no-op if already present.)
5. On any error, surface `{ code, message }` and DO NOT call confirmUpload. Orphan row will be swept hourly.

Hook signature:
```ts
export function useAttachmentUploader(): {
  uploads: Array<{ filename: string; progress: number; status: "uploading" | "confirming" | "done" | "error"; error?: string }>;
  upload: (file: File, ctx: { taskId: string; commentId?: string }) => Promise<AttachmentRow | null>;
  clearCompleted: () => void;
};
```

#### D.3 — `useSignedDisplayUrl`

Per-tab in-memory cache: `Map<attachmentId, { url, expiresAt }>`. Fetches via `getSignedDisplayUrl` server action. Returns `{ url: string | null, isLoading: boolean }`. On expiry (within 60s of `expiresAt`), refetches automatically.

For thumbnails: signature accepts an optional `transform: { width: number }` and caches under a composite key `${attachmentId}@${width ?? "raw"}`.

#### D.4 — `<AttachmentImage>`

```ts
export interface AttachmentImageProps {
  attachmentId: string;
  alt?: string;
  /** When provided, requests a Supabase image transform at this width. */
  width?: number;
  className?: string;
  /** Click-to-lightbox handler (optional). */
  onOpen?: () => void;
}
```

Uses `useSignedDisplayUrl({ attachmentId, transform })`. Renders a skeleton block while loading, an `<img>` once URL ready. Uses native `<img>` (not `next/image`) because URLs are dynamic + signed.

#### D.5 — `<AttachmentTile>` and `<AttachmentThumb>`

`<AttachmentThumb>`: 36×36px (matches cell skeleton height) thumbnail variant. For image MIME → renders `<AttachmentImage transform={{ width: 72 }}>`. For other MIME → renders the icon from `lib/attachments/mime-icons.ts`. Always shows the filename in a tooltip.

`<AttachmentTile>`: full-row representation. Icon/thumb on the left, filename + size + uploader timestamp in the middle, Download + Delete buttons on the right. Delete button is disabled unless `boardRole >= "admin"` OR `uploaderId === currentUserId` (Slice E passes both in via props; D's component accepts both as props).

#### D.6 — `<AttachmentLightbox>`

Base UI `Dialog.Root` (mirror existing modal patterns in `components/shared/CreateBoardModal/`). Receives `attachmentIds: string[]` and `startIndex: number`. Keyboard:
- `Esc` closes.
- `→` / `←` advance / go back.
- `Enter` opens download.

Only image MIME types open in the lightbox. For PDFs, click triggers a route to a full-page `<AttachmentPdfEmbed>` (or just opens the signed display URL in a new tab — Epic 10 default).

#### D.7 — `<AttachmentPdfEmbed>`

`<embed src={signedUrl} type="application/pdf" />` inside a fixed-height container. Below: a "Download" button calling `getDownloadUrl`. No `react-pdf`.

#### D.8 — Tests

- `use-attachment-uploader.test.ts`: stubs `fetch` and the two server actions. Asserts the three-step sequence; asserts error paths skip confirm.
- `use-signed-display-url.test.ts`: cache hit, expiry refetch, transform-keyed cache.
- `FileDropzone.test.tsx`: drag-and-drop simulation, size/mime client-side rejection, onComplete fires on success.
- `AttachmentImage.test.tsx`: renders skeleton then `<img>` with the resolved URL; passes `transform` through to the hook.

**Definition of done:**
- `react-dropzone` is the only added dependency. Pinned to current stable.
- `<FileDropzone>` accepts drag, click, and paste; calls `onComplete` per file; surfaces errors via `onError` and `sonner` toasts.
- `<AttachmentImage>` resolves a signed URL on mount, refetches near expiry, accepts an optional transform width.
- `<AttachmentLightbox>` opens via prop, supports keyboard arrows + Esc.
- `<AttachmentPdfEmbed>` renders a native PDF embed with a Download fallback.
- All four unit tests pass.

**Escalation triggers:**
- If `react-dropzone` is incompatible with React 19 (check `peerDependencies` after install), surface and propose either a custom drop handler or a different lib.
- If the Supabase image-transform endpoint returns 404 / "not enabled on this plan" in dev, surface — we may need to fall back to raw image URLs for v1 and defer thumbnails.

---

### Slice E — Wire surfaces: Files tab, file-column editor, Tiptap image extension, account avatar verification

**Branch:** `epic/10-attachments/e-surface-wiring`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/tabs/FilesTab.tsx` (REPLACE the placeholder — full implementation)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Editor.tsx` (REPLACE the disabled stub — full popover editor)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Cell.tsx` (extend — render up to 3 thumbnails + overflow chip, replacing the count-only placeholder)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/def.ts` (extend — switch `editorMode` to `"popover"` if appropriate; verify aggregations)
- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentEditor.tsx` (extend — pass an `imageUpload` extension into `<RichTextEditor extraExtensions>`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/extensions.ts` (extend — add an optional Tiptap Image extension builder that the comment editor can opt into via `extraExtensions`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/AttachmentImageNode.tsx` (new — Tiptap NodeView using `<AttachmentImage>`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/imageUpload.ts` (new — builds the Image extension with custom attrs `{ attachmentId, alt }` and a paste/drop handler that calls Slice B's `requestUpload` → PUT → `confirmUpload`, then inserts a node)
- `/Volumes/SSD1T/DEV WORK/donezo/components/activity/renderers/attachmentRenderers.tsx` (new — `attachment.uploaded` + `attachment.deleted` renderers)
- `/Volumes/SSD1T/DEV WORK/donezo/components/activity/renderers/index.ts` (extend — register the two new renderers)
- `/Volumes/SSD1T/DEV WORK/donezo/package.json` (add `@tiptap/extension-image` only)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/FilesTab.test.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/FileCellEditor.test.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/AttachmentImageNode.test.tsx` (new)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/comment-image-upload.test.ts` (new — image-paste extension upload flow)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/activity-renderers-attachment.test.tsx` (new)

**Reads (no write):**
- Slice D's components (`<FileDropzone>`, `<AttachmentTile>`, `<AttachmentLightbox>`, `<AttachmentImage>`).
- Slice C's store (`selectAttachmentsForTask`).
- Slice B's server actions.

**Forbidden:** The board store. The realtime hook. The board-page RSC. Other tab components (`UpdatesTab.tsx`, `ActivityTab.tsx`). Account-settings UI. (The slot is to verify the existing avatar flow still works under Slice A's bucket policies — that's Slice G's verification step, not Slice E's work.)

**Depends on:** Slices B, C, D merged.

**Spec:**

#### E.1 — `<FilesTab>` full implementation

Replace the placeholder. Component reads `selectAttachmentsForTask(state, taskId)` from the board store and renders:
- A `<FileDropzone taskId={taskId}>` at the top (large drop area, Tailwind dashed border).
- Below: a grid of `<AttachmentTile>` rows. Images open the `<AttachmentLightbox>` on click; PDFs open `<AttachmentPdfEmbed>` inline or in a new tab; others trigger download.
- Empty state when no attachments: centered text "Drop files here or click to upload" inside the dropzone.

Props (passed from `<TaskDrawer>`):
```ts
{ taskId: string; boardId: string; currentUserId: string; boardRole: Role; }
```

`<TaskDrawer>` is extended (in Slice C) to pass these — Slice E only consumes.

#### E.2 — File column `<Editor>` real implementation

Replace the disabled stub at `components/cells/file/Editor.tsx`. New editor:
- Renders inside a Base UI Popover (orchestrator already provides the popover shell — set `editorMode: "popover"` in `def.ts`).
- Top section: a small `<FileDropzone>` for adding files (uses the orchestrator's `row.id` task context).
- Below: list of current `attachmentIds` mapped to `<AttachmentTile>` (delete + download per row).
- On dropzone `onComplete(attachment)`: call `setCellValue` server action via the existing cell-editor orchestrator pattern, appending the new id to the cell value. **Important:** the cell value lives in the cell store; the realtime push from the cell upsert reconciles. The file column does NOT directly own the attachment list — that's hydrated via `attachmentsByTask`.
- On delete: call `deleteAttachment` server action, AND call `setCellValue` to remove the id from `attachmentIds`.

The `<Cell>` renderer is also updated: show up to 3 `<AttachmentThumb>` for the first 3 ids, plus an overflow `+N` chip if more. Empty state: paperclip + `—`.

#### E.3 — Tiptap Image upload extension

`components/rich-text/imageUpload.ts` exports `buildImageUploadExtension(ctx: { taskId: string; commentId?: string })`. The extension:
- Configures `@tiptap/extension-image` with `inline: false`, `allowBase64: false`, and custom attrs `{ attachmentId: string | null, alt: string | null }`.
- Replaces the existing `imagePastePluginKey` no-op in `RichTextEditor.tsx` ONLY via the `extraExtensions` path — DO NOT delete the no-op plugin; the comment editor passes the upload extension, the generic editor stays no-op-safe.
- On paste/drop of an image File: call `requestUpload` → PUT → `confirmUpload`. On success, insert an Image node with `{ attachmentId: <id>, alt: <filename> }`. On error, surface a `sonner` toast.

`components/rich-text/AttachmentImageNode.tsx`: Tiptap NodeView that renders `<AttachmentImage attachmentId={node.attrs.attachmentId} alt={node.attrs.alt} className="..." />`. Per-tab signed-URL refresh is automatic via Slice D's hook.

`components/rich-text/extensions.ts`: add an exported `buildImageUploadExtensions(ctx)` helper that returns `[buildImageUploadExtension(ctx)]` — keep the base extensions clean of attachment concerns.

`components/comments/CommentEditor.tsx`: when rendering for a task drawer (always), call `buildImageUploadExtensions({ taskId, commentId: undefined })` and pass via `extraExtensions`. The comment row created later may or may not link to `comment_id` — uploads happen before the comment exists, so they land with `comment_id = null` initially; an optional follow-up could `update attachment set comment_id = <id>` after `createComment` resolves, but that's deferred to followup if needed (epic doc allows it).

#### E.4 — Activity renderers

`components/activity/renderers/attachmentRenderers.tsx`:
- `attachment.uploaded`: "{actor} uploaded {filename}" with a small file icon.
- `attachment.deleted`: "{actor} deleted {filename}" with a strikethrough filename.

Both renderers follow the existing Epic-09 renderer signature (`(event, ctx) => ReactNode`).

Register both in `components/activity/renderers/index.ts` so the activity feed picks them up.

#### E.5 — Tests

- `FilesTab.test.tsx`: renders dropzone, renders attachment tiles from store, empty state.
- `FileCellEditor.test.tsx`: drop a file → setCellValue is called with the new attachmentId appended; delete removes both the attachment and updates the cell value.
- `AttachmentImageNode.test.tsx`: renders an `<AttachmentImage>` when given an attachmentId attr.
- `comment-image-upload.test.ts`: pastes an image → uploader pipeline runs → editor doc gets an Image node with the attachmentId.
- `activity-renderers-attachment.test.tsx`: snapshots for both action ids.

**Definition of done:**
- `<FilesTab>` is the real implementation. Placeholder gone.
- `<components/cells/file/Editor.tsx>` is the real implementation. Disabled tooltip gone.
- File column cell renders up to 3 thumbnails + overflow chip.
- Comment composer accepts image paste/drop and inserts a node referencing the new attachment.
- Activity feed renders `attachment.uploaded` and `attachment.deleted` events.
- All five new unit tests pass.

**Escalation triggers:**
- If switching `editorMode: "inline"` → `"popover"` on `fileType` cascades type errors in the cell-editor orchestrator, stop and return a `needs-direction` report.
- If `@tiptap/extension-image@3.x` has a breaking API for custom attrs vs the Tiptap 3.23 docs, surface; the alternative is a custom Node extension hand-rolled from `@tiptap/core`.
- If the Tiptap image upload pipeline conflicts with the existing `imagePastePluginKey` no-op, surface — do not delete the no-op plugin (other consumers of `<RichTextEditor>` would lose the warning).

---

## Stage 2 — Sequential integration

### Slice F — Integration polish + e2e + verification

**Branch:** `epic/10-attachments/f-integration`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/tests/e2e/10-attachments.spec.ts` (new — full E2E)
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-10-checkpoint-1.md` (new — written by executor as it audits the integrated stage)
- Minor edits to any of the files touched in Stage 1 ONLY to resolve integration gaps surfaced by the executor during Stage 2 (e.g., a prop wasn't threaded through `<TaskDrawer>`). Any edit broader than a 5-line fix must escalate.

**Depends on:** Stages 1 (all five slices merged into the epic branch).

**Spec:**

This slice is an integration audit, not net-new code. The executor's job is to:

1. Run `pnpm dev` and the local Supabase, then exercise the full pipeline end-to-end:
   - Account settings → upload a new avatar → confirm it appears (Epic 03 verify).
   - Open a board → open a task → Files tab → drag a file → tile appears.
   - File column on a row → drop a file inline → thumbnail appears.
   - Comment composer → paste an image → image inline; submit comment; the image renders on reload via fresh signed URL.
   - Open a second tab to the same board → first tab uploads → second tab sees the attachment within 2s.
   - Delete an attachment → tile disappears; storage object gone (verify via Supabase Studio).
   - Activity feed shows `attachment.uploaded` and `attachment.deleted` rows for the actions above.
2. Run the test suite: `pnpm test` and the new pgTAP suite.
3. Identify any wiring gaps and patch with minimal surgical edits (≤5 lines per file).
4. If anything beyond minor wiring is needed, **STOP** and produce a `needs-direction` report — that goes back to Opus for a followup-spec.

#### F.1 — E2E spec

`tests/e2e/10-attachments.spec.ts` (Playwright, follows the Epic-06/07/09 pattern under `tests/e2e/`):

- Setup: seeded board with one task, one file column.
- Test 1: drag a file into the Files tab → assertion: tile visible, attachment row inserted in DB.
- Test 2: same file appears in the file column.
- Test 3: open the file column editor → drop another file → cell value updates.
- Test 4: paste an image into a comment composer → submit → image renders on a fresh page load.
- Test 5: delete an attachment → tile gone; signed URL returns 404 for the deleted object.
- Test 6: non-member of the board cannot fetch the attachment via guessed Storage URL (assert 403).
- Test 7: orphan-cleanup — insert a `is_uploaded = false` row with `created_at = now() - 2 hours` via admin client, call `purge_orphan_attachments()`, assert row removed.

#### F.2 — Verification checklist

The executor writes a brief checkpoint at `_dispatch/epic-10-checkpoint-1.md` covering:
- All 14 epic-doc definition-of-done items, each marked verified/issue-found.
- Any minor patches landed.
- Any followup items deferred to Opus review.

**Definition of done:**
- E2E spec exists and passes locally (run with the dev test environment).
- All seven test cases pass.
- Checkpoint doc enumerates each DoD item with a verdict.
- No production code outside Stage-1 file scope was modified beyond ≤5-line wiring patches.

**Escalation triggers:**
- Any DoD item that fails verification AND requires more than a 5-line patch → escalate as `needs-direction`. The reviewer (Opus) will produce a followup slice spec.

---

## Sequential follow-ups (after F lands)

- **Stage 3 — Review pass:** the orchestrator dispatches the `epic-researcher` (Opus, this agent role) against the merged Stage-1+2 diff. Review produces either `CLEAN` (epic ready to merge to main) or a followup spec at `_dispatch/epic-10-followup-N.md`.
- **Scheduling the orphan-cleanup function:** post-merge ops decision — either (a) enable `pg_cron` extension on Supabase and `select cron.schedule('purge-attachments-hourly', '0 * * * *', 'select public.purge_orphan_attachments();')` from a one-shot SQL run, or (b) ship a tiny Supabase Edge Function `purge-orphans/index.ts` invoked by Vercel Cron at `0 * * * *`. Either path is small. **Not blocking epic merge.**
- **EXIF stripping (Q9):** deferred pending user input. If user wants v1, dispatch a followup slice to add a Sharp-based Edge Function `strip-exif` invoked from `confirmUpload` for image MIMEs. Roughly 1–2 days of work.

## Risk notes

1. **Storage RLS path-parsing.** `storage.foldername(name)` is the documented Supabase helper but its exact return shape has changed across versions. Slice A's pgTAP test must verify `(storage.foldername('a/b/c/d.txt'))[1] = 'a'` on the current local Supabase before relying on it. If it indexes from 0, every storage policy is silently wrong.
2. **Signed-upload URL semantics.** Supabase has both `createSignedUploadUrl(path)` (single-shot, the user PUTs directly) and `createSignedUrl(path, ttl)` (read-only). Slice B's `requestUpload` MUST use `createSignedUploadUrl`. The signed-upload URL bypasses RLS for the single PUT operation it authorizes — this is intentional and correct. Storage RLS still gates everything ELSE (reads, deletes, future PUTs to different paths).
3. **Bucket-level mime allowlist + size limit collision.** The bucket configuration enforces these at the Supabase edge. The server action does too. They MUST agree. If a future Slice A migration changes the bucket allowlist, the server-action constants and the Zod schema must change too. Single source: `lib/attachments/constants.ts` documents the constraint; the migration's `allowed_mime_types` array MUST be derived from the same list. Slice A includes a comment to that effect.
4. **Comment ↔ attachment linkage.** Attachments uploaded via comment paste happen BEFORE the comment row exists (the user is still drafting). The schema permits `comment_id NULL`. v1 leaves it null forever; the activity log + display still works. If we want strict referential cleanup ("delete the comment, lose the inline image"), we'd need to flip `comment_id` after `createComment` resolves AND change RLS so deleting a comment cascades to its attachments. **Deferred** — flagged here so Stage 2 verification doesn't try to enforce it.
5. **Tiptap NodeView + RSC.** Tiptap NodeViews must run client-side. `<AttachmentImage>` is `"use client"`. The comment body's stored JSON contains `{ type: "image", attrs: { attachmentId, alt } }` — but on the SERVER (during RSC render of comment plain-text previews) this attr is fine because the server never tries to render the NodeView. The activity feed's "bodyTextPreview" never includes image attrs. Safe.
6. **`next/image` is NOT used.** Slice D's `<AttachmentImage>` uses a raw `<img>` because the URLs are signed + transient. `next.config.ts` does not need a `remotePatterns` entry (verified against the current Next 15 config). The existing avatar `<img>` in `account-settings.tsx` already follows this pattern — see `biome-ignore lint/performance/noImgElement` precedent.
7. **Realtime back-pressure.** Bulk-uploading 50 files at once would fire 50 confirmUpload UPDATEs on `attachment`, which fan out to every subscribed tab. The board store's `applyAttachmentUpsert` is O(n) on the task's attachment array — fine for 100s, expensive at 10,000s. **Not blocking v1.** Flagged for Epic 14 perf pass.
8. **Orphan storage objects.** `deleteAttachment` removes both DB and storage. But if the storage delete fails (network blip), we orphan a storage object with no DB row pointing at it. The cleanup function only deletes DB rows, not orphan storage objects. Net effect: a slow accretion of orphan storage objects. Acceptable for internal tool v1. Add a "list-and-delete-orphans" admin task later in Epic 15 if growth becomes visible.
9. **`<embed>` for PDF on iOS Safari.** iOS Safari historically doesn't render `<embed type="application/pdf">` reliably. Falls through to the Download button — acceptable for v1, document in the AttachmentPdfEmbed JSDoc.
10. **`createSignedUrl` with `transform.width`.** This is a Supabase Pro feature ("Smart CDN" + "Image transformations"). On the free tier it returns the original image. Slice D's `<AttachmentImage>` handles either case (the URL is valid; it just isn't actually resized). Verify the project plan supports transformations before relying on them being smaller in production; if not, fall back to client-side `<img width=...>` for visual sizing only (still pays full-image bandwidth).
11. **Avatar upload regression risk.** Slice A's `attachments` bucket policies and the orphan cleanup function don't touch `avatars` policies, but: any error in the storage-rls migration that accidentally tightens `storage.objects` policies globally could regress avatars. Slice A's pgTAP suite MUST include a sanity assertion that the existing avatar policies still pass — copy the relevant assertion from `tests/policies/00_setup.sql` if there is one, otherwise add a fresh "user can upload to their own avatar folder" check.
12. **Schema drift between epic doc and reality (`uploaded_by` vs `uploader_id`).** Every slice spec above standardizes on `uploader_id`. If an executor reads the epic doc verbatim and writes `uploaded_by` somewhere, the column doesn't exist and the slice fails. Each slice spec explicitly calls this out.
13. **`pgTAP` for storage policies.** Storage policies are evaluated by Supabase Storage layer, not by Postgres directly. pgTAP can test the underlying `storage.objects` RLS by inserting/selecting AS a particular role with a JWT claim — but it's not 1:1 with what the Storage API does (the API wraps it). E2E test in Slice F is the canonical check. pgTAP is defense-in-depth.

---

**Summary of file paths I touched while planning (all absolute, repo-relative):**

- `/Volumes/SSD1T/DEV WORK/donezo/CLAUDE.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/00-overview.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/10-attachments.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/02-supabase-schema.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/03-auth.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/04-authorization-rls.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/06-groups-tasks-table.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/07-column-system.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/09-comments-activity.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-09.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-09-followup-1.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-08.md`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260506224930_initial_schema.sql` (lines 280–299, 473)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260507003509_avatars_bucket.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260507120100_rls_policies.sql` (lines 329–371)
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260512000000_realtime_denormalization.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260513000000_comment_reactions_and_activity_publication.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/seed.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/types.ts` (attachment table at lines 87–134)
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/admin.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/supabase/index.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/activity.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/actions/with-user.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/authorization/board.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/registry.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/env.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/account/page.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/account/account-settings.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/account/actions.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/@modal/(.)t/[taskId]/page.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/t/[taskId]/page.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/TaskDrawer.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/TaskDrawerTabs.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/tabs/FilesTab.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/tabs/UpdatesTab.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentComposer.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Cell.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Editor.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/def.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/RichTextEditor.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/MentionExtension.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/extensions.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/types.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-realtime.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/stores/types/comments.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/package.json`
- `/Volumes/SSD1T/DEV WORK/donezo/.env.example`
- `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/board_id_consistency.spec.sql`
- `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/comment_reaction_rls.spec.sql`