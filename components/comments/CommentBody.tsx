"use client";

/**
 * CommentBody — read-only renderer for a comment's rich-text body.
 *
 * Wraps <CommentEditor readOnly> so that mention chips, blockquote
 * quote-replies, code blocks, etc. all render through the same Tiptap
 * extensions used in edit mode. No interactive elements in read mode.
 */

import type { TiptapDoc } from "@/lib/comments/types";
import type { Json } from "@/lib/supabase/types";
import { CommentEditor } from "./CommentEditor";

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
