import { z } from "zod";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/attachments/constants";

/**
 * Schema for initiating an upload: server action validates before issuing a signed URL.
 */
export const RequestUploadSchema = z.object({
  taskId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  /** Optional: set when the upload is initiated from a comment composer / image-paste flow. */
  commentId: z.string().uuid().optional(),
});

/**
 * Schema for confirming a completed upload (flip `is_uploaded = true`).
 */
export const ConfirmUploadSchema = z.object({
  attachmentId: z.string().uuid(),
});

/**
 * Schema for deleting an attachment row and its storage object.
 */
export const DeleteAttachmentSchema = z.object({
  attachmentId: z.string().uuid(),
});

/**
 * Schema for generating a signed download URL (triggers browser download).
 */
export const GetDownloadUrlSchema = z.object({
  attachmentId: z.string().uuid(),
});

/**
 * Schema for generating a signed display URL (inline preview / thumbnail).
 * The optional `transform` is forwarded to the Supabase image-render endpoint.
 */
export const GetSignedDisplayUrlSchema = z.object({
  attachmentId: z.string().uuid(),
  /** Optional Supabase render transform — only used for image MIME types. */
  transform: z.object({ width: z.number().int().min(1).max(2000) }).optional(),
});

// ---------------------------------------------------------------------------
// Inferred input types
// ---------------------------------------------------------------------------

export type RequestUploadInput = z.infer<typeof RequestUploadSchema>;
export type ConfirmUploadInput = z.infer<typeof ConfirmUploadSchema>;
export type DeleteAttachmentInput = z.infer<typeof DeleteAttachmentSchema>;
export type GetDownloadUrlInput = z.infer<typeof GetDownloadUrlSchema>;
export type GetSignedDisplayUrlInput = z.infer<typeof GetSignedDisplayUrlSchema>;
