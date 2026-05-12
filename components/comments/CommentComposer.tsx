"use client";

/**
 * CommentComposer — the "write a new comment" card.
 *
 * - Owns the internal CommentEditor ref.
 * - On submit: optimistic insert → server action → reconcile or rollback.
 * - First production consumer of useTypingBroadcast (Epic 08).
 * - Exposes quoteReply() and focus() via ref for reply flow (Q1).
 */

import { type Ref, useCallback, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";
import { createComment } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions";
import type { MemberOption } from "@/components/comments/CommentEditor";
import { CommentEditor, type CommentEditorHandle } from "@/components/comments/CommentEditor";
import { useTypingBroadcast } from "@/hooks/use-typing-broadcast";
import type { TiptapDoc } from "@/lib/comments/types";
import { cn } from "@/lib/utils";
import { useBoardStore } from "@/stores/board-store";
import type { CommentRow } from "@/stores/types/comments";

export interface CommentComposerProps {
  taskId: string;
  boardId: string;
  userId: string;
  mentionableMembers: MemberOption[];
  /** Called with the confirmed comment row after successful server round-trip. */
  onPosted?: (comment: CommentRow) => void;
  /** Forwarded ref exposes quoteReply() and focus() to the parent (e.g. CommentList). */
  composerRef?: Ref<CommentComposerHandle>;
}

export interface CommentComposerHandle {
  quoteReply: (src: CommentRow) => void;
  focus: () => void;
}

/** Internal — used by the forwardRef wrapper below */
function CommentComposerImpl({
  taskId,
  boardId,
  userId,
  mentionableMembers,
  onPosted,
  composerRef,
}: CommentComposerProps) {
  const editorRef = useRef<CommentEditorHandle>(null);
  const [doc, setDoc] = useState<TiptapDoc | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // First production consumer of Epic 08's typing broadcast
  const { emit: emitTyping } = useTypingBroadcast({
    boardId,
    userId,
    context: `comment:${taskId}`,
  });

  const applyCommentUpsert = useBoardStore((s) => s.applyCommentUpsert);
  const applyCommentUpsertReplaceTemp = useBoardStore((s) => s.applyCommentUpsertReplaceTemp);
  const applyCommentDelete = useBoardStore((s) => s.applyCommentDelete);

  const handleChange = useCallback(
    (newDoc: TiptapDoc, newText: string) => {
      setDoc(newDoc);
      setText(newText);
      // Broadcast typing to board channel
      emitTyping();
    },
    [emitTyping],
  );

  const handleSubmit = useCallback(async () => {
    if (text.trim() === "" || submitting) return;

    const submitDoc = doc ?? { type: "doc", content: [{ type: "paragraph" }] };
    const tempId = `temp:${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    // Build optimistic row
    const optimistic: CommentRow = {
      id: tempId,
      task_id: taskId,
      board_id: boardId,
      author_id: userId,
      body: submitDoc as unknown as import("@/lib/supabase/types").Json,
      body_text: text,
      created_at: now,
      updated_at: now,
    };

    // Optimistic insert
    applyCommentUpsert(optimistic);
    editorRef.current?.clear();
    setDoc(null);
    setText("");
    setSubmitting(true);

    try {
      const result = await createComment({ taskId, body: submitDoc, bodyText: text });
      if (!result.ok) {
        // Rollback
        applyCommentDelete(tempId);
        toast.error(result.error.message ?? "Failed to post comment.");
        return;
      }

      // Reconcile: build real row from server data (action only returns id + board_id)
      const real: CommentRow = {
        ...optimistic,
        id: result.data.id,
        board_id: result.data.board_id,
      };
      applyCommentUpsertReplaceTemp(tempId, real);
      onPosted?.(real);
    } catch {
      applyCommentDelete(tempId);
      toast.error("Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  }, [
    text,
    doc,
    submitting,
    taskId,
    boardId,
    userId,
    applyCommentUpsert,
    applyCommentUpsertReplaceTemp,
    applyCommentDelete,
    onPosted,
  ]);

  const handleCancel = useCallback(() => {
    editorRef.current?.clear();
    setDoc(null);
    setText("");
  }, []);

  // Expose quoteReply and focus via composerRef
  useImperativeHandle(composerRef, () => ({
    quoteReply(src: CommentRow) {
      const srcDoc = src.body as unknown as TiptapDoc;
      editorRef.current?.quoteReply(srcDoc);
    },
    focus() {
      editorRef.current?.focus();
    },
  }));

  const hasContent = text.trim() !== "";

  return (
    <div className="comment-composer flex flex-col gap-2">
      <CommentEditor
        ref={editorRef}
        onChange={handleChange}
        onSubmit={handleSubmit}
        mentionableMembers={mentionableMembers}
        taskId={taskId}
      />
      <div className="flex items-center gap-2 justify-end">
        {hasContent && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className={cn(
              "h-8 rounded px-3 text-sm font-medium",
              "border border-[color:var(--color-border-strong)]",
              "bg-white text-[color:var(--color-fg)]",
              "hover:bg-[color:var(--color-surface-hover)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasContent || submitting}
          className={cn(
            "h-8 rounded px-3 text-sm font-medium text-white",
            "bg-[color:var(--color-primary)]",
            "hover:bg-[color:var(--color-primary-hover)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {submitting ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

/**
 * CommentComposer with forwarded composerRef.
 *
 * We separate the ref forwarding from the impl because `composerRef` is passed
 * as a regular prop so that parent (CommentList) can hold the ref while
 * CommentComposer only needs to satisfy the handle contract.
 */
export const CommentComposer = CommentComposerImpl;
