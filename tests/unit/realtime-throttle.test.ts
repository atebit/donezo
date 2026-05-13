import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { throttle } from "../../lib/realtime/throttle";

describe("throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the leading call synchronously (immediately on first invocation)", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled("a");

    // Leading edge fires immediately
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("a");
  });

  it("coalesces repeated calls within the wait window; trailing fires once with last args", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    // Leading call
    throttled("first");
    expect(fn).toHaveBeenCalledTimes(1);

    // Rapid calls within the 100ms window
    throttled("second");
    throttled("third");
    throttled("fourth");

    // Still only the leading call has fired
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance past the wait window — trailing call fires with last args
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("fourth");
  });

  it("allows a new leading call after the window has passed", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled("first");
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance fully past the window with no more calls (no trailing scheduled)
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1); // no trailing call (nothing was queued)

    // New call after window resets — fires as leading edge
    throttled("second");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("second");
  });

  it("cancel() prevents the trailing call from firing", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    // Leading call
    throttled("first");
    // Queue a trailing call
    throttled("second");

    // Cancel before the trailing fires
    throttled.cancel();

    vi.advanceTimersByTime(200);

    // Only the leading call; trailing was cancelled
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("first");
  });

  it("passes multiple arguments correctly", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled("a", "b", "c");
    expect(fn).toHaveBeenCalledWith("a", "b", "c");
  });

  it("trailing call uses the last-args from the window, not earlier ones", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled("alpha"); // leading
    throttled("beta"); // queued — will be overwritten
    throttled("gamma"); // overwrites beta as latest trailing args

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("gamma");
  });
});
