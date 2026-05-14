"use client";

/**
 * FilesTab — attachments tab for the inline item drawer (Epic 16 / Slice G).
 *
 * Read-only view of attachments already hydrated into the board store by
 * BoardDataProvider (epic 10). Upload affordance is omitted from this
 * lightweight drawer — the full upload UI lives in the route-based TaskDrawer.
 *
 * Forbidden scope: new server actions, new schema changes.
 */

import { formatDistanceToNow } from "date-fns";
import { FileIcon, PaperclipIcon } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { selectAttachmentsForTask, useBoardStore } from "@/stores/board-store";

interface FilesTabProps {
  taskId: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesTab({ taskId }: FilesTabProps) {
  const attachments = useBoardStore(useShallow((s) => selectAttachmentsForTask(s, taskId)));
  const uploaded = attachments.filter((a) => a.is_uploaded);

  if (uploaded.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center"
        data-testid="files-tab-empty"
      >
        <PaperclipIcon
          className="text-[color:var(--color-fg-muted)] opacity-40"
          size={32}
          aria-hidden="true"
        />
        <p className="text-sm text-[color:var(--color-fg-muted)] max-w-[240px]">
          No files yet — drag a file in or paste a link to attach it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="files-tab-list">
      {uploaded.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center gap-3 rounded border border-[color:var(--color-border-strong)] px-3 py-2"
        >
          <FileIcon
            size={16}
            className="flex-shrink-0 text-[color:var(--color-fg-muted)]"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[color:var(--color-fg)] truncate">
              {attachment.filename}
            </p>
            <p className="text-xs text-[color:var(--color-fg-muted)]">
              {formatBytes(attachment.size_bytes)} ·{" "}
              {formatDistanceToNow(new Date(attachment.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
