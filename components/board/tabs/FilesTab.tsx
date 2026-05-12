"use client";

/**
 * FilesTab — full implementation for the task drawer's Files tab (Epic 10).
 *
 * Reads attachments from the board store via `selectAttachmentsForTask`.
 * Renders:
 *   - `<FileDropzone>` for uploading new files (large dashed-border area at top).
 *   - Grid of `<AttachmentTile>` below.
 *   - Images open `<AttachmentLightbox>` on click.
 *   - PDFs open inline via `<AttachmentPdfEmbed>` in a simple expand/collapse.
 *   - Other file types → download via `getDownloadUrl`.
 *   - Empty state inside the dropzone when no files have been uploaded yet.
 */

import { useCallback, useState } from "react";
import { AttachmentLightbox } from "@/components/attachments/AttachmentLightbox";
import { AttachmentPdfEmbed } from "@/components/attachments/AttachmentPdfEmbed";
import { AttachmentTile } from "@/components/attachments/AttachmentTile";
import { FileDropzone } from "@/components/attachments/FileDropzone";
import { isImageMime, isPdfMime } from "@/lib/attachments/mime-icons";
import type { Role } from "@/lib/authorization/roles";
import { selectAttachmentsForTask, useBoardStore } from "@/stores/board-store";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FilesTabProps {
  taskId: string;
  boardId: string;
  currentUserId: string;
  boardRole: Role;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilesTab({ taskId, boardId: _boardId, currentUserId, boardRole }: FilesTabProps) {
  const attachments = useBoardStore((s) => selectAttachmentsForTask(s, taskId));

  // ── Lightbox state ──────────────────────────────────────────────────────
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Only image attachments in the lightbox
  const imageAttachments = attachments.filter((a) => a.is_uploaded && isImageMime(a.mime_type));

  const openLightbox = useCallback(
    (attachmentId: string) => {
      const idx = imageAttachments.findIndex((a) => a.id === attachmentId);
      setLightboxIndex(Math.max(0, idx));
      setLightboxOpen(true);
    },
    [imageAttachments],
  );

  // ── PDF embed state (one open at a time) ─────────────────────────────────
  const [openPdfId, setOpenPdfId] = useState<string | null>(null);

  const togglePdf = useCallback((attachmentId: string) => {
    setOpenPdfId((prev) => (prev === attachmentId ? null : attachmentId));
  }, []);

  // ── Delete handler (removes from grid optimistically via store realtime) ─
  // AttachmentTile calls the server action and shows a toast; store update
  // arrives via Realtime. No explicit local state needed.

  const uploadedAttachments = attachments.filter((a) => a.is_uploaded);

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <FileDropzone taskId={taskId} className="min-h-[100px]" />

      {/* Attachment list */}
      {uploadedAttachments.length > 0 && (
        <div className="flex flex-col gap-1" data-testid="files-tab-list">
          {uploadedAttachments.map((attachment) => (
            <div key={attachment.id}>
              <AttachmentTile
                attachmentId={attachment.id}
                filename={attachment.filename}
                mimeType={attachment.mime_type}
                sizeBytes={attachment.size_bytes}
                uploadedAt={attachment.created_at}
                uploaderId={attachment.uploader_id}
                currentUserId={currentUserId}
                boardRole={boardRole}
                onOpen={
                  isImageMime(attachment.mime_type)
                    ? () => openLightbox(attachment.id)
                    : isPdfMime(attachment.mime_type)
                      ? () => togglePdf(attachment.id)
                      : undefined
                }
              />
              {/* Inline PDF embed — shown when this PDF is toggled open */}
              {isPdfMime(attachment.mime_type) && openPdfId === attachment.id && (
                <div className="px-2 pb-2">
                  <AttachmentPdfEmbed
                    attachmentId={attachment.id}
                    filename={attachment.filename}
                    height="60vh"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image lightbox */}
      <AttachmentLightbox
        attachments={imageAttachments.map((a) => ({
          attachmentId: a.id,
          filename: a.filename,
        }))}
        startIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
}
