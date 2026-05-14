"use client";

/**
 * CommentItem — single comment row in a flat comment list.
 *
 * Visual spec (component-system §4.1, dispatch D.2):
 *   Container: 1px solid var(--color-border-strong), radius 4px, padding 16px, margin-bottom 16px.
 *   Header:    avatar 26px + author display_name (16px, --color-fg) + timestamp (--color-fg-muted)
 *              + "edited" badge + overflow menu (MoreHorizontal 24×24).
 *   Body:      <CommentBody> with padding 0 16px 16px, max-width 540px.
 *   Footer:    <CommentReactions> + Reply button.
 *
 * Threading: Q1 = no threading. Reply button triggers composerRef.quoteReply.
 * Delete: Q2 = hard delete only; no [deleted] placeholder.
 */

import { MessageSquareReply, MoreHorizontal } from "lucide-react";
import type React from "react";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteComment,
  editComment,
} from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions";
import { Avatar } from "@/components/shared/Avatar";
import { MenuList, MenuListItem } from "@/components/ui/menu-list";
import type { TiptapDoc } from "@/lib/comments/types";
import { cn } from "@/lib/utils";
import type { CommentRow } from "@/stores/types/comments";
import { CommentBody } from "./CommentBody";
import type { CommentComposerHandle } from "./CommentComposer";
import { CommentEditor, type MemberOption } from "./CommentEditor";
import { CommentReactions } from "./CommentReactions";

// Re-export for back-compat consumers (e.g. CommentList, tests).
export type { CommentComposerHandle, MemberOption };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a UTC timestamptz string into a locale-relative label. */
function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Return true when updated_at is more than 5 seconds after created_at. */
function isEdited(createdAt: string, updatedAt: string): boolean {
  try {
    return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 5_000;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommentItemProps {
  comment: CommentRow;
  boardId: string;
  currentUserId: string;
  isAuthor: boolean;
  /** True if the current user can delete this comment (isAuthor OR boardRole >= admin). */
  canDelete: boolean;
  mentionableMembers: MemberOption[];
  /** Profiles map for resolving display names (populated by the parent from server data). */
  profiles?:
    | Map<string, { display_name: string | null; avatar_url: string | null; email: string | null }>
    | undefined;
  /** Ref to the shared composer, forwarded from <CommentList />. */
  composerRef?: React.RefObject<CommentComposerHandle | null> | undefined;
  /** Applied when this comment matches the ?comment=<id> URL param. */
  isHighlighted?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentItem({
  comment,
  boardId: _boardId,
  currentUserId: _currentUserId,
  isAuthor,
  canDelete,
  mentionableMembers,
  profiles,
  composerRef,
  isHighlighted = false,
}: CommentItemProps) {
  const [, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDoc, setEditDoc] = useState<TiptapDoc | null>(null);
  const [editText, setEditText] = useState("");
  const menuAnchorRef = useRef<HTMLButtonElement>(null);

  // Profile for the author
  const authorProfile = profiles?.get(comment.author_id ?? "");
  const displayName = authorProfile?.display_name ?? authorProfile?.email ?? "Unknown";
  const avatarUrl = authorProfile?.avatar_url ?? null;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleReply = useCallback(() => {
    composerRef?.current?.quoteReply(comment);
    composerRef?.current?.focus();
  }, [comment, composerRef]);

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?comment=${comment.id}`;
    void navigator.clipboard.writeText(url);
    toast.success("Link copied");
    setMenuOpen(false);
  }, [comment.id]);

  const handleEditStart = useCallback(() => {
    setEditDoc(comment.body as unknown as TiptapDoc);
    setIsEditing(true);
    setMenuOpen(false);
  }, [comment.body]);

  const handleEditSave = useCallback(() => {
    if (!editDoc || editText.trim() === "") {
      toast.error("Comment cannot be empty");
      return;
    }
    startTransition(async () => {
      const result = await editComment({
        commentId: comment.id,
        body: editDoc,
        bodyText: editText,
      });
      if (result.ok) {
        setIsEditing(false);
      } else {
        toast.error(result.error.message ?? "Failed to save edit");
      }
    });
  }, [comment.id, editDoc, editText]);

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
    setEditDoc(null);
    setEditText("");
  }, []);

  const handleDelete = useCallback(() => {
    setMenuOpen(false);
    startTransition(async () => {
      const result = await deleteComment({ commentId: comment.id });
      if (!result.ok) {
        toast.error(result.error.message ?? "Failed to delete comment");
      }
    });
  }, [comment.id]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <article
      id={`comment-${comment.id}`}
      data-testid={`comment-item-${comment.id}`}
      className={cn(
        "rounded-[4px] p-4 mb-4 transition-colors duration-[2s]",
        "border border-[color:var(--color-border-strong)]",
        isHighlighted && "bg-[color:var(--color-primary-selected)]",
      )}
      aria-label={`Comment by ${displayName}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar src={avatarUrl} displayName={displayName} size={26} />
          <span className="text-base font-medium text-fg truncate" style={{ fontSize: 16 }}>
            {displayName}
          </span>
          <time className="text-sm text-fg-muted shrink-0" dateTime={comment.created_at}>
            {formatTimestamp(comment.created_at)}
          </time>
          {isEdited(comment.created_at, comment.updated_at) && (
            <span className="text-xs text-fg-muted italic" data-testid="comment-edited-badge">
              (edited)
            </span>
          )}
        </div>

        {/* Overflow menu */}
        <div className="relative">
          <button
            ref={menuAnchorRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "p-1 rounded transition-colors",
              "text-fg-muted hover:text-fg hover:bg-[color:var(--color-surface-hover)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]",
            )}
            aria-label="Comment options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            data-testid="comment-overflow-btn"
          >
            <MoreHorizontal size={24} aria-hidden="true" />
          </button>

          {menuOpen && (
            <>
              {/* Backdrop to close on outside-click */}
              <div
                className="fixed inset-0 z-[calc(var(--z-popover)-1)]"
                onClick={() => setMenuOpen(false)}
                aria-hidden="true"
              />
              <MenuList
                className="absolute right-0 top-full mt-1 min-w-[160px] z-[var(--z-popover)]"
                role="menu"
              >
                {isAuthor && (
                  <MenuListItem
                    onClick={handleEditStart}
                    role="menuitem"
                    data-testid="comment-edit-btn"
                  >
                    Edit
                  </MenuListItem>
                )}
                {canDelete && (
                  <MenuListItem
                    onClick={handleDelete}
                    role="menuitem"
                    className="text-red-600 hover:bg-red-50"
                    data-testid="comment-delete-btn"
                  >
                    Delete
                  </MenuListItem>
                )}
                <MenuListItem
                  onClick={handleCopyLink}
                  role="menuitem"
                  data-testid="comment-copy-link-btn"
                >
                  Copy link
                </MenuListItem>
              </MenuList>
            </>
          )}
        </div>
      </div>

      {/* Body — read or edit mode */}
      {isEditing ? (
        <InlineEditForm
          initialDoc={editDoc}
          mentionableMembers={mentionableMembers}
          onDocChange={(doc, text) => {
            setEditDoc(doc);
            setEditText(text);
          }}
          onSave={handleEditSave}
          onCancel={handleEditCancel}
        />
      ) : (
        <CommentBody body={comment.body} />
      )}

      {/* Footer — reactions + actions */}
      {!isEditing && (
        <div className="flex items-center gap-3 mt-2">
          <CommentReactions
            commentId={comment.id}
            boardId={_boardId}
            currentUserId={_currentUserId}
          />

          <button
            type="button"
            onClick={handleReply}
            className={cn(
              "inline-flex items-center gap-1 text-sm text-fg-muted",
              "hover:text-fg transition-colors cursor-pointer",
            )}
            aria-label="Reply to comment"
            data-testid="comment-reply-btn"
          >
            <MessageSquareReply size={16} aria-hidden="true" />
            <span>Reply</span>
          </button>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// InlineEditForm — rendered when a comment is being edited in-place.
// ---------------------------------------------------------------------------

interface InlineEditFormProps {
  initialDoc: TiptapDoc | null;
  mentionableMembers: MemberOption[];
  onDocChange: (doc: TiptapDoc, text: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function InlineEditForm({
  initialDoc,
  mentionableMembers,
  onDocChange,
  onSave,
  onCancel,
}: InlineEditFormProps) {
  return (
    <div className="mt-2" data-testid="comment-inline-edit">
      <CommentEditor
        initialDoc={initialDoc}
        onChange={onDocChange}
        onSubmit={onSave}
        mentionableMembers={mentionableMembers}
        autoFocus
      />
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onSave}
          className={cn(
            "h-8 px-3 rounded-[4px] text-sm font-medium text-white",
            "bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-hover)]",
            "transition-colors",
          )}
          data-testid="comment-edit-save-btn"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            "h-8 px-3 rounded-[4px] text-sm font-medium text-fg",
            "bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-hover)]",
            "border border-[color:var(--color-border-strong)] transition-colors",
          )}
          data-testid="comment-edit-cancel-btn"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
