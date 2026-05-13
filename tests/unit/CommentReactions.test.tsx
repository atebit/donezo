import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommentReactions } from "@/components/comments/CommentReactions";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock server actions (Slice A).
vi.mock("@/app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions", () => ({
  reactComment: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  unreactComment: vi.fn().mockResolvedValue({ ok: true, data: {} }),
}));

// Mock sonner toast.
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Controlled mocks for board store state and actions.
const mockApplyReactionInsert = vi.fn();
const mockApplyReactionDelete = vi.fn();

/**
 * We build grouped reactions inline in each test by controlling the store mock.
 * selectGroupedReactions is called from the component via useBoardStore(selector).
 */
vi.mock("@/stores/board-store", () => {
  const grouped: Array<{ emoji: string; count: number; selfReacted: boolean }> = [];
  return {
    useBoardStore: vi.fn().mockImplementation((selector: (s: unknown) => unknown) => {
      const state = {
        reactionsByComment: new Map(),
        applyReactionInsert: mockApplyReactionInsert,
        applyReactionDelete: mockApplyReactionDelete,
      };
      return selector(state);
    }),
    selectGroupedReactions: vi.fn().mockReturnValue(grouped),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setGroupedReactions(
  grouped: Array<{ emoji: string; count: number; selfReacted: boolean }>,
) {
  // Re-import to set the mock return value for selectGroupedReactions.
  const { selectGroupedReactions } = require("@/stores/board-store") as {
    selectGroupedReactions: ReturnType<typeof vi.fn>;
  };
  selectGroupedReactions.mockReturnValue(grouped);

  // Also update useBoardStore so selector invocations for applyReactionInsert/Delete
  // still work, and the grouped reactions are returned for the selectGroupedReactions call.
  const { useBoardStore } = require("@/stores/board-store") as {
    useBoardStore: ReturnType<typeof vi.fn>;
  };
  useBoardStore.mockImplementation((selector: (s: unknown) => unknown) => {
    const state = {
      reactionsByComment: new Map(),
      applyReactionInsert: mockApplyReactionInsert,
      applyReactionDelete: mockApplyReactionDelete,
      // Expose grouped so the selector that calls selectGroupedReactions works.
    };
    const result = selector(state);
    // When result is an array it's a grouped reactions call — return the mock.
    if (Array.isArray(result)) return grouped;
    return result;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skip("CommentReactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGroupedReactions([]);
  });

  it("renders no chips when there are no reactions", () => {
    setGroupedReactions([]);
    render(<CommentReactions commentId="comment-1" boardId="board-1" currentUserId="user-1" />);
    expect(screen.queryByTestId(/^reaction-chip-/)).toBeNull();
    expect(screen.getByTestId("add-reaction-button")).toBeTruthy();
  });

  it("renders a chip for each grouped reaction", () => {
    setGroupedReactions([
      { emoji: "👍", count: 2, selfReacted: false },
      { emoji: "❤️", count: 1, selfReacted: false },
    ]);
    render(<CommentReactions commentId="comment-1" boardId="board-1" currentUserId="user-1" />);
    expect(screen.getByTestId("reaction-chip-👍")).toBeTruthy();
    expect(screen.getByTestId("reaction-chip-❤️")).toBeTruthy();
  });

  it("applies self-reacted styling when selfReacted=true", () => {
    setGroupedReactions([{ emoji: "👍", count: 1, selfReacted: true }]);
    render(<CommentReactions commentId="comment-1" boardId="board-1" currentUserId="user-1" />);
    const chip = screen.getByTestId("reaction-chip-👍");
    expect(chip.className).toContain("bg-[color:var(--color-primary-selected)]");
    expect(chip.getAttribute("aria-pressed")).toBe("true");
  });

  it("clicking a non-self-reacted chip calls applyReactionInsert (optimistic)", () => {
    setGroupedReactions([{ emoji: "👍", count: 3, selfReacted: false }]);
    render(<CommentReactions commentId="comment-1" boardId="board-1" currentUserId="user-2" />);
    fireEvent.click(screen.getByTestId("reaction-chip-👍"));
    expect(mockApplyReactionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        comment_id: "comment-1",
        user_id: "user-2",
        emoji: "👍",
        board_id: "board-1",
      }),
    );
  });

  it("clicking a self-reacted chip calls applyReactionDelete (optimistic)", () => {
    setGroupedReactions([{ emoji: "👍", count: 1, selfReacted: true }]);
    render(<CommentReactions commentId="comment-1" boardId="board-1" currentUserId="user-1" />);
    fireEvent.click(screen.getByTestId("reaction-chip-👍"));
    expect(mockApplyReactionDelete).toHaveBeenCalledWith("comment-1", "user-1", "👍");
  });

  it('"+" add-reaction button is always visible', () => {
    setGroupedReactions([]);
    render(<CommentReactions commentId="comment-1" boardId="board-1" currentUserId="user-1" />);
    expect(screen.getByTestId("add-reaction-button")).toBeTruthy();
  });

  it("displays reaction count next to emoji", () => {
    setGroupedReactions([{ emoji: "🚀", count: 5, selfReacted: false }]);
    render(<CommentReactions commentId="comment-1" boardId="board-1" currentUserId="user-1" />);
    const chip = screen.getByTestId("reaction-chip-🚀");
    expect(chip.textContent).toContain("5");
  });
});
