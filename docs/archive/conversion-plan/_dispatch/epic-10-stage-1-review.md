# Epic 10 — Stage 1 Re-Review (post Followup Round 1)

## Verdict

**CLEAN.** Stage 1 (Slices A + B + C + D + E + F1.A + F1.B) meets Epic 10's Stage-1 definition of done. **Ready to dispatch Stage 2 (Slice F integration).**

---

## Scope reviewed

- Epic branch: `epic/10-attachments` at `97e2ce8`.
- Diff range: `main..97e2ce8` (commits below).
- Documents:
  - `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/10-attachments.md`
  - `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-10.md`
  - `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-10-followup-1.md`

Commit sequence on the epic branch since main:

```
97e2ce8 merge followup-1 slice F1.B (comment image read-mode) into epic/10-attachments
d1fbd83 merge followup-1 slice F1.A (cell editor row prop) into epic/10-attachments
1008134 fix(epic-10): thread task row through CellEditor to FileEditor
1ecd7ae fix(epic-10): register image NodeView unconditionally for read-mode comment rendering
778821a feat(epic-10): surface wiring — FilesTab, file cell editor, image upload, activity renderers (Slice E)
d91006d merge slice C (store + realtime) into epic/10-attachments
daa846e merge slice D (dropzone + image) into epic/10-attachments
65dfb0a merge slice B (server actions) into epic/10-attachments
0c20e7d feat(epic-10): add FileDropzone, attachment display components, upload hooks (Slice D)
ec01501 feat(epic-10): add attachment server actions and supporting helpers (Slice B)
a025bb7 feat(epic-10/c): add attachments state slice, realtime handler, and page hydration
288219b merge slice A (storage foundation) into epic/10-attachments
209186c test(epic-10): add pgTAP specs for attachment storage RLS, board_id trigger, orphan cleanup
8aa8ad9 feat(epic-10): extend ActivityType union with attachment.uploaded + attachment.deleted
9dcda49 types(epic-10): regen Supabase types — attachment columns + purge fn
7526d06 schema(epic-10): add attachment columns, bucket, storage RLS, realtime publication, and orphan cleanup fn
ff1aa90 docs(dispatch): add approved dispatch plan for epic 10 (attachments)
```

---

## Followup Round 1 — verification

### Slice F1.A: thread `row`/`task` through `<CellEditor>` to `<FileEditor>`

**Verified files:**

- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/CellEditor.tsx`
  - Lines 170–183 build `editorProps` and now include `row: task` and `task` alongside the prior optional extras. Comment at line 179–181 explicitly calls out that other editors ignore the prop and the `as any` boundary cast at lines 203 / 213 permits the structurally extra props.
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Editor.tsx`
  - Lines 42–49: `FileEditorProps.row` is **required** (`row: { id: string }`) — Option A from the F1.A spec.
  - Line 140: `const taskId = row.id;` — the silent `?? ""` fallback is gone.
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/def.ts`
  - Line 64: `Editor: Editor as any` — documented boundary cast. The leading comment (lines 63) explains why.

**Cross-cell regression check:**

- `components/cells/text/def.ts`, `components/cells/status/def.ts`, `components/cells/person/def.ts`, `components/cells/number/def.ts` all import their `Editor` and assign it directly to `CellTypeDef.Editor` with **no** `as any` — they remain structurally compatible because the base contract is `{ value, config, onChange, onClose }` and they ignore the extra `row` / `task` props passed by the orchestrator.
- `pnpm tsc --noEmit` clean on epic branch HEAD (after clearing stale `.next/types`).

**DoD met for F1.A:**
- `<CellEditor>` threads `row` and `task` to every `<def.Editor>` instance.
- `<FileEditor>` requires `row.id` (no silent empty-string fallback).
- Typecheck clean across the tree.
- No new test files needed; existing `tests/unit/FileCellEditor.test.tsx` already references `row={ROW}` and stays `describe.skip` per the epic-15 deferral.

---

### Slice F1.B: register attachment-image NodeView unconditionally for read-mode

**Verified files:**

- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/imageUpload.ts`
  - Lines 124–145: `buildImageDisplayExtension()` — registers `name: "image"`, the four attrs (`src`, `alt`, `title`, `attachmentId`), the `ReactNodeViewRenderer(AttachmentImageNode)` NodeView, and **no** ProseMirror plugins.
  - Lines 156–241: `buildImageUploadExtension(ctx)` — same schema + NodeView, **plus** the paste/drop upload plugin keyed by `imageUploadPluginKey`.
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/extensions.ts`
  - Lines 54–56: `buildImageDisplayExtensions()` wraps the display builder in a single-element array.
  - Lines 72–74: `buildImageUploadExtensions(ctx)` wraps the upload builder in a single-element array.
- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentEditor.tsx`
  - Lines 88–96: `imageExtensions` memo selects upload when `taskId` is provided, display otherwise. Memoized on `[taskId]`.
  - Line 204: extensions array spreads `...imageExtensions` into `useEditor` — exactly one of the two builders ever runs per editor instance.

**One-or-the-other invariant:**

Both builders extend `@tiptap/extension-image` and declare `name: "image"`. Tiptap rejects duplicate node names in a single editor's schema. The `imageExtensions` memo is a strict ternary (no `concat`, no spread of both), so each `useEditor` call receives at most one of them. **Verified safe by code path inspection** — there is no path in `CommentEditor` that includes both simultaneously.

**Consumers (no regressions):**

- `components/comments/CommentBody.tsx:47` — `<CommentEditor initialDoc={doc} readOnly mentionableMembers={[]} />`. No `taskId` → display branch → embedded images render via `AttachmentImageNode`.
- `components/comments/CommentItem.tsx:332` (`InlineEditForm`) — no `taskId` passed → display branch. Pre-existing embedded images survive entering edit mode (the prior bug where they were silently dropped is fixed). Note: per the F1.B spec, image upload from inline-edit context is intentionally NOT enabled in v1.
- `components/comments/CommentComposer.tsx:162` — `taskId={taskId}` → upload branch (compose path unchanged).

**DoD met for F1.B:**
- `buildImageDisplayExtension()` registers schema + NodeView with no plugin.
- `buildImageUploadExtension(ctx)` continues to ship the schema + NodeView + paste/drop plugin.
- `CommentEditor` selects exactly one builder based on `taskId`.
- Typecheck clean.
- `tests/unit/comment-image-upload.test.ts` carries a new `describe.skip("comment image display (no-taskId render path)")` block (lines 216–233) with the asserted behavior in the comment.

---

## Re-spot-check of remaining Stage-1 DoD

Verified once more that none of these regressed under the followup edits:

- **Migrations land.** All five Epic-10 migrations present in `supabase/migrations/`:
  - `20260514000000_attachments_polish.sql`
  - `20260514000001_attachments_bucket.sql`
  - `20260514000002_attachments_storage_rls.sql`
  - `20260514000003_attachments_realtime_publication.sql`
  - `20260514000004_attachment_orphan_cleanup_fn.sql`
- **Server actions.** `app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions.ts` (354 lines) ships `requestUpload`, `confirmUpload`, `deleteAttachment`, `getDownloadUrl`, `getSignedDisplayUrl`.
- **Board store + realtime.** `stores/board-store.ts` exposes `attachmentsByTask`, `hydrateAttachmentsForBoard`, `applyAttachmentUpsert`, `applyAttachmentDelete`, `selectAttachmentsForTask` with stable `EMPTY_ATTACHMENTS` fallback. `hooks/use-board-realtime.ts:235–257` subscribes to `attachment` postgres changes and routes to the store actions.
- **Surface wiring.** `components/board/tabs/FilesTab.tsx` rendered by `components/board/TaskDrawer.tsx` for the Files tab. `components/activity/renderers/attachmentRenderers.tsx` exported and merged via `components/activity/renderers/index.ts` (`...attachmentRenderers`). Attachment display primitives (`AttachmentThumb`, `AttachmentTile`, `AttachmentImage`, `AttachmentPdfEmbed`, `AttachmentLightbox`) and `FileDropzone` all under `components/attachments/`.
- **Stack defaults.** No `/api/*` routes; no MUI/SCSS; pnpm lockfile current; ids `gen_random_uuid()`; timestamps `timestamptz`. Verified during round-1 review and unchanged in the followup edits.

---

## Stage 2 readiness

The Stage 2 slice plan (Slice F integration: `app/page.tsx` hydration of attachments + final integration tests that exercise the cell-editor → upload → realtime → store path end-to-end) can proceed against this clean Stage 1 baseline.

No new open questions surfaced; no architectural drift discovered.

---

## File paths cited in this review (absolute)

- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/CellEditor.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Editor.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/def.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/imageUpload.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/extensions.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentEditor.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentBody.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentComposer.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentItem.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/tabs/FilesTab.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/board/TaskDrawer.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/activity/renderers/attachmentRenderers.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/activity/renderers/index.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/stores/board-store.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/hooks/use-board-realtime.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/FileCellEditor.test.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/comment-image-upload.test.ts`
