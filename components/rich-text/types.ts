import type { Editor, Extension } from "@tiptap/react";
import type { ReactNode } from "react";
import type { TiptapDoc } from "@/lib/comments/types";

export type { TiptapDoc };

/**
 * Props for the generic `<RichTextEditor />` primitive.
 * No comment-specific or business-logic concerns here — this is the Q8 reusable layer.
 */
export interface RichTextEditorProps {
  initialDoc?: TiptapDoc | null;
  onChange?: (doc: TiptapDoc, text: string) => void;
  /** Called when the user presses ⌘/Ctrl+Enter. */
  onSubmit?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
  /** Extra extensions appended after the base set (e.g. MentionExtension). */
  // biome-ignore lint/suspicious/noExplicitAny: Extension generic variance
  extraExtensions?: Extension<any, any>[];
  /** Toolbar slot — caller renders their own toolbar buttons via editor instance. */
  toolbar?: (editor: Editor | null) => ReactNode;
}
