import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import StarterKit from "@tiptap/starter-kit";
import { all, createLowlight } from "lowlight";

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
