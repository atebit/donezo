// @ts-expect-error vitest is wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for `<AttachmentImage />`.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 *
 * Tests:
 * - Renders a skeleton while isLoading is true.
 * - Renders an <img> once the signed URL is available.
 * - Passes the transform width through to useSignedDisplayUrl.
 * - Calls onOpen when the image is clicked.
 * - Renders skeleton again when URL is null (failed fetch).
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseSignedDisplayUrl = vi.fn();

vi.mock("../../hooks/use-signed-display-url", () => ({
  useSignedDisplayUrl: (opts: unknown) => mockUseSignedDisplayUrl(opts),
}));

// @ts-expect-error render is wired in epic 15
import { fireEvent, render } from "@testing-library/react";
import { AttachmentImage } from "../../components/attachments/AttachmentImage";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ATTACHMENT_ID = "aaaaa000-0000-0000-0000-000000000001";
const SIGNED_URL = "https://storage.example.com/signed/image.png?token=abc";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skip("AttachmentImage", () => {
  beforeEach(() => {
    mockUseSignedDisplayUrl.mockReset();
  });

  it("renders a skeleton while isLoading and url is null", () => {
    mockUseSignedDisplayUrl.mockReturnValue({ url: null, isLoading: true });

    const { container } = render(<AttachmentImage attachmentId={ATTACHMENT_ID} alt="test image" />);

    // Should render skeleton (animate-pulse div), no img element.
    const img = container.querySelector("img");
    const skeleton = container.querySelector('[aria-hidden="true"]');

    expect(img).toBeNull();
    expect(skeleton).toBeTruthy();
  });

  it("renders an <img> once the signed URL resolves", () => {
    mockUseSignedDisplayUrl.mockReturnValue({ url: SIGNED_URL, isLoading: false });

    const { container } = render(<AttachmentImage attachmentId={ATTACHMENT_ID} alt="test image" />);

    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe(SIGNED_URL);
    expect(img?.getAttribute("alt")).toBe("test image");
  });

  it("passes transform width to useSignedDisplayUrl", () => {
    mockUseSignedDisplayUrl.mockReturnValue({ url: SIGNED_URL, isLoading: false });

    render(<AttachmentImage attachmentId={ATTACHMENT_ID} width={72} />);

    expect(mockUseSignedDisplayUrl).toHaveBeenCalledWith({
      attachmentId: ATTACHMENT_ID,
      transform: { width: 72 },
    });
  });

  it("passes no transform when width is undefined", () => {
    mockUseSignedDisplayUrl.mockReturnValue({ url: SIGNED_URL, isLoading: false });

    render(<AttachmentImage attachmentId={ATTACHMENT_ID} />);

    expect(mockUseSignedDisplayUrl).toHaveBeenCalledWith({
      attachmentId: ATTACHMENT_ID,
      transform: undefined,
    });
  });

  it("calls onOpen when the image is clicked", () => {
    mockUseSignedDisplayUrl.mockReturnValue({ url: SIGNED_URL, isLoading: false });
    const onOpen = vi.fn();

    const { container } = render(<AttachmentImage attachmentId={ATTACHMENT_ID} onOpen={onOpen} />);

    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    if (!img) return; // type narrowing for fireEvent

    fireEvent.click(img);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("renders a skeleton when url is null after loading completes", () => {
    mockUseSignedDisplayUrl.mockReturnValue({ url: null, isLoading: false });

    const { container } = render(<AttachmentImage attachmentId={ATTACHMENT_ID} />);

    // No img — shows skeleton on failed fetch.
    const img = container.querySelector("img");
    expect(img).toBeNull();
  });

  it("applies className to the img element", () => {
    mockUseSignedDisplayUrl.mockReturnValue({ url: SIGNED_URL, isLoading: false });

    const { container } = render(
      <AttachmentImage attachmentId={ATTACHMENT_ID} className="h-full w-full object-cover" />,
    );

    const img = container.querySelector("img");
    expect(img?.className).toContain("h-full");
    expect(img?.className).toContain("w-full");
  });
});
