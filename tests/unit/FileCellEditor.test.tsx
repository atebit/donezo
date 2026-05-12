// @ts-expect-error RTL wired in epic 15
import { act, render } from "@testing-library/react";
// @ts-expect-error vitest runner wired in epic 15
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for `<Editor>` in components/cells/file/Editor.tsx.
 *
 * NOTE: These tests cannot run until Vitest + React Testing Library are installed
 * in epic 15.
 *
 * Tests:
 * - Upload complete → onChange called with appended id.
 * - Delete → deleteAttachment server action called AND onChange called with removed id.
 * - Empty state shown when no attachments.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDeleteAttachment = vi.fn();
const mockGetDownloadUrl = vi.fn();

vi.mock("../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions", () => ({
  deleteAttachment: (...args: unknown[]) => mockDeleteAttachment(...args),
  getDownloadUrl: (...args: unknown[]) => mockGetDownloadUrl(...args),
}));

const mockSelectAttachmentsForTask = vi.fn();
vi.mock("../../stores/board-store", () => ({
  useBoardStore: (selector: (s: unknown) => unknown) => selector({ attachmentsByTask: new Map() }),
  selectAttachmentsForTask: (...args: unknown[]) => mockSelectAttachmentsForTask(...args),
}));

// Mock FileDropzone — expose onComplete callback.
type OnCompleteCb = (attachment: unknown) => void;
let capturedOnComplete: OnCompleteCb | null = null;

vi.mock("../../components/attachments/FileDropzone", () => ({
  FileDropzone: (props: { taskId: string; onComplete?: OnCompleteCb }) => {
    capturedOnComplete = props.onComplete ?? null;
    return <div data-testid="file-dropzone" />;
  },
}));

// Mock AttachmentThumb.
vi.mock("../../components/attachments/AttachmentThumb", () => ({
  AttachmentThumb: ({ filename }: { filename: string }) => (
    <div data-testid="attachment-thumb">{filename}</div>
  ),
}));

import { Editor } from "../../components/cells/file/Editor";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TASK_ID = "ttttt000-0000-0000-0000-000000000001";
const ATTACHMENT_ID_1 = "aaaaa000-0000-0000-0000-000000000001";
const ATTACHMENT_ID_2 = "bbbbb000-0000-0000-0000-000000000002";

function makeAttachment(id: string, filename = "photo.png") {
  return {
    id,
    task_id: TASK_ID,
    board_id: "board-1",
    filename,
    mime_type: "image/png",
    size_bytes: 1024,
    storage_path: `board-1/${TASK_ID}/${id}/${filename}`,
    uploader_id: "user-1",
    comment_id: null,
    is_uploaded: true,
    scan_status: "skipped",
    created_at: new Date().toISOString(),
  };
}

const ROW = { id: TASK_ID };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skip("FileCellEditor", () => {
  beforeEach(() => {
    capturedOnComplete = null;
    mockDeleteAttachment.mockReset();
    mockGetDownloadUrl.mockReset();
    mockSelectAttachmentsForTask.mockReset();
  });

  it("renders the dropzone", () => {
    mockSelectAttachmentsForTask.mockReturnValue([]);
    const onChange = vi.fn();
    const { getByTestId } = render(
      <Editor value={null} config={{}} onChange={onChange} onClose={vi.fn()} row={ROW} />,
    );
    expect(getByTestId("file-dropzone")).toBeTruthy();
  });

  it("upload complete → onChange called with appended id", async () => {
    mockSelectAttachmentsForTask.mockReturnValue([]);
    const onChange = vi.fn();

    render(
      <Editor
        value={{ attachmentIds: [ATTACHMENT_ID_1] }}
        config={{}}
        onChange={onChange}
        onClose={vi.fn()}
        row={ROW}
      />,
    );

    const newAttachment = makeAttachment(ATTACHMENT_ID_2, "new.png");

    await act(async () => {
      capturedOnComplete?.(newAttachment);
    });

    expect(onChange).toHaveBeenCalledWith({
      attachmentIds: [ATTACHMENT_ID_1, ATTACHMENT_ID_2],
    });
  });

  it("starts from empty value → onChange called with single id after upload", async () => {
    mockSelectAttachmentsForTask.mockReturnValue([]);
    const onChange = vi.fn();

    render(<Editor value={null} config={{}} onChange={onChange} onClose={vi.fn()} row={ROW} />);

    const newAttachment = makeAttachment(ATTACHMENT_ID_1, "first.png");

    await act(async () => {
      capturedOnComplete?.(newAttachment);
    });

    expect(onChange).toHaveBeenCalledWith({
      attachmentIds: [ATTACHMENT_ID_1],
    });
  });

  it("delete → deleteAttachment called and onChange called with removed id", async () => {
    const att1 = makeAttachment(ATTACHMENT_ID_1, "photo.png");
    const att2 = makeAttachment(ATTACHMENT_ID_2, "other.png");
    mockSelectAttachmentsForTask.mockReturnValue([att1, att2]);
    mockDeleteAttachment.mockResolvedValue({ ok: true });

    const onChange = vi.fn();

    const { getAllByLabelText } = render(
      <Editor
        value={{ attachmentIds: [ATTACHMENT_ID_1, ATTACHMENT_ID_2] }}
        config={{}}
        onChange={onChange}
        onClose={vi.fn()}
        row={ROW}
      />,
    );

    // Click delete on the first attachment.
    const deleteButtons = getAllByLabelText(/Delete/i);
    await act(async () => {
      deleteButtons[0].click();
    });

    // Server action called with the first attachment id.
    expect(mockDeleteAttachment).toHaveBeenCalledWith({ attachmentId: ATTACHMENT_ID_1 });

    // onChange called with the remaining id only.
    expect(onChange).toHaveBeenCalledWith({ attachmentIds: [ATTACHMENT_ID_2] });
  });

  it("delete all → onChange called with null", async () => {
    const att1 = makeAttachment(ATTACHMENT_ID_1, "only.png");
    mockSelectAttachmentsForTask.mockReturnValue([att1]);
    mockDeleteAttachment.mockResolvedValue({ ok: true });

    const onChange = vi.fn();

    const { getByLabelText } = render(
      <Editor
        value={{ attachmentIds: [ATTACHMENT_ID_1] }}
        config={{}}
        onChange={onChange}
        onClose={vi.fn()}
        row={ROW}
      />,
    );

    const deleteBtn = getByLabelText(/Delete only\.png/i);
    await act(async () => {
      deleteBtn.click();
    });

    // When the last id is removed, onChange is called with null.
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
