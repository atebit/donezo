"use client";
/**
 * Image lightbox using Base UI Dialog.
 *
 * Receives a list of image attachment ids and an initial index. Renders the
 * current image full-size with prev/next navigation.
 *
 * Keyboard shortcuts:
 *   - Esc   → close (Base UI Dialog handles this automatically)
 *   - ←     → previous image
 *   - →     → next image
 *   - Enter → open download for current image
 *
 * Only image MIME types should be passed via `attachments`. PDFs and other
 * types are handled separately (see AttachmentPdfEmbed).
 */
import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getDownloadUrl } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions";
import { AttachmentImage } from "@/components/attachments/AttachmentImage";
import { cn } from "@/lib/utils";

export type LightboxAttachment = {
  attachmentId: string;
  filename: string;
};

export type AttachmentLightboxProps = {
  /** Subset of attachments to navigate — only image MIMEs should be included. */
  attachments: LightboxAttachment[];
  /** Zero-based index of the attachment to show first. */
  startIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Minimal, keyboard-accessible image lightbox.
 */
export function AttachmentLightbox({
  attachments,
  startIndex,
  open,
  onOpenChange,
}: AttachmentLightboxProps): ReactNode {
  const [currentIndex, setCurrentIndex] = useState(startIndex);

  // Reset to startIndex whenever the lightbox opens.
  useEffect(() => {
    if (open) setCurrentIndex(startIndex);
  }, [open, startIndex]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < attachments.length - 1;
  const current = attachments[currentIndex];

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, attachments.length - 1));
  }, [attachments.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleDownloadCurrent = useCallback(async () => {
    if (!current) return;
    const result = await getDownloadUrl({ attachmentId: current.attachmentId });
    if (result.ok) {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(`Download failed: ${result.error.message}`);
    }
  }, [current]);

  // Keyboard navigation inside the popup.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (hasNext) goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (hasPrev) goPrev();
      } else if (e.key === "Enter") {
        e.preventDefault();
        void handleDownloadCurrent();
      }
    },
    [hasNext, hasPrev, goNext, goPrev, handleDownloadCurrent],
  );

  if (!current) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Backdrop className={cn("fixed inset-0 z-50", "bg-black/80 backdrop-blur-sm")} />

        {/* Popup */}
        <Dialog.Popup
          className={cn(
            "fixed inset-0 z-50 flex flex-col items-center justify-center",
            "focus:outline-none",
          )}
          aria-label={`Image preview: ${current.filename}`}
          onKeyDown={handleKeyDown}
        >
          {/* Close button */}
          <Dialog.Close
            className={cn(
              "absolute top-4 right-4 z-10",
              "flex h-8 w-8 items-center justify-center rounded-full",
              "bg-white/10 text-white hover:bg-white/20",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-white",
              "transition-colors",
            )}
            aria-label="Close lightbox"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </Dialog.Close>

          {/* Prev button */}
          {hasPrev && (
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous image"
              className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 z-10",
                "flex h-10 w-10 items-center justify-center rounded-full",
                "bg-white/10 text-white hover:bg-white/20",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white",
                "transition-colors",
              )}
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ‹
              </span>
            </button>
          )}

          {/* Next button */}
          {hasNext && (
            <button
              type="button"
              onClick={goNext}
              aria-label="Next image"
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2 z-10",
                "flex h-10 w-10 items-center justify-center rounded-full",
                "bg-white/10 text-white hover:bg-white/20",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white",
                "transition-colors",
              )}
            >
              <span aria-hidden="true" className="text-xl leading-none">
                ›
              </span>
            </button>
          )}

          {/* Main image */}
          <div className="relative flex max-h-[85vh] max-w-[90vw] items-center justify-center">
            <AttachmentImage
              attachmentId={current.attachmentId}
              alt={current.filename}
              className="max-h-[85vh] max-w-[90vw] object-contain rounded-md"
            />
          </div>

          {/* Footer: filename + counter + download */}
          <div
            className={cn(
              "absolute bottom-4 left-1/2 -translate-x-1/2",
              "flex items-center gap-4 rounded-full px-4 py-2",
              "bg-white/10 text-white text-sm",
            )}
          >
            <span className="max-w-xs truncate">{current.filename}</span>
            {attachments.length > 1 && (
              <span className="text-white/70 text-xs">
                {currentIndex + 1} / {attachments.length}
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleDownloadCurrent()}
              className="text-xs text-white/80 hover:text-white underline focus:outline-none"
              aria-label={`Download ${current.filename}`}
            >
              Download
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
