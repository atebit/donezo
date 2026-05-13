import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { OutboxBanner } from "@/components/board/OutboxBanner";
import { useBoardStore } from "@/stores/board-store";

// ---------------------------------------------------------------------------
// Helper — seed outbox length without real entries
// ---------------------------------------------------------------------------

function seedOutboxCount(count: number) {
  const entries = Array.from({ length: count }, (_, i) => ({
    id: `entry-${i}`,
    actionId: "setCellValue" as const,
    args: [],
    optimisticUpdatedAt: Date.now(),
    enqueuedAt: Date.now() + i,
  }));
  useBoardStore.setState({ outbox: entries });
}

// ---------------------------------------------------------------------------
// Tests — deferred: vitest runner wired in epic 15
// ---------------------------------------------------------------------------

describe("OutboxBanner", () => {
  beforeEach(() => {
    useBoardStore.setState({ outbox: [] });
  });

  it("returns null (no DOM output) when outbox is empty (count=0)", () => {
    seedOutboxCount(0);
    const { container } = render(<OutboxBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the banner with correct singular text for count=1", () => {
    seedOutboxCount(1);
    render(<OutboxBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Syncing 1 pending change…/)).toBeInTheDocument();
  });

  it("renders the banner with correct plural text for count=5", () => {
    seedOutboxCount(5);
    render(<OutboxBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Syncing 5 pending changes…/)).toBeInTheDocument();
  });

  it("has aria-live='polite' on the status element", () => {
    seedOutboxCount(2);
    render(<OutboxBanner />);
    const statusEl = screen.getByRole("status");
    expect(statusEl).toHaveAttribute("aria-live", "polite");
  });

  it("renders the pulsing yellow dot inside the banner", () => {
    seedOutboxCount(3);
    const { container } = render(<OutboxBanner />);
    // The dot is a span with animate-pulse class
    const dot = container.querySelector(".animate-pulse");
    expect(dot).toBeInTheDocument();
  });

  it("updates reactively when the outbox count changes", () => {
    seedOutboxCount(0);
    const { rerender } = render(<OutboxBanner />);
    expect(screen.queryByRole("status")).toBeNull();

    seedOutboxCount(3);
    rerender(<OutboxBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/Syncing 3 pending changes…/)).toBeInTheDocument();
  });
});
