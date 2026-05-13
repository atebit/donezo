import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for usePrefersReducedMotion hook.
 *
 * Full integration tests (with renderHook) require @testing-library/react +
 * jsdom — wired in epic 15.
 *
 * Note: describe.skip keeps hook tests from running until RTL + jsdom land.
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

function makeMockMediaQueryList(matches: boolean): MockMediaQueryList {
  const listeners: MediaQueryListListener[] = [];

  const mql: MockMediaQueryList = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
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

describe("usePrefersReducedMotion — mock helper unit tests", () => {
  it("makeMockMediaQueryList triggers listeners correctly for reduced-motion", () => {
    const mql = makeMockMediaQueryList(false);
    let received: boolean | null = null;

    const listener = (e: MediaQueryListEvent) => {
      received = e.matches;
    };
    mql.addEventListener("change", listener);
    mql._trigger(true);

    expect(received).toBe(true);
    expect(mql.matches).toBe(true);
  });

  it("makeMockMediaQueryList removes listeners correctly", () => {
    const mql = makeMockMediaQueryList(false);
    const listener = vi.fn();
    mql.addEventListener("change", listener);
    mql.removeEventListener("change", listener);
    expect(mql._listeners).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Hook integration tests (require renderHook + jsdom — skip until epic 15)
// ---------------------------------------------------------------------------

describe("usePrefersReducedMotion — hook integration (requires RTL + jsdom, epic 15)", () => {
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

  it.skip("returns false on initial render (SSR-safe default)", async () => {
    // Skipped: RTL 16 + React 19 flushes effects synchronously, so the SSR default
    // false is never observable. Same issue as use-media-query. Tracked in epic-15-test-debt.md.
    const { renderHook } = await import("@testing-library/react");
    const { usePrefersReducedMotion } = await import("@/hooks/use-prefers-reduced-motion");

    mockMql = makeMockMediaQueryList(true);
    (window as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue(mockMql);

    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true after mount when prefers-reduced-motion matches", async () => {
    const { act, renderHook } = await import("@testing-library/react");
    const { usePrefersReducedMotion } = await import("@/hooks/use-prefers-reduced-motion");

    mockMql = makeMockMediaQueryList(true);
    (window as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue(mockMql);

    const { result } = renderHook(() => usePrefersReducedMotion());
    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it("returns false when prefers-reduced-motion does not match", async () => {
    const { act, renderHook } = await import("@testing-library/react");
    const { usePrefersReducedMotion } = await import("@/hooks/use-prefers-reduced-motion");

    mockMql = makeMockMediaQueryList(false);
    (window as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue(mockMql);

    const { result } = renderHook(() => usePrefersReducedMotion());
    await act(async () => {});
    expect(result.current).toBe(false);
  });

  it("queries the correct media query string", async () => {
    const { act, renderHook } = await import("@testing-library/react");
    const { usePrefersReducedMotion } = await import("@/hooks/use-prefers-reduced-motion");

    mockMql = makeMockMediaQueryList(false);
    (window as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue(mockMql);

    renderHook(() => usePrefersReducedMotion());
    await act(async () => {});

    const matchMedia = (window as { matchMedia?: ReturnType<typeof vi.fn> }).matchMedia;
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("updates when the OS reduced-motion setting changes", async () => {
    const { act, renderHook } = await import("@testing-library/react");
    const { usePrefersReducedMotion } = await import("@/hooks/use-prefers-reduced-motion");

    mockMql = makeMockMediaQueryList(false);
    (window as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue(mockMql);

    const { result } = renderHook(() => usePrefersReducedMotion());
    await act(async () => {});
    expect(result.current).toBe(false);

    await act(async () => {
      mockMql._trigger(true);
    });
    expect(result.current).toBe(true);
  });

  it("registers and cleans up the change listener", async () => {
    const { act, renderHook } = await import("@testing-library/react");
    const { usePrefersReducedMotion } = await import("@/hooks/use-prefers-reduced-motion");

    mockMql = makeMockMediaQueryList(false);
    (window as { matchMedia?: unknown }).matchMedia = vi.fn().mockReturnValue(mockMql);

    const { unmount } = renderHook(() => usePrefersReducedMotion());
    await act(async () => {});

    expect(mockMql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(mockMql._listeners).toHaveLength(1);

    unmount();

    expect(mockMql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(mockMql._listeners).toHaveLength(0);
  });
});
