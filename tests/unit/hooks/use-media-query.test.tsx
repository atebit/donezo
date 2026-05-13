// @ts-expect-error vitest is wired in epic 15
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for useMediaQuery hook.
 *
 * Full integration tests (with renderHook) require @testing-library/react +
 * jsdom — wired in epic 15. These tests verify the logic contract via direct
 * hook invocation in a mocked environment.
 *
 * Note: describe.skip keeps tests from running until RTL + jsdom land.
 * Remove the .skip once epic 15 wires the test environment.
 */

// ---------------------------------------------------------------------------
// matchMedia mock helpers
// ---------------------------------------------------------------------------

type MediaQueryListListener = (event: MediaQueryListEvent) => void;

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  _listeners: MediaQueryListListener[];
  _trigger: (matches: boolean) => void;
}

function makeMockMediaQueryList(matches: boolean, media: string): MockMediaQueryList {
  const listeners: MediaQueryListListener[] = [];

  const mql: MockMediaQueryList = {
    matches,
    media,
    _listeners: listeners,
    addEventListener: vi.fn((_type: string, listener: MediaQueryListListener) => {
      listeners.push(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: MediaQueryListListener) => {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    _trigger: (newMatches: boolean) => {
      mql.matches = newMatches;
      const event = { matches: newMatches } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
  return mql;
}

// ---------------------------------------------------------------------------
// Verify mock helper behaviour (plain node — no React, always runs)
// ---------------------------------------------------------------------------

describe("useMediaQuery — mock helper unit tests", () => {
  it("makeMockMediaQueryList stores and triggers listeners correctly", () => {
    const mql = makeMockMediaQueryList(false, "(min-width: 768px)");
    let received: boolean | null = null;

    const listener = (e: MediaQueryListEvent) => {
      received = e.matches;
    };
    mql.addEventListener("change", listener);
    expect(mql._listeners).toHaveLength(1);

    mql._trigger(true);
    expect(received).toBe(true);
    expect(mql.matches).toBe(true);
  });

  it("makeMockMediaQueryList removes listeners on removeEventListener", () => {
    const mql = makeMockMediaQueryList(false, "(min-width: 768px)");
    const listener = vi.fn();
    mql.addEventListener("change", listener);
    expect(mql._listeners).toHaveLength(1);

    mql.removeEventListener("change", listener);
    expect(mql._listeners).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Hook integration tests (require renderHook + jsdom — skip until epic 15)
// ---------------------------------------------------------------------------

describe.skip("useMediaQuery — hook integration (requires RTL + jsdom, epic 15)", () => {
  let originalMatchMedia: unknown;
  let mockMql: MockMediaQueryList;

  beforeEach(() => {
    originalMatchMedia = (globalThis as { matchMedia?: unknown }).matchMedia;
  });

  afterEach(() => {
    (globalThis as { matchMedia?: unknown }).matchMedia =
      originalMatchMedia as typeof window.matchMedia;
    vi.restoreAllMocks();
  });

  it("returns false on initial render (SSR-safe default)", async () => {
    // Import inline to avoid RTL import error at module load
    const { renderHook } = await import("@testing-library/react");
    const { useMediaQuery } = await import("@/hooks/use-media-query");

    mockMql = makeMockMediaQueryList(true, "(min-width: 768px)");
    (window as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue(mockMql);

    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    expect(result.current).toBe(false);
  });

  it("returns true after mount when query matches", async () => {
    const { act, renderHook } = await import("@testing-library/react");
    const { useMediaQuery } = await import("@/hooks/use-media-query");

    mockMql = makeMockMediaQueryList(true, "(min-width: 768px)");
    (window as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue(mockMql);

    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it("returns false after mount when query does not match", async () => {
    const { act, renderHook } = await import("@testing-library/react");
    const { useMediaQuery } = await import("@/hooks/use-media-query");

    mockMql = makeMockMediaQueryList(false, "(min-width: 768px)");
    (window as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue(mockMql);

    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    await act(async () => {});
    expect(result.current).toBe(false);
  });

  it("updates when the media query changes", async () => {
    const { act, renderHook } = await import("@testing-library/react");
    const { useMediaQuery } = await import("@/hooks/use-media-query");

    mockMql = makeMockMediaQueryList(false, "(min-width: 768px)");
    (window as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue(mockMql);

    const { result } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    await act(async () => {});
    expect(result.current).toBe(false);

    await act(async () => {
      mockMql._trigger(true);
    });
    expect(result.current).toBe(true);
  });

  it("registers and cleans up the change listener", async () => {
    const { act, renderHook } = await import("@testing-library/react");
    const { useMediaQuery } = await import("@/hooks/use-media-query");

    mockMql = makeMockMediaQueryList(false, "(min-width: 768px)");
    (window as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue(mockMql);

    const { unmount } = renderHook(() => useMediaQuery("(min-width: 768px)"));
    await act(async () => {});

    expect(mockMql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(mockMql._listeners).toHaveLength(1);

    unmount();

    expect(mockMql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(mockMql._listeners).toHaveLength(0);
  });
});
