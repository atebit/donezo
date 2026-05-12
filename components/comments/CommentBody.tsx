"use client";

/**
 * CommentBody — read-only renderer for a comment's rich-text body.
 *
 * Wraps <CommentEditor readOnly> from Slice B so that mention chips,
 * blockquote quote-replies, code blocks, etc. all render through the same
 * Tiptap extensions used in edit mode. No interactive elements in read mode.
 *
 * Dependency note (Slice B parallel):
 *   <CommentEditor> lives in components/comments/CommentEditor.tsx (Slice B).
 *   That file is installed when Slice B merges. The import below will resolve
 *   at that point. `CommentEditorProps` is matched from the Slice B spec (B.3).
 */

import type React from "react";
import type { TiptapDoc } from "@/lib/comments/types";
import type { Json } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Lazy-load <CommentEditor> from Slice B
// ---------------------------------------------------------------------------

/** Matches Slice B's CommentEditorProps — kept in sync with B.3 spec. */
interface CommentEditorProps {
  initialDoc?: TiptapDoc | null;
  onChange?: (doc: TiptapDoc, text: string) => void;
  onSubmit?: () => void;
  mentionableMembers?: Array<{
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  }>;
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
}

let _CommentEditor: React.ComponentType<CommentEditorProps> | null | undefined;

function getCommentEditor(): React.ComponentType<CommentEditorProps> | null {
  if (_CommentEditor !== undefined) return _CommentEditor;
  try {
    const mod = require("./CommentEditor") as {
      CommentEditor?: React.ComponentType<CommentEditorProps>;
      default?: React.ComponentType<CommentEditorProps>;
    };
    _CommentEditor = mod.CommentEditor ?? mod.default ?? null;
  } catch {
    _CommentEditor = null;
  }
  return _CommentEditor ?? null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommentBodyProps {
  /** The Tiptap doc stored in comment.body (already JSON). */
  body: Json;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentBody({ body, className }: CommentBodyProps) {
  const CommentEditor = getCommentEditor();

  // Convert Json body to TiptapDoc — the comment.body column stores a JSON
  // object whose root type is always "doc". We coerce rather than validate
  // here because this is a read path; malformed docs produce an empty render.
  const doc =
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    (body as Record<string, unknown>).type === "doc"
      ? (body as unknown as TiptapDoc)
      : null;

  if (!CommentEditor) {
    // Slice B not yet installed; fall back to plain text preview.
    // This branch should never appear in production.
    const plainText =
      body !== null && typeof body === "object" && !Array.isArray(body)
        ? (((body as Record<string, unknown>).text as string | undefined) ?? "")
        : typeof body === "string"
          ? body
          : "";
    return (
      <div
        className={className}
        style={{ padding: "0 16px 16px", maxWidth: 540 }}
        data-testid="comment-body-fallback"
      >
        <p className="text-sm text-fg whitespace-pre-wrap">{plainText}</p>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ padding: "0 16px 16px", maxWidth: 540 }}
      data-testid="comment-body"
    >
      <CommentEditor initialDoc={doc} readOnly mentionableMembers={[]} />
    </div>
  );
}
