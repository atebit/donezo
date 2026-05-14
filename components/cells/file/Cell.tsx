"use client";

/**
 * FileCell — read-mode renderer for the "file" cell type.
 *
 * Renders up to 3 `<AttachmentThumb>` thumbnails for the first 3 attachment ids,
 * plus an overflow "+N" chip when there are more than 3.
 *
 * Empty state: Paperclip icon + muted "—".
 *
 * Thumbnail rendering requires resolved attachment metadata (mimeType, filename).
 * We look up the attachments from the board store for this task and filter
 * by the ids stored in the cell value. IDs not yet in the store (e.g. race
 * during a real-time update) are silently skipped.
 */

import { Paperclip } from "lucide-react";
import React from "react";
import { AttachmentThumb } from "@/components/attachments/AttachmentThumb";
import type { TaskRow } from "@/lib/cells/types";
import { selectAttachmentsForTask, useBoardStore } from "@/stores/board-store";
import type { FileCellValue } from "./def";

const MAX_VISIBLE = 3;

interface FileCellProps {
  value: FileCellValue | null;
  config: Record<string, never>;
  row: TaskRow;
}

function FileCellInner({ value, row }: FileCellProps) {
  const taskId = row.id;
  const ids = value?.attachmentIds ?? [];

  // Lookup attachment metadata from the board store.
  const storeAttachments = useBoardStore((s) => selectAttachmentsForTask(s, taskId));

  // Build a map for fast lookup.
  const attachmentMap = React.useMemo(
    () => new Map(storeAttachments.map((a) => [a.id, a])),
    [storeAttachments],
  );

  // Visible rows: ids that exist in the store + are uploaded, capped at MAX_VISIBLE.
  const resolvedIds = ids.filter((id) => {
    const a = attachmentMap.get(id);
    return a?.is_uploaded;
  });

  const visibleIds = resolvedIds.slice(0, MAX_VISIBLE);
  const overflow = resolvedIds.length - visibleIds.length;

  // Empty state
  if (visibleIds.length === 0) {
    return (
      <div className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center px-2 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden">
        <Paperclip
          size={14}
          aria-hidden="true"
          className="shrink-0 text-[color:var(--color-fg-muted)] mr-1"
        />
        <span className="text-sm text-[color:var(--color-fg-muted)]" aria-hidden="true">
          —
        </span>
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`${resolvedIds.length} attachment${resolvedIds.length === 1 ? "" : "s"}`}
      className="min-w-[var(--size-cell-w)] h-[var(--size-cell-h)] flex items-center gap-1 px-1.5 hover:outline hover:outline-1 hover:outline-[color:var(--color-border-strong)] overflow-hidden"
    >
      {visibleIds.map((id) => {
        const att = attachmentMap.get(id);
        if (!att) return null;
        return (
          <AttachmentThumb
            key={id}
            attachmentId={id}
            filename={att.filename}
            mimeType={att.mime_type}
            className="h-6 w-6 shrink-0"
          />
        );
      })}
      {overflow > 0 && (
        <span className="shrink-0 rounded-full bg-[color:var(--color-surface-hover)] px-1.5 py-0.5 text-xs font-medium text-[color:var(--color-fg-muted)]">
          +{overflow}
        </span>
      )}
    </div>
  );
}

export const Cell = React.memo(FileCellInner);
Cell.displayName = "FileCell";
