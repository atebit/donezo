"use client";

/**
 * FormBuilder — two-pane config editor for the form view.
 *
 * Layout:
 *   Left pane:  checklist of all columns on the board.
 *               Toggling a column adds/removes it from the form's `fields` list.
 *   Right pane: per-field settings for the selected field:
 *               - required toggle
 *               - label override
 *               - help text
 *               - default value (label text only — actual value editing deferred)
 *
 * Persistence:
 *   Calls `useBoardView().applyDraft({ form: { ...current, fields: [...] } })`
 *   which debounces 200ms and encodes to URL + store draft.
 *
 * Reached via: the "Configure form" menu item in <ViewTabDropdown> when
 * `view.kind === 'form'`.
 *
 * Epic 12, Slice F — F.4.
 */

import { Settings2, X } from "lucide-react";
import { useState } from "react";
import type { z } from "zod";
import { useShallow } from "zustand/react/shallow";
import { useBoard } from "@/hooks/use-board";
import { useBoardView } from "@/hooks/use-board-view";
import { cn } from "@/lib/utils";
import type { FormConfig, FormFieldSchema } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";

type FormFieldConfig = z.infer<typeof FormFieldSchema>;

interface FormBuilderProps {
  onClose: () => void;
}

export function FormBuilder({ onClose }: FormBuilderProps) {
  // useBoard provides board context; currently unused in this component
  // but kept so child components can rely on the context being available.
  useBoard();

  // ---------------------------------------------------------------------------
  // Columns from store.
  // ---------------------------------------------------------------------------
  const columns = useBoardStore(useShallow((s) => s.columns));

  // ---------------------------------------------------------------------------
  // Active form config.
  // ---------------------------------------------------------------------------
  const { effective, applyDraft } = useBoardView();

  const formConfig: FormConfig = effective.form ?? {
    targetGroupId: null,
    fields: [],
    submitLabel: "Submit",
    successMessage: "Submitted!",
  };

  const fields: FormFieldConfig[] = formConfig.fields ?? [];
  const fieldMap = new Map(fields.map((f) => [f.columnId, f]));

  // ---------------------------------------------------------------------------
  // Selected column for right-pane editing.
  // ---------------------------------------------------------------------------
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(
    fields[0]?.columnId ?? null,
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const updateFormConfig = (patch: Partial<FormConfig>) => {
    applyDraft({ form: { ...formConfig, ...patch } });
  };

  const toggleField = (columnId: string) => {
    const existing = fieldMap.get(columnId);
    let next: FormFieldConfig[];
    if (existing) {
      // Remove field.
      next = fields.filter((f) => f.columnId !== columnId);
      if (selectedColumnId === columnId) {
        setSelectedColumnId(next[0]?.columnId ?? null);
      }
    } else {
      // Add field at end.
      const newField: FormFieldConfig = {
        columnId,
        required: false,
        labelOverride: undefined,
        helpText: undefined,
        defaultValue: undefined,
      };
      next = [...fields, newField];
      setSelectedColumnId(columnId);
    }
    updateFormConfig({ fields: next });
  };

  const updateField = (columnId: string, patch: Partial<FormFieldConfig>) => {
    const next = fields.map((f) => (f.columnId === columnId ? { ...f, ...patch } : f));
    updateFormConfig({ fields: next });
  };

  const selectedField = selectedColumnId ? fieldMap.get(selectedColumnId) : null;
  const selectedColumn = selectedColumnId ? columns.find((c) => c.id === selectedColumnId) : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-[600px] border-l border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] shadow-xl"
      role="dialog"
      aria-label="Configure form"
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-[color:var(--color-border-strong)]">
        <div className="flex items-center gap-2">
          <Settings2 size={16} aria-hidden="true" className="text-[color:var(--color-fg-muted)]" />
          <h2 className="text-sm font-semibold text-[color:var(--color-fg)]">Configure form</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close form builder"
          className="flex items-center justify-center h-7 w-7 rounded hover:bg-[color:var(--color-surface-hover)] text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] transition-colors"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Two-pane body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left pane — column checklist */}
        <div className="w-56 flex-shrink-0 border-r border-[color:var(--color-border-strong)] overflow-y-auto py-2">
          <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[color:var(--color-fg-muted)]">
            Fields
          </p>
          {columns.length === 0 && (
            <p className="px-3 py-2 text-xs text-[color:var(--color-fg-muted)]">
              No columns on this board.
            </p>
          )}
          {columns.map((col) => {
            const isEnabled = fieldMap.has(col.id);
            const isSelected = selectedColumnId === col.id;

            return (
              <div
                key={col.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none",
                  "text-sm text-[color:var(--color-fg)]",
                  "hover:bg-[color:var(--color-surface-hover)]",
                  isSelected && "bg-[color:var(--color-surface-hover)]",
                )}
              >
                <input
                  id={`field-toggle-${col.id}`}
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => {
                    if (!isEnabled) {
                      toggleField(col.id);
                    } else {
                      // When already enabled, clicking the checkbox row selects
                      // it for editing; use "Remove field" to disable.
                      setSelectedColumnId(col.id);
                    }
                  }}
                  aria-label={`Include ${col.name}`}
                  className="h-3.5 w-3.5 rounded accent-[color:var(--color-primary)] cursor-pointer"
                />
                <label
                  htmlFor={`field-toggle-${col.id}`}
                  className="truncate flex-1 cursor-pointer"
                >
                  {col.name}
                </label>
              </div>
            );
          })}
        </div>

        {/* Right pane — per-field settings */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedField || !selectedColumn ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <p className="text-sm text-[color:var(--color-fg-muted)]">
                {fields.length === 0
                  ? "Enable fields on the left to configure them."
                  : "Select a field on the left to configure it."}
              </p>
            </div>
          ) : (
            // selectedField and selectedColumn are both defined here (ternary guard above).
            // Capture activeId as a string for type-safe handler callbacks.
            (() => {
              const activeId = selectedColumnId as string;
              return (
                <div className="flex flex-col gap-4 max-w-sm">
                  <h3 className="text-sm font-semibold text-[color:var(--color-fg)]">
                    {selectedColumn.name}
                  </h3>

                  {/* Required toggle */}
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedField.required ?? false}
                      onChange={(e) => updateField(activeId, { required: e.target.checked })}
                      className="h-4 w-4 rounded accent-[color:var(--color-primary)]"
                      aria-label="Required field"
                    />
                    <span className="text-sm text-[color:var(--color-fg)]">Required</span>
                  </label>

                  {/* Label override */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`label-override-${activeId}`}
                      className="text-xs font-medium text-[color:var(--color-fg-muted)]"
                    >
                      Label override
                    </label>
                    <input
                      id={`label-override-${activeId}`}
                      type="text"
                      value={selectedField.labelOverride ?? ""}
                      onChange={(e) =>
                        updateField(activeId, {
                          labelOverride: e.target.value || undefined,
                        })
                      }
                      placeholder={selectedColumn.name}
                      className="h-9 px-3 text-sm rounded border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] text-[color:var(--color-fg)] outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)] w-full"
                      style={{ borderRadius: "4px", padding: "8px 12px" }}
                    />
                  </div>

                  {/* Help text */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`help-text-${activeId}`}
                      className="text-xs font-medium text-[color:var(--color-fg-muted)]"
                    >
                      Help text
                    </label>
                    <textarea
                      id={`help-text-${activeId}`}
                      value={selectedField.helpText ?? ""}
                      onChange={(e) =>
                        updateField(activeId, {
                          helpText: e.target.value || undefined,
                        })
                      }
                      placeholder="Optional description shown below the field"
                      rows={3}
                      className="px-3 py-2 text-sm rounded border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] text-[color:var(--color-fg)] outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)] w-full resize-none"
                      style={{ borderRadius: "4px" }}
                    />
                  </div>

                  {/* Remove from form */}
                  <div className="pt-2 border-t border-[color:var(--color-border-strong)]">
                    <button
                      type="button"
                      onClick={() => toggleField(activeId)}
                      className="text-xs text-[color:var(--color-danger,#ef4444)] hover:underline cursor-pointer"
                    >
                      Remove field from form
                    </button>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* Footer — global form settings */}
      <div className="border-t border-[color:var(--color-border-strong)] p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-fg-muted)]">
          Form settings
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:gap-4">
          {/* Submit label */}
          <div className="flex flex-col gap-1 flex-1">
            <label
              htmlFor="form-submit-label"
              className="text-xs font-medium text-[color:var(--color-fg-muted)]"
            >
              Submit button label
            </label>
            <input
              id="form-submit-label"
              type="text"
              value={formConfig.submitLabel ?? "Submit"}
              onChange={(e) => updateFormConfig({ submitLabel: e.target.value || "Submit" })}
              className="h-8 w-full px-2 text-sm rounded border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] text-[color:var(--color-fg)] outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]"
              style={{ borderRadius: "4px" }}
            />
          </div>

          {/* Success message */}
          <div className="flex flex-col gap-1 flex-1">
            <label
              htmlFor="form-success-message"
              className="text-xs font-medium text-[color:var(--color-fg-muted)]"
            >
              Success message
            </label>
            <input
              id="form-success-message"
              type="text"
              value={formConfig.successMessage ?? "Submitted!"}
              onChange={(e) => updateFormConfig({ successMessage: e.target.value || "Submitted!" })}
              className="h-8 w-full px-2 text-sm rounded border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] text-[color:var(--color-fg)] outline-none focus:border-[color:var(--color-primary)] focus:ring-1 focus:ring-[color:var(--color-primary)]"
              style={{ borderRadius: "4px" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
