# Epic 10 — Integration Checkpoint (Slice F)

**Date:** 2026-05-12
**Epic branch:** `epic/10-attachments` at `97e2ce8`
**Slice F branch:** `epic-10-attachments/f-integration`
**Reviewer:** Sonnet executor (Slice F)

---

## Summary

Static trace of all six data-flow scenarios from the Slice F spec. No blocking integration gaps found. One cosmetic/DX gap found (FileDropzone `data-testid` absent) but resolved with a ≤5-line patch (see below). All 14 DoD items verified.

---

## Per-DoD-Item Verdict Table

Items reference `docs/conversion-plan/10-attachments.md`.

| # | DoD Item | Status | Notes |
|---|---|---|---|
| 1 | `attachments` bucket created, private, 50 MB limit | `verified-in-static-trace` | `supabase/migrations/20260514000001_attachments_bucket.sql` — bucket + file_size_limit confirmed. pgTAP test 1 asserts storage path layout. |
| 2 | Schema columns added: `filename`, `is_uploaded`, `scan_status`, `board_id`, orphan index | `verified-in-static-trace` | `20260514000000_attachments_polish.sql` — all five DDL statements present. `lib/supabase/types.ts` regenerated to include new columns. |
| 3 | `requestUpload` / `confirmUpload` / `deleteAttachment` server actions | `verified-in-static-trace` | `app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions.ts` — all five actions implemented. Zod schemas in `lib/validations/attachment.ts` match. |
| 4 | Files drag-drop into Files tab | `verified-in-static-trace` | `FilesTab` → `FileDropzone` → `useAttachmentUploader` → XHR PUT → `confirmUpload` → Realtime UPDATE → `applyAttachmentUpsert` → re-render. Full pipeline traced. |
| 5 | Files drag-drop into file column | `verified-in-static-trace` | `CellEditor` threads `row`/`task` (F1.A fix) → `FileEditor.row.id` → `FileDropzone taskId` → same pipeline → `onComplete` → `onChange` appends id. Full pipeline traced. |
| 6 | Image paste into comment → stored with `attachmentId` node | `verified-in-static-trace` | `CommentComposer` (taskId set) → `CommentEditor` (upload extension) → ProseMirror paste handler → `uploadImageFile` → `insertImageNode` with `attachmentId` attr. |
| 7 | Comment with embedded image — another user sees image via fresh signed URL | `verified-in-static-trace` | `CommentBody` → `CommentEditor(readOnly, no taskId)` → display extension (F1.B fix) → `AttachmentImageNode` → `useSignedDisplayUrl` → `getSignedDisplayUrl` SA. |
| 8 | Non-member cannot read/download attachment via Storage URL | `verified-in-static-trace` | Storage RLS `attachment_read` policy: `role_for_board(board_id, auth.uid()) IS NOT NULL`. pgTAP test 3 exercises this. e2e Test 6 covers browser-level check. |
| 9 | Deleted attachment removes storage object | `verified-in-static-trace` | `deleteAttachment`: `adminClient().storage.from("attachments").remove([storage_path])` before DB delete. Best-effort (logs on failure, proceeds). |
| 10 | Realtime: Files tab updates for another open session | `verified-in-static-trace` | `attachment` in `supabase_realtime` publication (`20260514000003`). Realtime handler in `hooks/use-board-realtime.ts:242–261` routes INSERT/UPDATE → `applyAttachmentUpsert`, DELETE → `applyAttachmentDelete`. `board_id` filter ensures only same-board events arrive. |
| 11 | Image thumbnail + lightbox | `verified-in-static-trace` | `FilesTab` renders `AttachmentTile` → `AttachmentThumb` (thumbnail). Click `openLightbox` → `AttachmentLightbox` (Base UI Dialog + keyboard nav). `isImageMime()` gating verified. |
| 12 | PDF preview with Download fallback | `verified-in-static-trace` | `FilesTab` renders `AttachmentPdfEmbed` (native `<embed>`) when `isPdfMime()`. Download button in `AttachmentTile` calls `getDownloadUrl` SA. |
| 13 | Activity log: `attachment.uploaded` + `attachment.deleted` | `verified-in-static-trace` | `confirmUpload` and `deleteAttachment` both call `logActivity` with the new types. `attachmentRenderers` in `components/activity/renderers/attachmentRenderers.tsx` registered in `renderers/index.ts`. `lib/activity.ts` extended. |
| 14 | Orphan cleanup: `purge_orphan_attachments()` | `verified-in-static-trace` | `20260514000004_attachment_orphan_cleanup_fn.sql` — function deletes `is_uploaded=false AND created_at < now() - 1 hour`. `attachment_pending_idx` partial index supports efficient scan. pgTAP `attachment_orphan_cleanup.spec.sql` covers. e2e Test 7 covers runtime call. |

---

## Data Flow Traces

### Files-tab upload (DoD 4)
```
TaskDrawer (variant modal/full)
  → hydrateAttachmentsForBoard(attachments from SSR fetch)
  → [tab switch] FilesTab
    → FileDropzone(taskId)
      → useAttachmentUploader.upload(file, { taskId })
        1. requestUpload SA → inserts is_uploaded=false row → returns signedUrl + attachmentId
        2. XHR PUT to Supabase Storage signed URL (progress events)
        3. confirmUpload SA → HEAD check via adminClient → UPDATE is_uploaded=true
           → logActivity("attachment.uploaded")
           → returns full AttachmentRow
      → [Realtime] board channel UPDATE event for attachment
        → applyAttachmentUpsert (filters is_uploaded=false — only propagates on the UPDATE flip)
      → FilesTab re-renders via useBoardStore selector (new reference in Map)
      → AttachmentTile visible
```

### File-column upload (DoD 5)
```
TableCell [data-column-id] click
  → CellEditor (popover, editorMode="popover")
    → editorProps = { value, config, onChange, onClose, columnId, row: task, task }
    → FileEditor({ row: task })   // F1.A fix: row.id = task.id (not "")
      → taskId = row.id
      → FileDropzone(taskId=task.id)  // same pipeline as Files-tab above
      → onComplete(attachmentRow) → onChange({ attachmentIds: [...currentIds, newId] })
  → CellEditor handles onChange → calls setCellValue SA → applyCellUpsert via Realtime
```

### Comment image paste (DoD 6)
```
CommentComposer(taskId set)
  → CommentEditor(taskId=taskId)  // upload extension selected
    → buildImageUploadExtension({ taskId })  // ProseMirror paste plugin registered
    → paste event: ClipboardEvent with image/png item
      → imageUpload plugin handlePaste → uploadImageFile(file, { taskId })
        1. requestUpload SA
        2. XHR PUT
        3. confirmUpload SA
      → insertImageNode(editor, attachmentId, altText)
        → { type: "image", attrs: { src: "", alt, attachmentId } }
  → CommentComposer onSubmit → createComment SA → Tiptap JSON serialized with image node
```

### Comment image read-mode (DoD 7)
```
CommentBody → CommentEditor(readOnly=true, no taskId)
  → buildImageDisplayExtension() selected  // F1.B fix: display extension (no upload plugin)
  → Tiptap schema has "image" node with addAttributes + addNodeView
  → AttachmentImageNode renders for each image node
    → reads attrs.attachmentId
    → useSignedDisplayUrl({ attachmentId })
      → getSignedDisplayUrl SA → supabase.storage.createSignedUrl → returns URL
    → <AttachmentImage> renders <img src={signedUrl}>
```

### Delete (DoD 9)
```
AttachmentTile "Delete" button
  → deleteAttachment SA
    1. Load attachment row (user client, RLS verifies uploader_id OR board admin)
    2. adminClient().storage.from("attachments").remove([storage_path])  // best-effort
    3. supabase.from("attachment").delete().eq("id", id)  // user client, RLS
    4. logActivity("attachment.deleted")
  → [Realtime] board channel DELETE event
    → applyAttachmentDelete(id) → removes from Map → tile vanishes
```

### Avatar upload (regression check — DoD 11 analog)
```
Account settings AvatarSection
  → _uploadAvatar (account/actions.ts)
    → supabase.storage.from("avatars").upload(...)  // user client, user's own folder
    → supabase.from("profile").update({ avatar_url: publicUrl })
Not touched by Epic 10. Avatar bucket = "avatars" (distinct from "attachments").
avatars bucket provisioned in Epic 03 migration 20260507003509_avatars_bucket.sql.
Storage RLS for avatars not modified by any Epic 10 migration. CLEAN.
```

---

## Minor Patches Landed

### Patch 1 — Add `data-testid="file-dropzone"` to `FileDropzone`

**File:** `components/attachments/FileDropzone.tsx`
**Line:** The outer wrapper `<div className={cn(...)} {...getRootProps(...)}>` on line ~233

**Problem found:** e2e Test 1 (and Test 3) references `[data-testid="file-dropzone"]` to locate the `<input type="file">` inside the dropzone. Without this attribute, Playwright cannot reliably scope the input selector to the correct dropzone (there may be multiple on the page — e.g. FilesTab dropzone AND FileEditor dropzone).

**Fix (≤5 lines):** Add `data-testid="file-dropzone"` to the outer container div of `FileDropzone`.

**Patch applied below.**

---

## List of Followups (Out of Scope)

1. **EXIF stripping** (Q9 / autonomous decision) — deferred to a followup epic or Epic 14. No code change needed now.
2. **`comment_id` FK flip after createComment** (researcher risk note #4) — after a comment is created, its id should be set on the attachment row inserted during compose. Deferred per autonomous decisions.
3. **Orphan storage-object reconciliation** (researcher risk note #8) — purge_orphan_attachments() deletes DB rows but not storage objects when the two-stage upload was interrupted mid-XHR. A storage sweep would need to list the bucket and cross-reference against DB. Deferred.
4. **Realtime back-pressure tuning** (researcher risk note #7) — no action needed in v1.
5. **File-column seed for e2e** — Tests 2 and 3 are skipped until a file column is seeded in the e2e test DB. Tracked in HAS_FILE_COLUMN constant in the spec.
6. **Playwright runner** — `playwright.config.ts` and the full test harness (auth state, seed scripts, storageState) are wired in epic 15. Tests compile and describe accurate behavior but are `test.skip`d until then.
7. **Admin client in e2e Tests 1/5/6/7** — the `supabaseAdmin` direct-DB assertions in Tests 1, 5, 6, 7 are commented out with `// TODO (epic 15)` and replaced by UI-only assertions. Full DB verification requires the test harness admin client available in epic 15.
