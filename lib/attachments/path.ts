/**
 * Storage path helpers for the attachments pipeline.
 *
 * Path layout: `<boardId>/<taskId>/<attachmentId>/<sanitized-filename>`
 * This matches the bucket RLS policies in the storage migrations (first segment = boardId).
 */

/**
 * Sanitize a filename for use in a storage path.
 *
 * Steps:
 * 1. NFC-normalize the string.
 * 2. Replace whitespace runs with `_`.
 * 3. Strip control characters (U+0000–U+001F, U+007F–U+009F).
 * 4. Restrict to `[a-zA-Z0-9._-]` — strip anything else.
 * 5. Collapse runs of `_` down to a single `_`.
 * 6. Preserve the extension (last `.`-segment if non-empty).
 * 7. Fall back to `"file"` (plus extension if any) when the base collapses to empty.
 *
 * The original display filename is stored in the DB `filename` column separately.
 */
export function sanitizeFilename(name: string): string {
  // Split off extension before sanitizing
  const dotIndex = name.lastIndexOf(".");
  let base: string;
  let ext: string;

  if (dotIndex > 0 && dotIndex < name.length - 1) {
    base = name.slice(0, dotIndex);
    ext = name.slice(dotIndex); // includes the dot
  } else {
    base = name;
    ext = "";
  }

  // 1. NFC-normalize
  base = base.normalize("NFC");
  ext = ext.normalize("NFC");

  // 2. Replace whitespace runs with _
  base = base.replace(/\s+/g, "_");

  // 3 & 4. Strip control chars and restrict to [a-zA-Z0-9._-]
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char strip
  base = base.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
  base = base.replace(/[^a-zA-Z0-9._-]/g, "");

  // 5. Collapse runs of _ to single _
  base = base.replace(/_+/g, "_");

  // Trim leading/trailing _ and . that may be left after stripping
  base = base.replace(/^[_.]+|[_.]+$/g, "");

  // Sanitize extension the same way (strip anything that shouldn't be there)
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control-char strip
  ext = ext.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
  ext = ext.replace(/[^.a-zA-Z0-9_-]/g, "");

  // 7. Fall back to "file" if base is entirely empty after sanitization
  if (!base) {
    base = "file";
  }

  return base + ext;
}

/**
 * Build the canonical storage object path for an attachment.
 *
 * Returns `<boardId>/<taskId>/<attachmentId>/<sanitized-filename>`.
 * The first path segment (boardId) is what storage RLS uses to authorize access.
 */
export function buildStoragePath({
  boardId,
  taskId,
  attachmentId,
  filename,
}: {
  boardId: string;
  taskId: string;
  attachmentId: string;
  filename: string;
}): string {
  const safe = sanitizeFilename(filename);
  return `${boardId}/${taskId}/${attachmentId}/${safe}`;
}
