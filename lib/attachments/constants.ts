/**
 * Attachment upload constants — single source of truth for client and server.
 * Must mirror the `attachments` bucket configuration in storage migrations.
 *
 * THIS IS A TYPE STUB created by Slice D. Slice B owns this file and will
 * replace it with the real implementation.
 */

export const MAX_FILE_SIZE_BYTES = 52_428_800; // 50 MB; must match bucket file_size_limit

export const ALLOWED_MIME_TYPES = [
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

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Seconds a signed upload URL remains valid (10 minutes). */
export const SIGNED_UPLOAD_URL_TTL_SECONDS = 600;

/** Seconds a signed display URL remains valid (5 minutes). */
export const SIGNED_DISPLAY_URL_TTL_SECONDS = 300;

/** Seconds a signed download URL remains valid (5 minutes). */
export const SIGNED_DOWNLOAD_URL_TTL_SECONDS = 300;

/** MIME type prefix for images — used to decide whether transform options apply. */
export const IMAGE_MIME_PREFIX = "image/";
