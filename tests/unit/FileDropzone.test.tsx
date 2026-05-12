// @ts-expect-error vitest is wired in epic 15
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for `<FileDropzone />`.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 *
 * Tests:
 * - Renders without crashing with a default drop UI.
 * - Renders children when provided.
 * - Rejects files that exceed MAX_FILE_SIZE_BYTES (client-side validation).
 * - Rejects files with disallowed MIME types (client-side validation).
 * - Calls onComplete after a successful upload cycle.
 * - Calls onError and shows sonner toast on upload failure.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpload = vi.fn();
const mockClearCompleted = vi.fn();
const mockUploads: unknown[] = [];

vi.mock("../../hooks/use-attachment-uploader", () => ({
  useAttachmentUploader: () => ({
    upload: mockUpload,
    uploads: mockUploads,
    clearCompleted: mockClearCompleted,
  }),
}));

// Mock sonner toast.
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

// Mock react-dropzone — expose the onDrop callback.
type OnDropCb = (files: File[]) => void;
let capturedOnDrop: OnDropCb | null = null;

vi.mock("react-dropzone", () => ({
  useDropzone: (opts: { onDrop?: OnDropCb }) => {
    capturedOnDrop = opts?.onDrop ?? null;
    return {
      getRootProps: (p: Record<string, unknown> = {}) => ({ ...p, "data-testid": "dropzone-root" }),
      getInputProps: () => ({ "data-testid": "file-input" }),
      isDragActive: false,
    };
  },
}));

// @ts-expect-error render is wired in epic 15
import { act, fireEvent, render } from "@testing-library/react";
import { FileDropzone } from "../../components/attachments/FileDropzone";
import { MAX_FILE_SIZE_BYTES } from "../../lib/attachments/constants";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TASK_ID = "ttttt000-0000-0000-0000-000000000001";
const ATTACHMENT_ID = "aaaaa000-0000-0000-0000-000000000001";

function makeFile(name = "photo.png", type = "image/png", sizeBytes = 1024): File {
  const blob = new Blob(["x".repeat(sizeBytes)], { type });
  return new File([blob], name, { type });
}

function makeAttachmentRow() {
  return {
    id: ATTACHMENT_ID,
    task_id: TASK_ID,
    board_id: "board-1",
    filename: "photo.png",
    mime_type: "image/png",
    size_bytes: 1024,
    storage_path: `board-1/${TASK_ID}/${ATTACHMENT_ID}/photo.png`,
    uploader_id: "user-1",
    comment_id: null,
    is_uploaded: true,
    scan_status: "skipped",
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skip("FileDropzone", () => {
  beforeEach(() => {
    capturedOnDrop = null;
    mockUpload.mockReset();
    mockToastError.mockReset();
    mockClearCompleted.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing with default drop UI", () => {
    const { getByTestId } = render(<FileDropzone taskId={TASK_ID} />);
    expect(getByTestId("dropzone-root")).toBeTruthy();
    expect(getByTestId("file-input")).toBeTruthy();
  });

  it("renders custom children when provided", () => {
    const { getByTestId } = render(
      <FileDropzone taskId={TASK_ID}>
        <div data-testid="custom-child">Custom drop UI</div>
      </FileDropzone>,
    );
    expect(getByTestId("custom-child")).toBeTruthy();
  });

  it("rejects a file that exceeds MAX_FILE_SIZE_BYTES and calls onError", async () => {
    const onError = vi.fn();
    render(<FileDropzone taskId={TASK_ID} onError={onError} />);

    const oversizedFile = makeFile("big.png", "image/png", MAX_FILE_SIZE_BYTES + 1);

    await act(async () => {
      capturedOnDrop?.([oversizedFile]);
    });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "FILE_TOO_LARGE" }));
    expect(mockToastError).toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("rejects a file with a disallowed MIME type and calls onError", async () => {
    const onError = vi.fn();
    render(<FileDropzone taskId={TASK_ID} onError={onError} />);

    const badFile = makeFile("virus.exe", "application/x-msdownload", 512);

    await act(async () => {
      capturedOnDrop?.([badFile]);
    });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "INVALID_MIME" }));
    expect(mockToastError).toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("calls onComplete after a successful upload", async () => {
    const onComplete = vi.fn();
    const attachmentRow = makeAttachmentRow();
    mockUpload.mockResolvedValue(attachmentRow);

    render(<FileDropzone taskId={TASK_ID} onComplete={onComplete} />);

    const file = makeFile();

    await act(async () => {
      capturedOnDrop?.([file]);
    });

    expect(mockUpload).toHaveBeenCalledWith(file, {
      taskId: TASK_ID,
      commentId: undefined,
    });
    expect(onComplete).toHaveBeenCalledWith(attachmentRow);
  });

  it("calls onError when upload returns null", async () => {
    const onError = vi.fn();
    mockUpload.mockResolvedValue(null); // upload failed

    render(<FileDropzone taskId={TASK_ID} onError={onError} />);

    const file = makeFile();

    await act(async () => {
      capturedOnDrop?.([file]);
    });

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "UPLOAD_FAILED" }));
    expect(mockToastError).toHaveBeenCalled();
  });

  it("passes commentId to the upload hook when provided", async () => {
    const COMMENT_ID = "ccccc000-0000-0000-0000-000000000001";
    mockUpload.mockResolvedValue(makeAttachmentRow());

    render(<FileDropzone taskId={TASK_ID} commentId={COMMENT_ID} />);

    const file = makeFile();

    await act(async () => {
      capturedOnDrop?.([file]);
    });

    expect(mockUpload).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ commentId: COMMENT_ID }),
    );
  });

  it("handles paste events with image files", async () => {
    const onComplete = vi.fn();
    mockUpload.mockResolvedValue(makeAttachmentRow());

    const { getByTestId } = render(<FileDropzone taskId={TASK_ID} onComplete={onComplete} />);

    const imageFile = makeFile("pasted.png", "image/png", 512);
    const dataTransfer = {
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => imageFile,
        },
      ],
    };

    await act(async () => {
      fireEvent.paste(getByTestId("dropzone-root"), {
        clipboardData: dataTransfer,
      });
    });

    expect(mockUpload).toHaveBeenCalledWith(
      imageFile,
      expect.objectContaining({ taskId: TASK_ID }),
    );
  });
});
