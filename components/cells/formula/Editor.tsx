"use client";

/**
 * FormulaEditor — edit-mode renderer for the "formula" cell type.
 *
 * Formula columns are a stub in v1 — editing is not supported.
 * This re-exports ReadOnlyPlaceholder which immediately calls onClose(),
 * so the orchestrator (S15) transitions back to read-mode without rendering
 * any editor UI.
 */

export { ReadOnlyPlaceholder as Editor } from "@/components/cells/_shared/ReadOnlyPlaceholder";
