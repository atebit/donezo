/**
 * BoardDashboard mobile layout config test.
 *
 * Asserts that the Dashboard component's responsive grid config uses
 * sm: 1 column so widgets stack vertically on mobile (<768px).
 *
 * Epic 14, Slice F.
 *
 * Strategy: module-shape test that imports the constants directly from the
 * module. We do not render the component (avoids complex window/RGL mocking)
 * but instead verify the exported config shape that drives mobile layout.
 */

// @ts-expect-error vitest runner wired in epic 15
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// We verify that GRID_BREAKPOINTS and GRID_COLS are exported (or at least
// that the module-shape properties produce a single column at sm breakpoint).
// Since the constants are module-level (not exported), we parse the source
// file to verify the values — a lightweight text-based assertion that avoids
// the need to mock react-grid-layout's window access.
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DASHBOARD_PATH = resolve(__dirname, "../../../../components/board/dashboard/Dashboard.tsx");

const source = readFileSync(DASHBOARD_PATH, "utf-8");

describe("Dashboard mobile responsive config", () => {
  it("defines GRID_BREAKPOINTS with sm: 0 for mobile-first coverage", () => {
    // The breakpoints constant must declare sm: 0 (anything below md=768 uses sm).
    expect(source).toContain("sm: 0");
  });

  it("defines GRID_COLS with sm: 1 to force single-column on mobile", () => {
    // The cols constant must declare sm: 1.
    expect(source).toContain("sm: 1");
  });

  it("defines GRID_BREAKPOINTS with lg: 1024 and md: 768", () => {
    expect(source).toContain("lg: 1024");
    expect(source).toContain("md: 768");
  });

  it("passes breakpoints prop to ResponsiveGridLayout", () => {
    // The component must spread GRID_BREAKPOINTS as the breakpoints prop.
    expect(source).toContain("breakpoints={GRID_BREAKPOINTS}");
  });

  it("derives an sm layout that forces x: 0 and w: 1 for each widget", () => {
    // The sm layout derivation sets x: 0, w: 1 so widgets stack in single column.
    expect(source).toContain("x: 0");
    expect(source).toContain("w: 1");
  });
});
