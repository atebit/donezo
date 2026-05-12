"use client";
/**
 * Inline image that fetches and caches its signed Supabase Storage URL.
 *
 * Uses a native `<img>` element (not `next/image`) because signed URLs are
 * ephemeral and dynamic — `next/image` requires static remotePatterns config.
 *
 * Per repo convention (see app/(app)/account/account-settings.tsx:135):
 * // biome-ignore lint/performance/noImgElement: signed/transient URL from Supabase Storage; next/image requires remotePatterns config
 */
import type { ReactNode } from "react";
import { useSignedDisplayUrl } from "@/hooks/use-signed-display-url";
import { cn } from "@/lib/utils";

export type AttachmentImageProps = {
  attachmentId: string;
  alt?: string | undefined;
  /**
   * When provided, requests a Supabase image transform at this pixel width.
   * The actual rendered CSS width is controlled by `className`.
   */
  width?: number | undefined;
  className?: string | undefined;
  /** Click handler — e.g. opens the attachment lightbox. */
  onOpen?: (() => void) | undefined;
};

/**
 * Skeleton placeholder shown while the signed URL is being fetched.
 */
function ImageSkeleton({ className }: { className?: string | undefined }): ReactNode {
  const cls = cn("animate-pulse rounded bg-[var(--color-surface-hover)]", className);
  return <div className={cls} aria-hidden="true" />;
}

/**
 * Signed-URL-fetching image component for attachment previews.
 *
 * Renders a skeleton while the URL is loading, then swaps in the `<img>`.
 */
export function AttachmentImage({
  attachmentId,
  alt = "",
  width,
  className,
  onOpen,
}: AttachmentImageProps): ReactNode {
  const hookOptions =
    width !== undefined ? { attachmentId, transform: { width } } : { attachmentId };

  const { url, isLoading } = useSignedDisplayUrl(hookOptions);

  if (isLoading && !url) {
    return <ImageSkeleton className={className} />;
  }

  if (!url) {
    // Failed fetch — render skeleton indefinitely rather than broken image.
    return <ImageSkeleton className={className} />;
  }

  const imgClassName = cn("block object-cover", className);

  // biome-ignore lint/performance/noImgElement: signed/transient URL from Supabase Storage; next/image requires remotePatterns config
  const img = <img src={url} alt={alt} className={imgClassName} />;

  if (onOpen) {
    // Wrap in a button for accessible click-to-open behaviour.
    return (
      <button
        type="button"
        onClick={onOpen}
        className="p-0 border-0 bg-transparent cursor-pointer"
        aria-label={alt || "Open attachment"}
      >
        {img}
      </button>
    );
  }

  return img;
}
