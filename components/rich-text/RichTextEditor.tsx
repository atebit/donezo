"use client";

/**
 * RichTextEditor — generic reusable Tiptap wrapper. (Q8 primitive)
 *
 * This component has zero comment-specific or business-logic concerns.
 * It can be lifted as-is into any future feature that needs rich text
 * (e.g., a long-text cell in Epic 11/14).
 *
 * Image paste/drop is intentionally a no-op in this editor.
 * The Plugin below is the seam that Epic 10 (Attachments) will wire into.
 */

import { Plugin, PluginKey } from "@tiptap/pm/state";
import { EditorContent, Extension, useEditor } from "@tiptap/react";
import { Bold, Code, Italic, Link as LinkIcon, List, ListOrdered, ListTodo } from "lucide-react";
import { useEffect, useRef } from "react";
import type { TiptapDoc } from "@/lib/comments/types";
import { cn } from "@/lib/utils";
import { buildBaseExtensions } from "./extensions";
import type { RichTextEditorProps } from "./types";

/**
 * ProseMirror plugin that intercepts image paste/drop events.
 *
 * TODO (Epic 10): Replace this no-op with the attachment upload handler.
 * The plugin is registered unconditionally so Epic 10 can wire in storage
 * without needing to modify this component.
 */
const imagePastePluginKey = new PluginKey("imagePaste");

function buildImagePastePlugin() {
  return new Plugin({
    key: imagePastePluginKey,
    props: {
      handlePaste(_view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            if (process.env.NODE_ENV === "development") {
              // biome-ignore lint/suspicious/noConsole: intentional dev-mode warning for Epic 10 seam
              console.warn(
                "[RichTextEditor] Image paste intercepted but not handled. " +
                  "Epic 10 (Attachments) will wire this plugin to storage upload.",
              );
            }
            event.preventDefault();
            return true; // consumed — no-op
          }
        }
        return false;
      },
      handleDrop(_view, event) {
        const files = event.dataTransfer?.files;
        if (!files) return false;
        for (const file of Array.from(files)) {
          if (file.type.startsWith("image/")) {
            if (process.env.NODE_ENV === "development") {
              // biome-ignore lint/suspicious/noConsole: intentional dev-mode warning for Epic 10 seam
              console.warn(
                "[RichTextEditor] Image drop intercepted but not handled. " +
                  "Epic 10 (Attachments) will wire this plugin to storage upload.",
              );
            }
            event.preventDefault();
            return true; // consumed — no-op
          }
        }
        return false;
      },
    },
  });
}

export function RichTextEditor({
  initialDoc,
  onChange,
  onSubmit,
  placeholder,
  readOnly = false,
  autoFocus = false,
  className,
  extraExtensions = [],
  toolbar,
}: RichTextEditorProps) {
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const baseExtensions = buildBaseExtensions(placeholder);
  // Proper Tiptap extension for the image paste/drop intercept seam.
  const imagePasteExtension = Extension.create({
    name: "imagePaste",
    addProseMirrorPlugins() {
      return [buildImagePastePlugin()];
    },
  });
  const allExtensions = [...baseExtensions, ...(extraExtensions ?? []), imagePasteExtension];

  const editor = useEditor({
    extensions: allExtensions,
    ...(initialDoc ? { content: initialDoc as unknown as Record<string, unknown> } : {}),
    editable: !readOnly,
    autofocus: autoFocus,
    immediatelyRender: false,
    onUpdate({ editor: ed }) {
      const doc = ed.getJSON() as unknown as TiptapDoc;
      const text = ed.getText();
      onChangeRef.current?.(doc, text);
    },
  });

  // ⌘/Ctrl+Enter → onSubmit
  useEffect(() => {
    if (!editor) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onSubmitRef.current?.();
      }
    };
    const dom = editor.view.dom;
    dom.addEventListener("keydown", handler);
    return () => dom.removeEventListener("keydown", handler);
  }, [editor]);

  return (
    <div className={cn("rich-text-editor", className)}>
      {!readOnly && toolbar?.(editor)}
      {!readOnly && !toolbar && <DefaultToolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className={cn(
          "prose prose-sm max-w-none",
          "[&_.ProseMirror]:outline-none [&_.ProseMirror]:px-3 [&_.ProseMirror]:py-2",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[color:var(--color-fg-muted)]",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
          !readOnly && "min-h-[96px]",
          // Mention chip styling
          "[&_.mention-chip]:inline-flex [&_.mention-chip]:items-center",
          "[&_.mention-chip]:rounded-[8px] [&_.mention-chip]:px-[6px] [&_.mention-chip]:gap-1",
          "[&_.mention-chip]:text-[color:var(--color-fg)] [&_.mention-chip]:font-medium",
          // Default chip bg: --color-chip-member (#e5f4ff)
          "[&_.mention-chip]:bg-[color:var(--color-chip-member)]",
          "[&_.mention-chip]:border [&_.mention-chip]:border-[color:var(--color-chip-member)]",
          // @everyone chip: no dedicated --color-chip-everyone token exists;
          // fall back to --color-chip-member with a stronger border per spec B.4.
          // When Epic 14 adds the token, replace the border override with:
          //   bg-[color:var(--color-chip-everyone)]
          "[&_.mention-chip[data-id='everyone']]:border-[color:var(--color-primary)]",
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default toolbar (used when caller doesn't provide `toolbar` prop)
// Only shown when not readOnly.
// ---------------------------------------------------------------------------

function DefaultToolbar({ editor }: { editor: import("@tiptap/react").Editor | null }) {
  if (!editor) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-b border-[color:var(--color-border-strong)] px-2 py-1"
      role="toolbar"
      aria-label="Text formatting"
    >
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        aria-label="Bold"
        title="Bold (⌘B)"
      >
        <Bold size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        aria-label="Italic"
        title="Italic (⌘I)"
      >
        <Italic size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        aria-label="Inline code"
        title="Code"
      >
        <Code size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          const url = prompt("URL");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        isActive={editor.isActive("link")}
        aria-label="Link"
        title="Insert link"
      >
        <LinkIcon size={14} />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px bg-[color:var(--color-border-strong)]" aria-hidden="true" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        aria-label="Bullet list"
        title="Bullet list"
      >
        <List size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        aria-label="Ordered list"
        title="Ordered list"
      >
        <ListOrdered size={14} />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        aria-label="Task list"
        title="Task list"
      >
        <ListTodo size={14} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  isActive,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & { isActive?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // Prevent editor blur on toolbar click
        e.preventDefault();
        onClick?.(e as React.MouseEvent<HTMLButtonElement>);
      }}
      className={cn(
        "flex items-center justify-center rounded px-2 py-1 text-sm",
        "text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)]",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--color-primary)]",
        "transition-colors",
        isActive && "bg-[color:var(--color-surface-hover)] font-semibold",
      )}
      {...props}
    >
      {children}
    </button>
  );
}

import type React from "react";
