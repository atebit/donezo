import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PresencePile } from "@/components/board/PresencePile";
import { useBoardStore } from "@/stores/board-store";
import type { PresenceState } from "@/stores/types/realtime";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedPresence(state: PresenceState) {
  useBoardStore.setState({ presence: state });
}

const MEMBERS = [
  { id: "user-1", displayName: "Alice", email: "alice@example.com", avatarUrl: null },
  { id: "user-2", displayName: "Bob", email: "bob@example.com", avatarUrl: null },
  { id: "user-3", displayName: "Carol", email: "carol@example.com", avatarUrl: null },
  { id: "user-4", displayName: "Dave", email: "dave@example.com", avatarUrl: null },
  { id: "user-5", displayName: "Eve", email: "eve@example.com", avatarUrl: null },
];

const CURRENT_USER = "user-0";

// ---------------------------------------------------------------------------
// Tests — deferred: vitest runner wired in epic 15
// ---------------------------------------------------------------------------

// Mocks needed at module level (wired in epic 15 with proper jsdom + setup file)
vi.mock("@base-ui/react", () => ({
  Tooltip: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    Root: ({ children }: { children: React.ReactNode }) => children,
    Trigger: ({
      render: renderEl,
      children,
    }: {
      render: React.ReactElement;
      children?: React.ReactNode;
    }) => (
      <>
        {renderEl}
        {children}
      </>
    ),
    Portal: ({ children }: { children: React.ReactNode }) => children,
    Positioner: ({ children }: { children: React.ReactNode }) => children,
    Popup: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
}));

describe("PresencePile", () => {
  beforeEach(() => {
    // Reset store presence to empty between tests
    useBoardStore.setState({ presence: {} });
  });

  it("renders null when no other users are present", () => {
    seedPresence({});
    const { container } = render(<PresencePile members={MEMBERS} currentUserId={CURRENT_USER} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when only the current user is present", () => {
    seedPresence({
      [CURRENT_USER]: [
        { user_id: CURRENT_USER, online_at: Date.now(), viewing: { type: "board" } },
      ],
    });
    const { container } = render(<PresencePile members={MEMBERS} currentUserId={CURRENT_USER} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders 1 avatar when 1 other user is present", () => {
    seedPresence({
      "user-1": [{ user_id: "user-1", online_at: Date.now(), viewing: { type: "board" } }],
    });
    const { getAllByRole } = render(
      <PresencePile members={MEMBERS} currentUserId={CURRENT_USER} />,
    );
    // Avatar renders as role="img" (span with role="img") for fallback avatars
    const imgs = getAllByRole("img");
    expect(imgs).toHaveLength(1);
  });

  it("renders up to max avatars (default 4) and shows +N surplus chip", () => {
    // 8 users present (excluding current user who is user-0)
    const state: PresenceState = {};
    for (let i = 1; i <= 8; i++) {
      state[`user-${i}`] = [
        { user_id: `user-${i}`, online_at: Date.now(), viewing: { type: "board" } },
      ];
    }
    seedPresence(state);

    const { getByLabelText } = render(
      <PresencePile members={MEMBERS} currentUserId={CURRENT_USER} />,
    );
    // surplus = 8 - 4 = 4
    const chip = getByLabelText("4 more users viewing");
    expect(chip).toBeTruthy();
    expect(chip.textContent).toBe("+4");
  });

  it("respects custom max prop", () => {
    const state: PresenceState = {};
    for (let i = 1; i <= 5; i++) {
      state[`user-${i}`] = [
        { user_id: `user-${i}`, online_at: Date.now(), viewing: { type: "board" } },
      ];
    }
    seedPresence(state);

    const { getByLabelText } = render(
      <PresencePile members={MEMBERS} currentUserId={CURRENT_USER} max={2} />,
    );
    // surplus = 5 - 2 = 3
    const chip = getByLabelText("3 more users viewing");
    expect(chip.textContent).toBe("+3");
  });

  it("excludes current user from the pile", () => {
    // Only current user in presence — should render null
    seedPresence({
      [CURRENT_USER]: [
        { user_id: CURRENT_USER, online_at: Date.now(), viewing: { type: "board" } },
      ],
    });
    const { container } = render(<PresencePile members={MEMBERS} currentUserId={CURRENT_USER} />);
    expect(container.firstChild).toBeNull();
  });

  it("falls back gracefully for unknown presence ids (not in members list)", () => {
    // "unknown-user" is not in MEMBERS — should still render with ? fallback
    seedPresence({
      "unknown-user": [
        { user_id: "unknown-user", online_at: Date.now(), viewing: { type: "board" } },
      ],
    });
    const { getAllByRole } = render(
      <PresencePile members={MEMBERS} currentUserId={CURRENT_USER} />,
    );
    // Should render one avatar with the fallback "?" initial
    const imgs = getAllByRole("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]?.textContent).toBe("?");
  });

  it("deduplicates multi-tab presence (same user_id across tabs shows as one avatar)", () => {
    // user-1 has 2 tabs open
    seedPresence({
      "user-1": [
        { user_id: "user-1", online_at: Date.now(), viewing: { type: "board" } },
        { user_id: "user-1", online_at: Date.now() - 1000, viewing: { type: "board" } },
      ],
    });
    const { getAllByRole } = render(
      <PresencePile members={MEMBERS} currentUserId={CURRENT_USER} />,
    );
    // selectPresentUserIds dedupes by user_id key — only 1 avatar shown
    const imgs = getAllByRole("img");
    expect(imgs).toHaveLength(1);
  });
});
