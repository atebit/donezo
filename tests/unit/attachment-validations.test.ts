// @ts-expect-error vitest is wired in epic 15
import { describe, expect, it } from "vitest";

/**
 * Unit tests for attachment Zod validation schemas.
 *
 * NOTE: These tests cannot run until Vitest is installed in epic 15.
 * Written now so epic 15 executor can pick them up without changes.
 */

import {
  ConfirmUploadSchema,
  DeleteAttachmentSchema,
  GetDownloadUrlSchema,
  GetSignedDisplayUrlSchema,
  RequestUploadSchema,
} from "../../lib/validations/attachment";

const VALID_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

// ---------------------------------------------------------------------------
// RequestUploadSchema
// ---------------------------------------------------------------------------

describe.skip("RequestUploadSchema", () => {
  it("accepts a valid upload request", () => {
    const result = RequestUploadSchema.safeParse({
      taskId: VALID_UUID,
      filename: "document.pdf",
      sizeBytes: 1024,
      mimeType: "application/pdf",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an upload request with optional commentId", () => {
    const result = RequestUploadSchema.safeParse({
      taskId: VALID_UUID,
      filename: "image.png",
      sizeBytes: 512,
      mimeType: "image/png",
      commentId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an oversized file (> 50 MB)", () => {
    const result = RequestUploadSchema.safeParse({
      taskId: VALID_UUID,
      filename: "huge.zip",
      sizeBytes: 52_428_801, // 50 MB + 1 byte
      mimeType: "application/zip",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("sizeBytes");
  });

  it("rejects zero sizeBytes", () => {
    const result = RequestUploadSchema.safeParse({
      taskId: VALID_UUID,
      filename: "empty.txt",
      sizeBytes: 0,
      mimeType: "text/plain",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("sizeBytes");
  });

  it("rejects a disallowed MIME type", () => {
    const result = RequestUploadSchema.safeParse({
      taskId: VALID_UUID,
      filename: "script.js",
      sizeBytes: 100,
      mimeType: "application/javascript",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("mimeType");
  });

  it("rejects an invalid taskId (not a UUID)", () => {
    const result = RequestUploadSchema.safeParse({
      taskId: "not-a-uuid",
      filename: "file.txt",
      sizeBytes: 100,
      mimeType: "text/plain",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("taskId");
  });

  it("rejects an empty filename", () => {
    const result = RequestUploadSchema.safeParse({
      taskId: VALID_UUID,
      filename: "",
      sizeBytes: 100,
      mimeType: "text/plain",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("filename");
  });

  it("rejects a filename over 255 chars", () => {
    const result = RequestUploadSchema.safeParse({
      taskId: VALID_UUID,
      filename: "a".repeat(256),
      sizeBytes: 100,
      mimeType: "text/plain",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("filename");
  });

  it("rejects an invalid commentId (not a UUID)", () => {
    const result = RequestUploadSchema.safeParse({
      taskId: VALID_UUID,
      filename: "file.txt",
      sizeBytes: 100,
      mimeType: "text/plain",
      commentId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("commentId");
  });

  it("accepts exactly 50 MB (boundary — at the limit)", () => {
    const result = RequestUploadSchema.safeParse({
      taskId: VALID_UUID,
      filename: "max.zip",
      sizeBytes: 52_428_800,
      mimeType: "application/zip",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all allowed MIME types", () => {
    const mimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
    ] as const;

    for (const mimeType of mimes) {
      const result = RequestUploadSchema.safeParse({
        taskId: VALID_UUID,
        filename: "file",
        sizeBytes: 100,
        mimeType,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// ConfirmUploadSchema
// ---------------------------------------------------------------------------

describe.skip("ConfirmUploadSchema", () => {
  it("accepts a valid UUID", () => {
    const result = ConfirmUploadSchema.safeParse({ attachmentId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    const result = ConfirmUploadSchema.safeParse({ attachmentId: "bad-id" });
    expect(result.success).toBe(false);
  });

  it("rejects missing attachmentId", () => {
    const result = ConfirmUploadSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DeleteAttachmentSchema
// ---------------------------------------------------------------------------

describe.skip("DeleteAttachmentSchema", () => {
  it("accepts a valid UUID", () => {
    const result = DeleteAttachmentSchema.safeParse({ attachmentId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID string", () => {
    const result = DeleteAttachmentSchema.safeParse({ attachmentId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GetDownloadUrlSchema
// ---------------------------------------------------------------------------

describe.skip("GetDownloadUrlSchema", () => {
  it("accepts a valid UUID", () => {
    const result = GetDownloadUrlSchema.safeParse({ attachmentId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("rejects missing attachmentId", () => {
    const result = GetDownloadUrlSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GetSignedDisplayUrlSchema
// ---------------------------------------------------------------------------

describe.skip("GetSignedDisplayUrlSchema", () => {
  it("accepts a request without transform", () => {
    const result = GetSignedDisplayUrlSchema.safeParse({ attachmentId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("accepts a request with a valid transform", () => {
    const result = GetSignedDisplayUrlSchema.safeParse({
      attachmentId: VALID_UUID,
      transform: { width: 400 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects transform.width below 1", () => {
    const result = GetSignedDisplayUrlSchema.safeParse({
      attachmentId: VALID_UUID,
      transform: { width: 0 },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("width");
  });

  it("rejects transform.width above 2000", () => {
    const result = GetSignedDisplayUrlSchema.safeParse({
      attachmentId: VALID_UUID,
      transform: { width: 2001 },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toContain("width");
  });

  it("rejects a non-UUID attachmentId", () => {
    const result = GetSignedDisplayUrlSchema.safeParse({ attachmentId: "bad" });
    expect(result.success).toBe(false);
  });
});
