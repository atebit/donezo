import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import StarterKit from "@tiptap/starter-kit";
import { all, createLowlight } from "lowlight";
import type { ImageUploadCtx } from "./imageUpload";
import { buildImageDisplayExtension, buildImageUploadExtension } from "./imageUpload";

const lowlight = createLowlight(all);

/**
 * Base extension set for `<RichTextEditor />`.
 * Comment-specific extensions (e.g. Mention) are passed via `extraExtensions`.
 */
export function buildBaseExtensions(placeholder?: string) {
  return [
    StarterKit.configure({
      // CodeBlockLowlight replaces the StarterKit codeBlock
      codeBlock: false,
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        rel: "noopener noreferrer",
        target: "_blank",
      },
    }),
    Placeholder.configure({
      placeholder: placeholder ?? "Write something…",
    }),
    Typography,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    CodeBlockLowlight.configure({
      lowlight,
    }),
  ];
}

/**
 * Builds the display-only image extension array for use with `extraExtensions`.
 *
 * Use in read-only or no-taskId contexts (CommentBody, inline-edit of existing
 * comments) so embedded attachment images render correctly without a paste/drop
 * upload plugin.
 *
 * Returns a single-element array so the caller can spread or concat as needed.
 */
export function buildImageDisplayExtensions() {
  return [buildImageDisplayExtension()];
}

/**
 * Builds the image upload extension array for use with `extraExtensions`.
 *
 * Usage (in CommentEditor or any rich-text consumer that needs image upload):
 * ```ts
 * const imageExts = useMemo(
 *   () => buildImageUploadExtensions({ taskId }),
 *   [taskId],
 * );
 * // Pass imageExts to <RichTextEditor extraExtensions={imageExts} />
 * ```
 *
 * Returns a single-element array so the caller can spread or concat as needed.
 */
export function buildImageUploadExtensions(ctx: ImageUploadCtx) {
  return [buildImageUploadExtension(ctx)];
}
