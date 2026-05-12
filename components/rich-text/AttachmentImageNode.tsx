"use client";

/**
 * AttachmentImageNode — Tiptap React NodeView for images stored as attachments.
 *
 * Renders `<AttachmentImage attachmentId={...} alt={...} />` which internally
 * fetches a signed Supabase Storage URL via `useSignedDisplayUrl`.
 *
 * Used by `buildImageUploadExtension` (imageUpload.ts).
 * When `attachmentId` is null or absent (e.g. a legacy node lacking the custom attr),
 * falls back to a plain `<img src={src}>` so existing image content continues to render.
 */

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { AttachmentImage } from "@/components/attachments/AttachmentImage";

/**
 * Tiptap NodeView that renders an attachment image by `attachmentId`.
 *
 * When `attachmentId` is present (Epic 10 upload path), the component fetches a
 * signed display URL via `<AttachmentImage>`.
 * When only `src` is present (legacy content or Markdown round-trip), falls back
 * to a plain `<img>`.
 */
export function AttachmentImageNode({ node }: NodeViewProps) {
  const { attachmentId, alt, src } = node.attrs as {
    attachmentId: string | null;
    alt: string | null;
    src: string | null;
  };

  return (
    <NodeViewWrapper
      as="div"
      className="attachment-image-node my-2"
      data-testid="attachment-image-node"
      data-attachment-id={attachmentId ?? undefined}
    >
      {attachmentId ? (
        <AttachmentImage
          attachmentId={attachmentId}
          alt={alt ?? ""}
          className="max-w-full rounded"
        />
      ) : (
        // biome-ignore lint/performance/noImgElement: fallback for legacy nodes without attachmentId; URL not from Next.js domain
        <img src={src ?? ""} alt={alt ?? ""} className="max-w-full rounded" />
      )}
    </NodeViewWrapper>
  );
}
