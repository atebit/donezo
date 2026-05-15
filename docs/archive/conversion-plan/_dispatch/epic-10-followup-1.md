# Epic 10 — Followup Round 1

## Review summary

- **Stage reviewed:** Stage 1 cumulative (commit `778821a` — union of slices A–E on the epic branch). Diff range: `main..778821a`.
- **Verdict:** `FOLLOWUP REQUIRED`
- **Definition-of-done items met:**
  - A user without board access cannot read or download an attachment via Storage URL (pgTAP tests 3 + 6 + 8 verify the RLS policies are correct; storage path layout matches `((storage.foldername(name))[1])::uuid = boardId` per pgTAP test 1).
  - Avatar uploads from account settings work (pgTAP tests 10/11/12 — risk-note #11 regression check intact).
  - Deleted attachments remove the storage object (`deleteAttachment` server action calls `adminClient().storage.from("attachments").remove([storage_path])` before the DB delete).
  - Orphan rows are purged hourly — SQL function `purge_orphan_attachments()` ships and is pgTAP-covered. Scheduling is intentionally deferred per Q13 of autonomous decisions; not a Stage-1 gap.
  - Sentry/log shows upload errors with context — server actions throw structured `{ code, message }` errors, FileDropzone surfaces them via sonner, and `logActivity`/`logger.warn` cover the rest.
  - PDFs embed via native `<embed>` with a Download fallback (`<AttachmentPdfEmbed>`).
  - Images render inline with thumbnails AND open in a lightbox **for the Files tab and file column** (FilesTab + AttachmentLightbox + AttachmentThumb + AttachmentImage all wired and reading the store correctly).

- **Definition-of-done items NOT met:**
  1. **"Files drag-drop into … the file column."** The file-column popover Editor is non-functional at runtime — see Gap A.1.
  2. **"Pasting an image into a comment … another user views the comment in their session → image loads via fresh signed URL."** The compose-path works, but **read-mode rendering** of an existing comment containing an embedded attachment image is silently broken — the `@tiptap/extension-image` schema is only registered when `taskId` is passed to `<CommentEditor>`, and neither `<CommentBody>` nor `<CommentItem>`'s inline-edit `<CommentEditor>` passes one. The doc's `image` node is dropped from the Tiptap schema and never reaches `<AttachmentImageNode>`. See Gap A.2.

- **Other issues found:**
  - None of the verified items required followup beyond the two above.
  - Stack drift check: CLEAN (no `/api/*` routes, no MUI/SCSS, pnpm lockfile correctly updated for `react-dropzone` and `@tiptap/extension-image`, all ids `gen_random_uuid()`, RLS authoritative).
  - Slice B/D coordination: clean — Slice B's `actions.ts` is the real implementation; no stub residue from Slice D.
  - All Vitest test files use `describe.skip` (Epic 15 enabling) and describe the right assertions; pgTAP suite is comprehensive and includes the avatar regression sanity (risk-note #11).
  - Realtime delivery: confirmed correct. `attachment` is in `supabase_realtime` publication, `applyAttachmentUpsert` filters out `is_uploaded=false`, and the UPDATE on `confirmUpload` carries the full post-update row (default replica identity ships all replicated columns in NEW). The `is_uploaded` flip will surface in subscribed tabs as expected.
  - Trigger correctness: `attachment_board_id_consistency` fires `BEFORE INSERT OR UPDATE OF task_id`; Slice B's `requestUpload` passes both `task_id` and the matching `board_id` on insert, and the subsequent UPDATE only touches `storage_path` (so the trigger does not fire spuriously). pgTAP `attachment_board_id_consistency.spec.sql` covers the bad-board_id and the task_id-rederive cases.

---

## Stack reminders (CLAUDE.md — restated for executors)

- pnpm only.
- Next.js 15 App Router, RSC-first. `"use client"` only for interactivity.
- Server Actions for mutations. No `/api` route handlers.
- TypeScript strict; the `CellTypeDef.Editor` generic signature is `{ value, config, onChange, onClose }` — any additional props must be structurally compatible and the orchestrator boundary cast (`def.Editor as any`) is the documented escape hatch.
- Tailwind v4 + Base UI / shadcn primitives. No MUI, no SCSS.
- All ids `uuid v4` from Postgres `gen_random_uuid()`.

---

## Followup slices

**Both slices below are surgical fixes against specific Stage 1 DoD gaps. No scope expansion. They are independent and parallel-safe — they touch disjoint file sets.**

---

### Slice F1.A — Thread `row`/`task` through `<CellEditor>` to `<def.Editor>`

**Branch:** `epic/10-attachments/f1-a-cell-editor-row-prop`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/CellEditor.tsx` (extend the `editorProps` spread block — ~3-line addition)
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Editor.tsx` (tighten the `row` prop type — remove `| undefined` if appropriate; or leave it optional and stop falling back to `""`)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/FileCellEditor.test.tsx` (already references `row={ROW}`, no change needed — but verify after the prop is plumbed)

**Forbidden:** Any other cell type's `Editor.tsx` (Slices E established the file editor as the only one that reads `row`; other editors don't consume it). Any board store / realtime hook / server action / migration. Any `app/` route.

**Depends on:** none (this is a tiny orchestrator wiring fix).

**Spec:**

The bug: `components/cells/CellEditor.tsx:170-179` builds `editorProps` and passes it through `<def.Editor {...editorProps}>`. Today it threads `columnId`, `members`, and `currentUserId` as optional extras, but **does not** thread the parent `task` row. `<FileEditor>` reads `row?.id ?? ""` (line 140 of `components/cells/file/Editor.tsx`) and silently falls back to an empty-string `taskId`. At runtime:

- `selectAttachmentsForTask(state, "")` returns the stable `EMPTY_ATTACHMENTS` reference (no crash, just blank UI).
- `<FileDropzone taskId="">` calls `requestUpload({ taskId: "", ... })`, which fails `z.string().uuid()` validation in `RequestUploadSchema`. The user sees a "Couldn't save"-style toast on every upload attempt.

This breaks the DoD: "Files drag-drop into … the file column."

#### F1.A.1 — Edit `components/cells/CellEditor.tsx`

In `CellEditorInner`, extend the `editorProps` object to include the task row:

```ts
const editorProps = {
  value: currentValue,
  config,
  onChange: handleChange,
  onClose: handleEditorClose,
  // Optional extras threaded from orchestrator context:
  columnId: column.id,
  members: undefined,
  currentUserId: currentUserIdRef.current,
  // Epic 10 — file editor needs the task row to derive taskId for upload context.
  // Other editors ignore this prop (structural compatibility).
  row: task,
  task,
};
```

Pass both `row` (matching the file editor's prop name) and `task` (matching the `Cell` contract's `row`/the `TableCell.tsx` precedent at line 87) so we don't lock in a single name. The boundary cast `def.Editor as any` already permits extra props.

#### F1.A.2 — Edit `components/cells/file/Editor.tsx`

Change the prop interface to require the row (or at least to type the fallback as an actual error path, not silent `""`):

Option A (recommended — strict required):
```ts
interface FileEditorProps {
  value: FileCellValue | null;
  config: Record<string, never>;
  onChange: (next: FileCellValue | null) => void;
  onClose: () => void;
  /** The task row from the CellEditor orchestrator. REQUIRED — provides taskId. */
  row: { id: string };
}
```

And remove the `row?.id ?? ""` fallback (line 140) to a direct `row.id`.

Option B (keep optional, fail loud): if executor decides type strictness across the registry is painful (some other Editor signatures only declare the base 4 props), keep `row?` optional but, when absent, render a non-functional error state instead of silently mounting a broken dropzone:

```ts
if (!row?.id) {
  // Orchestrator did not provide the task row — this is a wiring bug, not a user error.
  if (process.env.NODE_ENV !== "production") {
    console.error("[FileEditor] missing `row` prop from CellEditor orchestrator");
  }
  return (
    <div className="p-2 text-xs text-[var(--color-danger)]">
      File editor unavailable: missing task context.
    </div>
  );
}
const taskId = row.id;
```

The executor may pick either; both fix the DoD gap. Option A is cleaner; Option B is defensive.

#### F1.A.3 — Tests

`tests/unit/FileCellEditor.test.tsx` already mocks `row={ROW}` for every test case, so no test change is needed. If Option A is chosen, the executor should additionally verify the new required-prop type compiles cleanly with `pnpm tsc --noEmit`.

**Definition of done:**
- `<CellEditor>` passes `row` (and `task`) through to every `<def.Editor>`.
- `<FileEditor>` no longer reads `row?.id ?? ""`; either requires `row.id` or fails loud + visibly when absent.
- `pnpm tsc --noEmit` is clean across the whole tree.
- The Vitest test file remains `describe.skip` (Epic 15 deferred). No new test files needed.

**Escalation triggers:**
- If tightening `FileEditorProps.row` to required cascades type errors through `def.Editor` boundary in 3+ unrelated cell types, stop and return a `needs-direction` report — the choice between Option A and Option B is significant enough that we'd want the alternative confirmed.

---

### Slice F1.B — Register the attachment-image NodeView unconditionally for read-mode comment rendering

**Branch:** `epic/10-attachments/f1-b-comment-image-readmode`

**Owns (write):**
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/imageUpload.ts` (extend — add a `buildImageDisplayExtension()` builder that registers the schema + NodeView **without** the paste/drop ProseMirror plugin)
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/extensions.ts` (extend — export `buildImageDisplayExtensions()` companion to `buildImageUploadExtensions()`)
- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentEditor.tsx` (extend — register the display extension unconditionally; keep upload extension gated on `taskId`)
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/comment-image-upload.test.ts` (extend — add one describe.skip case asserting read-mode renders the NodeView when no `taskId` is provided)

**Forbidden:** `<FileDropzone>`, the board store, the realtime hook, the server actions, `app/(app)/account/`, any migration, `<CommentBody>` and `<CommentItem>` themselves (the fix happens inside CommentEditor so the consumers don't need updates).

**Depends on:** none (independent of F1.A; can run in parallel).

**Spec:**

The bug: `<CommentEditor>` only registers the Tiptap Image extension (`buildImageUploadExtension`) when `taskId` is provided. The Image extension's `addAttributes` + `addNodeView` are what make the `image` node renderable. Without it:

- `<CommentBody>` (read-only, no `taskId`) → Tiptap schema lacks `image` node → embedded image nodes are silently dropped from rendered content.
- `<CommentItem>` inline-edit (no `taskId` passed) → same problem; pre-existing embedded images vanish on entering edit mode and are not saved back to the doc.

This breaks the DoD: "another user views the comment in their session → image loads via fresh signed URL."

The fix is structural: split the current `buildImageUploadExtension(ctx)` into two builders. One owns the **schema + NodeView** (works in any context, no `ctx` required). The other owns the **paste/drop ProseMirror plugin** (requires `ctx.taskId`). Register the first unconditionally; layer the second on top when `taskId` is present.

#### F1.B.1 — Edit `components/rich-text/imageUpload.ts`

Refactor to export two builders. Keep the existing `buildImageUploadExtension(ctx)` API working for backward compatibility (it remains the all-in-one for compose contexts), but underlying it now extends the new display builder.

```ts
/**
 * Display-only Image extension: registers the `image` node schema with the
 * `attachmentId` custom attr and the AttachmentImageNode React NodeView.
 * Does NOT install paste/drop upload plugins.
 *
 * Use this in read-only or no-taskId contexts (CommentBody, inline edit of
 * existing comments) so embedded attachment images render correctly.
 */
export function buildImageDisplayExtension() {
  return Image.extend({
    name: "image",
    addAttributes() {
      return {
        src: { default: null },
        alt: { default: null },
        title: { default: null },
        attachmentId: { default: null },
      };
    },
    addNodeView() {
      return ReactNodeViewRenderer(AttachmentImageNode);
    },
  }).configure({
    inline: false,
    allowBase64: false,
  });
}

/**
 * Compose-mode Image extension: display extension + paste/drop upload plugin.
 * Requires `ctx.taskId` for the upload pipeline.
 */
export function buildImageUploadExtension(ctx: ImageUploadCtx) {
  // ... existing implementation unchanged ...
}
```

Implementation note: do not double-register the `image` node. Tiptap rejects duplicate `name` extensions in a single editor. The fix is to register **either** `buildImageDisplayExtension()` (read/edit-without-taskId) OR `buildImageUploadExtension(ctx)` (compose-with-taskId), never both in the same editor instance. The CommentEditor change in F1.B.3 does this.

#### F1.B.2 — Edit `components/rich-text/extensions.ts`

Add a companion export:

```ts
import { buildImageDisplayExtension, buildImageUploadExtension } from "./imageUpload";

export function buildImageDisplayExtensions() {
  return [buildImageDisplayExtension()];
}

export function buildImageUploadExtensions(ctx: ImageUploadCtx) {
  return [buildImageUploadExtension(ctx)];
}
```

#### F1.B.3 — Edit `components/comments/CommentEditor.tsx`

In `CommentEditor`, change the `imageExtensions` memo to register the upload extension when `taskId` is present AND the display extension otherwise:

```ts
const imageExtensions = useMemo(
  () =>
    taskId
      ? buildImageUploadExtensions({ taskId })
      : buildImageDisplayExtensions(),
  [taskId],
);
```

Imports:

```ts
import {
  buildBaseExtensions,
  buildImageDisplayExtensions,
  buildImageUploadExtensions,
} from "@/components/rich-text/extensions";
```

The downstream `CommentEditorInner` already spreads `...imageExtensions` into the `useEditor` extensions array — no further change needed there.

**Important constraint:** the `buildImageDisplayExtensions()` extension still uses `<AttachmentImage>` (which calls `getSignedDisplayUrl`). That server action returns 200 only when the calling user has board access to the attachment's `task.board_id`. For users viewing a comment they have access to, this works. For server-side RSC rendering of a comment body (in activity feed previews etc.), the NodeView is a client component — `'use client'` is already on `AttachmentImageNode.tsx` — so it never runs server-side. Confirmed safe.

#### F1.B.4 — Tests

In `tests/unit/comment-image-upload.test.ts` (already `describe.skip`), add a single new case:

```ts
it("read-only CommentEditor (no taskId) registers the image node schema + NodeView", () => {
  // Render <CommentEditor readOnly mentionableMembers={[]} initialDoc={docWithImageNode} />.
  // Assert the rendered output contains [data-testid="attachment-image-node"].
});
```

The test stays `describe.skip` per the Epic-15 deferral; the description must accurately convey the assertion.

**Definition of done:**
- `buildImageDisplayExtension()` exists, registers the `image` node schema and the AttachmentImageNode NodeView, and installs NO ProseMirror plugin.
- `buildImageUploadExtension(ctx)` continues to work for compose context; it remains the all-in-one path.
- `<CommentEditor>` selects one of the two based on `taskId` presence.
- `pnpm tsc --noEmit` is clean.
- A `describe.skip` test case for the no-taskId render-path is added.

**Escalation triggers:**
- If Tiptap rejects registering the same `image` node name in any layered configuration the executor tries (e.g. if a base extension already includes an `image` node from `StarterKit`), stop and return a `needs-direction` report. StarterKit does NOT include image by default (verified during review), so this should not happen, but version drift is possible.

---

## Parallelization

Slices F1.A and F1.B are independent. F1.A touches `components/cells/CellEditor.tsx` and `components/cells/file/Editor.tsx`. F1.B touches `components/rich-text/imageUpload.ts`, `components/rich-text/extensions.ts`, and `components/comments/CommentEditor.tsx`. **No file overlap. Dispatch in parallel.**

---

## Open questions for the user

None. Both bugs are clear DoD gaps with surgical fixes, and the deferred items called out in `_dispatch/epic-10.md` (EXIF stripping, comment ↔ attachment `comment_id` flip, orphan-storage reconciliation, realtime back-pressure) remain correctly deferred — they are not Stage-1 gaps.

---

## File paths cited in this followup (absolute)

- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/10-attachments.md`
- `/Volumes/SSD1T/DEV WORK/donezo/docs/conversion-plan/_dispatch/epic-10.md`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/CellEditor.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/TableCell.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Editor.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/cells/file/Cell.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentEditor.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentBody.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentItem.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/comments/CommentComposer.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/imageUpload.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/extensions.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/components/rich-text/AttachmentImageNode.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/FileCellEditor.test.tsx`
- `/Volumes/SSD1T/DEV WORK/donezo/tests/unit/comment-image-upload.test.ts`
- `/Volumes/SSD1T/DEV WORK/donezo/lib/cells/types.ts`
