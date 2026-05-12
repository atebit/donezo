"use client";
import type { ReactNode } from "react";
/**
 * Native PDF embed with a Download fallback.
 *
 * Uses the browser's built-in `<embed>` element for PDF rendering — no `react-pdf`
 * dependency per the epic design decision (autonomous decision Q11).
 *
 * @jsDocNote iOS Safari does not support `<embed>` for PDFs and will show a blank area.
 * Users on iOS should use the Download button below to open the PDF in Files or another
 * PDF-capable app. There is no reliable workaround for inline PDF rendering on iOS Safari
 * without a third-party renderer; this is a known platform limitation (researcher risk #9).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getDownloadUrl,
  getSignedDisplayUrl,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions";
import { cn } from "@/lib/utils";

export type AttachmentPdfEmbedProps = {
  attachmentId: string;
  filename: string;
  /** Height of the embed container. Defaults to "70vh". */
  height?: string;
  className?: string;
};

/**
 * Renders a full-height PDF viewer using the browser's native embed element.
 *
 * Falls back gracefully for browsers/OS combinations that don't support inline PDF
 * rendering — the Download button is always visible below the embed.
 *
 * **iOS Safari note:** `<embed>` for PDFs does not work on iOS Safari. The Download
 * button is the recommended fallback for mobile users.
 */
export function AttachmentPdfEmbed({
  attachmentId,
  filename,
  height = "70vh",
  className,
}: AttachmentPdfEmbedProps): ReactNode {
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchUrl(): Promise<void> {
      setIsLoading(true);
      try {
        const result = await getSignedDisplayUrl({ attachmentId });
        if (!cancelled && result.ok) {
          setDisplayUrl(result.data.url);
        }
      } catch {
        // Swallow — the Download button remains functional.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchUrl();

    return () => {
      cancelled = true;
    };
  }, [attachmentId]);

  async function handleDownload(): Promise<void> {
    setDownloading(true);
    try {
      const result = await getDownloadUrl({ attachmentId });
      if (result.ok) {
        window.open(result.data.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(`Download failed: ${result.error.message}`);
      }
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* PDF embed */}
      <div
        className="w-full overflow-hidden rounded-md border border-[var(--color-border-muted)] bg-[var(--color-surface-hover)]"
        style={{ height }}
      >
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-[var(--color-fg-muted)]">Loading PDF…</span>
          </div>
        )}
        {!isLoading && displayUrl && (
          <embed
            src={displayUrl}
            type="application/pdf"
            className="h-full w-full"
            title={filename}
          />
        )}
        {!isLoading && !displayUrl && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <span className="text-sm text-[var(--color-fg-muted)]">
              Unable to load PDF preview.
            </span>
          </div>
        )}
      </div>

      {/* Download button — always visible */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={downloading}
          className={cn(
            "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium",
            "bg-[var(--color-surface-hover)] text-[var(--color-fg)]",
            "border border-[var(--color-border-solid)]",
            "hover:bg-[var(--color-surface-active)]",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors",
          )}
        >
          {downloading ? "Downloading…" : "Download PDF"}
        </button>
        <span className="text-xs text-[var(--color-fg-muted)]">{filename}</span>
      </div>
    </div>
  );
}
