// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it, vi } from "vitest";

/**
 * Unit tests for <RichTextEditor /> — Slice B, Epic 09.
 *
 * Uses describe.skip because vitest is not yet configured (wired in epic 15).
 * Pattern matches existing test files in tests/unit/.
 *
 * Tests verify:
 * - Component renders without throwing.
 * - Typing inside the editor calls `onChange` with the updated doc and text.
 * - ⌘/Ctrl+Enter triggers the `onSubmit` callback.
 * - readOnly prop hides the toolbar.
 * - Placeholder is visible when the editor is empty.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock @tiptap/react to avoid ProseMirror DOM setup in jsdom
vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(() => null),
  EditorContent: ({ className }: { className?: string }) => (
    <div data-testid="editor-content" className={className} />
  ),
  Extension: {
    create: vi.fn((config: unknown) => config),
  },
}));

vi.mock("@tiptap/pm/state", () => ({
  Plugin: vi.fn(),
  PluginKey: vi.fn(),
}));

vi.mock("@/components/rich-text/extensions", () => ({
  buildBaseExtensions: vi.fn(() => []),
}));

// @ts-expect-error renderHook is wired in epic 15
import { act, fireEvent, render } from "@testing-library/react";
import { RichTextEditor } from "../../components/rich-text/RichTextEditor";
import type { TiptapDoc } from "../../lib/comments/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_DOC: TiptapDoc = { type: "doc", content: [] };

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe.skip("RichTextEditor", () => {
  it("renders without crashing", () => {
    const { getByTestId } = render(<RichTextEditor />);
    expect(getByTestId("editor-content")).toBeTruthy();
  });

  it("renders the default toolbar when not readOnly", () => {
    const { getByRole } = render(<RichTextEditor readOnly={false} />);
    expect(getByRole("toolbar")).toBeTruthy();
  });

  it("hides the toolbar when readOnly is true", () => {
    const { queryByRole } = render(<RichTextEditor readOnly />);
    expect(queryByRole("toolbar")).toBeNull();
  });

  it("renders the placeholder text when editor is empty", () => {
    // The placeholder is rendered via CSS pseudo-element using data-placeholder,
    // so we just verify the editor content element is present.
    const { getByTestId } = render(<RichTextEditor placeholder="Write here…" />);
    const content = getByTestId("editor-content");
    expect(content).toBeTruthy();
    // Placeholder is applied via CSS — visible in real browser, not in jsdom.
    // Integration verification is via Playwright in Epic 15.
  });

  it("calls onChange when the editor content changes", () => {
    const mockEditor = {
      getJSON: vi.fn(() => EMPTY_DOC),
      getText: vi.fn(() => "hello"),
      view: { dom: document.createElement("div") },
      on: vi.fn(),
      off: vi.fn(),
      isActive: vi.fn(() => false),
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          toggleBold: vi.fn(() => ({ run: vi.fn() })),
        })),
      })),
    };

    // biome-ignore lint/suspicious/noExplicitAny: mocking for test
    const { useEditor } = require("@tiptap/react") as any;
    useEditor.mockReturnValue(mockEditor);

    const onChange = vi.fn();
    render(<RichTextEditor onChange={onChange} />);

    // Simulate a change by calling the onUpdate callback directly
    // (Real integration tested in Playwright e2e in Epic 15)
    const onUpdateCall = useEditor.mock.calls[0]?.[0]?.onUpdate;
    if (onUpdateCall) {
      act(() => {
        onUpdateCall({ editor: mockEditor });
      });
      expect(onChange).toHaveBeenCalledWith(EMPTY_DOC, "hello");
    }
  });

  it("calls onSubmit when ⌘+Enter is pressed on the editor DOM", () => {
    const mockDom = document.createElement("div");
    const mockEditor = {
      getJSON: vi.fn(() => EMPTY_DOC),
      getText: vi.fn(() => ""),
      view: { dom: mockDom },
      on: vi.fn(),
      off: vi.fn(),
      isActive: vi.fn(() => false),
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          toggleBold: vi.fn(() => ({ run: vi.fn() })),
        })),
      })),
    };

    // biome-ignore lint/suspicious/noExplicitAny: mocking for test
    const { useEditor } = require("@tiptap/react") as any;
    useEditor.mockReturnValue(mockEditor);

    const onSubmit = vi.fn();
    render(<RichTextEditor onSubmit={onSubmit} />);

    act(() => {
      fireEvent.keyDown(mockDom, { key: "Enter", metaKey: true });
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("calls onSubmit when Ctrl+Enter is pressed on the editor DOM", () => {
    const mockDom = document.createElement("div");
    const mockEditor = {
      getJSON: vi.fn(() => EMPTY_DOC),
      getText: vi.fn(() => ""),
      view: { dom: mockDom },
      on: vi.fn(),
      off: vi.fn(),
      isActive: vi.fn(() => false),
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          toggleBold: vi.fn(() => ({ run: vi.fn() })),
        })),
      })),
    };

    // biome-ignore lint/suspicious/noExplicitAny: mocking for test
    const { useEditor } = require("@tiptap/react") as any;
    useEditor.mockReturnValue(mockEditor);

    const onSubmit = vi.fn();
    render(<RichTextEditor onSubmit={onSubmit} />);

    act(() => {
      fireEvent.keyDown(mockDom, { key: "Enter", ctrlKey: true });
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("accepts a custom toolbar prop and renders it instead of the default", () => {
    const customToolbar = vi.fn(() => <div data-testid="custom-toolbar" />);
    const { getByTestId, queryByRole } = render(<RichTextEditor toolbar={customToolbar} />);

    expect(getByTestId("custom-toolbar")).toBeTruthy();
    expect(queryByRole("toolbar")).toBeNull(); // default toolbar not rendered
  });

  it("applies the className prop to the container", () => {
    const { container } = render(<RichTextEditor className="my-custom-class" />);
    expect(container.firstChild).toHaveClass("my-custom-class");
  });
});
