/**
 * Maps MIME types to Lucide icon components for file-type display.
 *
 * Returns a Lucide icon component suitable for use in thumbnails and tiles.
 * Import from lucide-react directly here because this module is the single
 * source of truth for mime-to-icon mapping and needs full icon coverage.
 */
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  File,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Image,
  Paperclip,
  Presentation,
} from "lucide-react";

/**
 * Returns the Lucide icon component appropriate for a given MIME type.
 * Falls back to the generic `Paperclip` icon for unknown types.
 */
export function getMimeIcon(mimeType: string): LucideIcon {
  if (mimeType.startsWith("image/")) {
    return Image;
  }
  if (mimeType.startsWith("video/")) {
    return FileVideo;
  }
  if (mimeType === "application/pdf") {
    return FileText;
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "text/plain" ||
    mimeType === "text/markdown"
  ) {
    return FileText;
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "text/csv"
  ) {
    return FileSpreadsheet;
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return Presentation;
  }
  if (mimeType === "application/zip") {
    return Archive;
  }
  if (mimeType.startsWith("text/")) {
    return FileCode;
  }
  if (mimeType.startsWith("application/")) {
    return File;
  }
  return Paperclip;
}

/**
 * Returns true if the MIME type is an image that can be previewed inline.
 * SVG is included — browsers render it natively; gif is animated.
 */
export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Returns true if the MIME type is a PDF document.
 */
export function isPdfMime(mimeType: string): boolean {
  return mimeType === "application/pdf";
}
