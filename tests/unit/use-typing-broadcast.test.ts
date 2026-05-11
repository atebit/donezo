// @ts-expect-error vitest is wired in epic 15
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Stub channel returned by createClient().channel()
// ---------------------------------------------------------------------------

interface StubChannel {
  send: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
}

function makeStubChannel(): StubChannel {
  return {
    send: vi.fn(() => Promise.resolve("ok")),
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
    unsubscribe: vi.fn(() => Promise.resolve()),
  };
}

let stubChannel: StubChannel;
const mockRemoveChannel = vi.fn(() => Promise.resolve());

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => stubChannel,
    removeChannel: mockRemoveChannel,
  }),
}));

// ---------------------------------------------------------------------------
// Import the hook AFTER mocks
// ---------------------------------------------------------------------------
// @ts-expect-error renderHook is wired in epic 15
import { act, renderHook } from "@testing-library/react";
import { useTypingBroadcast } from "../../hooks/use-typing-broadcast";

const BOARD_ID = "board-abc";
const USER_ID = "user-123";
const CONTEXT = "comment:task-42";

describe.skip("useTypingBroadcast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubChannel = makeStubChannel();
    mockRemoveChannel.mockClear();

    // Default: tab is visible
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Throttle: leading edge fires immediately; subsequent calls within 2000ms
  // are collapsed into one trailing call
  // -------------------------------------------------------------------------

  it("emit() sends a broadcast payload immediately on first call (leading edge)", () => {
    const { result } = renderHook(() =>
      useTypingBroadcast({ boardId: BOARD_ID, userId: USER_ID, context: CONTEXT }),
    );

    act(() => {
      result.current.emit();
    });

    expect(stubChannel.send).toHaveBeenCalledTimes(1);
    expect(stubChannel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "broadcast",
        event: "typing",
        payload: expect.objectContaining({
          user_id: USER_ID,
          context: CONTEXT,
          at: expect.any(Number),
        }),
      }),
    );
  });

  it("multiple emit() calls within 2000ms result in at most two sends (leading + one trailing)", () => {
    const { result } = renderHook(() =>
      useTypingBroadcast({ boardId: BOARD_ID, userId: USER_ID, context: CONTEXT }),
    );

    act(() => {
      result.current.emit(); // leading
      result.current.emit(); // within window — queued
      result.current.emit(); // within window — replaces queued
    });

    // Only the leading call has fired so far
    expect(stubChannel.send).toHaveBeenCalledTimes(1);

    // Advance past the 2000ms throttle window — trailing fires
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(stubChannel.send).toHaveBeenCalledTimes(2);
  });

  it("a second emit() after 2000ms fires as a fresh leading call (window has reset)", () => {
    const { result } = renderHook(() =>
      useTypingBroadcast({ boardId: BOARD_ID, userId: USER_ID, context: CONTEXT }),
    );

    act(() => {
      result.current.emit(); // first leading
    });
    expect(stubChannel.send).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(2000); // window resets, no trailing queued
    });

    act(() => {
      result.current.emit(); // second leading
    });
    expect(stubChannel.send).toHaveBeenCalledTimes(2);
  });

  it("payload shape satisfies TypingPayload: user_id, context, at (epoch ms)", () => {
    const now = 1_700_000_000_000;
    vi.setSystemTime(now);

    const { result } = renderHook(() =>
      useTypingBroadcast({ boardId: BOARD_ID, userId: USER_ID, context: CONTEXT }),
    );

    act(() => {
      result.current.emit();
    });

    const call = stubChannel.send.mock.calls[0]?.[0] as {
      payload: { user_id: string; context: string; at: number };
    };
    expect(call.payload.user_id).toBe(USER_ID);
    expect(call.payload.context).toBe(CONTEXT);
    expect(call.payload.at).toBe(now);
  });

  // -------------------------------------------------------------------------
  // Visibility gate: hidden tabs should not emit
  // -------------------------------------------------------------------------

  it("emit() is suppressed when document.visibilityState is 'hidden'", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });

    const { result } = renderHook(() =>
      useTypingBroadcast({ boardId: BOARD_ID, userId: USER_ID, context: CONTEXT }),
    );

    act(() => {
      result.current.emit();
    });

    expect(stubChannel.send).not.toHaveBeenCalled();
  });

  it("emit() fires once tab becomes visible again after being hidden", () => {
    // Start hidden
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });

    const { result } = renderHook(() =>
      useTypingBroadcast({ boardId: BOARD_ID, userId: USER_ID, context: CONTEXT }),
    );

    act(() => {
      result.current.emit(); // suppressed
    });
    expect(stubChannel.send).toHaveBeenCalledTimes(0);

    // Advance past throttle window so next call is a fresh leading
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Tab becomes visible
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });

    act(() => {
      result.current.emit(); // now visible — fires
    });
    expect(stubChannel.send).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Cancel on unmount: trailing call must not fire after unmount
  // -------------------------------------------------------------------------

  it("unmount cancels the pending throttle trailing call", () => {
    const { result, unmount } = renderHook(() =>
      useTypingBroadcast({ boardId: BOARD_ID, userId: USER_ID, context: CONTEXT }),
    );

    act(() => {
      result.current.emit(); // leading
      result.current.emit(); // queued trailing
    });
    expect(stubChannel.send).toHaveBeenCalledTimes(1);

    // Unmount before trailing fires
    unmount();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Trailing call was cancelled by unmount — still only 1 send
    expect(stubChannel.send).toHaveBeenCalledTimes(1);
  });

  it("unmount does NOT call channel.unsubscribe() or supabase.removeChannel() — board channel is owned by useBoardRealtime", () => {
    const { unmount } = renderHook(() =>
      useTypingBroadcast({ boardId: BOARD_ID, userId: USER_ID, context: CONTEXT }),
    );

    unmount();

    expect(stubChannel.unsubscribe).toHaveBeenCalledTimes(0);
    expect(mockRemoveChannel).toHaveBeenCalledTimes(0);
  });

  it("hook does NOT call channel.subscribe() on mount — useBoardRealtime owns the subscription", () => {
    renderHook(() => useTypingBroadcast({ boardId: BOARD_ID, userId: USER_ID, context: CONTEXT }));

    expect(stubChannel.subscribe).toHaveBeenCalledTimes(0);
  });
});
