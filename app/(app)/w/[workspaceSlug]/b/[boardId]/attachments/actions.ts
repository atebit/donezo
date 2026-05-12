"use server";
/**
 * Attachment server actions — requestUpload, confirmUpload, deleteAttachment,
 * getDownloadUrl, getSignedDisplayUrl.
 *
 * THIS IS A TYPE STUB created by Slice D so that TypeScript resolves the import.
 * Slice B will replace this file with the real implementation.
 *
 * The stub exports type-correct async function signatures so that:
 *   1. TypeScript can check callers in Slice D's files.
 *   2. Runtime calls are never made from Slice D (all UI code is guarded by user actions).
 */
import type { ActionResult } from "@/lib/actions";
import type { Database } from "@/lib/supabase/types";

type AttachmentRow = Database["public"]["Tables"]["attachment"]["Row"];

// ---------------------------------------------------------------------------
// Input / output types (mirrors Slice B's schema-derived types)
// ---------------------------------------------------------------------------

export type RequestUploadInput = {
  taskId: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  commentId?: string | undefined;
};

export type RequestUploadData = {
  attachmentId: string;
  storagePath: string;
  signedUrl: string;
  token: string;
  expiresInSeconds: number;
};

export type GetSignedDisplayUrlInput = {
  attachmentId: string;
  transform?: { width: number } | undefined;
};

export type GetSignedDisplayUrlData = {
  url: string;
  expiresInSeconds: number;
  attachmentId: string;
};

export type GetDownloadUrlInput = {
  attachmentId: string;
};

export type GetDownloadUrlData = {
  url: string;
  expiresInSeconds: number;
};

export type DeleteAttachmentInput = {
  attachmentId: string;
};

export type ConfirmUploadInput = {
  attachmentId: string;
};

// ---------------------------------------------------------------------------
// Stub implementations — throw at runtime so nothing accidentally calls them
// ---------------------------------------------------------------------------

export async function requestUpload(
  _input: RequestUploadInput,
): Promise<ActionResult<RequestUploadData>> {
  throw new Error("requestUpload: Slice B stub — not yet implemented");
}

export async function confirmUpload(
  _input: ConfirmUploadInput,
): Promise<ActionResult<AttachmentRow>> {
  throw new Error("confirmUpload: Slice B stub — not yet implemented");
}

export async function getSignedDisplayUrl(
  _input: GetSignedDisplayUrlInput,
): Promise<ActionResult<GetSignedDisplayUrlData>> {
  throw new Error("getSignedDisplayUrl: Slice B stub — not yet implemented");
}

export async function getDownloadUrl(
  _input: GetDownloadUrlInput,
): Promise<ActionResult<GetDownloadUrlData>> {
  throw new Error("getDownloadUrl: Slice B stub — not yet implemented");
}

export async function deleteAttachment(
  _input: DeleteAttachmentInput,
): Promise<ActionResult<{ ok: true }>> {
  throw new Error("deleteAttachment: Slice B stub — not yet implemented");
}
