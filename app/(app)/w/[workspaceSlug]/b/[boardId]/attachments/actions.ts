"use server";

/**
 * Attachment server actions — requestUpload, confirmUpload, deleteAttachment,
 * getDownloadUrl, getSignedDisplayUrl.
 *
 * All actions:
 *   - Wrap `withUser` for authentication + error normalization.
 *   - Parse raw input via Zod schemas from `lib/validations/attachment.ts`.
 *   - Resolve boardId from the task / attachment record.
 *   - Mutate via the per-user Supabase client (RLS applies).
 *   - Log activity best-effort (never fails the parent action).
 *
 * Storage-delete note:
 *   `deleteAttachment` uses `adminClient()` to remove the storage object because
 *   the Storage DELETE RLS requires the uploader_id match OR board admin — routing
 *   through the admin client is the documented defensive path for server-side cleanup.
 */

import { withUser } from "@/lib/actions";
import { logActivity } from "@/lib/activity";
import {
  IMAGE_MIME_PREFIX,
  SIGNED_DISPLAY_URL_TTL_SECONDS,
  SIGNED_DOWNLOAD_URL_TTL_SECONDS,
  SIGNED_UPLOAD_URL_TTL_SECONDS,
} from "@/lib/attachments/constants";
import { buildStoragePath } from "@/lib/attachments/path";
import { storageObjectExists } from "@/lib/attachments/server";
import { requireBoardRole } from "@/lib/authorization";
import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: admin-delete of storage objects; no user-client path for cleanup.
import { adminClient } from "@/lib/supabase/admin";
import {
  ConfirmUploadSchema,
  DeleteAttachmentSchema,
  GetDownloadUrlSchema,
  GetSignedDisplayUrlSchema,
  RequestUploadSchema,
} from "@/lib/validations/attachment";

// ---------------------------------------------------------------------------
// requestUpload
// ---------------------------------------------------------------------------

/**
 * Step 1 of the two-stage upload pipeline.
 *
 * Validates the file metadata, inserts a pending `attachment` row (is_uploaded=false),
 * and returns a signed upload URL that the client uses to PUT the file directly to
 * Supabase Storage. No activity is logged until `confirmUpload` succeeds.
 */
export const requestUpload = withUser(async ({ supabase, userId }, raw) => {
  const input = RequestUploadSchema.parse(raw);

  // 1. Load task to get board_id; verify task exists and is not deleted.
  const { data: task, error: taskError } = await supabase
    .from("task")
    .select("id, board_id")
    .eq("id", input.taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (taskError) throw { code: "DB", message: taskError.message };
  if (!task) throw { code: "NOT_FOUND", message: "Task not found." };

  // 2. Require >= member on the board.
  await requireBoardRole(task.board_id, "member");

  // 3. If commentId provided, verify the comment exists on the same task.
  if (input.commentId) {
    const { data: comment, error: commentError } = await supabase
      .from("comment")
      .select("id, task_id")
      .eq("id", input.commentId)
      .maybeSingle();

    if (commentError) throw { code: "DB", message: commentError.message };
    if (!comment) throw { code: "NOT_FOUND", message: "Comment not found." };
    if (comment.task_id !== input.taskId) {
      throw { code: "VALIDATION", message: "Comment does not belong to this task." };
    }
  }

  // 4. Insert the attachment row.
  //    Postgres generates the UUID id via gen_random_uuid() (default).
  //    We do a two-step: insert first (Postgres picks the id), then build and update
  //    storage_path using the returned id so the path's <attachment_id> segment matches
  //    the DB row exactly. This follows the repo's no-client-uuid convention.
  const { data: inserted, error: insertError } = await supabase
    .from("attachment")
    .insert({
      task_id: input.taskId,
      board_id: task.board_id,
      comment_id: input.commentId ?? null,
      uploader_id: userId,
      storage_path: "_pending_", // placeholder; overwritten in the UPDATE below
      filename: input.filename,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      is_uploaded: false,
      scan_status: "skipped",
    })
    .select("id")
    .single();

  if (insertError) throw { code: "DB", message: insertError.message };
  if (!inserted) throw { code: "DB", message: "Attachment insert returned no row." };

  const attachmentId = inserted.id;
  const storagePath = buildStoragePath({
    boardId: task.board_id,
    taskId: input.taskId,
    attachmentId,
    filename: input.filename,
  });

  const { error: updateError } = await supabase
    .from("attachment")
    .update({ storage_path: storagePath })
    .eq("id", attachmentId);

  if (updateError) throw { code: "DB", message: updateError.message };

  // 5. Create a signed upload URL.
  const { data: urlData, error: urlError } = await supabase.storage
    .from("attachments")
    .createSignedUploadUrl(storagePath);

  if (urlError) throw { code: "STORAGE", message: urlError.message };
  if (!urlData) throw { code: "STORAGE", message: "Failed to create signed upload URL." };

  return {
    attachmentId,
    storagePath,
    signedUrl: urlData.signedUrl,
    token: urlData.token,
    expiresInSeconds: SIGNED_UPLOAD_URL_TTL_SECONDS,
  };
});

// ---------------------------------------------------------------------------
// confirmUpload
// ---------------------------------------------------------------------------

/**
 * Step 2 of the two-stage upload pipeline.
 *
 * Called after the client has PUT the file to the signed URL. Verifies the object
 * exists in Storage, flips `is_uploaded = true`, and logs an activity entry.
 */
export const confirmUpload = withUser(async ({ supabase, userId }, raw) => {
  const input = ConfirmUploadSchema.parse(raw);

  // 1. Load the attachment row.
  const { data: attachment, error: fetchError } = await supabase
    .from("attachment")
    .select("*")
    .eq("id", input.attachmentId)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!attachment) throw { code: "NOT_FOUND", message: "Attachment not found." };

  // 2. Only the uploader can confirm (defense-in-depth; RLS enforces read access).
  if (attachment.uploader_id !== userId) {
    throw { code: "FORBIDDEN", message: "Only the uploader can confirm this upload." };
  }

  // 3. Idempotent: already confirmed — return the row.
  if (attachment.is_uploaded) {
    return attachment;
  }

  // 4. HEAD-check: verify the storage object actually exists.
  const exists = await storageObjectExists(attachment.storage_path);
  if (!exists) {
    throw { code: "STORAGE_MISSING", message: "Upload did not complete." };
  }

  // 5. Flip is_uploaded = true.
  const { data: updated, error: updateError } = await supabase
    .from("attachment")
    .update({ is_uploaded: true })
    .eq("id", input.attachmentId)
    .select("*")
    .single();

  if (updateError) throw { code: "DB", message: updateError.message };
  if (!updated) throw { code: "DB", message: "Attachment not found after update." };

  // 6. Best-effort activity log.
  void logActivity({
    boardId: updated.board_id,
    taskId: updated.task_id,
    actorId: userId,
    type: "attachment.uploaded",
    payload: {
      attachmentId: updated.id,
      filename: updated.filename,
      mimeType: updated.mime_type,
      sizeBytes: updated.size_bytes,
      ...(updated.comment_id ? { viaCommentId: updated.comment_id } : {}),
    },
  });

  return updated;
});

// ---------------------------------------------------------------------------
// deleteAttachment
// ---------------------------------------------------------------------------

/**
 * Hard-delete an attachment: remove the storage object (via admin client, best-effort)
 * then delete the DB row (via user client, RLS enforces authority).
 */
export const deleteAttachment = withUser(async ({ supabase, userId: _userId }, raw) => {
  const input = DeleteAttachmentSchema.parse(raw);

  // 1. Load the row.
  const { data: attachment, error: fetchError } = await supabase
    .from("attachment")
    .select("*")
    .eq("id", input.attachmentId)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!attachment) throw { code: "NOT_FOUND", message: "Attachment not found." };
  if (!attachment.is_uploaded) {
    throw { code: "NOT_FOUND", message: "Attachment not found." };
  }

  // 2. Sanity check: at least a viewer on the board (RLS enforces the real auth check).
  await requireBoardRole(attachment.board_id, "viewer");

  // 3. Delete storage object via admin client (best-effort; proceed even on failure).
  const { error: storageError } = await adminClient()
    .storage.from("attachments")
    .remove([attachment.storage_path]);

  if (storageError) {
    logger.warn(
      { err: storageError, attachmentId: input.attachmentId, path: attachment.storage_path },
      "deleteAttachment: storage remove failed — proceeding with DB delete",
    );
  }

  // 4. Delete DB row via user client (RLS verifies uploader_id = userId OR board admin).
  const { error: deleteError } = await supabase
    .from("attachment")
    .delete()
    .eq("id", input.attachmentId);

  if (deleteError) throw { code: "DB", message: deleteError.message };

  // 5. Best-effort activity log.
  void logActivity({
    boardId: attachment.board_id,
    taskId: attachment.task_id,
    actorId: _userId,
    type: "attachment.deleted",
    payload: {
      attachmentId: attachment.id,
      filename: attachment.filename,
    },
  });

  return { ok: true as const };
});

// ---------------------------------------------------------------------------
// getDownloadUrl
// ---------------------------------------------------------------------------

/**
 * Generate a signed download URL (triggers browser download with Content-Disposition: attachment).
 */
export const getDownloadUrl = withUser(async ({ supabase }, raw) => {
  const input = GetDownloadUrlSchema.parse(raw);

  // 1. Load the row.
  const { data: attachment, error: fetchError } = await supabase
    .from("attachment")
    .select("id, storage_path, filename, board_id")
    .eq("id", input.attachmentId)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!attachment) throw { code: "NOT_FOUND", message: "Attachment not found." };

  // 2. Create signed download URL.
  const { data: urlData, error: urlError } = await supabase.storage
    .from("attachments")
    .createSignedUrl(attachment.storage_path, SIGNED_DOWNLOAD_URL_TTL_SECONDS, {
      download: attachment.filename,
    });

  if (urlError) throw { code: "STORAGE", message: urlError.message };
  if (!urlData?.signedUrl) throw { code: "STORAGE", message: "Failed to create download URL." };

  return {
    url: urlData.signedUrl,
    expiresInSeconds: SIGNED_DOWNLOAD_URL_TTL_SECONDS,
  };
});

// ---------------------------------------------------------------------------
// getSignedDisplayUrl
// ---------------------------------------------------------------------------

/**
 * Generate a signed display URL for inline preview or thumbnail.
 *
 * When `transform` is provided AND the attachment is an image MIME type,
 * the Supabase image-render endpoint is used (applies width transform).
 * For non-image types, a plain signed URL is returned.
 */
export const getSignedDisplayUrl = withUser(async ({ supabase }, raw) => {
  const input = GetSignedDisplayUrlSchema.parse(raw);

  // 1. Load the row.
  const { data: attachment, error: fetchError } = await supabase
    .from("attachment")
    .select("id, storage_path, filename, mime_type, board_id")
    .eq("id", input.attachmentId)
    .maybeSingle();

  if (fetchError) throw { code: "DB", message: fetchError.message };
  if (!attachment) throw { code: "NOT_FOUND", message: "Attachment not found." };

  const isImage = attachment.mime_type.startsWith(IMAGE_MIME_PREFIX);

  // 2. Create signed URL — with transform only for images.
  const { data: urlData, error: urlError } =
    input.transform && isImage
      ? await supabase.storage
          .from("attachments")
          .createSignedUrl(attachment.storage_path, SIGNED_DISPLAY_URL_TTL_SECONDS, {
            transform: { width: input.transform.width },
          })
      : await supabase.storage
          .from("attachments")
          .createSignedUrl(attachment.storage_path, SIGNED_DISPLAY_URL_TTL_SECONDS);

  if (urlError) throw { code: "STORAGE", message: urlError.message };
  if (!urlData?.signedUrl) throw { code: "STORAGE", message: "Failed to create display URL." };

  return {
    url: urlData.signedUrl,
    expiresInSeconds: SIGNED_DISPLAY_URL_TTL_SECONDS,
    attachmentId: attachment.id,
  };
});
