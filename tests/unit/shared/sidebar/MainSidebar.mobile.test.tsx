import { describe, expect, it } from "vitest";

/**
 * Tests for the mobile sidebar drawer store contract.
 *
 * On <768px viewports the Topbar drives the same sidebar store as the desktop
 * rail, so we just assert the store shape both surfaces depend on.
 */

describe("MainSidebar mobile — sidebar store contract", () => {
  it("useSidebarStore has mobileSidebarOpen state and setter", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");

    const state = useSidebarStore.getState();
    expect(typeof state.mobileSidebarOpen).toBe("boolean");
    expect(typeof state.setMobileSidebarOpen).toBe("function");
  });

  it("setMobileSidebarOpen(true) sets mobileSidebarOpen to true", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");

    useSidebarStore.setState({ mobileSidebarOpen: false });
    useSidebarStore.getState().setMobileSidebarOpen(true);
    expect(useSidebarStore.getState().mobileSidebarOpen).toBe(true);
  });

  it("setMobileSidebarOpen(false) sets mobileSidebarOpen to false", async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");

    useSidebarStore.setState({ mobileSidebarOpen: true });
    useSidebarStore.getState().setMobileSidebarOpen(false);
    expect(useSidebarStore.getState().mobileSidebarOpen).toBe(false);
  });
});
