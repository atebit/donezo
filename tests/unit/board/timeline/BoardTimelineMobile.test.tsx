// @ts-expect-error vitest runner wired in epic 15
import { describe, expect, it } from "vitest";

/**
 * Tests for BoardTimelineMobile — the mobile fallback for the timeline view.
 *
 * Full render tests require @testing-library/react + jsdom (epic 15).
 * Module-shape and static-inspection tests run in node mode now.
 *
 * Contract being tested:
 * - BoardTimelineMobile is exported from components/board/timeline/BoardTimelineMobile.
 * - It renders an EmptyState with the expected title and description.
 * - It uses IconClock from lib/icons.
 * - TimelineView renders BoardTimelineMobile on <md: (< 768px).
 * - TimelineView renders the full Gantt chart on ≥md:.
 */

// ---------------------------------------------------------------------------
// Module shape tests (plain node)
// ---------------------------------------------------------------------------

describe("BoardTimelineMobile — module contract", () => {
  it("exports BoardTimelineMobile as a named function", async () => {
    const mod = await import("@/components/board/timeline/BoardTimelineMobile");
    expect(typeof mod.BoardTimelineMobile).toBe("function");
  });

  it("uses EmptyState from components/shared/empty-states", async () => {
    const mod = await import("@/components/board/timeline/BoardTimelineMobile");
    const src = mod.BoardTimelineMobile.toString();
    expect(src).toContain("EmptyState");
  });

  it("uses IconClock from lib/icons", async () => {
    const mod = await import("@/components/board/timeline/BoardTimelineMobile");
    const src = mod.BoardTimelineMobile.toString();
    expect(src).toContain("IconClock");
  });

  it("has data-testid=timeline-mobile-fallback in its render output (source check)", async () => {
    const mod = await import("@/components/board/timeline/BoardTimelineMobile");
    const src = mod.BoardTimelineMobile.toString();
    expect(src).toContain("timeline-mobile-fallback");
  });
});

describe("BoardTimelineMobile — EmptyState content", () => {
  it("title string is 'Timeline works best on desktop'", async () => {
    const mod = await import("@/components/board/timeline/BoardTimelineMobile");
    const src = mod.BoardTimelineMobile.toString();
    expect(src).toContain("Timeline works best on desktop");
  });

  it("description mentions rotating device or switching view", async () => {
    const mod = await import("@/components/board/timeline/BoardTimelineMobile");
    const src = mod.BoardTimelineMobile.toString();
    expect(src).toContain("Rotate your device or switch to another view");
  });

  it("EmptyState is exported from the shared empty-states index", async () => {
    const mod = await import("@/components/shared/empty-states");
    expect(typeof mod.EmptyState).toBe("function");
  });

  it("IconClock is exported from lib/icons", async () => {
    const mod = await import("@/lib/icons");
    // Lucide icons are forwardRef objects (typeof "object"), not plain functions
    expect(mod.IconClock).toBeTruthy();
  });
});

describe("TimelineView — mobile fallback wiring", () => {
  it("TimelineView exports a named function", async () => {
    const mod = await import("@/components/board/timeline/TimelineView");
    expect(typeof mod.TimelineView).toBe("function");
  });

  it("TimelineView source references BoardTimelineMobile", async () => {
    const mod = await import("@/components/board/timeline/TimelineView");
    const src = mod.TimelineView.toString();
    expect(src).toContain("BoardTimelineMobile");
  });

  it("TimelineView source uses useMediaQuery for mobile detection", async () => {
    const mod = await import("@/components/board/timeline/TimelineView");
    const src = mod.TimelineView.toString();
    expect(src).toContain("useMediaQuery");
  });
});

// ---------------------------------------------------------------------------
// Render tests (require RTL + jsdom — skip until epic 15)
// ---------------------------------------------------------------------------

describe.skip("BoardTimelineMobile — render (requires RTL + jsdom, epic 15)", () => {
  it("renders the EmptyState with correct title text", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { BoardTimelineMobile } = await import("@/components/board/timeline/BoardTimelineMobile");

    render(<BoardTimelineMobile />);

    expect(screen.getByText("Timeline works best on desktop")).toBeTruthy();
  });

  it("renders the description text", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { BoardTimelineMobile } = await import("@/components/board/timeline/BoardTimelineMobile");

    render(<BoardTimelineMobile />);

    expect(
      screen.getByText("Rotate your device or switch to another view to see the timeline."),
    ).toBeTruthy();
  });

  it("renders data-testid=timeline-mobile-fallback", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { BoardTimelineMobile } = await import("@/components/board/timeline/BoardTimelineMobile");

    render(<BoardTimelineMobile />);

    expect(screen.getByTestId("timeline-mobile-fallback")).toBeTruthy();
  });

  it("does not render a CTA button (no action prop)", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { BoardTimelineMobile } = await import("@/components/board/timeline/BoardTimelineMobile");

    render(<BoardTimelineMobile />);

    const buttons = screen.queryAllByRole("button");
    expect(buttons.length).toBe(0);
  });

  it("TimelineView renders BoardTimelineMobile at <768px", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { TimelineView } = await import("@/components/board/timeline/TimelineView");

    // jsdom window.matchMedia returns false by default → mobile
    render(<TimelineView />);

    expect(screen.getByTestId("timeline-mobile-fallback")).toBeTruthy();
  });
});
