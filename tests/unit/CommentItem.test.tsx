// @ts-expect-error RTL wired in epic 15
import { fireEvent, render, screen } from "@testing-library/react";
// @ts-expect-error vitest runner wired in epic 15
import { describe, expect, it, vi } from "vitest";
import type { CommentComposerHandle } from "@/components/comments/CommentItem";
import { CommentItem } from "@/components/comments/CommentItem";
import type { Database } from "@/lib/supabase/types";

type CommentRow = Database["public"]["Tables"]["comment"]["Row"];

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock server actions (Slice A) — no actual DB calls in unit tests.
vi.mock("@/app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions", () => ({
  deleteComment: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  editComment: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  reactComment: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  unreactComment: vi.fn().mockResolvedValue({ ok: true, data: {} }),
}));

// Mock board store (Slice C) — prevents zustand provider requirement.
vi.mock("@/stores/board-store", () => ({
  useBoardStore: vi.fn().mockReturnValue([]),
  selectGroupedReactions: vi.fn().mockReturnValue([]),
}));

// Mock sonner toast.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = "2024-06-01T12:00:00Z";
const LATER = "2024-06-01T12:01:00Z"; // 60 seconds later → isEdited = true
const SOON = "2024-06-01T12:00:03Z"; // 3 seconds later → isEdited = false

function makeComment(overrides: Partial<CommentRow> = {}): CommentRow {
  return {
    id: "comment-abc",
    board_id: "board-1",
    task_id: "task-1",
    author_id: "user-1",
    body: { type: "doc", content: [] },
    body_text: "Hello world",
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

const profiles = new Map([
  ["user-1", { display_name: "Alice", avatar_url: null, email: "alice@example.com" }],
]);

const baseProps = {
  boardId: "board-1",
  currentUserId: "user-1",
  isAuthor: true,
  canDelete: true,
  mentionableMembers: [],
  profiles,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skip("CommentItem", () => {
  it("renders header with author name and timestamp", () => {
    render(<CommentItem comment={makeComment()} {...baseProps} />);
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it('shows "edited" badge when updated_at > created_at + 5 seconds', () => {
    const edited = makeComment({ updated_at: LATER });
    render(<CommentItem comment={edited} {...baseProps} />);
    expect(screen.getByTestId("comment-edited-badge")).toBeTruthy();
  });

  it('does not show "edited" badge when updated_at is close to created_at', () => {
    const notEdited = makeComment({ updated_at: SOON });
    render(<CommentItem comment={notEdited} {...baseProps} />);
    expect(screen.queryByTestId("comment-edited-badge")).toBeNull();
  });

  it("overflow menu shows Edit only when isAuthor=true", () => {
    render(
      <CommentItem comment={makeComment()} {...baseProps} isAuthor={true} canDelete={false} />,
    );
    fireEvent.click(screen.getByTestId("comment-overflow-btn"));
    expect(screen.getByTestId("comment-edit-btn")).toBeTruthy();
    expect(screen.queryByTestId("comment-delete-btn")).toBeNull();
  });

  it("overflow menu hides Edit when isAuthor=false", () => {
    render(
      <CommentItem comment={makeComment()} {...baseProps} isAuthor={false} canDelete={false} />,
    );
    fireEvent.click(screen.getByTestId("comment-overflow-btn"));
    expect(screen.queryByTestId("comment-edit-btn")).toBeNull();
  });

  it("overflow menu shows Delete when canDelete=true and isAuthor=false (admin)", () => {
    render(
      <CommentItem comment={makeComment()} {...baseProps} isAuthor={false} canDelete={true} />,
    );
    fireEvent.click(screen.getByTestId("comment-overflow-btn"));
    expect(screen.getByTestId("comment-delete-btn")).toBeTruthy();
    expect(screen.queryByTestId("comment-edit-btn")).toBeNull();
  });

  it("overflow menu shows both Edit and Delete when isAuthor=true and canDelete=true", () => {
    render(<CommentItem comment={makeComment()} {...baseProps} isAuthor={true} canDelete={true} />);
    fireEvent.click(screen.getByTestId("comment-overflow-btn"));
    expect(screen.getByTestId("comment-edit-btn")).toBeTruthy();
    expect(screen.getByTestId("comment-delete-btn")).toBeTruthy();
    expect(screen.getByTestId("comment-copy-link-btn")).toBeTruthy();
  });

  it("Copy link button is always visible in overflow menu", () => {
    render(
      <CommentItem comment={makeComment()} {...baseProps} isAuthor={false} canDelete={false} />,
    );
    fireEvent.click(screen.getByTestId("comment-overflow-btn"));
    expect(screen.getByTestId("comment-copy-link-btn")).toBeTruthy();
  });

  it("Reply button calls composerRef.current.quoteReply with the comment", () => {
    const quoteReply = vi.fn();
    const focus = vi.fn();
    const composerRef = {
      current: { quoteReply, focus } satisfies CommentComposerHandle,
    };

    const comment = makeComment();
    render(<CommentItem comment={comment} {...baseProps} composerRef={composerRef} />);

    fireEvent.click(screen.getByTestId("comment-reply-btn"));
    expect(quoteReply).toHaveBeenCalledWith(comment);
    expect(focus).toHaveBeenCalled();
  });

  it("applies highlight class when isHighlighted=true", () => {
    const comment = makeComment();
    render(<CommentItem comment={comment} {...baseProps} isHighlighted={true} />);
    const article = screen.getByTestId(`comment-item-${comment.id}`);
    // The highlight class uses a CSS variable color — check the class is present.
    expect(article.className).toContain("bg-[color:var(--color-primary-selected)]");
  });

  it("does not apply highlight class when isHighlighted=false", () => {
    const comment = makeComment();
    render(<CommentItem comment={comment} {...baseProps} isHighlighted={false} />);
    const article = screen.getByTestId(`comment-item-${comment.id}`);
    expect(article.className).not.toContain("bg-[color:var(--color-primary-selected)]");
  });

  it("sets id attribute on the article for scroll targeting", () => {
    const comment = makeComment({ id: "my-comment-id" });
    render(<CommentItem comment={comment} {...baseProps} />);
    expect(document.getElementById("comment-my-comment-id")).toBeTruthy();
  });
});
