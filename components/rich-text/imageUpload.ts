"use client";

/**
 * buildImageUploadExtension — Tiptap Image extension with custom attrs and paste/drop upload.
 *
 * Extends @tiptap/extension-image to add:
 *   - `attachmentId` attribute (stored in the node; signed URL fetched at render time)
 *   - Custom React NodeView rendering `<AttachmentImageNode>`
 *   - Paste/drop handler: uploads image files via the requestUpload→PUT→confirmUpload pipeline
 *
 * The `imagePastePluginKey` no-op in RichTextEditor.tsx is NOT removed — it continues to warn
 * in dev for consumers that do NOT pass this extension. This extension's paste/drop plugin runs
 * before the no-op plugin and returns `true` (consumed), so they don't conflict.
 *
 * Upload context:
 *   - `taskId`: required — attachment FK target.
 *   - `commentId`: optional — currently always undefined (deferred per epic-10 decisions).
 */

import { Image } from "@tiptap/extension-image";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { toast } from "sonner";
import {
  confirmUpload,
  requestUpload,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions";
import { AttachmentImageNode } from "./AttachmentImageNode";

// ---------------------------------------------------------------------------
// Upload context
// ---------------------------------------------------------------------------

export type ImageUploadCtx = {
  taskId: string;
  commentId?: string;
};

// ---------------------------------------------------------------------------
// Low-level upload helper (imperative, no hook state machine)
// ---------------------------------------------------------------------------

/**
 * PUT a File to a signed Supabase Storage URL via XHR.
 */
function xhrPutFile(signedUrl: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Storage PUT failed: ${xhr.status} ${xhr.statusText}`));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload.")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted.")));
    xhr.send(file);
  });
}

/**
 * Run the full three-step upload pipeline for a single image File.
 * Returns `{ attachmentId }` on success, `null` on any error (already toasted).
 */
async function uploadImageFile(
  file: File,
  ctx: ImageUploadCtx,
): Promise<{ attachmentId: string } | null> {
  try {
    const requestResult = await requestUpload({
      taskId: ctx.taskId,
      filename: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
      commentId: ctx.commentId,
    });

    if (!requestResult.ok) {
      toast.error(`Upload failed: ${requestResult.error.message}`);
      return null;
    }

    const { attachmentId, signedUrl } = requestResult.data;

    await xhrPutFile(signedUrl, file);

    const confirmResult = await confirmUpload({ attachmentId });
    if (!confirmResult.ok) {
      toast.error(`Upload confirmation failed: ${confirmResult.error.message}`);
      return null;
    }

    return { attachmentId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    toast.error(message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Plugin key
// ---------------------------------------------------------------------------

const imageUploadPluginKey = new PluginKey("attachmentImageUpload");

// ---------------------------------------------------------------------------
// Extension builder
// ---------------------------------------------------------------------------

/**
 * Builds the Tiptap Image extension extended with:
 *   - `attachmentId` attr (alongside `src`, `alt`)
 *   - React NodeView using `<AttachmentImageNode>`
 *   - paste/drop plugin calling the upload pipeline
 */
export function buildImageUploadExtension(ctx: ImageUploadCtx) {
  return Image.extend({
    name: "image",

    addAttributes() {
      return {
        src: { default: null },
        alt: { default: null },
        title: { default: null },
        // Epic 10: DB attachment id; NodeView fetches signed URL from this.
        attachmentId: { default: null },
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(AttachmentImageNode);
    },

    addProseMirrorPlugins() {
      // Capture reference to the outer `this` context (Tiptap extension instance).
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const ext = this as typeof this & { editor: import("@tiptap/react").Editor };

      return [
        new Plugin({
          key: imageUploadPluginKey,
          props: {
            handlePaste(_view: EditorView, event: ClipboardEvent) {
              const items = event.clipboardData?.items;
              if (!items) return false;

              const imageFiles: File[] = [];
              for (const item of Array.from(items)) {
                if (item.kind === "file" && item.type.startsWith("image/")) {
                  const file = item.getAsFile();
                  if (file) imageFiles.push(file);
                }
              }

              if (imageFiles.length === 0) return false;

              event.preventDefault();

              for (const file of imageFiles) {
                void uploadImageFile(file, ctx).then((result) => {
                  if (!result) return;
                  insertImageNode(ext.editor, result.attachmentId, file.name);
                });
              }

              return true;
            },

            handleDrop(_view: EditorView, event: DragEvent) {
              const files = event.dataTransfer?.files;
              if (!files || files.length === 0) return false;

              const imageFiles: File[] = [];
              for (const file of Array.from(files)) {
                if (file.type.startsWith("image/")) {
                  imageFiles.push(file);
                }
              }

              if (imageFiles.length === 0) return false;

              event.preventDefault();

              for (const file of imageFiles) {
                void uploadImageFile(file, ctx).then((result) => {
                  if (!result) return;
                  insertImageNode(ext.editor, result.attachmentId, file.name);
                });
              }

              return true;
            },
          },
        }),
      ];
    },
  }).configure({
    inline: false,
    allowBase64: false,
  });
}

// ---------------------------------------------------------------------------
// Helper — insert an image node with attachmentId
// ---------------------------------------------------------------------------

function insertImageNode(
  editor: import("@tiptap/react").Editor,
  attachmentId: string,
  alt: string,
): void {
  // Use a command chain to insert the image node with custom attrs.
  // We set src to "" — the NodeView renders via attachmentId only.
  editor
    .chain()
    .focus()
    .insertContent({
      type: "image",
      attrs: { src: "", alt, attachmentId },
    })
    .run();
}
