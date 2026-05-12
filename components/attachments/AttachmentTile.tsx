"use client";
/**
 * Full-row attachment representation used in the Files tab and file-column overflow.
 *
 * Layout: [icon/thumb] [filename + size + timestamp] [Download] [Delete?]
 *
 * Delete is only enabled if:
 *   - `boardRole >= "admin"`, OR
 *   - `uploaderId === currentUserId`
 *
 * Both conditions are passed in via props — this component does not do its own auth check.
 */
import type { ReactNode } from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  deleteAttachment,
  getDownloadUrl,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions";
import { AttachmentThumb } from "@/components/attachments/AttachmentThumb";
import type { Role } from "@/lib/authorization/roles";
import { ROLE_RANK } from "@/lib/authorization/roles";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Human-readable file size string.
 * Matches the 1024-byte convention used by most OS file explorers.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Locale-aware short date string.
 */
function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type AttachmentTileProps = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploaderId: string | null;
  /** The currently authenticated user's id. */
  currentUserId: string;
  boardRole: Role;
  className?: string | undefined;
  /** Click handler for the thumbnail / filename — e.g. opens lightbox or PDF embed. */
  onOpen?: (() => void) | undefined;
  /** Called after a successful delete so the parent can update its list. */
  onDeleted?: ((attachmentId: string) => void) | undefined;
};

/**
 * Full-row attachment tile with icon, metadata, and action buttons.
 */
export function AttachmentTile({
  attachmentId,
  filename,
  mimeType,
  sizeBytes,
  uploadedAt,
  uploaderId,
  currentUserId,
  boardRole,
  className,
  onOpen,
  onDeleted,
}: AttachmentTileProps): ReactNode {
  const [deleting, startDelete] = useTransition();
  const [downloading, startDownload] = useTransition();

  const canDelete = ROLE_RANK[boardRole] >= ROLE_RANK.admin || uploaderId === currentUserId;

  function handleDownload(): void {
    startDownload(async () => {
      const result = await getDownloadUrl({ attachmentId });
      if (result.ok) {
        // Open in a new tab — browser handles Content-Disposition: attachment.
        window.open(result.data.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(`Download failed: ${result.error.message}`);
      }
    });
  }

  function handleDelete(): void {
    startDelete(async () => {
      const result = await deleteAttachment({ attachmentId });
      if (result.ok) {
        toast.success(`"${filename}" deleted.`);
        onDeleted?.(attachmentId);
      } else {
        toast.error(`Delete failed: ${result.error.message}`);
      }
    });
  }

  return (
    <div
      data-testid="attachment-tile"
      className={cn(
        "flex items-center gap-3 rounded-md px-2 py-1.5",
        "hover:bg-[var(--color-surface-hover)] transition-colors",
        className,
      )}
    >
      {/* Thumbnail / icon */}
      <AttachmentThumb
        attachmentId={attachmentId}
        filename={filename}
        mimeType={mimeType}
        onOpen={onOpen}
      />

      {/* Metadata */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "truncate text-left text-sm font-medium text-[var(--color-fg)]",
            "hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]",
            onOpen ? "cursor-pointer" : "cursor-default",
          )}
          disabled={!onOpen}
        >
          {filename}
        </button>
        <span className="text-xs text-[var(--color-fg-muted)]">
          {formatBytes(sizeBytes)} · {formatDate(uploadedAt)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Download */}
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          aria-label={`Download ${filename}`}
          className={cn(
            "flex items-center justify-center rounded px-2 py-1",
            "text-xs font-medium text-[var(--color-fg-muted)]",
            "hover:bg-[var(--color-surface-active)] hover:text-[var(--color-fg)]",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors",
          )}
        >
          {downloading ? "…" : "Download"}
        </button>

        {/* Delete — only shown when the user has permission */}
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label={`Delete ${filename}`}
            className={cn(
              "flex items-center justify-center rounded px-2 py-1",
              "text-xs font-medium text-[var(--color-danger)]",
              "hover:bg-[var(--color-danger-subtle)]",
              "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-danger)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors",
            )}
          >
            {deleting ? "…" : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}
