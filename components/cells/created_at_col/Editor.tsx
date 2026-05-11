"use client";

/**
 * CreatedAtColEditor — no-op editor for the derived "created_at_col" cell type.
 *
 * The orchestrator (S15) should never open this for derived types, but the
 * CellTypeDef contract requires an Editor export. Immediately calls onClose.
 */

import { ReadOnlyPlaceholder } from "@/components/cells/_shared/ReadOnlyPlaceholder";

import type { CreatedAtColValue } from "./def";

interface CreatedAtColEditorProps {
  value: CreatedAtColValue | null;
  config: Record<string, never>;
  onChange: (next: CreatedAtColValue | null) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({
  onClose,
  value: _value,
  config: _config,
  onChange: _onChange,
}: CreatedAtColEditorProps) {
  return <ReadOnlyPlaceholder onClose={onClose} />;
}
