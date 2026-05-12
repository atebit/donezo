"use client";

/**
 * CommentEditor — comment-specific wrapper around <RichTextEditor />.
 *
 * Wires in the MentionExtension with the comment-specific suggestion items.
 * Exposes `quoteReply(srcDoc)` via ref for Q1 quote-reply functionality.
 *
 * When readOnly, renders the body as Tiptap content with no toolbar.
 * Used by <CommentBody /> (Slice D) in read-only mode.
 */

import { EditorContent, useEditor } from "@tiptap/react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { MentionPopover } from "@/components/comments/MentionPopover";
import { buildBaseExtensions } from "@/components/rich-text/extensions";
import type { MentionItem, MentionSuggestionBridge } from "@/components/rich-text/MentionExtension";
import { buildMentionExtension } from "@/components/rich-text/MentionExtension";
import type { TiptapDoc } from "@/lib/comments/types";
import { cn } from "@/lib/utils";

export type MemberOption = MentionItem;

export interface CommentEditorProps {
  initialDoc?: TiptapDoc | null;
  onChange?: (doc: TiptapDoc, text: string) => void;
  onSubmit?: () => void;
  mentionableMembers: MemberOption[];
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export interface CommentEditorHandle {
  /**
   * Quote-reply (Q1): inserts a blockquote of `srcDoc` at the top of the editor,
   * followed by an empty paragraph. Positions the cursor at the trailing paragraph.
   */
  quoteReply: (srcDoc: TiptapDoc) => void;
  focus: () => void;
  clear: () => void;
}

export const CommentEditor = forwardRef<CommentEditorHandle, CommentEditorProps>(
  function CommentEditor(
    {
      initialDoc,
      onChange,
      onSubmit,
      mentionableMembers,
      readOnly = false,
      autoFocus = false,
      className,
    },
    ref,
  ) {
    // Bridge ref connects ProseMirror suggestion plugin to React state (MentionPopover)
    const bridgeRef = useRef<MentionSuggestionBridge | null>(null);

    // Build the mention extension, re-configure when members change
    const mentionExtension = useMemo(
      () => buildMentionExtension(mentionableMembers, bridgeRef),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      // Members array identity: re-build when the array ref changes.
      // In practice this is stable across renders for a mounted CommentEditor.
      [mentionableMembers],
    );

    // Expose imperative handle
    // The RichTextEditor manages its own editor instance internally.
    // For quoteReply and focus/clear, we need access to that editor.
    // We use a separate internal editor ref via a child RichTextEditor override approach.
    // Since RichTextEditor owns the editor, we communicate via a stable internal ref.

    // We use a separate "inner handle" ref that RichTextEditor calls back with its editor.
    const editorRef = useRef<import("@tiptap/react").Editor | null>(null);

    useImperativeHandle(ref, () => ({
      quoteReply(srcDoc: TiptapDoc) {
        const editor = editorRef.current;
        if (!editor) return;
        // Build the new document: blockquote of source body + empty trailing paragraph (Q1).
        editor
          .chain()
          .focus()
          .setContent({
            type: "doc",
            content: [
              {
                type: "blockquote",
                content: srcDoc.content ?? [{ type: "paragraph" }],
              },
              { type: "paragraph" },
            ],
          })
          .run();
        // Move cursor to end (after the trailing paragraph)
        editor.commands.focus("end");
      },
      focus() {
        editorRef.current?.commands.focus();
      },
      clear() {
        editorRef.current?.commands.clearContent(true);
      },
    }));

    return (
      <div
        className={cn(
          "comment-editor relative",
          !readOnly && "rounded border border-[color:var(--color-primary)]",
          className,
        )}
      >
        <CommentEditorInner
          {...(initialDoc != null ? { initialDoc } : {})}
          {...(onChange ? { onChange } : {})}
          {...(onSubmit ? { onSubmit } : {})}
          readOnly={readOnly}
          autoFocus={autoFocus}
          mentionExtension={mentionExtension}
          editorRef={editorRef}
        />
        {/* MentionPopover is controlled imperatively via bridgeRef */}
        {!readOnly && <MentionPopover ref={bridgeRef} />}
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// Inner component that owns the Tiptap editor instance and exposes it upward
// ---------------------------------------------------------------------------

interface CommentEditorInnerProps {
  initialDoc?: TiptapDoc | null;
  onChange?: (doc: TiptapDoc, text: string) => void;
  onSubmit?: () => void;
  readOnly: boolean;
  autoFocus: boolean;
  mentionExtension: ReturnType<typeof buildMentionExtension>;
  editorRef: React.MutableRefObject<import("@tiptap/react").Editor | null>;
}

function CommentEditorInner({
  initialDoc,
  onChange,
  onSubmit,
  readOnly,
  autoFocus,
  mentionExtension,
  editorRef,
}: CommentEditorInnerProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  const editor = useEditor({
    extensions: [...buildBaseExtensions("Write an update…"), mentionExtension],
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

  // Expose editor to parent ref
  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);

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
    <div>
      {!readOnly && <CommentToolbar editor={editor} />}
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
          "[&_.mention-chip]:bg-[color:var(--color-chip-member)]",
          "[&_.mention-chip]:border [&_.mention-chip]:border-[color:var(--color-chip-member)]",
          // @everyone: no --color-chip-everyone token exists; use chip-member bg
          // with a stronger primary-colored border per spec B.4 / B.10 note.
          "[&_.mention-chip[data-id='everyone']]:border-[color:var(--color-primary)]",
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar for CommentEditor (Bold, Italic, Code, Link, lists)
// ---------------------------------------------------------------------------

import { Bold, Code, Italic, Link as LinkIcon, List, ListOrdered, ListTodo } from "lucide-react";
import type React from "react";

function CommentToolbar({ editor }: { editor: import("@tiptap/react").Editor | null }) {
  if (!editor) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-b border-[color:var(--color-border-strong)] px-2 py-1"
      role="toolbar"
      aria-label="Comment formatting"
    >
      <TBtn
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        aria-label="Bold"
        title="Bold"
      >
        <Bold size={14} />
      </TBtn>
      <TBtn
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        aria-label="Italic"
        title="Italic"
      >
        <Italic size={14} />
      </TBtn>
      <TBtn
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        aria-label="Inline code"
        title="Code"
      >
        <Code size={14} />
      </TBtn>
      <TBtn
        onClick={() => {
          const url = prompt("URL");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }}
        isActive={editor.isActive("link")}
        aria-label="Link"
        title="Link"
      >
        <LinkIcon size={14} />
      </TBtn>
      <div className="mx-1 h-4 w-px bg-[color:var(--color-border-strong)]" aria-hidden="true" />
      <TBtn
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        aria-label="Bullet list"
        title="Bullet list"
      >
        <List size={14} />
      </TBtn>
      <TBtn
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        aria-label="Ordered list"
        title="Ordered list"
      >
        <ListOrdered size={14} />
      </TBtn>
      <TBtn
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        aria-label="Task list"
        title="Task list"
      >
        <ListTodo size={14} />
      </TBtn>
    </div>
  );
}

function TBtn({
  children,
  onClick,
  isActive,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & { isActive?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
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
