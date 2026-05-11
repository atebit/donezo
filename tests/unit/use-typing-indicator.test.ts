// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock useBoardStore to control typingByContext
// ---------------------------------------------------------------------------

// We need to control what selector returns — keep a mutable map so individual
// tests can populate it before rendering.
let mockTypingByContext: Map<
  string,
  Array<{ user_id: string; context: string; at: number }>
> = new Map();

vi.mock("../../stores/board-store", () => ({
  useBoardStore: (selector: (state: { typingByContext: typeof mockTypingByContext }) => unknown) =>
    selector({ typingByContext: mockTypingByContext }),
}));

// ---------------------------------------------------------------------------
// Import the hook AFTER mocks
// ---------------------------------------------------------------------------
// @ts-expect-error renderHook is wired in epic 15
import { renderHook } from "@testing-library/react";
import { useTypingIndicator } from "../../hooks/use-typing-indicator";

const CONTEXT = "comment:task-42";
const OTHER_CONTEXT = "comment:task-99";

describe.skip("useTypingIndicator", () => {
  // -------------------------------------------------------------------------
  // Self-filter: current user is excluded from results
  // -------------------------------------------------------------------------

  it("filters out the current user from the result list", () => {
    mockTypingByContext = new Map([
      [
        CONTEXT,
        [
          { user_id: "u1", context: CONTEXT, at: 1000 },
          { user_id: "u2", context: CONTEXT, at: 2000 },
        ],
      ],
    ]);

    const { result } = renderHook(() => useTypingIndicator({ userId: "u1", context: CONTEXT }));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toEqual({ user_id: "u2", at: 2000 });
  });

  it("returns all entries when none match the current userId (no self present)", () => {
    mockTypingByContext = new Map([
      [
        CONTEXT,
        [
          { user_id: "u2", context: CONTEXT, at: 1000 },
          { user_id: "u3", context: CONTEXT, at: 2000 },
        ],
      ],
    ]);

    const { result } = renderHook(() => useTypingIndicator({ userId: "u1", context: CONTEXT }));

    expect(result.current).toHaveLength(2);
  });

  it("returns an empty array when there are no typists in the context", () => {
    mockTypingByContext = new Map(); // no entries at all

    const { result } = renderHook(() => useTypingIndicator({ userId: "u1", context: CONTEXT }));

    expect(result.current).toEqual([]);
  });

  it("returns only entries for the matching context, not other contexts", () => {
    mockTypingByContext = new Map([
      [CONTEXT, [{ user_id: "u2", context: CONTEXT, at: 1000 }]],
      [OTHER_CONTEXT, [{ user_id: "u3", context: OTHER_CONTEXT, at: 2000 }]],
    ]);

    const { result } = renderHook(() => useTypingIndicator({ userId: "u1", context: CONTEXT }));

    // Should only see u2, not u3 (which is in a different context)
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toEqual({ user_id: "u2", at: 1000 });
  });

  it("returns an empty array when the only entry in the context is the current user", () => {
    mockTypingByContext = new Map([[CONTEXT, [{ user_id: "u1", context: CONTEXT, at: 1000 }]]]);

    const { result } = renderHook(() => useTypingIndicator({ userId: "u1", context: CONTEXT }));

    expect(result.current).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Spec fixture: store seeded to typingByContext: { 'comment:t1': [{u1,at1}, {u2,at2}] }
  // with userId: 'u1' — hook returns only [{u2, at2}]
  // -------------------------------------------------------------------------

  it("spec fixture: returns only [{ u2, at2 }] when userId is u1 and both are typing in comment:t1", () => {
    const at1 = 1_000_000;
    const at2 = 2_000_000;

    mockTypingByContext = new Map([
      [
        "comment:t1",
        [
          { user_id: "u1", context: "comment:t1", at: at1 },
          { user_id: "u2", context: "comment:t1", at: at2 },
        ],
      ],
    ]);

    const { result } = renderHook(() =>
      useTypingIndicator({ userId: "u1", context: "comment:t1" }),
    );

    expect(result.current).toEqual([{ user_id: "u2", context: "comment:t1", at: at2 }]);
  });
});
