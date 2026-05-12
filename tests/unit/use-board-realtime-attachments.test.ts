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
// Build a realistic stub channel (mirrors use-board-realtime-comments.test.ts)
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
// Mock the board store actions — includes Epic 10 additions
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
  // Epic 10 additions
  applyAttachmentUpsert: vi.fn(),
  applyAttachmentDelete: vi.fn(),
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
// Tests — Epic 10: attachment subscription
// ---------------------------------------------------------------------------

describe.skip("useBoardRealtime — Epic 10 attachment subscription", () => {
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

  it("registers postgres_changes for attachment with board_id filter", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const sub = stubChannel._findSub("attachment");
    expect((sub.opts as { event?: string }).event).toBe("*");
    expect((sub.opts as { schema?: string }).schema).toBe("public");
    expect((sub.opts as { filter?: string }).filter).toBe(`board_id=eq.${BOARD_ID}`);
  });

  // -------------------------------------------------------------------------
  // attachment — INSERT routes to applyAttachmentUpsert
  // -------------------------------------------------------------------------

  it("attachment INSERT calls applyAttachmentUpsert with e.new", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const newAttachment = {
      id: "att-1",
      board_id: BOARD_ID,
      task_id: "task-1",
      uploader_id: USER_ID,
      filename: "photo.png",
      storage_path: `${BOARD_ID}/task-1/att-1/photo.png`,
      mime_type: "image/png",
      size_bytes: 2048,
      is_uploaded: true,
      scan_status: "skipped",
      comment_id: null,
      created_at: "2024-01-01T00:00:00Z",
    };

    act(() => {
      const sub = stubChannel._findSub("attachment");
      sub.handler({ eventType: "INSERT", new: newAttachment, old: {} });
    });

    expect(mockStore.applyAttachmentUpsert).toHaveBeenCalledWith(newAttachment);
  });

  // -------------------------------------------------------------------------
  // attachment — UPDATE routes to applyAttachmentUpsert (is_uploaded flip)
  // -------------------------------------------------------------------------

  it("attachment UPDATE calls applyAttachmentUpsert with e.new (catches is_uploaded flip)", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const updatedAttachment = {
      id: "att-1",
      board_id: BOARD_ID,
      task_id: "task-1",
      uploader_id: USER_ID,
      filename: "photo.png",
      storage_path: `${BOARD_ID}/task-1/att-1/photo.png`,
      mime_type: "image/png",
      size_bytes: 2048,
      is_uploaded: true, // flipped from false → true by confirmUpload
      scan_status: "skipped",
      comment_id: null,
      created_at: "2024-01-01T00:00:00Z",
    };

    act(() => {
      const sub = stubChannel._findSub("attachment");
      sub.handler({ eventType: "UPDATE", new: updatedAttachment, old: { is_uploaded: false } });
    });

    expect(mockStore.applyAttachmentUpsert).toHaveBeenCalledWith(updatedAttachment);
  });

  // -------------------------------------------------------------------------
  // attachment — DELETE routes to applyAttachmentDelete
  // -------------------------------------------------------------------------

  it("attachment DELETE calls applyAttachmentDelete with id from e.old", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      const sub = stubChannel._findSub("attachment");
      sub.handler({ eventType: "DELETE", new: {}, old: { id: "att-deleted" } });
    });

    expect(mockStore.applyAttachmentDelete).toHaveBeenCalledWith("att-deleted");
  });

  it("attachment DELETE with no id in e.old does not call applyAttachmentDelete", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    act(() => {
      const sub = stubChannel._findSub("attachment");
      sub.handler({ eventType: "DELETE", new: {}, old: {} });
    });

    expect(mockStore.applyAttachmentDelete).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Non-uploaded INSERT does not cause visible mutation (store filters it)
  // -------------------------------------------------------------------------

  it("attachment INSERT with is_uploaded=false still calls applyAttachmentUpsert (store filters)", () => {
    renderHook(() => useBoardRealtime(BOARD_ID, USER_ID));

    const pendingAttachment = {
      id: "att-pending",
      board_id: BOARD_ID,
      task_id: "task-1",
      uploader_id: USER_ID,
      filename: "upload.pdf",
      storage_path: `${BOARD_ID}/task-1/att-pending/upload.pdf`,
      mime_type: "application/pdf",
      size_bytes: 512,
      is_uploaded: false, // not yet confirmed
      scan_status: "skipped",
      comment_id: null,
      created_at: "2024-01-01T00:00:00Z",
    };

    act(() => {
      const sub = stubChannel._findSub("attachment");
      sub.handler({ eventType: "INSERT", new: pendingAttachment, old: {} });
    });

    // Hook always routes to the store; the store itself gates on is_uploaded.
    expect(mockStore.applyAttachmentUpsert).toHaveBeenCalledWith(pendingAttachment);
  });
});
