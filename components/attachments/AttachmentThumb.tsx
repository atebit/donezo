"use client";
/**
 * 36×36px thumbnail for use in the file column cell and attachment lists.
 *
 * - Image MIME → `<AttachmentImage>` with a 72px transform (2× for HiDPI).
 * - Other MIME → icon from `lib/attachments/mime-icons.ts`.
 * - Always shows the filename in a native title tooltip.
 */
import type { ReactNode } from "react";
import { AttachmentImage } from "@/components/attachments/AttachmentImage";
import { getMimeIcon, isImageMime } from "@/lib/attachments/mime-icons";
import { cn } from "@/lib/utils";

export type AttachmentThumbProps = {
  attachmentId: string;
  filename: string;
  mimeType: string;
  className?: string | undefined;
  /** Click handler — e.g. opens the attachment lightbox. */
  onOpen?: (() => void) | undefined;
};

/**
 * 36×36 thumbnail. For images, fetches a signed 72px-wide URL from Supabase.
 * For other types, renders the appropriate Lucide icon.
 */
export function AttachmentThumb({
  attachmentId,
  filename,
  mimeType,
  className,
  onOpen,
}: AttachmentThumbProps): ReactNode {
  const base = cn(
    "flex h-9 w-9 items-center justify-center rounded overflow-hidden flex-shrink-0",
    className,
  );

  if (isImageMime(mimeType)) {
    return (
      <div className={base} title={filename}>
        <AttachmentImage
          attachmentId={attachmentId}
          alt={filename}
          width={72}
          className="h-full w-full object-cover"
          onOpen={onOpen}
        />
      </div>
    );
  }

  const Icon = getMimeIcon(mimeType);

  const iconDiv = (
    <div
      className={cn(base, "bg-[var(--color-surface-hover)] text-[var(--color-fg-muted)]")}
      title={filename}
      aria-hidden="true"
    >
      <Icon size={18} aria-hidden="true" />
    </div>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={filename}
        className="p-0 border-0 bg-transparent cursor-pointer hover:opacity-80"
      >
        {iconDiv}
      </button>
    );
  }

  return iconDiv;
}
