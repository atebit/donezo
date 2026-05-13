import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for `<FilesTab />`.
 *
 * NOTE: These tests cannot run until Vitest + React Testing Library are installed
 * in epic 15.
 *
 * Tests:
 * - Renders the dropzone area.
 * - Renders AttachmentTile rows when the store has uploaded attachments for the task.
 * - Empty state: shows no tile list when there are no attachments.
 * - Does not render tiles for attachments with is_uploaded=false.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelectAttachmentsForTask = vi.fn();

vi.mock("../../stores/board-store", () => ({
  useBoardStore: (selector: (s: unknown) => unknown) => selector({ attachmentsByTask: new Map() }),
  selectAttachmentsForTask: (...args: unknown[]) => mockSelectAttachmentsForTask(...args),
}));

// Mock FileDropzone so we don't need react-dropzone in unit tests.
vi.mock("../../components/attachments/FileDropzone", () => ({
  FileDropzone: ({ taskId }: { taskId: string }) => (
    <div data-testid="file-dropzone" data-task-id={taskId} />
  ),
}));

// Mock AttachmentTile to avoid complex props + server action imports.
vi.mock("../../components/attachments/AttachmentTile", () => ({
  AttachmentTile: ({ attachmentId, filename }: { attachmentId: string; filename: string }) => (
    <div data-testid="attachment-tile" data-attachment-id={attachmentId}>
      {filename}
    </div>
  ),
}));

// Mock AttachmentLightbox.
vi.mock("../../components/attachments/AttachmentLightbox", () => ({
  AttachmentLightbox: () => null,
}));

// Mock AttachmentPdfEmbed.
vi.mock("../../components/attachments/AttachmentPdfEmbed", () => ({
  AttachmentPdfEmbed: () => null,
}));

import { FilesTab } from "../../components/board/tabs/FilesTab";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TASK_ID = "ttttt000-0000-0000-0000-000000000001";

function makeAttachment(id: string, filename: string, mimeType = "image/png", isUploaded = true) {
  return {
    id,
    task_id: TASK_ID,
    board_id: "board-1",
    filename,
    mime_type: mimeType,
    size_bytes: 1024,
    storage_path: `board-1/${TASK_ID}/${id}/${filename}`,
    uploader_id: "user-1",
    comment_id: null,
    is_uploaded: isUploaded,
    scan_status: "skipped",
    created_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FilesTab", () => {
  beforeEach(() => {
    mockSelectAttachmentsForTask.mockReset();
  });

  it("renders the dropzone", () => {
    mockSelectAttachmentsForTask.mockReturnValue([]);
    const { getByTestId } = render(
      <FilesTab taskId={TASK_ID} boardId="board-1" currentUserId="user-1" boardRole="member" />,
    );
    expect(getByTestId("file-dropzone")).toBeTruthy();
  });

  it("renders attachment tiles for uploaded attachments", () => {
    const attachments = [
      makeAttachment("a1", "photo.png"),
      makeAttachment("a2", "report.pdf", "application/pdf"),
    ];
    mockSelectAttachmentsForTask.mockReturnValue(attachments);

    const { getAllByTestId } = render(
      <FilesTab taskId={TASK_ID} boardId="board-1" currentUserId="user-1" boardRole="member" />,
    );

    const tiles = getAllByTestId("attachment-tile");
    expect(tiles).toHaveLength(2);
    expect(tiles[0].getAttribute("data-attachment-id")).toBe("a1");
    expect(tiles[1].getAttribute("data-attachment-id")).toBe("a2");
  });

  it("does not render a tile list when there are no attachments", () => {
    mockSelectAttachmentsForTask.mockReturnValue([]);

    const { queryByTestId } = render(
      <FilesTab taskId={TASK_ID} boardId="board-1" currentUserId="user-1" boardRole="member" />,
    );

    expect(queryByTestId("files-tab-list")).toBeNull();
  });

  it("skips attachments with is_uploaded=false", () => {
    const attachments = [
      makeAttachment("a1", "uploading.png", "image/png", false),
      makeAttachment("a2", "done.png", "image/png", true),
    ];
    mockSelectAttachmentsForTask.mockReturnValue(attachments);

    const { getAllByTestId } = render(
      <FilesTab taskId={TASK_ID} boardId="board-1" currentUserId="user-1" boardRole="member" />,
    );

    // Only the uploaded one should appear.
    const tiles = getAllByTestId("attachment-tile");
    expect(tiles).toHaveLength(1);
    expect(tiles[0].getAttribute("data-attachment-id")).toBe("a2");
  });
});
