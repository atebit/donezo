"use client";

/**
 * StatusEditor — thin wrapper that renders <StatusLabelEditor />.
 *
 * This is the CellTypeDef.Editor for both "status" and "priority".
 * It re-exports the shared StatusLabelEditor as the Editor contract expects.
 *
 * Prop contract (CellTypeDef.Editor):
 *   { value, config, onChange, onClose }
 *
 * columnId and onEditLabels are optional extras that the orchestrator (S15)
 * will wire once it dispatches per-column context to editors.
 */

import type { StatusCellValue } from "./Cell";
import { StatusLabelEditor } from "./StatusLabelEditor";

interface StatusEditorProps {
  value: StatusCellValue | null;
  config: Record<string, never>;
  onChange: (next: StatusCellValue | null) => void;
  onClose: () => void;
  /** Passed by the orchestrator (S15) so the editor can look up labels. Optional
   *  for CellTypeDef.Editor type-compatibility; shows empty list when absent. */
  columnId?: string;
  /** Wired by S17 to open LabelEditorModal. */
  onEditLabels?: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Editor({
  value,
  config: _config,
  onChange,
  onClose,
  columnId,
  onEditLabels,
}: StatusEditorProps) {
  return (
    <StatusLabelEditor
      value={value}
      onChange={onChange}
      onClose={onClose}
      {...(columnId !== undefined ? { columnId } : {})}
      {...(onEditLabels !== undefined ? { onEditLabels } : {})}
    />
  );
}
