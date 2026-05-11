// @ts-expect-error vitest is wired in epic 15
import { act, renderHook } from "@testing-library/react";
// @ts-expect-error vitest is wired in epic 15
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditableTitleHandle } from "../../components/shared/EditableTitle";
import { useTableKeyboardNav } from "../../hooks/use-table-keyboard-nav";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainer(): HTMLDivElement {
  const div = document.createElement("div");
  document.body.appendChild(div);
  return div;
}

function fireKey(container: HTMLElement, key: string) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  container.dispatchEvent(event);
}

function makeHandle(): EditableTitleHandle {
  return { focus: vi.fn() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skip("useTableKeyboardNav", () => {
  let container: HTMLDivElement;
  let containerRef: React.RefObject<HTMLDivElement | null>;

  beforeEach(() => {
    container = makeContainer();
    containerRef = { current: container };
  });

  afterEach(() => {
    container.remove();
  });

  it("ArrowDown moves focusedRowId to the next visible task", () => {
    const visibleTaskIds = ["task-1", "task-2", "task-3"];
    const titleCellRefs = { current: new Map<string, EditableTitleHandle>() };
    const scrollToTaskId = vi.fn();

    const { result } = renderHook(() =>
      useTableKeyboardNav({
        containerRef,
        visibleTaskIds,
        titleCellRefs,
        scrollToTaskId,
      }),
    );

    // Initial state: no focus.
    expect(result.current.focusedRowId).toBeNull();

    // First ArrowDown → first task.
    act(() => {
      fireKey(container, "ArrowDown");
    });
    expect(result.current.focusedRowId).toBe("task-1");

    // Second ArrowDown → second task.
    act(() => {
      fireKey(container, "ArrowDown");
    });
    expect(result.current.focusedRowId).toBe("task-2");
  });

  it("ArrowUp at the top row with wrap=false is a no-op", () => {
    const visibleTaskIds = ["task-1", "task-2"];
    const titleCellRefs = { current: new Map<string, EditableTitleHandle>() };
    const scrollToTaskId = vi.fn();

    const { result } = renderHook(() =>
      useTableKeyboardNav({
        containerRef,
        visibleTaskIds,
        titleCellRefs,
        scrollToTaskId,
        wrap: false,
      }),
    );

    // Focus the first task directly via setFocusedRow.
    act(() => {
      result.current.setFocusedRow("task-1");
    });
    expect(result.current.focusedRowId).toBe("task-1");

    // ArrowUp from the top → should stay on task-1.
    act(() => {
      fireKey(container, "ArrowUp");
    });
    expect(result.current.focusedRowId).toBe("task-1");
  });

  it("ArrowDown skips tasks in collapsed groups (visible list excludes them)", () => {
    // When a group is collapsed, its tasks are excluded from visibleTaskIds by
    // the caller (BoardTable). The hook only operates on what it receives.
    const visibleTaskIds = ["task-1", "task-3"]; // task-2 is in a collapsed group
    const titleCellRefs = { current: new Map<string, EditableTitleHandle>() };
    const scrollToTaskId = vi.fn();

    const { result } = renderHook(() =>
      useTableKeyboardNav({
        containerRef,
        visibleTaskIds,
        titleCellRefs,
        scrollToTaskId,
      }),
    );

    act(() => {
      result.current.setFocusedRow("task-1");
    });

    act(() => {
      fireKey(container, "ArrowDown");
    });
    // Jumps directly to task-3 (task-2 is not in the visible list).
    expect(result.current.focusedRowId).toBe("task-3");
  });

  it("Enter sets editingRowId to the currently focused row", () => {
    const visibleTaskIds = ["task-1", "task-2"];
    const titleCellRefs = { current: new Map<string, EditableTitleHandle>() };
    const scrollToTaskId = vi.fn();

    const { result } = renderHook(() =>
      useTableKeyboardNav({
        containerRef,
        visibleTaskIds,
        titleCellRefs,
        scrollToTaskId,
      }),
    );

    act(() => {
      result.current.setFocusedRow("task-1");
    });

    act(() => {
      fireKey(container, "Enter");
    });
    expect(result.current.editingRowId).toBe("task-1");
  });

  it("Esc clears editingRowId", () => {
    const visibleTaskIds = ["task-1", "task-2"];
    const titleCellRefs = { current: new Map<string, EditableTitleHandle>() };
    const scrollToTaskId = vi.fn();

    const { result } = renderHook(() =>
      useTableKeyboardNav({
        containerRef,
        visibleTaskIds,
        titleCellRefs,
        scrollToTaskId,
      }),
    );

    act(() => {
      result.current.setFocusedRow("task-1");
    });
    act(() => {
      result.current.beginEdit("task-1");
    });
    expect(result.current.editingRowId).toBe("task-1");

    act(() => {
      fireKey(container, "Escape");
    });
    expect(result.current.editingRowId).toBeNull();
  });

  it("ArrowUp/Down are ignored while editingRowId is non-null", () => {
    const visibleTaskIds = ["task-1", "task-2", "task-3"];
    const titleCellRefs = { current: new Map<string, EditableTitleHandle>() };
    const scrollToTaskId = vi.fn();

    const { result } = renderHook(() =>
      useTableKeyboardNav({
        containerRef,
        visibleTaskIds,
        titleCellRefs,
        scrollToTaskId,
      }),
    );

    act(() => {
      result.current.setFocusedRow("task-2");
    });
    act(() => {
      result.current.beginEdit("task-2");
    });
    expect(result.current.editingRowId).toBe("task-2");

    // ArrowDown while editing → focusedRowId must not change.
    act(() => {
      fireKey(container, "ArrowDown");
    });
    expect(result.current.focusedRowId).toBe("task-2");

    // ArrowUp while editing → focusedRowId must not change.
    act(() => {
      fireKey(container, "ArrowUp");
    });
    expect(result.current.focusedRowId).toBe("task-2");
  });

  it("setting editingRowId causes titleCellRefs.focus() to be called", () => {
    const visibleTaskIds = ["task-1", "task-2"];
    const handle = makeHandle();
    const titleCellRefs = {
      current: new Map<string, EditableTitleHandle>([["task-1", handle]]),
    };
    const scrollToTaskId = vi.fn();

    const { result } = renderHook(() =>
      useTableKeyboardNav({
        containerRef,
        visibleTaskIds,
        titleCellRefs,
        scrollToTaskId,
      }),
    );

    act(() => {
      result.current.beginEdit("task-1");
    });

    expect(handle.focus).toHaveBeenCalledTimes(1);
  });

  it("scrollToTaskId is called when focusedRowId is not in the DOM after a state change", () => {
    const visibleTaskIds = ["task-1", "task-2", "task-3"];
    const titleCellRefs = { current: new Map<string, EditableTitleHandle>() };
    const scrollToTaskId = vi.fn();

    const { result } = renderHook(() =>
      useTableKeyboardNav({
        containerRef,
        visibleTaskIds,
        titleCellRefs,
        scrollToTaskId,
      }),
    );

    // Focus a task whose DOM node is NOT in the container (simulates an
    // off-screen virtualised row).
    act(() => {
      result.current.setFocusedRow("task-3");
    });

    // The layoutEffect should have called scrollToTaskId because no
    // [data-task-id="task-3"] element exists in the container div.
    expect(scrollToTaskId).toHaveBeenCalledWith("task-3");
  });
});
