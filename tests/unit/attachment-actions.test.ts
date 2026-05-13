import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for attachment server actions.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * Written now so epic 15 executor can pick them up without changes.
 *
 * Mocking approach (mirrors comment-actions.test.ts):
 *   - `@/lib/supabase/server` → createClient returns a fake SupabaseClient.
 *   - `@/lib/supabase/admin` → adminClient returns a fake admin SupabaseClient.
 *   - `@/lib/logger` → no-op stubs.
 *   - `@/lib/authorization` → requireBoardRole and getBoardRole are spies.
 *   - `@/lib/activity` → logActivity is a spy.
 *   - `@/lib/attachments/server` → storageObjectExists is a spy.
 */

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

const mockLogActivity = vi.fn().mockResolvedValue(undefined);
vi.mock("../../lib/activity", () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

const mockRequireBoardRole = vi.fn().mockResolvedValue("member");
vi.mock("../../lib/authorization", () => ({
  requireBoardRole: (...args: unknown[]) => mockRequireBoardRole(...args),
  getBoardRole: vi.fn().mockResolvedValue("member"),
}));

vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockStorageObjectExists = vi.fn().mockResolvedValue(true);
vi.mock("../../lib/attachments/server", () => ({
  storageObjectExists: (...args: unknown[]) => mockStorageObjectExists(...args),
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Valid RFC 4122 v4 UUIDs (Zod 4 enforces strict UUID format including variant bits).
const BOARD_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const TASK_ID = "bc09bc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const ATTACHMENT_ID = "ab09bc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const _COMMENT_ID = "d379bc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // reserved for future tests
const USER_ID = "fa09bc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const USER2_ID = "a5eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const STORAGE_PATH = `${BOARD_ID}/${TASK_ID}/${ATTACHMENT_ID}/test_file.pdf`;

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeAttachmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ATTACHMENT_ID,
    task_id: TASK_ID,
    board_id: BOARD_ID,
    comment_id: null,
    uploader_id: USER_ID,
    storage_path: STORAGE_PATH,
    filename: "test file.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
    is_uploaded: true,
    scan_status: "skipped",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeTaskRow() {
  return { id: TASK_ID, board_id: BOARD_ID };
}

/**
 * Builds a minimal chainable Supabase client mock.
 * Covers the typical query chain: from → select → eq → is → maybeSingle/single.
 */
function makeSupabase({
  task = makeTaskRow() as ReturnType<typeof makeTaskRow> | null,
  attachment = makeAttachmentRow() as ReturnType<typeof makeAttachmentRow> | null,
  insertedAttachment = { id: ATTACHMENT_ID } as { id: string } | null,
  insertError = null as { message: string } | null,
  updateError = null as { message: string } | null,
  deleteError = null as { message: string } | null,
  signedUploadUrl = {
    signedUrl: "https://example.com/upload",
    token: "tok123",
    path: STORAGE_PATH,
  } as Record<string, string> | null,
  signedUploadUrlError = null as { message: string } | null,
  signedUrl = "https://example.com/display/file.pdf",
  signedUrlError = null as { message: string } | null,
  comment = null as { id: string; task_id: string } | null,
} = {}) {
  const makeChain = (result: unknown, error: unknown = null) => {
    const chain: Record<string, unknown> = {};
    const methods = [
      "select",
      "eq",
      "is",
      "maybeSingle",
      "single",
      "insert",
      "update",
      "delete",
      "limit",
    ];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    (chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({ data: result, error });
    (chain.single as ReturnType<typeof vi.fn>).mockResolvedValue({ data: result, error });
    return chain;
  };

  const taskChain = makeChain(task, task === null ? { message: "not found" } : null);
  const attachmentChain = makeChain(attachment, null);
  const _insertChain = makeChain(insertedAttachment, insertError); // used implicitly via closure
  const _updateChain = { error: updateError }; // used implicitly via closure
  const deleteDbChain = { error: deleteError };
  const commentChain = makeChain(comment, null);

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "task") return taskChain;
    if (table === "comment") return commentChain;
    if (table === "attachment") {
      return {
        ...attachmentChain,
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: insertedAttachment, error: insertError }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            ...{ error: updateError },
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...makeAttachmentRow(), is_uploaded: true },
                error: updateError,
              }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue(deleteDbChain),
        }),
      };
    }
    return makeChain(null, null);
  });

  const storageFromMock = vi.fn().mockReturnValue({
    createSignedUploadUrl: vi.fn().mockResolvedValue({
      data: signedUploadUrl,
      error: signedUploadUrlError,
    }),
    createSignedUrl: vi.fn().mockResolvedValue({
      data: signedUrl ? { signedUrl } : null,
      error: signedUrlError,
    }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
  });

  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } } }),
  };

  return { from, storage: { from: storageFromMock }, auth };
}

function makeAdminStorageClient(removeError: { message: string } | null = null) {
  const removeResult = { error: removeError };
  const storageFromMock = vi.fn().mockReturnValue({
    remove: vi.fn().mockResolvedValue(removeResult),
  });
  return { storage: { from: storageFromMock } };
}

// ---------------------------------------------------------------------------
// describe: requestUpload
// ---------------------------------------------------------------------------

describe.skip("requestUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBoardRole.mockResolvedValue("member");
  });

  it("denies a non-member (requireBoardRole throws FORBIDDEN)", async () => {
    mockRequireBoardRole.mockRejectedValue({
      code: "FORBIDDEN",
      message: "Insufficient permissions",
    });

    const supabase = makeSupabase();
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { requestUpload } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    const result = await requestUpload({
      taskId: TASK_ID,
      filename: "file.pdf",
      sizeBytes: 1024,
      mimeType: "application/pdf",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("rejects an oversized payload before touching the DB (Zod rejects > 50 MB)", async () => {
    const supabase = makeSupabase();
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { requestUpload } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    const result = await requestUpload({
      taskId: TASK_ID,
      filename: "huge.zip",
      sizeBytes: 52_428_801, // 50 MB + 1 byte
      mimeType: "application/zip",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION");
    }
    // DB should not have been touched
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns attachment id, storagePath, signedUrl, token, expiresInSeconds on success", async () => {
    const supabase = makeSupabase();
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { requestUpload } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    const result = await requestUpload({
      taskId: TASK_ID,
      filename: "document.pdf",
      sizeBytes: 1024,
      mimeType: "application/pdf",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("attachmentId");
      expect(result.data).toHaveProperty("storagePath");
      expect(result.data).toHaveProperty("signedUrl");
      expect(result.data).toHaveProperty("token");
      expect(result.data.expiresInSeconds).toBe(600);
    }
  });
});

// ---------------------------------------------------------------------------
// describe: confirmUpload
// ---------------------------------------------------------------------------

describe.skip("confirmUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageObjectExists.mockResolvedValue(true);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("is idempotent when is_uploaded is already true", async () => {
    const alreadyUploaded = makeAttachmentRow({ is_uploaded: true });
    const supabase = makeSupabase({ attachment: alreadyUploaded });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { confirmUpload } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    const result = await confirmUpload({ attachmentId: ATTACHMENT_ID });

    expect(result.ok).toBe(true);
    // storageObjectExists should not be called for an already-uploaded attachment
    expect(mockStorageObjectExists).not.toHaveBeenCalled();
    // logActivity should not be called again
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("throws STORAGE_MISSING when the HEAD check fails", async () => {
    mockStorageObjectExists.mockResolvedValue(false);
    const pendingAttachment = makeAttachmentRow({ is_uploaded: false });
    const supabase = makeSupabase({ attachment: pendingAttachment });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { confirmUpload } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    const result = await confirmUpload({ attachmentId: ATTACHMENT_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STORAGE_MISSING");
    }
  });

  it("throws FORBIDDEN when called by a different user", async () => {
    const attachmentOwnedByUser2 = makeAttachmentRow({ uploader_id: USER2_ID });
    const supabase = makeSupabase({ attachment: attachmentOwnedByUser2 });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { confirmUpload } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    const result = await confirmUpload({ attachmentId: ATTACHMENT_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("flips is_uploaded and logs activity on success", async () => {
    const pendingAttachment = makeAttachmentRow({ is_uploaded: false });
    const supabase = makeSupabase({ attachment: pendingAttachment });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { confirmUpload } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    const result = await confirmUpload({ attachmentId: ATTACHMENT_ID });

    expect(result.ok).toBe(true);
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "attachment.uploaded" }),
    );
  });
});

// ---------------------------------------------------------------------------
// describe: deleteAttachment
// ---------------------------------------------------------------------------

describe.skip("deleteAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireBoardRole.mockResolvedValue("viewer");
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("calls admin storage.remove([storagePath]) exactly once", async () => {
    const adminMock = makeAdminStorageClient();
    vi.mock("../../lib/supabase/admin", () => ({
      adminClient: vi.fn().mockReturnValue(adminMock),
    }));

    const supabase = makeSupabase();
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { deleteAttachment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    const result = await deleteAttachment({ attachmentId: ATTACHMENT_ID });

    expect(result.ok).toBe(true);
    expect(adminMock.storage.from).toHaveBeenCalledWith("attachments");
    const removeFn = adminMock.storage.from.mock.results[0]?.value?.remove as ReturnType<
      typeof vi.fn
    >;
    expect(removeFn).toHaveBeenCalledTimes(1);
    expect(removeFn).toHaveBeenCalledWith([STORAGE_PATH]);
  });

  it("proceeds with DB delete even if storage remove fails", async () => {
    const adminMock = makeAdminStorageClient({ message: "storage error" });
    vi.mock("../../lib/supabase/admin", () => ({
      adminClient: vi.fn().mockReturnValue(adminMock),
    }));

    const supabase = makeSupabase();
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { deleteAttachment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    const result = await deleteAttachment({ attachmentId: ATTACHMENT_ID });

    // Should still succeed (storage failure is best-effort)
    expect(result.ok).toBe(true);
  });

  it("logs attachment.deleted activity", async () => {
    const adminMock = makeAdminStorageClient();
    vi.mock("../../lib/supabase/admin", () => ({
      adminClient: vi.fn().mockReturnValue(adminMock),
    }));

    const supabase = makeSupabase();
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { deleteAttachment } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    await deleteAttachment({ attachmentId: ATTACHMENT_ID });

    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "attachment.deleted" }),
    );
  });
});

// ---------------------------------------------------------------------------
// describe: getSignedDisplayUrl
// ---------------------------------------------------------------------------

describe.skip("getSignedDisplayUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes transform options only for image MIME types", async () => {
    const imageAttachment = makeAttachmentRow({ mime_type: "image/png" });
    const supabase = makeSupabase({ attachment: imageAttachment });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { getSignedDisplayUrl } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    const result = await getSignedDisplayUrl({
      attachmentId: ATTACHMENT_ID,
      transform: { width: 400 },
    });

    expect(result.ok).toBe(true);

    // Verify createSignedUrl was called with the transform argument
    const storageInstance = supabase.storage.from.mock.results[0]?.value as Record<
      string,
      ReturnType<typeof vi.fn>
    >;
    expect(storageInstance?.createSignedUrl).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
      expect.objectContaining({ transform: { width: 400 } }),
    );
  });

  it("does NOT pass transform for non-image MIME types", async () => {
    const pdfAttachment = makeAttachmentRow({ mime_type: "application/pdf" });
    const supabase = makeSupabase({ attachment: pdfAttachment });

    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { getSignedDisplayUrl } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    const result = await getSignedDisplayUrl({
      attachmentId: ATTACHMENT_ID,
      transform: { width: 400 },
    });

    expect(result.ok).toBe(true);

    // Verify createSignedUrl was called WITHOUT the transform argument
    const storageInstance = supabase.storage.from.mock.results[0]?.value as Record<
      string,
      ReturnType<typeof vi.fn>
    >;
    const calls = storageInstance?.createSignedUrl?.mock?.calls ?? [];
    // Should have been called without transform options (or with undefined/no third arg)
    const hadTransform = calls.some(
      (call: unknown[]) =>
        call[2] && typeof call[2] === "object" && "transform" in (call[2] as object),
    );
    expect(hadTransform).toBe(false);
  });

  it("returns url, expiresInSeconds, and attachmentId", async () => {
    const supabase = makeSupabase();
    vi.mock("../../lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue(supabase),
    }));

    const { getSignedDisplayUrl } = await import(
      "../../app/(app)/w/[workspaceSlug]/b/[boardId]/attachments/actions"
    );

    const result = await getSignedDisplayUrl({ attachmentId: ATTACHMENT_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("url");
      expect(result.data).toHaveProperty("expiresInSeconds");
      expect(result.data.attachmentId).toBe(ATTACHMENT_ID);
    }
  });
});
