import { beforeEach, describe, expect, it } from "vitest";

import type { Database } from "../../lib/supabase/types";
import { selectAttachmentsForTask, useBoardStore } from "../../stores/board-store";

type AttachmentRow = Database["public"]["Tables"]["attachment"]["Row"];

// ---------------------------------------------------------------------------
// Helpers — minimal fixture factories
// ---------------------------------------------------------------------------

function makeAttachment(overrides: Partial<AttachmentRow> = {}): AttachmentRow {
  return {
    id: "attachment-1",
    board_id: "board-1",
    task_id: "task-1",
    uploader_id: "user-1",
    filename: "document.pdf",
    storage_path: "board-1/task-1/attachment-1/document.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
    is_uploaded: true,
    scan_status: "skipped",
    comment_id: null,
    created_at: "2024-01-01T10:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useBoardStore — Epic 10 attachments", () => {
  beforeEach(() => {
    useBoardStore.getState().reset();
    useBoardStore.setState({
      collapsedByBoard: {},
      attachmentsByTask: new Map(),
    });
  });

  // -------------------------------------------------------------------------
  // hydrateAttachmentsForBoard
  // -------------------------------------------------------------------------

  it("hydrateAttachmentsForBoard groups attachments by task_id", () => {
    const a1 = makeAttachment({ id: "a1", task_id: "task-1" });
    const a2 = makeAttachment({ id: "a2", task_id: "task-2" });
    const a3 = makeAttachment({ id: "a3", task_id: "task-1" });

    useBoardStore.getState().hydrateAttachmentsForBoard([a1, a2, a3]);

    const state = useBoardStore.getState();
    expect(state.attachmentsByTask.get("task-1")).toHaveLength(2);
    expect(state.attachmentsByTask.get("task-2")).toHaveLength(1);
  });

  it("hydrateAttachmentsForBoard sorts attachments oldest-first within each task", () => {
    const a1 = makeAttachment({ id: "a1", task_id: "task-1", created_at: "2024-01-03T00:00:00Z" });
    const a2 = makeAttachment({ id: "a2", task_id: "task-1", created_at: "2024-01-01T00:00:00Z" });
    const a3 = makeAttachment({ id: "a3", task_id: "task-1", created_at: "2024-01-02T00:00:00Z" });

    useBoardStore.getState().hydrateAttachmentsForBoard([a1, a2, a3]);

    const state = useBoardStore.getState();
    const attachments = state.attachmentsByTask.get("task-1") ?? [];
    expect(attachments.map((a) => a.id)).toEqual(["a2", "a3", "a1"]);
  });

  it("hydrateAttachmentsForBoard skips rows where is_uploaded=false", () => {
    const uploaded = makeAttachment({ id: "uploaded", is_uploaded: true });
    const pending = makeAttachment({ id: "pending", is_uploaded: false });

    useBoardStore.getState().hydrateAttachmentsForBoard([uploaded, pending]);

    const state = useBoardStore.getState();
    const attachments = state.attachmentsByTask.get("task-1") ?? [];
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.id).toBe("uploaded");
  });

  // -------------------------------------------------------------------------
  // applyAttachmentUpsert — idempotency
  // -------------------------------------------------------------------------

  it("applyAttachmentUpsert inserts a new attachment into attachmentsByTask", () => {
    const attachment = makeAttachment();
    useBoardStore.getState().applyAttachmentUpsert(attachment);

    const state = useBoardStore.getState();
    const attachments = state.attachmentsByTask.get("task-1") ?? [];
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.id).toBe("attachment-1");
  });

  it("applyAttachmentUpsert is idempotent on id (same id + same created_at is a no-op)", () => {
    const attachment = makeAttachment({ created_at: "2024-01-01T10:00:00Z" });
    useBoardStore.getState().applyAttachmentUpsert(attachment);
    useBoardStore.getState().applyAttachmentUpsert(attachment); // duplicate

    const state = useBoardStore.getState();
    const attachments = state.attachmentsByTask.get("task-1") ?? [];
    expect(attachments).toHaveLength(1);
  });

  it("applyAttachmentUpsert skips rows where is_uploaded=false", () => {
    const pending = makeAttachment({ is_uploaded: false });
    useBoardStore.getState().applyAttachmentUpsert(pending);

    const state = useBoardStore.getState();
    const attachments = state.attachmentsByTask.get("task-1") ?? [];
    expect(attachments).toHaveLength(0);
  });

  it("applyAttachmentUpsert accepts UPDATE that flips is_uploaded from false to true", () => {
    // Simulate the confirmUpload flow: first a pending row (skipped), then
    // the same row with is_uploaded=true arrives via UPDATE Realtime event.
    const pending = makeAttachment({ id: "a1", is_uploaded: false });
    useBoardStore.getState().applyAttachmentUpsert(pending);

    const uploaded = makeAttachment({ id: "a1", is_uploaded: true });
    useBoardStore.getState().applyAttachmentUpsert(uploaded);

    const state = useBoardStore.getState();
    const attachments = state.attachmentsByTask.get("task-1") ?? [];
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.id).toBe("a1");
  });

  it("applyAttachmentUpsert sorts attachments oldest-first after insert", () => {
    const a1 = makeAttachment({ id: "a1", created_at: "2024-01-03T00:00:00Z" });
    const a2 = makeAttachment({ id: "a2", created_at: "2024-01-01T00:00:00Z" });
    const a3 = makeAttachment({ id: "a3", created_at: "2024-01-02T00:00:00Z" });

    useBoardStore.getState().applyAttachmentUpsert(a1);
    useBoardStore.getState().applyAttachmentUpsert(a2);
    useBoardStore.getState().applyAttachmentUpsert(a3);

    const state = useBoardStore.getState();
    const attachments = state.attachmentsByTask.get("task-1") ?? [];
    expect(attachments.map((a) => a.id)).toEqual(["a2", "a3", "a1"]);
  });

  // -------------------------------------------------------------------------
  // applyAttachmentDelete
  // -------------------------------------------------------------------------

  it("applyAttachmentDelete removes an attachment by id", () => {
    const a1 = makeAttachment({ id: "a1" });
    const a2 = makeAttachment({ id: "a2" });
    useBoardStore.getState().applyAttachmentUpsert(a1);
    useBoardStore.getState().applyAttachmentUpsert(a2);

    useBoardStore.getState().applyAttachmentDelete("a1");

    const state = useBoardStore.getState();
    const attachments = state.attachmentsByTask.get("task-1") ?? [];
    expect(attachments.map((a) => a.id)).toEqual(["a2"]);
  });

  it("applyAttachmentDelete is a no-op on unknown id", () => {
    const a1 = makeAttachment({ id: "a1" });
    useBoardStore.getState().applyAttachmentUpsert(a1);

    useBoardStore.getState().applyAttachmentDelete("nonexistent");

    const state = useBoardStore.getState();
    const attachments = state.attachmentsByTask.get("task-1") ?? [];
    expect(attachments).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // reset() clears attachmentsByTask
  // -------------------------------------------------------------------------

  it("reset() clears attachmentsByTask", () => {
    useBoardStore.getState().applyAttachmentUpsert(makeAttachment());

    useBoardStore.getState().reset();

    const state = useBoardStore.getState();
    expect(state.attachmentsByTask.size).toBe(0);
  });

  it("reset() preserves collapsedByBoard, columnPrefsByBoard, and outbox", () => {
    useBoardStore.setState({
      collapsedByBoard: { "board-1": ["group-1"] },
      columnPrefsByBoard: { "board-1": { "col-1": { width: 200 } } },
      outbox: [],
    });

    useBoardStore.getState().reset();

    const state = useBoardStore.getState();
    expect(state.collapsedByBoard).toEqual({ "board-1": ["group-1"] });
    expect(state.columnPrefsByBoard).toEqual({ "board-1": { "col-1": { width: 200 } } });
  });

  // -------------------------------------------------------------------------
  // selectAttachmentsForTask — stable EMPTY_ARRAY reference
  // -------------------------------------------------------------------------

  it("selectAttachmentsForTask returns attachments for a known task", () => {
    const a1 = makeAttachment({ id: "a1", task_id: "task-1" });
    useBoardStore.getState().applyAttachmentUpsert(a1);

    const attachments = selectAttachmentsForTask(useBoardStore.getState(), "task-1");
    expect(attachments).toHaveLength(1);
    expect(attachments[0]?.id).toBe("a1");
  });

  it("selectAttachmentsForTask returns stable EMPTY_ARRAY for unknown task", () => {
    const result1 = selectAttachmentsForTask(useBoardStore.getState(), "task-nonexistent");
    const result2 = selectAttachmentsForTask(useBoardStore.getState(), "task-nonexistent");

    expect(result1).toEqual([]);
    // Same reference — prevents infinite render loops (Zustand v5 selector note)
    expect(result1).toBe(result2);
  });
});
