"use client";
import type { ReactNode } from "react";
/**
 * Generic drop / click / paste uploader.
 *
 * Uses `react-dropzone` for drag-and-drop and click-to-browse. Native `onPaste`
 * on the wrapper div handles image paste (react-dropzone's paste support is limited).
 *
 * Client-side validation (size + MIME) is performed before calling `requestUpload`.
 * Errors are surfaced via `onError` callback and a `sonner` toast.
 *
 * Per-file progress is rendered inline as `<progress>` elements.
 */
import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { useAttachmentUploader } from "@/hooks/use-attachment-uploader";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/attachments/constants";
import type { Database } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

type AttachmentRow = Database["public"]["Tables"]["attachment"]["Row"];

export type FileDropzoneProps = {
  taskId: string;
  /**
   * Required when uploading via a comment image-paste flow; absent for Files tab / file column.
   */
  commentId?: string | undefined;
  /**
   * Accept attribute for the underlying `<input type="file">`.
   * Defaults to the full `ALLOWED_MIME_TYPES` list.
   */
  accept?: string | undefined;
  multiple?: boolean | undefined;
  /**
   * Called once each file's full request → PUT → confirm cycle completes successfully.
   */
  onComplete?: ((attachment: AttachmentRow) => void) | undefined;
  onError?:
    | ((err: { code: string; message: string; filename?: string | undefined }) => void)
    | undefined;
  /**
   * Composition slot — caller renders the drop-target visuals.
   * When absent, a default dashed drop zone UI is rendered.
   */
  children?: ReactNode | undefined;
  className?: string | undefined;
};

// Build the react-dropzone `accept` object from the ALLOWED_MIME_TYPES array.
const DROPZONE_ACCEPT = Object.fromEntries(
  ALLOWED_MIME_TYPES.map((mime: string) => [mime, [] as string[]]),
) as Record<string, string[]>;

/**
 * Validates a `File` against the client-side size and MIME constraints.
 * Returns an error object if invalid, otherwise undefined.
 */
function validateFile(file: File): { code: string; message: string; filename: string } | undefined {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const maxMb = Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024);
    return {
      code: "FILE_TOO_LARGE",
      message: `"${file.name}" exceeds the ${maxMb} MB limit.`,
      filename: file.name,
    };
  }
  const allowed = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);
  if (!allowed) {
    return {
      code: "INVALID_MIME",
      message: `"${file.name}" has an unsupported file type (${file.type || "unknown"}).`,
      filename: file.name,
    };
  }
  return undefined;
}

/**
 * Renders a default drop-zone UI when no `children` slot is provided.
 */
function DefaultDropTarget({ isDragActive }: { isDragActive: boolean }): ReactNode {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 p-6 text-center",
        "text-sm text-[var(--color-fg-muted)]",
        isDragActive && "text-[var(--color-primary)]",
      )}
    >
      <span className="text-base font-medium">
        {isDragActive ? "Drop files here" : "Drop files here or click to upload"}
      </span>
      <span className="text-xs">
        Up to {Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB per file
      </span>
    </div>
  );
}

/**
 * Per-file upload progress row.
 */
function UploadProgressRow({
  filename,
  progress,
  status,
  error,
}: {
  filename: string;
  progress: number;
  status: "uploading" | "confirming" | "done" | "error";
  error?: string | undefined;
}): ReactNode {
  if (status === "done") return null; // Hide completed rows

  return (
    <div className="flex flex-col gap-0.5 rounded px-2 py-1 bg-[var(--color-surface-hover)]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-[var(--color-fg)]">{filename}</span>
        <span
          className={cn(
            "shrink-0 text-xs",
            status === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-fg-muted)]",
          )}
        >
          {status === "uploading" && `${progress}%`}
          {status === "confirming" && "Confirming…"}
          {status === "error" && "Failed"}
        </span>
      </div>
      {status !== "error" && (
        <progress
          value={progress}
          max={100}
          aria-label={`Uploading ${filename}: ${progress}%`}
          className="h-1 w-full"
        />
      )}
      {status === "error" && error && (
        <span className="text-xs text-[var(--color-danger)]">{error}</span>
      )}
    </div>
  );
}

/**
 * Generic file drop / click / paste uploader component.
 */
export function FileDropzone({
  taskId,
  commentId,
  accept,
  multiple = true,
  onComplete,
  onError,
  children,
  className,
}: FileDropzoneProps): ReactNode {
  const { uploads, upload } = useAttachmentUploader();

  const processFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const validationError = validateFile(file);
        if (validationError) {
          toast.error(validationError.message);
          onError?.(validationError);
          continue;
        }

        const ctx: { taskId: string; commentId?: string } = { taskId };
        if (commentId !== undefined) ctx.commentId = commentId;
        const result = await upload(file, ctx);
        if (result) {
          onComplete?.(result);
        } else {
          // Upload state machine already set error state — toast here for visibility.
          const entry = uploads.find((u) => u.filename === file.name && u.status === "error");
          const msg = entry?.error ?? `Failed to upload "${file.name}".`;
          toast.error(msg);
          onError?.({ code: "UPLOAD_FAILED", message: msg, filename: file.name });
        }
      }
    },
    [upload, uploads, taskId, commentId, onComplete, onError],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      void processFiles(acceptedFiles);
    },
    [processFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ? { [accept]: [] } : DROPZONE_ACCEPT,
    multiple,
    maxSize: MAX_FILE_SIZE_BYTES,
    noClick: !!children, // When a custom child is provided, don't intercept clicks
  });

  // Native paste handler for image paste (react-dropzone paste support is limited).
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = Array.from(e.clipboardData.items);
      const imageFiles: File[] = [];

      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        void processFiles(imageFiles);
      }
    },
    [processFiles],
  );

  // Active uploads (not yet done) to show in progress UI.
  const activeUploads = uploads.filter((u) => u.status !== "done");

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Drop zone */}
      <div
        {...getRootProps({
          className: cn(
            "relative cursor-pointer rounded-lg border-2 border-dashed",
            "border-[var(--color-border-solid)] transition-colors",
            isDragActive
              ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
              : "hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]",
          ),
          onPaste: handlePaste,
          "data-testid": "file-dropzone",
        })}
      >
        <input {...getInputProps()} />
        {children ?? <DefaultDropTarget isDragActive={isDragActive} />}

        {/* Drag overlay */}
        {isDragActive && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--color-primary-subtle)] z-10"
            aria-hidden="true"
          >
            <span className="text-sm font-medium text-[var(--color-primary)]">
              Drop files to upload
            </span>
          </div>
        )}
      </div>

      {/* Per-file progress rows */}
      {activeUploads.length > 0 && (
        <div className="flex flex-col gap-1">
          {activeUploads.map((entry) => (
            <UploadProgressRow
              key={entry.key}
              filename={entry.filename}
              progress={entry.progress}
              status={entry.status}
              error={entry.error}
            />
          ))}
        </div>
      )}
    </div>
  );
}
