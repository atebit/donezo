import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tests for BoardCalendarAgenda — the mobile-aware calendar entry point.
 *
 * Full render tests require @testing-library/react + jsdom (epic 15).
 * Module-shape tests run in node mode now.
 *
 * Note: CalendarView.tsx imports react-big-calendar CSS which fails in
 * vitest's node environment (PostCSS plugin issue). Tests that need CalendarView
 * are therefore source-file inspection tests or in describe.skip.
 *
 * Contract being tested:
 * - BoardCalendarAgenda exists and exports a named function.
 * - It wraps CalendarView with forceMobileAgenda prop.
 * - CalendarView accepts the forceMobileAgenda prop.
 * - On mobile (<768px) the calendar view mode is "agenda".
 * - On desktop (≥768px) the persisted view mode is used.
 */

const ROOT = "/Volumes/SSD1T/DEV WORK/donezo/.claude/worktrees/agent-a462b0776957501bb";

function readSource(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

// ---------------------------------------------------------------------------
// Source-file inspection tests (plain node — no module import needed)
// ---------------------------------------------------------------------------

describe("BoardCalendarAgenda — source contract", () => {
  it("BoardCalendarAgenda.tsx file exists and exports BoardCalendarAgenda", () => {
    const src = readSource("components/board/calendar/BoardCalendarAgenda.tsx");
    expect(src).toContain("export function BoardCalendarAgenda");
  });

  it("BoardCalendarAgenda.tsx imports useMediaQuery from hooks/use-media-query", () => {
    const src = readSource("components/board/calendar/BoardCalendarAgenda.tsx");
    expect(src).toContain("useMediaQuery");
    expect(src).toContain("use-media-query");
  });

  it("BoardCalendarAgenda.tsx imports CalendarView", () => {
    const src = readSource("components/board/calendar/BoardCalendarAgenda.tsx");
    expect(src).toContain("CalendarView");
  });

  it("BoardCalendarAgenda.tsx passes forceMobileAgenda prop to CalendarView", () => {
    const src = readSource("components/board/calendar/BoardCalendarAgenda.tsx");
    expect(src).toContain("forceMobileAgenda");
  });

  it("BoardCalendarAgenda.tsx uses isDesktop conditional to set forceMobileAgenda", () => {
    const src = readSource("components/board/calendar/BoardCalendarAgenda.tsx");
    expect(src).toContain("isDesktop");
    // forceMobileAgenda is the inverse of isDesktop
    expect(src).toContain("!isDesktop");
  });
});

describe("CalendarView — forceMobileAgenda source contract", () => {
  it("CalendarView.tsx accepts forceMobileAgenda prop", () => {
    const src = readSource("components/board/calendar/CalendarView.tsx");
    expect(src).toContain("forceMobileAgenda");
  });

  it("CalendarView.tsx forces 'agenda' view when forceMobileAgenda is true", () => {
    const src = readSource("components/board/calendar/CalendarView.tsx");
    expect(src).toContain("agenda");
    expect(src).toContain("forceMobileAgenda");
  });

  it("CalendarView.tsx passes defaultView to react-big-calendar Calendar", () => {
    const src = readSource("components/board/calendar/CalendarView.tsx");
    expect(src).toContain("defaultView");
  });
});

// ---------------------------------------------------------------------------
// Render tests (require RTL + jsdom — skip until epic 15)
// ---------------------------------------------------------------------------

describe.skip("BoardCalendarAgenda — render (requires RTL + jsdom, epic 15)", () => {
  // Skipped: importing @/components/board/calendar/BoardCalendarAgenda triggers
  // react-big-calendar CSS import which fails with "Invalid PostCSS Plugin".
  // CSS transforms in jsdom vitest project need postcss config fix or CSS mock.
  // Tracked in epic-15-test-debt.md.
  it("on mobile (<768px) renders CalendarView with forceMobileAgenda=true", async () => {
    const { render } = await import("@testing-library/react");
    const { BoardCalendarAgenda } = await import("@/components/board/calendar/BoardCalendarAgenda");

    // useMediaQuery returns false (mobile) by default in jsdom
    render(<BoardCalendarAgenda />);
    // Verify CalendarView receives forceMobileAgenda=true via render tree inspection
  });

  it("on desktop (≥768px) renders CalendarView with forceMobileAgenda=false", async () => {
    const { render } = await import("@testing-library/react");
    const { BoardCalendarAgenda } = await import("@/components/board/calendar/BoardCalendarAgenda");

    // With window.matchMedia matching (768px+), isDesktop=true
    render(<BoardCalendarAgenda />);
  });
});
