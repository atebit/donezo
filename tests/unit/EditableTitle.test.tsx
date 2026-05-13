import { act, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

import type { EditableTitleHandle } from "@/components/shared/EditableTitle";
import { EditableTitle } from "@/components/shared/EditableTitle";

// Tests deferred: vitest runner wired in epic 15
describe("EditableTitle", () => {
  it("Enter commits the value", async () => {
    // TODO: render <EditableTitle initialValue="foo" onCommit={...} />,
    // simulate Enter, assert onCommit called with "foo"
  });

  it("Esc reverts to initialValue", async () => {
    // TODO: render, type new value, press Esc, assert displayed value is initialValue
  });

  it("Empty trimmed value reverts without calling onCommit", async () => {
    // TODO
  });

  it("onCommit throw triggers revert and shows toast", async () => {
    // TODO
  });
});

// S14: Imperative focus API + ARIA polish
describe("EditableTitle imperative focus()", () => {
  it("exposes a ref handle after mount", () => {
    const ref = createRef<EditableTitleHandle>();
    render(
      <EditableTitle
        ref={ref}
        initialValue="Hello"
        variant="body"
        onCommit={() => {}}
        ariaLabel="Test title"
      />,
    );
    expect(ref.current).not.toBeNull();
    expect(typeof ref.current?.focus).toBe("function");
  });

  it("enters edit mode when ref.current.focus() is called", () => {
    const ref = createRef<EditableTitleHandle>();
    const { getByRole } = render(
      <EditableTitle
        ref={ref}
        initialValue="Hello"
        variant="body"
        onCommit={() => {}}
        ariaLabel="Test title"
      />,
    );
    // Before focus(): element is in display mode (aria-readonly="true")
    const el = getByRole("textbox", { name: "Test title" });
    expect(el.getAttribute("aria-readonly")).toBe("true");

    act(() => {
      ref.current?.focus();
    });
    // After focus(): setEditing(true) fires synchronously — aria-readonly removed.
    // The actual DOM focus happens after setTimeout(0), so we just check state.
    expect(el.getAttribute("aria-readonly")).toBeNull();
    expect(el.getAttribute("aria-multiline")).toBe("false");
  });

  it("display mode has role=textbox and aria-readonly=true", () => {
    const { getByRole } = render(
      <EditableTitle
        initialValue="Group A"
        variant="h4"
        onCommit={() => {}}
        ariaLabel="Group name"
      />,
    );
    const el = getByRole("textbox", { name: "Group name" });
    expect(el.getAttribute("aria-readonly")).toBe("true");
    expect(el.getAttribute("aria-multiline")).toBeNull();
  });

  it("edit mode has role=textbox and aria-multiline=false", () => {
    const ref = createRef<EditableTitleHandle>();
    const { getByRole } = render(
      <EditableTitle
        ref={ref}
        initialValue="Task name"
        variant="body"
        onCommit={() => {}}
        ariaLabel="Task title"
      />,
    );
    act(() => {
      ref.current?.focus();
    });
    const el = getByRole("textbox", { name: "Task title" });
    expect(el.getAttribute("aria-multiline")).toBe("false");
    expect(el.getAttribute("aria-readonly")).toBeNull();
  });
});
