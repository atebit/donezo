import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock next/navigation before importing the hook
// ---------------------------------------------------------------------------
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// ---------------------------------------------------------------------------
// Build a realistic stub channel that the hook can drive
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
    presenceState: vi.fn(() => ({
      "user-2": [{ user_id: "user-2", online_at: Date.now(), viewing: { type: "board" } }],
    })),
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
// Mock the board store actions
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
};

vi.mock("../../stores/board-store", () => ({
  useBoardStore: {
    getState: () => mockStore,
  },
}));

// ---------------------------------------------------------------------------
// Import the hook AFTER mocks are set up
// ---------------------------------------------------------------------------
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
// Tests
// ---------------------------------------------------------------------------

describe("useBoardRealtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubChannel = makeStubChannel();
    clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Channel registration — postgres_changes subscriptions
  // -------------------------------------------------------------------------

  it("registers postgres_changes for task with board_id filter and * event", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const taskSub = stubChannel._findSub("task");
    expect((taskSub.opts as { event?: string }).event).toBe("*");
    expect((taskSub.opts as { filter?: string }).filter).toBe(`board_id=eq.${BOARD_ID}`);
  });

  it("registers postgres_changes for group with board_id filter", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const sub = stubChannel._findSub("group");
    expect((sub.opts as { filter?: string }).filter).toBe(`board_id=eq.${BOARD_ID}`);
  });

  it("registers postgres_changes for column with board_id filter", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const sub = stubChannel._findSub("column");
    expect((sub.opts as { filter?: string }).filter).toBe(`board_id=eq.${BOARD_ID}`);
  });

  it("registers postgres_changes for cell with board_id filter (enabled after S0)", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const sub = stubChannel._findSub("cell");
    expect((sub.opts as { filter?: string }).filter).toBe(`board_id=eq.${BOARD_ID}`);
  });

  it.skip("does NOT register postgres_changes for comment (deferred to epic 09)", () => {
    // Skipped: epic 09 completed and comment postgres_changes IS now registered.
    // The assertion is obsolete. Tracked in epic-15-test-debt.md.
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const commentSub = stubChannel._registeredEvents.find(
      (e) => e.type === "postgres_changes" && (e.opts as { table?: string }).table === "comment",
    );
    expect(commentSub).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // SUBSCRIBED status — initial connect
  // -------------------------------------------------------------------------

  it("on SUBSCRIBED: calls setConnectionStatus('connected') and track()", async () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    await act(async () => {
      await stubChannel._triggerStatus("SUBSCRIBED");
    });

    expect(mockStore.setConnectionStatus).toHaveBeenCalledWith("connected");
    expect(stubChannel.track).toHaveBeenCalledWith({
      user_id: USER_ID,
      online_at: expect.any(Number),
      viewing: { type: "board" },
    });
  });

  it("on first SUBSCRIBED (no prior reconnect): does NOT call router.refresh()", async () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    await act(async () => {
      await stubChannel._triggerStatus("SUBSCRIBED");
    });

    expect(mockRefresh).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // TIMED_OUT — marks reconnecting
  // -------------------------------------------------------------------------

  it("on TIMED_OUT: calls setConnectionStatus('reconnecting') and clears presence", async () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    await act(async () => {
      await stubChannel._triggerStatus("TIMED_OUT");
    });

    expect(mockStore.setConnectionStatus).toHaveBeenCalledWith("reconnecting");
    expect(mockStore.setPresence).toHaveBeenCalledWith({});
  });

  it("on CHANNEL_ERROR: calls setConnectionStatus('reconnecting') and clears presence", async () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    await act(async () => {
      await stubChannel._triggerStatus("CHANNEL_ERROR");
    });

    expect(mockStore.setConnectionStatus).toHaveBeenCalledWith("reconnecting");
    expect(mockStore.setPresence).toHaveBeenCalledWith({});
  });

  // -------------------------------------------------------------------------
  // Reconnect transition: TIMED_OUT → SUBSCRIBED
  // -------------------------------------------------------------------------

  it("on TIMED_OUT → SUBSCRIBED: calls router.refresh() before marking connected", async () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    await act(async () => {
      await stubChannel._triggerStatus("SUBSCRIBED"); // initial connect
    });
    mockRefresh.mockClear();
    mockStore.setConnectionStatus.mockClear();

    await act(async () => {
      await stubChannel._triggerStatus("TIMED_OUT"); // disconnect
    });

    await act(async () => {
      await stubChannel._triggerStatus("SUBSCRIBED"); // reconnect
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockStore.setConnectionStatus).toHaveBeenCalledWith("connected");
  });

  // -------------------------------------------------------------------------
  // Presence sync
  // -------------------------------------------------------------------------

  it("on presence sync: calls setPresence with channel.presenceState()", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      stubChannel._triggerEvent("presence", "sync", {});
    });

    expect(mockStore.setPresence).toHaveBeenCalledWith(
      expect.objectContaining({ "user-2": expect.any(Array) }),
    );
  });

  // -------------------------------------------------------------------------
  // Broadcast — cursor and typing
  // -------------------------------------------------------------------------

  it("on broadcast cursor: calls setCursor with payload", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const cursorPayload = { user_id: "user-2", task_id: "t1", column_id: "col-1", at: Date.now() };

    act(() => {
      stubChannel._triggerEvent("broadcast", "cursor", { payload: cursorPayload });
    });

    expect(mockStore.setCursor).toHaveBeenCalledWith(cursorPayload);
  });

  it("on broadcast typing: calls setTyping with payload", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const typingPayload = { user_id: "user-2", context: "comment:t1", at: Date.now() };

    act(() => {
      stubChannel._triggerEvent("broadcast", "typing", { payload: typingPayload });
    });

    expect(mockStore.setTyping).toHaveBeenCalledWith(typingPayload);
  });

  // -------------------------------------------------------------------------
  // Postgres changes dispatch
  // -------------------------------------------------------------------------

  it("task INSERT calls applyTaskUpsert", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const newTask = { id: "t1", board_id: BOARD_ID, updated_at: "2024-01-01T00:00:00Z" };

    act(() => {
      const sub = stubChannel._findSub("task");
      sub.handler({ eventType: "INSERT", new: newTask, old: {} });
    });

    expect(mockStore.applyTaskUpsert).toHaveBeenCalledWith(newTask);
  });

  it("task DELETE calls applyTaskDelete with id from e.old", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      const sub = stubChannel._findSub("task");
      sub.handler({ eventType: "DELETE", new: {}, old: { id: "t-deleted" } });
    });

    expect(mockStore.applyTaskDelete).toHaveBeenCalledWith("t-deleted");
  });

  it("group DELETE calls applyGroupDelete with id", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      const sub = stubChannel._findSub("group");
      sub.handler({ eventType: "DELETE", new: {}, old: { id: "g-deleted" } });
    });

    expect(mockStore.applyGroupDelete).toHaveBeenCalledWith("g-deleted");
  });

  it("column DELETE calls applyColumnDelete with id", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      const sub = stubChannel._findSub("column");
      sub.handler({ eventType: "DELETE", new: {}, old: { id: "c-deleted" } });
    });

    expect(mockStore.applyColumnDelete).toHaveBeenCalledWith("c-deleted");
  });

  it("cell INSERT calls applyCellUpsert", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const newCell = {
      task_id: "t1",
      column_id: "col1",
      board_id: BOARD_ID,
      updated_at: "2024-01-01T00:00:00Z",
    };

    act(() => {
      const sub = stubChannel._findSub("cell");
      sub.handler({ eventType: "INSERT", new: newCell, old: {} });
    });

    expect(mockStore.applyCellUpsert).toHaveBeenCalledWith(newCell);
  });

  it("cell DELETE does not call any store delete method (no store method exists)", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      const sub = stubChannel._findSub("cell");
      sub.handler({ eventType: "DELETE", new: {}, old: { id: "cell-id" } });
    });

    // No cell-delete store method should be called
    expect(mockStore.applyTaskDelete).not.toHaveBeenCalled();
    expect(mockStore.applyGroupDelete).not.toHaveBeenCalled();
    expect(mockStore.applyColumnDelete).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Sweeper interval
  // -------------------------------------------------------------------------

  it("sweeper interval calls pruneExpiredCursors and pruneExpiredTyping every 2s", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockStore.pruneExpiredCursors).toHaveBeenCalledTimes(1);
    expect(mockStore.pruneExpiredTyping).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockStore.pruneExpiredCursors).toHaveBeenCalledTimes(2);
    expect(mockStore.pruneExpiredTyping).toHaveBeenCalledTimes(2);
  });

  it("sweeper calls pruneExpiredCursors and pruneExpiredTyping with ttlMs = 5000", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockStore.pruneExpiredCursors).toHaveBeenCalledWith(expect.any(Number), 5000);
    expect(mockStore.pruneExpiredTyping).toHaveBeenCalledWith(expect.any(Number), 5000);
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  it("cleanup calls channel.unsubscribe() and removeChannel()", () => {
    const { unmount } = renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    unmount();

    expect(stubChannel.unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });

  it("cleanup clears the sweeper interval (no more prune calls after unmount)", () => {
    const { unmount } = renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    unmount();
    mockStore.pruneExpiredCursors.mockClear();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(mockStore.pruneExpiredCursors).not.toHaveBeenCalled();
  });
});
