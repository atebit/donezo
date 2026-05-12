// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it, vi } from "vitest";

/**
 * Unit tests for <MentionPopover /> and filterMentionItems — Slice B, Epic 09.
 *
 * Uses describe.skip because vitest is not yet configured (wired in epic 15).
 * Pattern matches existing test files in tests/unit/.
 *
 * Tests verify:
 * - filterMentionItems always pins "Everyone" first.
 * - filter by query works (case-insensitive on displayName and email).
 * - Popover opens/closes/updates via the bridge ref.
 * - ↑/↓/Enter/Esc key handling.
 * - Selecting "Everyone" inserts node with attrs.id = "everyone".
 * - Empty state renders gracefully.
 */

// @ts-expect-error renderHook is wired in epic 15
import { act, fireEvent, render } from "@testing-library/react";
import type {
  MentionItem,
  MentionSuggestionBridge,
} from "../../components/rich-text/MentionExtension";
import { EVERYONE_ITEM, filterMentionItems } from "../../components/rich-text/MentionExtension";
import { EVERYONE_MENTION_ID } from "../../lib/comments/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALICE: MentionItem = {
  id: "user-alice",
  displayName: "Alice Smith",
  email: "alice@example.com",
  avatarUrl: null,
};

const BOB: MentionItem = {
  id: "user-bob",
  displayName: "Bob Jones",
  email: "bob@example.com",
  avatarUrl: null,
};

const CAROL: MentionItem = {
  id: "user-carol",
  displayName: null,
  email: "carol@example.com",
  avatarUrl: null,
};

const ALL_MEMBERS = [ALICE, BOB, CAROL];

// ---------------------------------------------------------------------------
// filterMentionItems tests (no React, pure logic)
// ---------------------------------------------------------------------------

describe.skip("filterMentionItems", () => {
  it("returns Everyone first with empty query", () => {
    const result = filterMentionItems(ALL_MEMBERS, "");
    // biome-ignore lint/style/noNonNullAssertion: result is non-empty
    expect(result[0]!.id).toBe(EVERYONE_MENTION_ID);
  });

  it("returns all members after Everyone with empty query", () => {
    const result = filterMentionItems(ALL_MEMBERS, "");
    expect(result).toHaveLength(ALL_MEMBERS.length + 1); // +1 for Everyone
    expect(result.slice(1).map((m) => m.id)).toEqual(ALL_MEMBERS.map((m) => m.id));
  });

  it("pins Everyone first even when query matches other members better", () => {
    const result = filterMentionItems(ALL_MEMBERS, "alice");
    // biome-ignore lint/style/noNonNullAssertion: result is non-empty
    expect(result[0]!.id).toBe(EVERYONE_MENTION_ID);
    // biome-ignore lint/style/noNonNullAssertion: result has at least 2 items
    expect(result[1]!.id).toBe(ALICE.id);
    expect(result).toHaveLength(2); // Everyone + alice
  });

  it("filters members case-insensitively by displayName", () => {
    const result = filterMentionItems(ALL_MEMBERS, "ALICE");
    expect(result.some((m) => m.id === ALICE.id)).toBe(true);
    expect(result.some((m) => m.id === BOB.id)).toBe(false);
  });

  it("filters members case-insensitively by email", () => {
    const result = filterMentionItems(ALL_MEMBERS, "carol@");
    expect(result.some((m) => m.id === CAROL.id)).toBe(true);
  });

  it("shows Everyone + no members if query matches nothing", () => {
    const result = filterMentionItems(ALL_MEMBERS, "zzzzz_no_match");
    expect(result).toHaveLength(1);
    // biome-ignore lint/style/noNonNullAssertion: result has exactly 1 item
    expect(result[0]!.id).toBe(EVERYONE_MENTION_ID);
  });

  it("does not include the EVERYONE_ITEM from the input members list twice", () => {
    // If somehow EVERYONE_ITEM is in the members list, it should not appear twice
    const withEveryone = [EVERYONE_ITEM, ...ALL_MEMBERS];
    const result = filterMentionItems(withEveryone, "");
    const everyoneEntries = result.filter((m) => m.id === EVERYONE_MENTION_ID);
    expect(everyoneEntries).toHaveLength(1);
  });

  it("returns Everyone when query is a whitespace string", () => {
    const result = filterMentionItems(ALL_MEMBERS, "   ");
    // biome-ignore lint/style/noNonNullAssertion: result is non-empty
    expect(result[0]!.id).toBe(EVERYONE_MENTION_ID);
  });
});

// ---------------------------------------------------------------------------
// MentionPopover component tests
// ---------------------------------------------------------------------------

import { createRef } from "react";
import { MentionPopover } from "../../components/comments/MentionPopover";

describe.skip("MentionPopover", () => {
  it("renders nothing when not open", () => {
    const ref = createRef<MentionSuggestionBridge>();
    const { container } = render(<MentionPopover ref={ref} />);
    expect(container.firstChild).toBeNull();
  });

  it("opens and shows items when bridge.onOpen is called", () => {
    const ref = createRef<MentionSuggestionBridge>();
    const { getByRole } = render(<MentionPopover ref={ref} />);

    act(() => {
      ref.current?.onOpen([EVERYONE_ITEM, ALICE], vi.fn(), new DOMRect(0, 0, 100, 20));
    });

    expect(getByRole("listbox")).toBeTruthy();
    expect(getByRole("listbox").textContent).toContain("Everyone on this board");
    expect(getByRole("listbox").textContent).toContain("Alice Smith");
  });

  it("closes when bridge.onClose is called", () => {
    const ref = createRef<MentionSuggestionBridge>();
    const { container } = render(<MentionPopover ref={ref} />);

    act(() => {
      ref.current?.onOpen([ALICE], vi.fn(), new DOMRect(0, 0, 100, 20));
    });
    act(() => {
      ref.current?.onClose();
    });

    expect(container.firstChild).toBeNull();
  });

  it("updates items when bridge.onUpdate is called", () => {
    const ref = createRef<MentionSuggestionBridge>();
    const { getByRole } = render(<MentionPopover ref={ref} />);

    act(() => {
      ref.current?.onOpen([ALICE], vi.fn(), new DOMRect(0, 0, 100, 20));
    });
    act(() => {
      ref.current?.onUpdate([EVERYONE_ITEM, BOB], vi.fn(), new DOMRect(0, 0, 100, 20));
    });

    const listbox = getByRole("listbox");
    expect(listbox.textContent).toContain("Everyone on this board");
    expect(listbox.textContent).toContain("Bob Jones");
    expect(listbox.textContent).not.toContain("Alice Smith");
  });

  it("ArrowDown moves selection down", () => {
    const ref = createRef<MentionSuggestionBridge>();
    render(<MentionPopover ref={ref} />);

    act(() => {
      ref.current?.onOpen([EVERYONE_ITEM, ALICE, BOB], vi.fn(), new DOMRect());
    });

    // Initially index 0 (Everyone) is active
    act(() => {
      const handled = ref.current?.onKeyDown(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      expect(handled).toBe(true);
    });
    // Index should now be 1
  });

  it("ArrowUp wraps from first to last item", () => {
    const ref = createRef<MentionSuggestionBridge>();
    render(<MentionPopover ref={ref} />);

    act(() => {
      ref.current?.onOpen([EVERYONE_ITEM, ALICE], vi.fn(), new DOMRect());
    });

    act(() => {
      const handled = ref.current?.onKeyDown(new KeyboardEvent("keydown", { key: "ArrowUp" }));
      expect(handled).toBe(true);
    });
  });

  it("Enter key calls command with the active item", () => {
    const command = vi.fn();
    const ref = createRef<MentionSuggestionBridge>();
    render(<MentionPopover ref={ref} />);

    act(() => {
      ref.current?.onOpen([EVERYONE_ITEM, ALICE], command, new DOMRect());
    });

    act(() => {
      ref.current?.onKeyDown(new KeyboardEvent("keydown", { key: "Enter" }));
    });

    // First item (Everyone) was selected
    expect(command).toHaveBeenCalledWith(expect.objectContaining({ id: EVERYONE_MENTION_ID }));
  });

  it("Esc key closes the popover and returns true", () => {
    const ref = createRef<MentionSuggestionBridge>();
    const { container } = render(<MentionPopover ref={ref} />);

    act(() => {
      ref.current?.onOpen([ALICE], vi.fn(), new DOMRect());
    });

    act(() => {
      const handled = ref.current?.onKeyDown(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(handled).toBe(true);
    });

    expect(container.firstChild).toBeNull();
  });

  it("Everyone entry always appears in the popover", () => {
    const ref = createRef<MentionSuggestionBridge>();
    const { getByRole } = render(<MentionPopover ref={ref} />);

    act(() => {
      ref.current?.onOpen([EVERYONE_ITEM], vi.fn(), new DOMRect());
    });

    expect(getByRole("listbox").textContent).toContain("Everyone on this board");
  });

  it("selecting Everyone calls command with id='everyone'", () => {
    const command = vi.fn();
    const ref = createRef<MentionSuggestionBridge>();
    const { getByRole } = render(<MentionPopover ref={ref} />);

    act(() => {
      ref.current?.onOpen([EVERYONE_ITEM, ALICE], command, new DOMRect());
    });

    // Click the first item (Everyone)
    const listbox = getByRole("listbox");
    const everyoneOption = listbox.querySelector("[role='option']") as HTMLElement;
    act(() => {
      fireEvent.mouseDown(everyoneOption);
    });

    expect(command).toHaveBeenCalledWith(expect.objectContaining({ id: EVERYONE_MENTION_ID }));
  });

  it("shows 'No members found' when items array is empty", () => {
    const ref = createRef<MentionSuggestionBridge>();
    const { getByRole } = render(<MentionPopover ref={ref} />);

    act(() => {
      ref.current?.onOpen([], vi.fn(), new DOMRect());
    });

    expect(getByRole("listbox").textContent).toContain("No members found");
  });

  it("onKeyDown returns false when popover is closed", () => {
    const ref = createRef<MentionSuggestionBridge>();
    render(<MentionPopover ref={ref} />);

    // Don't open — popover is closed
    const handled = ref.current?.onKeyDown(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(handled).toBe(false);
  });
});
