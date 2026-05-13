import { describe, expect, it } from "vitest";

/**
 * Tests for the skeleton layout catalog.
 *
 * Full render tests (render, screen) require @testing-library/react + jsdom —
 * wired in epic 15.
 *
 * Non-render tests (module shape) run in node mode now.
 *
 * Contract being tested:
 * - Each skeleton component is exported from its own module.
 * - The barrel index.ts exports all six skeletons.
 * - Each skeleton is a function (server-safe React component).
 */

// ---------------------------------------------------------------------------
// Module shape tests (plain node — no React rendering needed)
// ---------------------------------------------------------------------------

describe("Skeletons — module contract", () => {
  it("barrel exports BoardTableSkeleton", async () => {
    const mod = await import("@/components/shared/skeletons/index");
    expect(typeof mod.BoardTableSkeleton).toBe("function");
  });

  it("barrel exports BoardKanbanSkeleton", async () => {
    const mod = await import("@/components/shared/skeletons/index");
    expect(typeof mod.BoardKanbanSkeleton).toBe("function");
  });

  it("barrel exports BoardListSkeleton", async () => {
    const mod = await import("@/components/shared/skeletons/index");
    expect(typeof mod.BoardListSkeleton).toBe("function");
  });

  it("barrel exports DashboardSkeleton", async () => {
    const mod = await import("@/components/shared/skeletons/index");
    expect(typeof mod.DashboardSkeleton).toBe("function");
  });

  it("barrel exports NotificationCenterSkeleton", async () => {
    const mod = await import("@/components/shared/skeletons/index");
    expect(typeof mod.NotificationCenterSkeleton).toBe("function");
  });

  it("barrel exports WorkspaceSidebarSkeleton", async () => {
    const mod = await import("@/components/shared/skeletons/index");
    expect(typeof mod.WorkspaceSidebarSkeleton).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Render tests (require RTL + jsdom — skip until epic 15)
// ---------------------------------------------------------------------------

describe("Skeletons — render (requires RTL + jsdom, epic 15)", () => {
  /**
   * For each skeleton, verify it renders at least one element with
   * data-slot="skeleton" (the Skeleton primitive adds this attribute).
   */
  const skeletonComponents = [
    ["BoardTableSkeleton", "@/components/shared/skeletons/BoardTableSkeleton"],
    ["BoardKanbanSkeleton", "@/components/shared/skeletons/BoardKanbanSkeleton"],
    ["BoardListSkeleton", "@/components/shared/skeletons/BoardListSkeleton"],
    ["DashboardSkeleton", "@/components/shared/skeletons/DashboardSkeleton"],
    ["NotificationCenterSkeleton", "@/components/shared/skeletons/NotificationCenterSkeleton"],
    ["WorkspaceSidebarSkeleton", "@/components/shared/skeletons/WorkspaceSidebarSkeleton"],
  ] as const;

  for (const [name, modulePath] of skeletonComponents) {
    it(`${name} renders at least one <Skeleton /> instance`, async () => {
      const { render } = await import("@testing-library/react");
      const mod = await import(modulePath);
      const Component = mod[name];
      // container comes from render(), not from the RTL module.
      const { container } = render(<Component />);
      const skeletonEls = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletonEls.length).toBeGreaterThan(0);
    });
  }
});
