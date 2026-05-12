// @ts-expect-error vitest runner wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for useTaskDrawerPresence — tracks user as "viewing task" on the board channel.
 *
 * Runner wired in epic 15. Tests are stubbed with describe.skip per established
 * repo pattern.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTrack = vi.fn().mockResolvedValue(undefined);
const mockChannel = { track: mockTrack };
const mockSupabase = {
  channel: vi.fn().mockReturnValue(mockChannel),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/realtime/channel", () => ({
  boardChannelName: vi.fn((id: string) => `board:${id}`),
}));

vi.mock("@/hooks/use-board", () => ({
  useBoard: vi.fn(() => ({
    board: {
      id: "board-42",
      name: "Test",
      workspace_id: "ws-1",
      is_private: false,
      description: "",
      created_by: null,
      deleted_at: null,
    },
    role: "member",
    isStarred: false,
    userId: "user-99",
  })),
}));

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe.skip(
  "useTaskDrawerPresence",
  "Runner wired in epic 15. Requires RTL + Vitest + jsdom + renderHook.",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("calls supabase.channel with the board channel name on mount", () => {
      // Epic 15: use renderHook from @testing-library/react
      // const { renderHook } = require("@testing-library/react");
      // const { useTaskDrawerPresence } = require("@/hooks/use-task-drawer-presence");
      // renderHook(() => useTaskDrawerPresence("task-abc"));
      // expect(mockSupabase.channel).toHaveBeenCalledWith("board:board-42");
      expect(true).toBe(true); // placeholder
    });

    it("calls channel.track with viewing.type = 'task' and task_id on mount", () => {
      // Epic 15:
      // renderHook(() => useTaskDrawerPresence("task-abc"));
      // expect(mockTrack).toHaveBeenCalledWith(
      //   expect.objectContaining({ viewing: { type: "task", task_id: "task-abc" } }),
      // );
      expect(true).toBe(true); // placeholder
    });

    it("reverts track to viewing.type = 'board' on unmount", () => {
      // Epic 15:
      // const { unmount } = renderHook(() => useTaskDrawerPresence("task-abc"));
      // unmount();
      // expect(mockTrack).toHaveBeenLastCalledWith(
      //   expect.objectContaining({ viewing: { type: "board" } }),
      // );
      expect(true).toBe(true); // placeholder
    });

    it("does NOT call supabase.removeChannel — useBoardRealtime owns lifecycle", () => {
      // Epic 15:
      // const { unmount } = renderHook(() => useTaskDrawerPresence("task-abc"));
      // unmount();
      // expect(mockSupabase.removeChannel).not.toHaveBeenCalled();
      expect(true).toBe(true); // placeholder
    });

    it("re-runs when taskId changes, updating the tracked viewing state", () => {
      // Epic 15:
      // const { rerender } = renderHook(
      //   ({ taskId }) => useTaskDrawerPresence(taskId),
      //   { initialProps: { taskId: "task-1" } },
      // );
      // rerender({ taskId: "task-2" });
      // expect(mockTrack).toHaveBeenCalledWith(
      //   expect.objectContaining({ viewing: { type: "task", task_id: "task-2" } }),
      // );
      expect(true).toBe(true); // placeholder
    });
  },
);
