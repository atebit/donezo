// @ts-expect-error vitest runner wired in epic 15
import { describe, expect, it } from "vitest";

/**
 * Tests for the canonical EmptyState primitive.
 *
 * Full render tests (render, screen, fireEvent) require @testing-library/react
 * + jsdom — wired in epic 15.
 *
 * Non-render tests (module shape, prop type checks) run in node mode now.
 *
 * Contract being tested:
 * - EmptyState is exported from the module.
 * - EmptyState accepts the required props: icon, title.
 * - EmptyState accepts optional props: description, action, className.
 * - Missing description does not throw (component renders without it).
 */

// ---------------------------------------------------------------------------
// Module shape tests (plain node — no React rendering needed)
// ---------------------------------------------------------------------------

describe("EmptyState — module contract", () => {
  it("exports EmptyState as a named function", async () => {
    const mod = await import("@/components/shared/empty-states/EmptyState");
    expect(typeof mod.EmptyState).toBe("function");
  });

  it("barrel index.ts exports EmptyState", async () => {
    const mod = await import("@/components/shared/empty-states/index");
    expect(typeof mod.EmptyState).toBe("function");
  });

  it("barrel index.ts exports all four existing primitives", async () => {
    const mod = await import("@/components/shared/empty-states/index");
    expect(typeof mod.FavoritesEmpty).toBe("function");
    expect(typeof mod.NoBoardsInWorkspace).toBe("function");
    expect(typeof mod.NoWorkspaces).toBe("function");
    expect(typeof mod.TrashEmpty).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Render tests (require RTL + jsdom — skip until epic 15)
// ---------------------------------------------------------------------------

describe.skip("EmptyState — render (requires RTL + jsdom, epic 15)", () => {
  it("renders title text", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { Star } = await import("lucide-react");
    const { EmptyState } = await import("@/components/shared/empty-states/EmptyState");
    render(<EmptyState icon={Star} title="No items yet" />);
    expect(screen.getByText("No items yet")).toBeTruthy();
  });

  it("renders description when provided", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { Star } = await import("lucide-react");
    const { EmptyState } = await import("@/components/shared/empty-states/EmptyState");
    render(<EmptyState icon={Star} title="No items" description="Try adding one." />);
    expect(screen.getByText("Try adding one.")).toBeTruthy();
  });

  it("does not render a description element when description is omitted", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { Star } = await import("lucide-react");
    const { EmptyState } = await import("@/components/shared/empty-states/EmptyState");
    render(<EmptyState icon={Star} title="No items" />);
    // No <p> with description text should be present
    const paragraphs = screen.queryAllByRole("paragraph");
    expect(paragraphs.length).toBe(0);
  });

  it("renders the action ReactNode when provided", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { Star } = await import("lucide-react");
    const { EmptyState } = await import("@/components/shared/empty-states/EmptyState");
    render(
      <EmptyState
        icon={Star}
        title="No items"
        action={<button type="button">Create one</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Create one" })).toBeTruthy();
  });

  it("CTA button fires onClick when clicked", async () => {
    const { render, screen, fireEvent } = await import("@testing-library/react");
    const { vi } = await import("vitest");
    const { Star } = await import("lucide-react");
    const { EmptyState } = await import("@/components/shared/empty-states/EmptyState");
    const handleClick = vi.fn();
    render(
      <EmptyState
        icon={Star}
        title="No items"
        action={
          <button type="button" onClick={handleClick}>
            Do it
          </button>
        }
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Do it" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
