"use client";
/**
 * Upload state machine for the two-stage attachment pipeline:
 *   requestUpload (server action) → PUT to signed URL (XHR) → confirmUpload (server action)
 *
 * Each call to `upload(file, ctx)` runs the full three-step sequence and
 * returns the confirmed `AttachmentRow` on success, or `null` on failure.
 *
 * The hook tracks per-file progress in local state. The caller can render progress
 * bars from `uploads`. `clearCompleted()` removes entries in "done" or "error" state.
 *
 * Note: On success the hook does NOT insert into the board store. The Realtime
 * channel (Slice C) fires an UPDATE when `is_uploaded` flips to true, which picks
 * up the row via `applyAttachmentUpsert`. This keeps the upload path decoupled from
 * the store.
 */
import { useCallback, useRef, useState } from "react";
import {
  confirmUpload,
  requestUpload,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions";
import type { Database } from "@/lib/supabase/types";

type AttachmentRow = Database["public"]["Tables"]["attachment"]["Row"];

export type UploadStatus = "uploading" | "confirming" | "done" | "error";

export type UploadEntry = {
  /** Client-side key for React rendering (not the DB id). */
  key: string;
  filename: string;
  /** 0–100 */
  progress: number;
  status: UploadStatus;
  /** Only set when status === "error". */
  error?: string;
};

export type UploadCtx = {
  taskId: string;
  commentId?: string;
};

export type AttachmentUploaderReturn = {
  /** Current per-file upload entries (progress rows). */
  uploads: UploadEntry[];
  /**
   * Begin the full upload pipeline for `file`.
   * Returns the confirmed `AttachmentRow` on success, or `null` on failure.
   */
  upload: (file: File, ctx: UploadCtx) => Promise<AttachmentRow | null>;
  /** Remove all entries with status "done" or "error". */
  clearCompleted: () => void;
};

let keyCounter = 0;

function nextKey(): string {
  keyCounter += 1;
  return `upload-${keyCounter}`;
}

/**
 * Puts a `File` to a signed Supabase Storage URL via XMLHttpRequest so that
 * `onprogress` events are available (fetch does not expose upload progress).
 */
function xhrPut(signedUrl: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Storage PUT failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during file upload."));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("File upload aborted."));
    });

    xhr.send(file);
  });
}

export function useAttachmentUploader(): AttachmentUploaderReturn {
  const [uploads, setUploads] = useState<UploadEntry[]>([]);

  // Stable ref to avoid including `uploads` in the `upload` callback deps.
  const uploadsRef = useRef<UploadEntry[]>([]);

  const updateEntry = useCallback((key: string, patch: Partial<UploadEntry>) => {
    setUploads((prev) => {
      const next = prev.map((e) => (e.key === key ? { ...e, ...patch } : e));
      uploadsRef.current = next;
      return next;
    });
  }, []);

  const upload = useCallback(
    async (file: File, ctx: UploadCtx): Promise<AttachmentRow | null> => {
      const key = nextKey();

      const entry: UploadEntry = {
        key,
        filename: file.name,
        progress: 0,
        status: "uploading",
      };

      setUploads((prev) => {
        const next = [...prev, entry];
        uploadsRef.current = next;
        return next;
      });

      try {
        // ── Step 1: requestUpload ──────────────────────────────────────────
        const requestResult = await requestUpload({
          taskId: ctx.taskId,
          filename: file.name,
          sizeBytes: file.size,
          mimeType: file.type,
          commentId: ctx.commentId,
        });

        if (!requestResult.ok) {
          updateEntry(key, {
            status: "error",
            error: requestResult.error.message,
          });
          return null;
        }

        const { attachmentId, signedUrl } = requestResult.data;

        // ── Step 2: PUT to Supabase Storage via XHR ───────────────────────
        await xhrPut(signedUrl, file, (pct) => {
          updateEntry(key, { progress: pct });
        });

        // ── Step 3: confirmUpload ─────────────────────────────────────────
        updateEntry(key, { status: "confirming", progress: 100 });

        const confirmResult = await confirmUpload({ attachmentId });

        if (!confirmResult.ok) {
          updateEntry(key, {
            status: "error",
            error: confirmResult.error.message,
          });
          return null;
        }

        updateEntry(key, { status: "done", progress: 100 });
        return confirmResult.data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed.";
        updateEntry(key, { status: "error", error: message });
        return null;
      }
    },
    [updateEntry],
  );

  const clearCompleted = useCallback(() => {
    setUploads((prev) => {
      const next = prev.filter((e) => e.status !== "done" && e.status !== "error");
      uploadsRef.current = next;
      return next;
    });
  }, []);

  return { uploads, upload, clearCompleted };
}
