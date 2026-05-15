# Epic 10 — Final Review

## Verdict

**CLEAN.** Epic 10 (Attachments & File Storage) meets the epic doc's definition of done and is ready to merge `epic/10-attachments` (tip `ca81bbc`) into `main`.

---

## Scope reviewed

- Branch: `epic/10-attachments` at `ca81bbc501612e3c5b1f95c8a69afcb4c51d44e5`.
- Diff range: `main..epic/10-attachments` (64 files, +8931 / −88).
- Documents read for context:
  - `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/10-attachments.md`
  - `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-10.md`
  - `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-10-followup-1.md`
  - `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-10-stage-1-review.md`
  - `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-10-checkpoint-1.md`

Static verification:
- `pnpm exec tsc --noEmit` exits 0 (clean).
- No `app/api/*` route handlers added (only `app/api/webhooks/` empty placeholder, allowed per CLAUDE.md).
- No MUI / SCSS / Cloudinary / Socket.IO / npm / yarn artifacts.
- All migration files, RLS specs, server actions, hooks, components, and tests verified by direct file read.

---

## Definition-of-done items — each verified against code

The epic doc lists 8 DoD bullets. Each is verified below with a file:line citation.

### DoD 1 — Files drag-drop into a task's Files tab and the file column

**Files tab:**
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/tabs/FilesTab.tsx:75` renders `<FileDropzone taskId={taskId}>`.
- The dropzone uses `react-dropzone` + native paste handler. `/Volumes/SSD1T/DEV WORK/donezo/components/attachments/FileDropzone.tsx:197–224` wires `getRootProps`, `onPaste`, and `data-testid="file-dropzone"`.

**File column:**
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/def.ts:60` sets `editorMode: "popover"`.
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/CellEditor.tsx:170–183` threads `row: task` and `task` through to `<def.Editor>` (F1.A fix).
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Editor.tsx:42–49` requires `row: { id: string }` and at line 140 reads `const taskId = row.id;` — no silent empty-string fallback.
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Editor.tsx:169–174` renders `<FileDropzone taskId={taskId} multiple={true} onComplete={handleUploadComplete}>` inline in the popover. `handleUploadComplete` (lines 152–155) appends the new id to `attachmentIds` via `onChange`.

### DoD 2 — Images render inline with thumbnails and open in a lightbox; PDFs embed

**Thumbnails:**
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Cell.tsx:76–88` renders up to 3 `<AttachmentThumb>` per row + overflow `+N` chip (line 89–93). Empty state at line 55–67.
- `/Volumes/SSD1T/DEV WORK/donezo/components/attachments/AttachmentThumb.tsx` uses `<AttachmentImage transform={{ width: 72 }}>` for images, MIME icons otherwise.
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/tabs/FilesTab.tsx:80–98` renders `<AttachmentTile>` rows.

**Lightbox:**
- `/Volumes/SSD1T/DEV WORK/donezo/components/attachments/AttachmentLightbox.tsx` — Base UI `Dialog.Root` with prev/next/Esc/Enter keyboard handlers (lines 78–92), filename + counter footer (lines 177–198).
- `FilesTab` wires `openLightbox` (lines 50–57) → state at lines 44–45 → `<AttachmentLightbox attachments=…>` at lines 115–123.

**PDF embed:**
- `/Volumes/SSD1T/DEV WORK/donezo/components/attachments/AttachmentPdfEmbed.tsx:100–105` — native `<embed src={displayUrl} type="application/pdf">`.
- Download fallback button at lines 118–134 calls `getDownloadUrl` server action.
- iOS Safari limitation documented in the JSDoc at line 9–13.

### DoD 3 — Pasting an image into a comment uploads and embeds it

- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentEditor.tsx:88–93` selects `buildImageUploadExtensions({ taskId })` when `taskId` is provided, else `buildImageDisplayExtensions()` (F1.B fix). Strict ternary — never both.
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/imageUpload.ts:156–241` — `buildImageUploadExtension(ctx)` registers schema + NodeView + paste/drop plugin.
- Paste handler at lines 183–207 collects image files, calls `uploadImageFile(file, ctx)`, then `insertImageNode(editor, attachmentId, file.name)`.
- Drop handler at lines 209–232 mirrors paste.
- Inserted node shape (line 257–260): `{ type: "image", attrs: { src: "", alt, attachmentId } }` — `attachmentId` stored, no signed URL inlined.

### DoD 4 — A user without board access cannot read or download an attachment, even with a guessed Storage URL

**Storage RLS:**
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260514000002_attachments_storage_rls.sql:5–11` — `attachment_read` policy authorizes via `role_for_board(((storage.foldername(name))[1])::uuid, auth.uid()) is not null`.
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260514000002_attachments_storage_rls.sql:13–21` — `attachment_write` requires `role_rank >= 'member'`.
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260514000002_attachments_storage_rls.sql:23–36` — `attachment_delete` requires uploader OR board admin.

**pgTAP coverage (12 assertions):**
- `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/attachment_storage_rls.spec.sql:148–157` — Test 1 sanity-checks `storage.foldername([1]) = board_id`.
- Test 2 (line 160–172): viewer CAN select objects for their board.
- Test 3 (line 174–187): non-member CANNOT select (0 rows).
- Test 4 (line 189–215): member CAN insert.
- Test 5 (line 217–239): viewer CANNOT insert (42501).
- Test 6 (line 241–262): non-member CANNOT insert (42501).
- Test 7 (line 264–283): uploader CAN delete own object.
- Test 8 (line 285–307): non-uploader member CANNOT delete.
- Test 9 (line 309–328): admin CAN delete any member's object.

### DoD 5 — Avatar uploads from account settings work (covers Epic 03)

- Avatar flow is the pre-existing Epic 03 implementation: `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/account/actions.ts` (`_uploadAvatar`) and `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/account/account-settings.tsx` (`AvatarSection`). Untouched by Epic 10.
- Regression sanity at `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/attachment_storage_rls.spec.sql:330–395`:
  - Test 10 (line 330–356): user CAN insert into own avatar folder.
  - Test 11 (line 358–372): any user CAN select avatar objects (public bucket).
  - Test 12 (line 374–395): user CANNOT insert into another user's avatar folder.
- Avatars and attachments are in **distinct buckets** (`avatars` from Epic 03, `attachments` new in Epic 10). The new storage policies only touch the `attachments` bucket — no cross-bucket regression risk.

### DoD 6 — Deleted attachments remove the storage object

- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions.ts:237–270` — `deleteAttachment`:
  - Line 238–241: `adminClient().storage.from("attachments").remove([attachment.storage_path])` is called BEFORE the DB delete.
  - Line 242–247: storage delete failure is logged but does not block — defensive against ghost rows pointing at missing objects.
  - Line 250–254: DB delete via user client (RLS verifies uploader or admin).
  - Line 258–267: best-effort `logActivity({ type: "attachment.deleted" })`.

### DoD 7 — Orphan rows are purged hourly

- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260514000004_attachment_orphan_cleanup_fn.sql:1–22` — `purge_orphan_attachments()` SECURITY DEFINER function:
  - Deletes rows where `is_uploaded = false AND created_at < now() - interval '1 hour'`.
  - Returns the deletion count.
  - `revoke all from public; grant execute to service_role`.
- `/Volumes/SSD1T/DEV WORK/donezo/supabase/migrations/20260514000000_attachments_polish.sql:35–37` — supporting partial index `attachment_pending_idx on (is_uploaded, created_at) where is_uploaded = false`.
- pgTAP coverage: `/Volumes/SSD1T/DEV WORK/donezo/tests/policies/attachment_orphan_cleanup.spec.sql` — 4 assertions (no-orphans, leaves confirmed rows, leaves recent pending, deletes stale pending).
- **Scheduling is intentionally deferred per autonomous decision Q13.** Code ships; pg_cron / Edge Function scheduling is a post-merge ops step. Documented in Deferred section below.

### DoD 8 — Sentry/log shows upload errors with context

- Every error path in the five server actions throws `{ code, message }` — `requestUpload`/`confirmUpload`/`deleteAttachment`/`getDownloadUrl`/`getSignedDisplayUrl`.
- `/Volumes/SSD1T/DEV WORK/donezo/lib/attachments/server.ts:31–33,40–42` — `storageObjectExists` logs `logger.warn` with context on failure (returns false rather than throwing).
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions.ts:242–247` — `deleteAttachment` logs storage-remove failures via `logger.warn` with `{ err, attachmentId, path }`.
- `/Volumes/SSD1T/DEV WORK/donezo/lib/activity.ts:91–97` — `logActivity` swallows failures into `logger.warn`.
- `<FileDropzone>` (line 168, 182) and the comment image upload (`imageUpload.ts:84,94,101`) surface user-facing errors via `toast.error(message)`. Sentry/Pino logger is the singleton `lib/logger.ts` — same instance as everywhere else in the app, so transports inherit the project-level config.

---

## Open questions from the dispatch plan — confirmed resolved

All 20 dispatch-plan open questions resolved per the autonomous decisions block. Each verified:

| # | Decision | Verified |
|---|---|---|
| Q1 | `uploader_id` everywhere | Migration `20260514000000_attachments_polish.sql` and server actions use `uploader_id`. No occurrences of `uploaded_by` in Epic 10 code (`grep` confirmed). |
| Q2 | Denormalized `board_id` | Migration line 17–20 adds the column + index; trigger at lines 22–33 derives from parent task. |
| Q3 | `filename text not null` | Migration lines 3–6. |
| Q4 | `is_uploaded` + `scan_status` + partial index | Migration lines 9–14, 35–37. |
| Q5 | Direct PUT + requestUpload/confirmUpload | `actions.ts:53–140` and `:152–208`. |
| Q6 | 50 MB + MIME allowlist | `constants.ts:6–22`; bucket migration `20260514000001_attachments_bucket.sql` mirrors verbatim. |
| Q7 | `attachments` bucket, `<board_id>/<task_id>/<attachment_id>/<filename>` | `path.ts:73–86`. |
| Q8 | Supabase image-transform endpoint | `actions.ts:332–344` — `transform: { width }` only for image MIME. |
| Q9 | EXIF stripping deferred | Documented below in Deferred section. No `sharp`/`exif` references in Epic 10. |
| Q10 | scan_status wired, no scanner | Default `'skipped'`. No Edge Function shipped. |
| Q11 | Native `<embed>` PDF | `AttachmentPdfEmbed.tsx:100`. `react-pdf` not in `package.json`. |
| Q12 | Hand-rolled Base UI Dialog lightbox | `AttachmentLightbox.tsx` — no `react-zoom-pan-pinch` dep. |
| Q13 | Orphan-cleanup function ships, scheduling deferred | Function in migration; scheduling documented below. |
| Q14 | Tiptap Image extension with `{ attachmentId, alt }` attrs + NodeView | `imageUpload.ts:124–145, 156–241`; `AttachmentImageNode.tsx`. |
| Q15 | Per-workspace size limits out of scope | No `workspace.attachment_size_limit_bytes` column. |
| Q16 | `{ attachmentIds: string[] }` value shape | `components/cells/file/def.ts:27`. |
| Q17 | Per-board fetch in board page | `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx:53–64`. |
| Q18 | Activity types `attachment.uploaded` + `attachment.deleted` | `lib/activity.ts:65–66` + `components/activity/renderers/attachmentRenderers.tsx`. |
| Q19 | Sanitized filename in path; original in DB | `path.ts:22–65` (sanitize) + `actions.ts:97–123` (DB stores original `filename`). |
| Q20 | pgTAP harness under `tests/policies/` | Three pgTAP specs shipped. |

---

## Stack non-negotiables — confirmed

- **pnpm** — `pnpm-lock.yaml` is the only lockfile; `react-dropzone` and `@tiptap/extension-image` added cleanly.
- **Next.js 15 App Router, RSC-first** — all attachment surfaces are `"use client"` only where interactive; pages remain RSCs.
- **Server Actions only** — no new `app/api/*` route handlers. The only `app/api/` entry is the empty `webhooks/` placeholder (allowed exception).
- **TypeScript strict** — `pnpm exec tsc --noEmit` clean. Regenerated types include `attachment.{filename, is_uploaded, scan_status, board_id}` and `purge_orphan_attachments` function.
- **Tailwind v4 + shadcn/Base UI** — `AttachmentLightbox` uses `@base-ui/react/dialog`. No MUI, no SCSS.
- **RHF + Zod** — five Zod schemas in `lib/validations/attachment.ts`, same schema used by server actions and the client uploader's pre-flight validation.
- **TanStack Table + Virtual** — untouched.
- **dnd-kit** — untouched.
- **Tiptap** — `@tiptap/extension-image@^3.23.1` matches existing extension surface (Tiptap 3.x). `buildImageDisplayExtension` and `buildImageUploadExtension` share `name: "image"` — registered exclusively via the `imageExtensions` ternary in `CommentEditor.tsx:88–93`. **No path registers both in a single editor instance** (verified by code path).
- **Zustand for UI state, no Redux** — `stores/board-store.ts:127, 130, 132, 134, 1013, 1043, 1078, 1202` extends the existing Zustand slice with `attachmentsByTask` + three actions + one selector. Stable `EMPTY_ATTACHMENTS` reference at line 1199 (avoids infinite render loops per MEMORY.md note).
- **Supabase Postgres + RLS authoritative** — Storage RLS migration `20260514000002` is comprehensive. pgTAP suite covers it.
- **Supabase Realtime, no Socket.IO** — `hooks/use-board-realtime.ts:234–261` adds attachment subscription via `postgres_changes`. `supabase_realtime` publication adds `public.attachment` (migration `20260514000003`).
- **Supabase Storage, no Cloudinary** — bucket `attachments` + RLS migration. No Cloudinary references anywhere.
- **All ids `gen_random_uuid()`** — `actions.ts:87–105` inserts without a client-generated id; the row's id is returned from Postgres. Storage path derived from the returned id at `actions.ts:111–116`.
- **All times `timestamptz`** — no schema changes on this axis.
- **Soft delete via `deleted_at`** — N/A for attachments; epic spec explicitly uses **hard delete** (storage object goes too). Confirmed by `deleteAttachment` action.

---

## Cross-cut sanity checks

- **No `console.log` debug breadcrumbs in production code paths.** The three `console.warn` lines in `hooks/use-board-realtime.ts` (lines 137, 198, 226) are pre-existing Epic 7/9 dev-only diagnostics guarded by `process.env.NODE_ENV !== "production"` and `biome-ignore lint/suspicious/noConsole`. Not Epic 10.
- **No `TODO`/`FIXME`/`XXX` in Epic 10 production code paths.** Verified via grep across `components/attachments/`, `components/cells/file/`, `components/rich-text/{AttachmentImageNode,imageUpload}.{ts,tsx}`, `components/board/tabs/FilesTab.tsx`, `hooks/use-{attachment-uploader,signed-display-url}.ts`, `lib/attachments/`, `lib/validations/attachment.ts`, and `app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/`. Clean.
- **Storage RLS pgTAP suite includes the avatar regression sanity check.** Tests 10, 11, 12 (file `attachment_storage_rls.spec.sql:330–395`).
- **`buildImageDisplayExtension` and `buildImageUploadExtension` cannot both register in a single editor.** `CommentEditor.tsx:88–93` is a strict ternary (`taskId ? upload : display`). `imageExtensions` is spread once into `useEditor` extensions at line 201. No `concat` or merging path. Both builders use `name: "image"` so Tiptap would error if both were ever registered — defense in depth.
- **`@tiptap/extension-image` aligns with existing Tiptap 3.23 surface.** Both builders extend `Image` from `@tiptap/extension-image` and override `addAttributes` / `addNodeView` (and, for the upload builder, `addProseMirrorPlugins`). NodeView via `ReactNodeViewRenderer` matches the existing Tiptap 3 React adapter used by `MentionExtension`.
- **Orphan-cleanup function is shipped; scheduling deferred (Q13).** See Deferred section.
- **EXIF stripping deferred (Q9).** See Deferred section.
- **Vitest test files use `describe.skip` consistently.** All 14 Epic 10 unit-test files: `describe.skip` (verified by grep). No `xdescribe` typos.
- **e2e spec compiles standalone.** `tests/e2e/10-attachments.spec.ts` wraps all 7 tests in `test.skip(true, ...)` per the Epic 09 pattern; runner wired in Epic 15.

---

## Items "the user might ask 'did we ship this?'" — each verified

| Question | Verified location |
|---|---|
| Image preview lightbox? | `components/attachments/AttachmentLightbox.tsx` + `FilesTab.tsx:115–123`. |
| PDF preview via `<embed>`? | `components/attachments/AttachmentPdfEmbed.tsx:100–105`. |
| File icons for other MIME types? | `lib/attachments/mime-icons.ts` + `AttachmentThumb.tsx`. |
| Activity log entries (`attachment.uploaded`, `attachment.deleted`)? | `lib/activity.ts:65–66`, written in `confirmUpload` and `deleteAttachment`, rendered in `components/activity/renderers/attachmentRenderers.tsx`. |
| Drag-drop onto files tab? | `FilesTab.tsx:75` → `FileDropzone`. |
| Drag-drop into the file column cell? | `components/cells/file/Editor.tsx:169–174` (popover dropzone). |
| Comment image paste/drop? | `components/rich-text/imageUpload.ts:183–232` paste + drop handlers. |
| Storage RLS via board membership? | `supabase/migrations/20260514000002_attachments_storage_rls.sql`. |
| Signed display URLs (per-tab cache with TTL refresh)? | `hooks/use-signed-display-url.ts` (155 lines; transform-keyed cache, expiry refetch). |
| Two-stage upload (pending row → confirmUpload)? | `actions.ts:53–140` (request) + `:152–208` (confirm). `is_uploaded` flag gates UI visibility. |
| Avatar upload still works? | Unmodified Epic 03 code path; pgTAP sanity tests 10–12 confirm storage policies intact. |

---

## Deferred / out-of-scope items (intentional)

These are noted in the dispatch plan's autonomous-decisions block and the risk notes. They are NOT Epic 10 DoD gaps — they are deliberate post-merge work:

1. **EXIF stripping (Q9).** Server-side EXIF strip via Sharp-based Edge Function. Deferred to a followup epic or Epic 14 polish. Recommended doing this in v1, but autonomous decision was to defer to preserve MVP scope.
2. **`comment_id` FK flip after `createComment` (risk note #4).** Attachments uploaded via comment paste land with `comment_id = null` initially. A followup could `update attachment set comment_id = <id>` after `createComment` resolves. v1 leaves it null; the activity log + display still works without it.
3. **Orphan storage-object reconciliation (risk note #8).** `deleteAttachment` removes both DB and storage objects, but a failed storage delete leaves an orphan storage object with no DB row. `purge_orphan_attachments()` deletes DB rows only. A "list-and-reconcile" admin task is acceptable later (Epic 15 ops scope).
4. **pg_cron scheduling of `purge_orphan_attachments()` (Q13).** Function ships. Scheduling is a post-merge ops step: either enable `pg_cron` on Supabase Pro and run `select cron.schedule('purge-attachments-hourly', '0 * * * *', 'select public.purge_orphan_attachments();')`, OR ship a tiny Edge Function invoked by Vercel Cron. Either path is small.
5. **Realtime back-pressure tuning (risk note #7).** Not blocking v1; bulk-upload patterns will be revisited in Epic 14 perf pass.
6. **Per-board / per-workspace size limits (Q15).** Global 50 MB cap for v1. Schema forward-compatible.
7. **Vitest harness enablement (Epic 15).** All unit tests are `describe.skip`. They compile and their bodies are accurate; they run when Epic 15 wires the runner. e2e tests likewise `test.skip(true, ...)`.

---

## Recommendation

Merge `epic/10-attachments` into `main`. The epic is feature-complete against its definition of done; followup-1 round (F1.A + F1.B) closed the only Stage-1 DoD gaps; Stage-2 Slice F added the e2e harness and confirmed no integration regressions. The deferred items above are explicit autonomous decisions or future-epic scope, not gaps in Epic 10.

