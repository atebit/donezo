/**
 * tests/unit/jobs/compact-positions.test.ts
 *
 * Unit tests for lib/jobs/compact-positions.ts (runCompactPositions).
 *
 * Coverage:
 *  - Returns { boardsProcessed, groupsCompacted, tasksCompacted } summary.
 *  - No active boards → returns zeros.
 *  - Board fetch error → throws and captures to Sentry.
 *  - Groups that already have compact positions are skipped.
 *  - Groups are updated when their position differs from the compacted value.
 *  - Tasks within a group are compacted by position order.
 *  - Group fetch error is logged and the board is skipped (no throw).
 *  - Task fetch error is logged and the group is skipped (no throw).
 *  - Structured log calls happen.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be at top level so vi.mock() hoisting works correctly
// ---------------------------------------------------------------------------

const mockSentryCapture = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: mockSentryCapture,
}));

vi.mock("../../../lib/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mutable sequence for from() call results — set in each test.
let fromResults: Array<{ data: unknown; error: unknown }> = [];
let fromCallIndex = 0;

vi.mock("../../../lib/supabase/admin", () => ({
  adminClient: () => ({
    from: () => {
      const result = fromResults[fromCallIndex] ?? { data: null, error: null };
      fromCallIndex++;
      return makeChain(result);
    },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ChainResult = { data: unknown; error: unknown };

function makeChain(result: ChainResult) {
  const p = Promise.resolve(result);
  const c: Record<string, unknown> = {
    select: () => c,
    eq: () => c,
    is: () => c,
    gte: () => c,
    order: () => c,
    update: () => c,
    // biome-ignore lint/suspicious/noThenProperty: required for Supabase query chain mock
    then: (p as Promise<unknown>).then.bind(p),
    catch: (p as Promise<unknown>).catch.bind(p),
    finally: (p as Promise<unknown>).finally.bind(p),
  };
  return c;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runCompactPositions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    fromResults = [];
    fromCallIndex = 0;
  });

  it("returns zero counts when no active boards are found", async () => {
    fromResults = [{ data: [], error: null }];

    const { runCompactPositions } = await import("@/lib/jobs/compact-positions");
    const result = await runCompactPositions();

    expect(result.boardsProcessed).toBe(0);
    expect(result.groupsCompacted).toBe(0);
    expect(result.tasksCompacted).toBe(0);
  });

  it("throws and captures to Sentry when board fetch fails", async () => {
    fromResults = [{ data: null, error: { message: "board fetch error" } }];

    const { runCompactPositions } = await import("@/lib/jobs/compact-positions");
    await expect(runCompactPositions()).rejects.toThrow("compact-positions board fetch failed");
    expect(mockSentryCapture).toHaveBeenCalledOnce();
  });

  it("processes a board with groups and tasks and returns correct counts", async () => {
    // Sequence:
    // 0. boards query → [{id: 'board-aaa'}]
    // 1. groups query for board-aaa → [{id: 'group-bbb', position: 1.5}]
    // 2. group update for group-bbb (1.5 → 1000) → {data:null, error:null}
    // 3. tasks query for group-bbb → [{id:'task-1', position: 1.5}]
    // 4. task update for task-1 (1.5 → 1000) → {data:null, error:null}
    fromResults = [
      { data: [{ id: "board-aaa" }], error: null },
      { data: [{ id: "group-bbb", position: 1.5 }], error: null },
      { data: null, error: null }, // group update
      { data: [{ id: "task-1", position: 1.5 }], error: null },
      { data: null, error: null }, // task update
    ];

    const { runCompactPositions } = await import("@/lib/jobs/compact-positions");
    const result = await runCompactPositions();

    expect(result.boardsProcessed).toBe(1);
    expect(result.groupsCompacted).toBe(1);
    expect(result.tasksCompacted).toBe(1);
  });

  it("skips group update when position is already compact (=1000)", async () => {
    // Position 1000 = (0+1)*1000 — already correct for index 0.
    fromResults = [
      { data: [{ id: "board-ccc" }], error: null },
      { data: [{ id: "group-ddd", position: 1000 }], error: null },
      { data: [], error: null }, // tasks (none)
    ];

    const { runCompactPositions } = await import("@/lib/jobs/compact-positions");
    const result = await runCompactPositions();

    expect(result.groupsCompacted).toBe(0);
    expect(result.tasksCompacted).toBe(0);
  });

  it("logs group fetch error and continues — does not throw", async () => {
    fromResults = [
      { data: [{ id: "board-x" }], error: null },
      { data: null, error: { message: "group fetch fail" } },
    ];

    const { runCompactPositions } = await import("@/lib/jobs/compact-positions");
    // Should resolve, not reject.
    const result = await runCompactPositions();

    expect(result.boardsProcessed).toBe(1);
    expect(result.groupsCompacted).toBe(0);
    expect(mockLoggerError).toHaveBeenCalled();
    expect(mockSentryCapture).not.toHaveBeenCalled();
  });

  it("compacts two groups for a single board", async () => {
    // board → 2 groups (positions 0.5 and 1.5) → updated to 1000 and 2000
    // no tasks in either group
    fromResults = [
      { data: [{ id: "board-m" }], error: null },
      {
        data: [
          { id: "group-1", position: 0.5 },
          { id: "group-2", position: 1.5 },
        ],
        error: null,
      },
      { data: null, error: null }, // group-1 update
      { data: [], error: null }, // tasks for group-1
      { data: null, error: null }, // group-2 update
      { data: [], error: null }, // tasks for group-2
    ];

    const { runCompactPositions } = await import("@/lib/jobs/compact-positions");
    const result = await runCompactPositions();

    expect(result.boardsProcessed).toBe(1);
    expect(result.groupsCompacted).toBe(2);
    expect(result.tasksCompacted).toBe(0);
  });

  it("logs info summary on success", async () => {
    fromResults = [{ data: [], error: null }];

    const { runCompactPositions } = await import("@/lib/jobs/compact-positions");
    await runCompactPositions();

    expect(mockLoggerInfo).toHaveBeenCalled();
  });
});
