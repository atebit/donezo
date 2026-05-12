// @ts-expect-error vitest is wired in epic 15
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock next/navigation before importing the hook
// ---------------------------------------------------------------------------
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// ---------------------------------------------------------------------------
// Build a realistic stub channel (reused from use-board-realtime.test.ts)
// ---------------------------------------------------------------------------

type EventHandler = (payload: unknown) => void;

interface RegisteredEvent {
  type: string;
  opts: Record<string, unknown>;
  handler: EventHandler;
}

interface StubChannel {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  presenceState: ReturnType<typeof vi.fn>;
  _triggerStatus: (status: string) => Promise<void>;
  _triggerEvent: (type: string, event: string, payload: unknown) => void;
  _registeredEvents: RegisteredEvent[];
  _findSub: (table: string) => RegisteredEvent;
}

function makeStubChannel(): StubChannel {
  const registeredEvents: RegisteredEvent[] = [];
  let subscribeCallback: ((status: string) => Promise<void>) | null = null;

  const channel: StubChannel = {
    _registeredEvents: registeredEvents,
    on: vi.fn((type: string, opts: Record<string, unknown>, handler: EventHandler) => {
      registeredEvents.push({ type, opts, handler });
      return channel;
    }),
    subscribe: vi.fn((cb: (status: string) => Promise<void>) => {
      subscribeCallback = cb;
      return channel;
    }),
    track: vi.fn(() => Promise.resolve()),
    unsubscribe: vi.fn(() => Promise.resolve()),
    presenceState: vi.fn(() => ({})),
    _triggerStatus: async (status: string) => {
      if (subscribeCallback) {
        await subscribeCallback(status);
      }
    },
    _triggerEvent: (type: string, event: string, payload: unknown) => {
      for (const reg of registeredEvents) {
        if (reg.type === type && (reg.opts as { event?: string }).event === event) {
          reg.handler(payload);
        }
      }
    },
    /** Finds a postgres_changes registration for a given table; throws if absent. */
    _findSub: (table: string): RegisteredEvent => {
      const sub = registeredEvents.find(
        (e) => e.type === "postgres_changes" && (e.opts as { table?: string }).table === table,
      );
      if (!sub) {
        throw new Error(`No postgres_changes subscription found for table: ${table}`);
      }
      return sub;
    },
  };

  return channel;
}

// ---------------------------------------------------------------------------
// Mock lib/supabase/client
// ---------------------------------------------------------------------------

let stubChannel: StubChannel;
const mockRemoveChannel = vi.fn(() => Promise.resolve());

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => stubChannel,
    removeChannel: mockRemoveChannel,
  }),
}));

// ---------------------------------------------------------------------------
// Mock the board store actions — includes Epic 09 additions
// ---------------------------------------------------------------------------

const mockStore = {
  setConnectionStatus: vi.fn(),
  setPresence: vi.fn(),
  setCursor: vi.fn(),
  setTyping: vi.fn(),
  applyTaskUpsert: vi.fn(),
  applyTaskDelete: vi.fn(),
  applyGroupUpsert: vi.fn(),
  applyGroupDelete: vi.fn(),
  applyColumnUpsert: vi.fn(),
  applyColumnDelete: vi.fn(),
  applyCellUpsert: vi.fn(),
  pruneExpiredCursors: vi.fn(),
  pruneExpiredTyping: vi.fn(),
  // Epic 09 additions
  applyCommentUpsert: vi.fn(),
  applyCommentDelete: vi.fn(),
  applyReactionInsert: vi.fn(),
  applyReactionDelete: vi.fn(),
  applyActivityInsert: vi.fn(),
};

vi.mock("../../stores/board-store", () => ({
  useBoardStore: {
    getState: () => mockStore,
  },
}));

// ---------------------------------------------------------------------------
// Import the hook AFTER mocks are set up
// ---------------------------------------------------------------------------
// @ts-expect-error renderHook is wired in epic 15
import { act, renderHook } from "@testing-library/react";
import { useBoardRealtime } from "../../hooks/use-board-realtime";

const BOARD_ID = "board-abc";
const USER_ID = "user-123";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clearAllMocks(): void {
  mockRefresh.mockClear();
  mockRemoveChannel.mockClear();
  for (const fn of Object.values(mockStore)) {
    (fn as ReturnType<typeof vi.fn>).mockClear();
  }
}

// ---------------------------------------------------------------------------
// Tests — Epic 09: comment, comment_reaction, activity subscriptions
// ---------------------------------------------------------------------------

describe.skip("useBoardRealtime — Epic 09 comment/reaction/activity subscriptions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubChannel = makeStubChannel();
    clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Channel registration
  // -------------------------------------------------------------------------

  it("registers postgres_changes for comment with board_id filter", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const sub = stubChannel._findSub("comment");
    expect((sub.opts as { event?: string }).event).toBe("*");
    expect((sub.opts as { filter?: string }).filter).toBe(`board_id=eq.${BOARD_ID}`);
  });

  it("registers postgres_changes for comment_reaction with board_id filter", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const sub = stubChannel._findSub("comment_reaction");
    expect((sub.opts as { event?: string }).event).toBe("*");
    expect((sub.opts as { filter?: string }).filter).toBe(`board_id=eq.${BOARD_ID}`);
  });

  it("registers postgres_changes for activity with board_id filter", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const sub = stubChannel._findSub("activity");
    expect((sub.opts as { event?: string }).event).toBe("*");
    expect((sub.opts as { filter?: string }).filter).toBe(`board_id=eq.${BOARD_ID}`);
  });

  // -------------------------------------------------------------------------
  // comment — INSERT/UPDATE dispatches to applyCommentUpsert
  // -------------------------------------------------------------------------

  it("comment INSERT calls applyCommentUpsert", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const newComment = {
      id: "c1",
      board_id: BOARD_ID,
      task_id: "task-1",
      body: {},
      body_text: "Hello",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    act(() => {
      const sub = stubChannel._findSub("comment");
      sub.handler({ eventType: "INSERT", new: newComment, old: {} });
    });

    expect(mockStore.applyCommentUpsert).toHaveBeenCalledWith(newComment);
  });

  it("comment UPDATE calls applyCommentUpsert", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const updatedComment = {
      id: "c1",
      board_id: BOARD_ID,
      task_id: "task-1",
      body: {},
      body_text: "Updated",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    };

    act(() => {
      const sub = stubChannel._findSub("comment");
      sub.handler({ eventType: "UPDATE", new: updatedComment, old: {} });
    });

    expect(mockStore.applyCommentUpsert).toHaveBeenCalledWith(updatedComment);
  });

  it("comment DELETE calls applyCommentDelete with id from e.old", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      const sub = stubChannel._findSub("comment");
      sub.handler({ eventType: "DELETE", new: {}, old: { id: "c-deleted" } });
    });

    expect(mockStore.applyCommentDelete).toHaveBeenCalledWith("c-deleted");
  });

  it("comment DELETE with no id in e.old does not call applyCommentDelete", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      const sub = stubChannel._findSub("comment");
      sub.handler({ eventType: "DELETE", new: {}, old: {} });
    });

    expect(mockStore.applyCommentDelete).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // comment_reaction — INSERT/DELETE dispatch correctly
  // -------------------------------------------------------------------------

  it("comment_reaction INSERT calls applyReactionInsert", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const newReaction = {
      comment_id: "c1",
      user_id: USER_ID,
      emoji: "👍",
      board_id: BOARD_ID,
      created_at: "2024-01-01T00:00:00Z",
    };

    act(() => {
      const sub = stubChannel._findSub("comment_reaction");
      sub.handler({ eventType: "INSERT", new: newReaction, old: {} });
    });

    expect(mockStore.applyReactionInsert).toHaveBeenCalledWith(newReaction);
  });

  it("comment_reaction DELETE calls applyReactionDelete with (comment_id, user_id, emoji)", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      const sub = stubChannel._findSub("comment_reaction");
      sub.handler({
        eventType: "DELETE",
        new: {},
        old: { comment_id: "c1", user_id: USER_ID, emoji: "👍" },
      });
    });

    expect(mockStore.applyReactionDelete).toHaveBeenCalledWith("c1", USER_ID, "👍");
  });

  it("comment_reaction UPDATE does not call any store action (reactions are immutable)", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      const sub = stubChannel._findSub("comment_reaction");
      sub.handler({ eventType: "UPDATE", new: {}, old: {} });
    });

    expect(mockStore.applyReactionInsert).not.toHaveBeenCalled();
    expect(mockStore.applyReactionDelete).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Self-echo idempotency: same user inserts a reaction and receives it back
  // -------------------------------------------------------------------------

  it("self-echo on comment_reaction INSERT: applyReactionInsert is called (store is idempotent)", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const reaction = {
      comment_id: "c1",
      user_id: USER_ID,
      emoji: "👍",
      board_id: BOARD_ID,
      created_at: "2024-01-01T00:00:00Z",
    };

    // Simulate receiving the same INSERT twice (self-echo)
    act(() => {
      const sub = stubChannel._findSub("comment_reaction");
      sub.handler({ eventType: "INSERT", new: reaction, old: {} });
      sub.handler({ eventType: "INSERT", new: reaction, old: {} });
    });

    // Hook dispatches both; the store's idempotency gates prevent double-increment
    expect(mockStore.applyReactionInsert).toHaveBeenCalledTimes(2);
    // The store mock is a no-op here; we just verify the hook passed both to the store.
    // The board-store-comments.test.ts tests verify that the store is idempotent.
  });

  // -------------------------------------------------------------------------
  // activity — INSERT dispatches correctly; UPDATE/DELETE are no-ops
  // -------------------------------------------------------------------------

  it("activity INSERT calls applyActivityInsert", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const newActivity = {
      id: "act-1",
      board_id: BOARD_ID,
      task_id: "task-1",
      actor_id: USER_ID,
      type: "task.renamed",
      payload: {},
      created_at: "2024-01-01T00:00:00Z",
    };

    act(() => {
      const sub = stubChannel._findSub("activity");
      sub.handler({ eventType: "INSERT", new: newActivity, old: {} });
    });

    expect(mockStore.applyActivityInsert).toHaveBeenCalledWith(newActivity);
  });

  it("activity UPDATE does not call any store action (activity is append-only)", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      const sub = stubChannel._findSub("activity");
      sub.handler({ eventType: "UPDATE", new: {}, old: {} });
    });

    expect(mockStore.applyActivityInsert).not.toHaveBeenCalled();
  });

  it("activity DELETE does not call any store action (activity is append-only)", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      const sub = stubChannel._findSub("activity");
      sub.handler({ eventType: "DELETE", new: {}, old: {} });
    });

    expect(mockStore.applyActivityInsert).not.toHaveBeenCalled();
  });
});
