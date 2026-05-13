"use client";

/**
 * FormField — renders a single field in the form view.
 *
 * Dispatches to def.Editor per cell type. The editors were designed for
 * inline-table edit but their contract (value, config, onChange, onClose) is
 * general enough to work in a form context too.
 *
 * The board store is hydrated by the layout's <BoardDataProvider>, so editors
 * that read from the store (e.g., status labels) work correctly here.
 *
 * Visual contract (per Epic 12 spec — Form view input chrome):
 *   - Label: 13px, font-medium, --color-fg.
 *   - Required asterisk: red, inline after label.
 *   - Help text: 12px, --color-fg-muted.
 *   - Editor wrapper: radius 4px, border 1px --color-border, padding 8px 16px,
 *     focus-within border --color-primary (to match Epic 03 auth form chrome).
 */

import { getCellDef } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import type { Database } from "@/lib/supabase/types";

type Column = Database["public"]["Tables"]["column"]["Row"];

/**
 * Per-field config shape from FormConfigSchema.
 * Uses `string | undefined` (not just `string`) for optional fields to satisfy
 * exactOptionalPropertyTypes: false callers (Zod infers `T | undefined` for optional).
 */
export interface FormFieldConfig {
  columnId: string;
  required: boolean;
  labelOverride?: string | undefined;
  helpText?: string | undefined;
  defaultValue?: unknown;
}

interface FormFieldProps {
  /** Column metadata (name, type, settings). */
  column: Column;
  /** Per-field form config (required, labelOverride, helpText). */
  fieldConfig: FormFieldConfig;
  /** Current value for this field (controlled by RHF). */
  value: unknown;
  /** Called when the editor emits a new value. */
  onChange: (next: unknown) => void;
}

export function FormField({ column, fieldConfig, value, onChange }: FormFieldProps) {
  const def = getCellDef(column.type as CellTypeId);
  const label = fieldConfig.labelOverride ?? column.name;

  const handleClose = () => {
    // In form context, "close" just means the editor lost focus / was dismissed.
    // No-op — the value is already committed via onChange.
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Label row */}
      <label className="text-sm font-medium text-[color:var(--color-fg)] flex items-center gap-0.5">
        {label}
        {fieldConfig.required && (
          <span className="text-red-500 ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {/* Help text */}
      {fieldConfig.helpText && (
        <p className="text-xs text-[color:var(--color-fg-muted)]">{fieldConfig.helpText}</p>
      )}

      {/* Editor wrapper — styled to match Epic 03 auth form chrome */}
      <div
        className="
          rounded-[4px]
          border border-[color:var(--color-border)]
          px-4 py-2
          bg-[color:var(--color-surface)]
          focus-within:border-[color:var(--color-primary)]
          focus-within:ring-1 focus-within:ring-[color:var(--color-primary)]
          transition-colors duration-[var(--motion-fast)]
          min-h-[40px]
          flex items-start
        "
      >
        <div className="w-full">
          <def.Editor
            // biome-ignore lint/suspicious/noExplicitAny: CellTypeDef.Editor uses TValue generic; value is unknown at this level
            value={value as any}
            // biome-ignore lint/suspicious/noExplicitAny: column.settings is typed as Json in generated types; CellTypeDef.TConfig is the narrowed form
            config={column.settings as any}
            onChange={onChange}
            onClose={handleClose}
          />
        </div>
      </div>
    </div>
  );
}
