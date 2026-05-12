"use client";

/**
 * FileEditor — popover-content editor for the "file" cell type.
 *
 * This component is the popover CONTENT only — no <Popover.Root> here.
 * The CellEditor orchestrator wraps it with <Popover.Root> because `def.editorMode === "popover"`.
 *
 * Layout:
 *   - Top: small `<FileDropzone>` for adding new files.
 *   - Below: list of existing attachments (download + delete per row).
 *
 * Mutations:
 *   - On upload complete: calls `onChange` with the appended attachmentId in the value.
 *     The CellEditor orchestrator handles the optimistic update + server action.
 *   - On delete: calls `deleteAttachment` server action AND `onChange` with the removed id.
 *     The Realtime channel will reconcile if needed.
 *
 * Contract:
 *   - Does NOT include <Popover.Root> (caller provides it).
 *   - Does NOT call setCellValue directly — uses `onChange` per the orchestrator contract.
 *   - `row` is threaded through from CellEditor via an optional prop so we can access taskId.
 */

import type { ReactNode } from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  deleteAttachment,
  getDownloadUrl,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions";
import { AttachmentThumb } from "@/components/attachments/AttachmentThumb";
import { FileDropzone } from "@/components/attachments/FileDropzone";
import type { Database } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { selectAttachmentsForTask, useBoardStore } from "@/stores/board-store";

import type { FileCellValue } from "./def";

type AttachmentRow = Database["public"]["Tables"]["attachment"]["Row"];

interface FileEditorProps {
  value: FileCellValue | null;
  config: Record<string, never>;
  onChange: (next: FileCellValue | null) => void;
  onClose: () => void;
  /** REQUIRED — the task row from the CellEditor orchestrator. Provides taskId for upload context. */
  row: { id: string };
}

// ---------------------------------------------------------------------------
// AttachmentEditorRow — single row inside the file editor
// ---------------------------------------------------------------------------

function AttachmentEditorRow({
  attachment,
  onDeleted,
}: {
  attachment: AttachmentRow;
  onDeleted: (id: string) => void;
}): ReactNode {
  const [deleting, startDelete] = useTransition();
  const [downloading, startDownload] = useTransition();

  function handleDownload(): void {
    startDownload(async () => {
      const result = await getDownloadUrl({ attachmentId: attachment.id });
      if (result.ok) {
        window.open(result.data.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(`Download failed: ${result.error.message}`);
      }
    });
  }

  function handleDelete(): void {
    startDelete(async () => {
      const result = await deleteAttachment({ attachmentId: attachment.id });
      if (result.ok) {
        onDeleted(attachment.id);
      } else {
        toast.error(`Delete failed: ${result.error.message}`);
      }
    });
  }

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[var(--color-surface-hover)] transition-colors"
      data-testid="file-editor-row"
    >
      <AttachmentThumb
        attachmentId={attachment.id}
        filename={attachment.filename}
        mimeType={attachment.mime_type}
        className="h-7 w-7 shrink-0"
      />
      <span className="flex-1 truncate text-xs text-[var(--color-fg)] min-w-0">
        {attachment.filename}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          aria-label={`Download ${attachment.filename}`}
          className={cn(
            "rounded px-1.5 py-0.5 text-xs text-[var(--color-fg-muted)]",
            "hover:bg-[var(--color-surface-active)] hover:text-[var(--color-fg)]",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {downloading ? "…" : "↓"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label={`Delete ${attachment.filename}`}
          className={cn(
            "rounded px-1.5 py-0.5 text-xs text-[var(--color-danger)]",
            "hover:bg-[var(--color-danger-subtle)]",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-danger)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {deleting ? "…" : "×"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor component
// ---------------------------------------------------------------------------

export function Editor({ value, onChange, onClose: _onClose, row }: FileEditorProps): ReactNode {
  const taskId = row.id;

  // Read current attachments from the board store for this task.
  // This is more up-to-date than reading from `value.attachmentIds` after a delete.
  const storeAttachments = useBoardStore((s) => selectAttachmentsForTask(s, taskId));
  const currentIds = value?.attachmentIds ?? [];

  // Only show attachments that are in the cell value AND uploaded.
  const visibleAttachments = storeAttachments.filter(
    (a) => a.is_uploaded && currentIds.includes(a.id),
  );

  function handleUploadComplete(attachment: AttachmentRow): void {
    const next = [...currentIds, attachment.id];
    onChange({ attachmentIds: next });
  }

  function handleDeleted(deletedId: string): void {
    const next = currentIds.filter((id) => id !== deletedId);
    onChange(next.length > 0 ? { attachmentIds: next } : null);
  }

  return (
    <div
      className="flex flex-col gap-2 p-2"
      style={{ minWidth: 260, maxWidth: 320 }}
      data-testid="file-cell-editor"
    >
      {/* Upload dropzone */}
      <FileDropzone
        taskId={taskId}
        multiple={true}
        onComplete={handleUploadComplete}
        className="min-h-[72px]"
      />

      {/* Existing attachments */}
      {visibleAttachments.length > 0 && (
        <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
          {visibleAttachments.map((att) => (
            <AttachmentEditorRow key={att.id} attachment={att} onDeleted={handleDeleted} />
          ))}
        </div>
      )}

      {/* Empty state when no attachments yet */}
      {visibleAttachments.length === 0 && currentIds.length === 0 && (
        <p className="text-center text-xs text-[var(--color-fg-muted)] py-1">
          No files attached yet
        </p>
      )}
    </div>
  );
}
