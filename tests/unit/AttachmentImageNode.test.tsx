import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * Unit tests for `<AttachmentImageNode />`.
 *
 * NOTE: These tests cannot run until Vitest + React Testing Library are installed
 * in epic 15.
 *
 * Tests:
 * - Renders AttachmentImage when attachmentId is present.
 * - Renders a plain <img> fallback when only src is present.
 * - Passes alt attribute through in both cases.
 * - Sets data-attachment-id attribute on the wrapper.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../components/attachments/AttachmentImage", () => ({
  AttachmentImage: ({ attachmentId, alt }: { attachmentId: string; alt: string }) =>
    React.createElement("img", {
      "data-testid": "attachment-image",
      "data-attachment-id": attachmentId,
      alt,
      src: "",
    }),
}));

// Mock Tiptap NodeViewWrapper to render as a plain div.
vi.mock("@tiptap/react", () => ({
  NodeViewWrapper: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  ),
  ReactNodeViewRenderer: (component: unknown) => component,
}));

import type { NodeViewProps } from "@tiptap/react";
import { AttachmentImageNode } from "../../components/rich-text/AttachmentImageNode";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ATTACHMENT_ID = "aaaaa000-0000-0000-0000-000000000001";

function makeNodeViewProps(attrs: Record<string, string | null>): NodeViewProps {
  return {
    node: { attrs } as unknown as NodeViewProps["node"],
    editor: {} as NodeViewProps["editor"],
    view: {} as NodeViewProps["view"],
    getPos: () => 0,
    decorations: [] as unknown as NodeViewProps["decorations"],
    innerDecorations: {} as unknown as NodeViewProps["innerDecorations"],
    selected: false,
    extension: {} as NodeViewProps["extension"],
    HTMLAttributes: {},
    updateAttributes: vi.fn(),
    deleteNode: vi.fn(),
  } as NodeViewProps;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AttachmentImageNode", () => {
  it("renders AttachmentImage when attachmentId is present", () => {
    const props = makeNodeViewProps({ attachmentId: ATTACHMENT_ID, alt: "test", src: null });
    const { getByTestId } = render(<AttachmentImageNode {...props} />);

    const img = getByTestId("attachment-image");
    expect(img.getAttribute("data-attachment-id")).toBe(ATTACHMENT_ID);
  });

  it("passes alt attribute through to AttachmentImage", () => {
    const props = makeNodeViewProps({ attachmentId: ATTACHMENT_ID, alt: "my photo", src: null });
    const { getByTestId } = render(<AttachmentImageNode {...props} />);

    const img = getByTestId("attachment-image");
    expect(img.getAttribute("alt")).toBe("my photo");
  });

  it("renders a plain <img> fallback when attachmentId is null", () => {
    const props = makeNodeViewProps({
      attachmentId: null,
      alt: "legacy image",
      src: "https://example.com/image.png",
    });
    const { container } = render(<AttachmentImageNode {...props} />);

    // No AttachmentImage rendered (no data-testid="attachment-image")
    const attachmentImg = container.querySelector('[data-testid="attachment-image"]');
    expect(attachmentImg).toBeNull();

    // Plain <img> fallback
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("https://example.com/image.png");
    expect(img?.getAttribute("alt")).toBe("legacy image");
  });

  it("sets data-attachment-id on the wrapper when attachmentId is present", () => {
    const props = makeNodeViewProps({ attachmentId: ATTACHMENT_ID, alt: null, src: null });
    const { container } = render(<AttachmentImageNode {...props} />);

    const wrapper = container.querySelector("[data-attachment-id]");
    expect(wrapper?.getAttribute("data-attachment-id")).toBe(ATTACHMENT_ID);
  });
});
