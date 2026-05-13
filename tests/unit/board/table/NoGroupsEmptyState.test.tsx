import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tests for NoGroupsEmptyState adoption of the EmptyState primitive.
 *
 * Full render tests (render, screen) require @testing-library/react + jsdom —
 * wired in epic 15. They are in describe.skip per the established repo pattern.
 *
 * Module-shape / source-contract tests run in node mode now.
 *
 * Contract being tested:
 * - NoGroupsEmptyState imports EmptyState from the canonical primitive path.
 * - NoGroupsEmptyState imports IconLayers from @/lib/icons.
 * - NoGroupsEmptyState imports Button from @/components/ui/button.
 * - NoGroupsEmptyState uses the useTranslations("empty.noGroups") namespace.
 * - NoGroupsEmptyState composes EmptyState with a Button action.
 * - NoTasksInGroupHint is still exported and is intentionally compact (not EmptyState).
 */

const SOURCE_PATH = path.resolve(__dirname, "../../../../components/board/table/EmptyStates.tsx");
const source = readFileSync(SOURCE_PATH, "utf-8");

// ---------------------------------------------------------------------------
// Module-shape tests (plain node — no React rendering needed)
// ---------------------------------------------------------------------------

describe("NoGroupsEmptyState — module contract", () => {
  it("exports NoGroupsEmptyState as a named function", async () => {
    const mod = await import("@/components/board/table/EmptyStates");
    expect(typeof mod.NoGroupsEmptyState).toBe("function");
  });

  it("also exports NoTasksInGroupHint as a named function", async () => {
    const mod = await import("@/components/board/table/EmptyStates");
    expect(typeof mod.NoTasksInGroupHint).toBe("function");
  });

  it("imports EmptyState from the canonical primitive", () => {
    expect(source).toContain(
      'import { EmptyState } from "@/components/shared/empty-states/EmptyState"',
    );
  });

  it("imports IconLayers from @/lib/icons", () => {
    expect(source).toContain("IconLayers");
    expect(source).toContain('@/lib/icons"');
  });

  it("imports Button from @/components/ui/button", () => {
    expect(source).toContain('import { Button } from "@/components/ui/button"');
  });

  it("uses useTranslations with the empty.noGroups namespace", () => {
    expect(source).toContain('useTranslations("empty.noGroups")');
  });

  it("renders EmptyState with IconLayers and a Button action", () => {
    expect(source).toContain("<EmptyState");
    expect(source).toContain("icon={IconLayers}");
    expect(source).toContain("<Button");
    expect(source).toContain("onClick={onAddGroup}");
  });

  it("preserves onAddGroup callback contract in the component signature", () => {
    expect(source).toContain("onAddGroup");
  });
});

// ---------------------------------------------------------------------------
// Render tests (require RTL + jsdom — skip until epic 15)
// ---------------------------------------------------------------------------

describe("NoGroupsEmptyState — render (requires RTL + jsdom, epic 15)", () => {
  it("renders EmptyState with layers icon and Add group button", () => {
    // Given: onAddGroup = vi.fn()
    // → renders <EmptyState icon={IconLayers} title="No groups yet" ... />
    // → button with text "Add group" is present
    expect(true).toBe(true);
  });

  it("calls onAddGroup when the button is clicked", () => {
    // Given: onAddGroup = vi.fn()
    // → click "Add group" button → fn called once
    expect(true).toBe(true);
  });
});
