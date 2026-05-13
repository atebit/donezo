// @ts-expect-error vitest runner wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for MainSidebar mobile responsiveness.
 *
 * Full render tests (render, screen, fireEvent) require @testing-library/react
 * + jsdom — wired in epic 15.
 *
 * Note: describe.skip keeps render tests from running until RTL + jsdom land.
 * Remove the .skip once epic 15 wires the test environment.
 *
 * Contract being tested:
 * - At <768px: MainSidebar renders a fixed-bottom row with a hamburger button.
 * - Hamburger click calls setMobileSidebarOpen(true) in useSidebarStore.
 * - When mobileSidebarOpen = true, Sheet is open and WorkspaceSidebar renders inside.
 * - hamburger has aria-expanded that reflects open state.
 */

// Mocks hoisted at module level (vitest hoists vi.mock to top of file).
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/use-workspace", () => ({
  useWorkspaceMaybe: () => null,
}));

// ---------------------------------------------------------------------------
// Store contract tests (plain node — no React rendering needed)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Render tests (require RTL + jsdom — skip until epic 15)
// ---------------------------------------------------------------------------

describe.skip("MainSidebar — mobile render (requires RTL + jsdom, epic 15)", () => {
  beforeEach(async () => {
    const { useSidebarStore } = await import("@/stores/sidebar-store");
    useSidebarStore.setState({ mobileSidebarOpen: false });
  });

  it("renders the mobile hamburger button in the DOM", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { MainSidebar } = await import("@/components/shared/sidebar/MainSidebar");

    const mockUser = { id: "u-1", email: "t@x.com", name: "T", avatarUrl: null };
    const mockWorkspaces = [{ id: "ws-1", slug: "ws", name: "Workspace" }];

    render(<MainSidebar user={mockUser} workspaces={mockWorkspaces} />);

    const hamburger = screen.getByTestId("mobile-hamburger");
    expect(hamburger).toBeTruthy();
  });

  it("hamburger click sets mobileSidebarOpen to true", async () => {
    const { render, screen, fireEvent } = await import("@testing-library/react");
    const { MainSidebar } = await import("@/components/shared/sidebar/MainSidebar");
    const { useSidebarStore } = await import("@/stores/sidebar-store");

    const mockUser = { id: "u-1", email: "t@x.com", name: "T", avatarUrl: null };
    const mockWorkspaces = [{ id: "ws-1", slug: "ws", name: "Workspace" }];

    render(<MainSidebar user={mockUser} workspaces={mockWorkspaces} />);

    const hamburger = screen.getByTestId("mobile-hamburger");
    fireEvent.click(hamburger);

    expect(useSidebarStore.getState().mobileSidebarOpen).toBe(true);
  });

  it("Sheet renders WorkspaceSidebar when mobileSidebarOpen is true", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { MainSidebar } = await import("@/components/shared/sidebar/MainSidebar");
    const { useSidebarStore } = await import("@/stores/sidebar-store");

    useSidebarStore.setState({ mobileSidebarOpen: true });

    const mockUser = { id: "u-1", email: "t@x.com", name: "T", avatarUrl: null };
    const mockWorkspaces = [{ id: "ws-1", slug: "ws", name: "Workspace" }];

    render(<MainSidebar user={mockUser} workspaces={mockWorkspaces} />);

    const workspaceSidebar = screen.getByRole("complementary", {
      name: "Workspace sidebar",
    });
    expect(workspaceSidebar).toBeTruthy();
  });

  it("hamburger has aria-expanded reflecting open state", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { MainSidebar } = await import("@/components/shared/sidebar/MainSidebar");
    const { useSidebarStore } = await import("@/stores/sidebar-store");

    useSidebarStore.setState({ mobileSidebarOpen: true });

    const mockUser = { id: "u-1", email: "t@x.com", name: "T", avatarUrl: null };
    render(<MainSidebar user={mockUser} workspaces={[]} />);

    const hamburger = screen.getByTestId("mobile-hamburger");
    expect(hamburger.getAttribute("aria-expanded")).toBe("true");
  });
});
