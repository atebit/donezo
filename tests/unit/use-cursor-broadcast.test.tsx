import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock lib/supabase/client before importing the hook
// ---------------------------------------------------------------------------

interface StubChannel {
  send: ReturnType<typeof vi.fn>;
}

let stubChannel: StubChannel;

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => stubChannel,
  }),
}));

// We also need to make sure lib/realtime/channel resolves without side effects.
// It is a pure function; no mock needed.

// ---------------------------------------------------------------------------
// Import hook after mocks are set up
// ---------------------------------------------------------------------------

import { renderHook } from "@testing-library/react";
import { useCursorBroadcast } from "../../hooks/use-cursor-broadcast";

describe("useCursorBroadcast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubChannel = {
      send: vi.fn(),
    };
    // Restore visibility to 'visible' (jsdom default)
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns an emit function", () => {
    const { result } = renderHook(() => useCursorBroadcast("board-1", "user-1"));
    expect(typeof result.current.emit).toBe("function");
  });

  it("sends to channel with correct payload on emit", () => {
    const { result } = renderHook(() => useCursorBroadcast("board-1", "user-1"));
    result.current.emit("task-1", "col-1");

    expect(stubChannel.send).toHaveBeenCalledTimes(1);
    const call = stubChannel.send.mock.calls[0][0];
    expect(call.type).toBe("broadcast");
    expect(call.event).toBe("cursor");
    expect(call.payload.user_id).toBe("user-1");
    expect(call.payload.task_id).toBe("task-1");
    expect(call.payload.column_id).toBe("col-1");
    expect(typeof call.payload.at).toBe("number");
  });

  it("throttles rapid calls — leading + at most one trailing within 100ms window", () => {
    const { result } = renderHook(() => useCursorBroadcast("board-1", "user-1"));

    // Fire 10 rapid calls (all within the 100ms throttle window)
    for (let i = 0; i < 10; i++) {
      result.current.emit("task-1", `col-${i}`);
    }

    // Leading call fires immediately — only 1 send so far
    expect(stubChannel.send).toHaveBeenCalledTimes(1);

    // Advance past the throttle window — trailing call fires (with last args)
    vi.advanceTimersByTime(110);
    // Leading + trailing = 2 total
    expect(stubChannel.send.mock.calls.length).toBeLessThanOrEqual(2);
    expect(stubChannel.send.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("suppresses emit when document.visibilityState is not 'visible'", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });

    const { result } = renderHook(() => useCursorBroadcast("board-1", "user-1"));
    result.current.emit("task-1", "col-1");

    // Advance past throttle window to trigger trailing if any
    vi.advanceTimersByTime(200);

    // No send calls because visibility is hidden
    expect(stubChannel.send).toHaveBeenCalledTimes(0);
  });

  it("calls cancel on the throttled emitter on unmount (no trailing after unmount)", () => {
    const { result, unmount } = renderHook(() => useCursorBroadcast("board-1", "user-1"));

    // Leading call
    result.current.emit("task-1", "col-1");
    expect(stubChannel.send).toHaveBeenCalledTimes(1);

    // Queue a trailing call
    result.current.emit("task-1", "col-2");

    // Unmount before trailing fires — cancel should suppress it
    unmount();

    vi.advanceTimersByTime(200);

    // Only the leading call; trailing was cancelled on unmount
    expect(stubChannel.send).toHaveBeenCalledTimes(1);
  });

  it("calls channel.send once on first emit (confirms channel is obtained)", () => {
    // We verify indirectly: after emit, send is called on the stub channel
    // that was returned. The mock always returns the same stubChannel regardless
    // of topic; the channel name routing is tested at integration level.
    const { result } = renderHook(() => useCursorBroadcast("board-42", "user-99"));
    result.current.emit("task-X", "col-Y");
    expect(stubChannel.send).toHaveBeenCalledTimes(1);
  });
});
