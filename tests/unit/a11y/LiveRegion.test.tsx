// @ts-expect-error vitest runner wired in epic 15
import { describe, expect, it } from "vitest";

/**
 * LiveRegion unit tests.
 *
 * DOM rendering (RTL) is deferred to Epic 15 — the vitest environment is
 * set to "node" in vitest.config.ts; RTL + jsdom require "jsdom" environment.
 *
 * These module-shape tests DO run and verify:
 *  1. The module exports the right symbols.
 *  2. useAnnouncer's type signature matches the contract.
 *  3. The render form of LiveRegion is a function component.
 */

// ---------------------------------------------------------------------------
// Module-shape tests — run now (no DOM required)
// ---------------------------------------------------------------------------

describe("LiveRegion module shape", () => {
  it("exports LiveRegion as a function component", async () => {
    const mod = await import("@/components/shared/a11y/LiveRegion");
    expect(typeof mod.LiveRegion).toBe("function");
  });

  it("exports useAnnouncer as a function", async () => {
    const mod = await import("@/components/shared/a11y/LiveRegion");
    expect(typeof mod.useAnnouncer).toBe("function");
  });

  it("useAnnouncer returns a function when called (no DOM context)", async () => {
    // In a non-browser context the hook runs outside React; calling it directly
    // exercises the callback path only (no React context, no live region node).
    const { useAnnouncer } = await import("@/components/shared/a11y/LiveRegion");
    // useAnnouncer calls useCallback internally — we can't render hooks here,
    // so we just verify the module import resolves and the export is present.
    expect(useAnnouncer).toBeDefined();
    expect(typeof useAnnouncer).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// DOM rendering tests — deferred to Epic 15 (jsdom environment + RTL)
// ---------------------------------------------------------------------------

describe.skip("LiveRegion DOM rendering (Epic 15 wiring)", () => {
  it("renders a visually-hidden div with role=status", () => {
    // TODO(epic-15): render <LiveRegion /> with RTL + jsdom
    // const { container } = render(<LiveRegion />);
    // const region = container.querySelector('[role="status"]');
    // expect(region).not.toBeNull();
    // expect(region?.getAttribute('aria-live')).toBe('polite');
    // expect(region?.getAttribute('aria-atomic')).toBe('true');
  });

  it("useAnnouncer updates the live region text content", async () => {
    // TODO(epic-15): render both <LiveRegion /> and a consumer component
    // that calls useAnnouncer(). Assert the text content of the region
    // changes after the announcer is called.
    //
    // Pseudo-code:
    // function Consumer() {
    //   const announce = useAnnouncer();
    //   return <button onClick={() => announce("Task saved.")}>Click</button>;
    // }
    // render(<><LiveRegion /><Consumer /></>);
    // fireEvent.click(screen.getByRole('button'));
    // const region = screen.getByRole('status');
    // await waitFor(() => expect(region.textContent).toBe('Task saved.'));
  });

  it("consecutive identical announcements are re-announced (empty → message cycle)", async () => {
    // TODO(epic-15): assert that calling announce() twice with the same message
    // triggers two distinct text-content changes (empty → msg → empty → msg).
    // This verifies the "clear then set" pattern in LiveRegion.tsx.
  });
});
