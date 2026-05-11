// @ts-expect-error @testing-library/react wired in epic 15
import { render } from "@testing-library/react";
// @ts-expect-error vitest is wired in epic 15
import { beforeEach, describe, expect, it } from "vitest";

import { ConnectionStatus } from "@/components/board/ConnectionStatus";
import { useBoardStore } from "@/stores/board-store";
import type { ConnectionStatus as ConnectionStatusType } from "@/stores/types/realtime";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function setStatus(status: ConnectionStatusType) {
  useBoardStore.setState({ connection: status });
}

// ---------------------------------------------------------------------------
// Tests — deferred: vitest runner wired in epic 15
// ---------------------------------------------------------------------------

describe.skip("ConnectionStatus", () => {
  beforeEach(() => {
    // Reset to connected (the default / "invisible" state)
    useBoardStore.setState({ connection: "connected" });
  });

  it("renders null when connected (no DOM output)", () => {
    setStatus("connected");
    const { container } = render(<ConnectionStatus />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a pill with aria-live=polite when reconnecting", () => {
    setStatus("reconnecting");
    const { getByRole } = render(<ConnectionStatus />);
    const pill = getByRole("status");
    expect(pill).toBeTruthy();
    expect(pill.getAttribute("aria-live")).toBe("polite");
    expect(pill.textContent).toContain("Reconnecting…");
  });

  it("renders a pill with aria-live=polite when offline", () => {
    setStatus("offline");
    const { getByRole } = render(<ConnectionStatus />);
    const pill = getByRole("status");
    expect(pill).toBeTruthy();
    expect(pill.getAttribute("aria-live")).toBe("polite");
  });

  it("offline message matches the spec", () => {
    setStatus("offline");
    const { getByRole } = render(<ConnectionStatus />);
    const pill = getByRole("status");
    expect(pill.textContent).toBe("You're offline. Changes will sync when you reconnect.");
  });

  it("reconnecting shows animate-pulse on the dot", () => {
    setStatus("reconnecting");
    const { getByRole } = render(<ConnectionStatus />);
    const pill = getByRole("status");
    // The dot span is aria-hidden; select by querying inside the pill
    const dot = pill.querySelector("[aria-hidden]");
    expect(dot?.className).toContain("animate-pulse");
    expect(dot?.className).toContain("bg-yellow-500");
  });

  it("offline shows red dot without animate-pulse", () => {
    setStatus("offline");
    const { getByRole } = render(<ConnectionStatus />);
    const pill = getByRole("status");
    const dot = pill.querySelector("[aria-hidden]");
    expect(dot?.className).toContain("bg-red-500");
    expect(dot?.className).not.toContain("animate-pulse");
  });
});
