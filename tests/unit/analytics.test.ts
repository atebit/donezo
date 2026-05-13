import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for lib/analytics.ts — typed trackEvent helper.
 *
 * Mocks @vercel/analytics/server so no network calls are made and
 * the test can assert that `track` is called with the correct event
 * name and properties for each discriminated-union variant.
 */

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

const mockTrack = vi.fn().mockResolvedValue(undefined);
vi.mock("@vercel/analytics/server", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("trackEvent", () => {
  beforeEach(() => {
    mockTrack.mockClear();
  });

  it("calls track with 'board.created' and workspaceId + boardId props", async () => {
    const { trackEvent } = await import("../../lib/analytics");
    trackEvent({
      name: "board.created",
      props: { workspaceId: "ws-123", boardId: "b-456" },
    });
    expect(mockTrack).toHaveBeenCalledOnce();
    expect(mockTrack).toHaveBeenCalledWith("board.created", {
      workspaceId: "ws-123",
      boardId: "b-456",
    });
  });

  it("calls track with 'task.added' and boardId prop", async () => {
    const { trackEvent } = await import("../../lib/analytics");
    trackEvent({
      name: "task.added",
      props: { boardId: "b-789" },
    });
    expect(mockTrack).toHaveBeenCalledOnce();
    expect(mockTrack).toHaveBeenCalledWith("task.added", { boardId: "b-789" });
  });

  it("calls track with 'comment.posted' and boardId + taskId props", async () => {
    const { trackEvent } = await import("../../lib/analytics");
    trackEvent({
      name: "comment.posted",
      props: { boardId: "b-111", taskId: "t-222" },
    });
    expect(mockTrack).toHaveBeenCalledOnce();
    expect(mockTrack).toHaveBeenCalledWith("comment.posted", {
      boardId: "b-111",
      taskId: "t-222",
    });
  });
});
