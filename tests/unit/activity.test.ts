// @ts-expect-error vitest is wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LogActivityArgs } from "../../lib/activity";

/**
 * Tests for lib/activity.ts — service-role activity logger.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * They are written here so the epic 15 executor can pick them up without changes.
 *
 * Approach:
 * - Mock `lib/supabase/admin` so no real Supabase client is constructed.
 * - Mock `lib/logger` so warn/error calls can be captured.
 * - Verify insert is called with the right shape and that errors are swallowed.
 */

// --- mocks ---

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
const mockAdminClient = vi.fn(() => ({ from: mockFrom }));

vi.mock("../../lib/supabase/admin", () => ({
  adminClient: mockAdminClient,
}));

const mockWarn = vi.fn();
vi.mock("../../lib/logger", () => ({
  logger: { warn: mockWarn, error: vi.fn() },
}));

// --- tests ---

describe.skip("logActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: insert succeeds
    mockInsert.mockResolvedValue({ error: null });
  });

  it("calls adminClient().from('activity').insert() with the correct shape", async () => {
    const { logActivity } = await import("../../lib/activity");

    const args: LogActivityArgs = {
      boardId: "board-uuid-1",
      taskId: "task-uuid-1",
      actorId: "actor-uuid-1",
      type: "task.created",
      payload: { title: "New task" },
    };

    await logActivity(args);

    expect(mockFrom).toHaveBeenCalledWith("activity");
    expect(mockInsert).toHaveBeenCalledWith({
      board_id: "board-uuid-1",
      task_id: "task-uuid-1",
      actor_id: "actor-uuid-1",
      type: "task.created",
      payload: { title: "New task" },
    });
  });

  it("maps args.type to the 'type' column on the inserted row", async () => {
    const { logActivity } = await import("../../lib/activity");

    await logActivity({
      boardId: "board-uuid-2",
      actorId: "actor-uuid-2",
      type: "group.renamed",
      payload: { name: "Renamed group" },
    });

    const insertCall = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.type).toBe("group.renamed");
    // The column must be 'type', not 'action'
    expect(insertCall).not.toHaveProperty("action");
  });

  it("catches an insert error and logs a warning without throwing", async () => {
    const { logActivity } = await import("../../lib/activity");

    mockInsert.mockResolvedValue({
      error: { message: "RLS denied", code: "42501" },
    });

    await expect(
      logActivity({
        boardId: "board-uuid-3",
        actorId: "actor-uuid-3",
        type: "task.deleted",
        payload: {},
      }),
    ).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalled();
  });

  it("catches an unexpected thrown error and logs a warning without throwing", async () => {
    const { logActivity } = await import("../../lib/activity");

    mockInsert.mockRejectedValue(new Error("network failure"));

    await expect(
      logActivity({
        boardId: "board-uuid-4",
        actorId: "actor-uuid-4",
        type: "group.deleted",
        payload: {},
      }),
    ).resolves.toBeUndefined();

    expect(mockWarn).toHaveBeenCalled();
  });

  it("uses null for taskId when taskId is omitted", async () => {
    const { logActivity } = await import("../../lib/activity");

    await logActivity({
      boardId: "board-uuid-5",
      actorId: "actor-uuid-5",
      type: "group.created",
      payload: { color: "#c4c4c4" },
    });

    const insertCall = mockInsert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertCall.task_id).toBeNull();
  });
});
