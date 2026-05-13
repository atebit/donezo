"use client";

/**
 * FormField — renders a single form field by dispatching to the cell type's
 * Editor component in compact mode.
 *
 * Contract:
 *   - Looks up the cell def from cellRegistry by column.type.
 *   - Renders <def.Editor value={...} config={column.settings} onChange={...} onClose={noop} />
 *     inside a labelled, bordered container.
 *   - Displays a required asterisk when field.required === true.
 *   - Displays optional help text below the field.
 */

import type { z } from "zod";
import { cellRegistry } from "@/lib/cells/registry";
import type { CellTypeId } from "@/lib/cells/types";
import type { FormFieldSchema } from "@/lib/views/config-schema";

type FormFieldConfig = z.infer<typeof FormFieldSchema>;

interface ColumnInfo {
  id: string;
  name: string;
  type: string;
  /** column.settings jsonb */
  // biome-ignore lint/suspicious/noExplicitAny: column settings vary per type
  settings: Record<string, any> | null;
}

interface FormFieldProps {
  field: FormFieldConfig;
  column: ColumnInfo;
  value: unknown;
  onChange: (columnId: string, value: unknown) => void;
}

export function FormField({ field, column, value, onChange }: FormFieldProps) {
  const label = field.labelOverride ?? column.name;

  // Look up the cell type definition.
  const def = cellRegistry[column.type as CellTypeId];

  // If the type is unknown (e.g. NOT_IMPLEMENTED proxy), render a plain text input fallback.
  let editorNode: React.ReactNode;
  try {
    const Editor = def.Editor;
    editorNode = (
      <Editor
        // biome-ignore lint/suspicious/noExplicitAny: value type is unknown at form-field level; each def validates at runtime
        value={value as any}
        config={(column.settings ?? {}) as never}
        // biome-ignore lint/suspicious/noExplicitAny: same rationale
        onChange={(next: any) => onChange(column.id, next)}
        onClose={() => {
          // onClose is a no-op in form context — the orchestrator pattern
          // (open/close popover) doesn't apply here.
        }}
      />
    );
  } catch {
    // Fallback: plain text input when editor is not implemented.
    editorNode = (
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(column.id, e.target.value)}
        placeholder={`Enter ${label.toLowerCase()}`}
        className="w-full h-9 px-3 text-sm rounded border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] text-[color:var(--color-fg)] outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]"
        aria-label={label}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row — uses <p> since the editor is a compound component without a
          predictable id; aria-label on the editor container provides screen reader
          context. */}
      <p className="flex items-center gap-1 text-sm font-medium text-[color:var(--color-fg)]">
        {label}
        {field.required && (
          <span className="text-[color:var(--color-danger,#ef4444)]" aria-hidden="true">
            *
          </span>
        )}
        {field.required && <span className="sr-only">(required)</span>}
      </p>

      {/* Editor container — fieldset removes default border/padding for consistent styling */}
      <fieldset
        className="rounded border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] overflow-hidden m-0 p-0"
        style={{ borderRadius: "4px" }}
        aria-label={label}
      >
        {editorNode}
      </fieldset>

      {/* Help text */}
      {field.helpText && (
        <p className="text-xs text-[color:var(--color-fg-muted)]">{field.helpText}</p>
      )}
    </div>
  );
}
