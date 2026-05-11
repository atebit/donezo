"use client";

/**
 * CreatedByEditor — no-op editor for the derived "created_by" cell type.
 *
 * The orchestrator (S15) should never open this for derived types, but the
 * CellTypeDef contract requires an Editor export. Immediately calls onClose.
 */

import { ReadOnlyPlaceholder } from "@/components/cells/_shared/ReadOnlyPlaceholder";

import type { CreatedByValue } from "./def";

interface CreatedByEditorProps {
  value: CreatedByValue | null;
  config: Record<string, never>;
  onChange: (next: CreatedByValue | null) => void;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({
  onClose,
  value: _value,
  config: _config,
  onChange: _onChange,
}: CreatedByEditorProps) {
  return <ReadOnlyPlaceholder onClose={onClose} />;
}
