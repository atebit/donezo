"use client";

/**
 * FormBuilder — config editor for the form view.
 *
 * Reached via the inline "Configure fields" button in <FormView /> when the
 * user has editor (member+) role. Two-pane layout:
 *   - Left pane: checklist of all board columns; toggling adds/removes fields.
 *   - Right pane: per-field settings for the selected field (required, label
 *     override, help text).
 *
 * Saves via useBoardView().applyDraft({ form: { ...current, fields: [...] } }).
 *
 * This component does NOT touch <ViewTabDropdown>. Per the dispatch plan
 * gotcha #6, it is rendered inline from <FormView /> via an inline
 * "Configure fields" button when role >= member.
 */

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useBoard } from "@/hooks/use-board";
import { useBoardView } from "@/hooks/use-board-view";
import { ROLE_RANK } from "@/lib/authorization";
import type { FormConfig } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";

interface FormBuilderProps {
  formConfig: FormConfig;
}

export function FormBuilder({ formConfig }: FormBuilderProps) {
  const { role } = useBoard();
  const { applyDraft, effective } = useBoardView();
  const columns = useBoardStore(useShallow((s) => s.columns));

  // Which column is selected in the right pane.
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(
    formConfig.fields[0]?.columnId ?? null,
  );

  // Is a given column currently in the fields list?
  const isFieldEnabled = (columnId: string) =>
    formConfig.fields.some((f) => f.columnId === columnId);

  // Toggle a column into / out of the fields list.
  const toggleField = (columnId: string) => {
    const currentFields = formConfig.fields;
    if (isFieldEnabled(columnId)) {
      const next = currentFields.filter((f) => f.columnId !== columnId);
      saveFields(next);
      if (selectedColumnId === columnId) {
        setSelectedColumnId(next[0]?.columnId ?? null);
      }
    } else {
      const next = [
        ...currentFields,
        { columnId, required: false, labelOverride: undefined, helpText: undefined },
      ];
      saveFields(next);
      setSelectedColumnId(columnId);
    }
  };

  // Update a field's settings.
  const updateField = (
    columnId: string,
    patch: { required?: boolean; labelOverride?: string | undefined; helpText?: string | undefined },
  ) => {
    const next = formConfig.fields.map((f) =>
      f.columnId === columnId ? { ...f, ...patch } : f,
    );
    saveFields(next);
  };

  const saveFields = (fields: FormConfig["fields"]) => {
    // Merge into the current form config, falling back to defaults for missing fields.
    const current: FormConfig = effective.form ?? {
      targetGroupId: null,
      fields: [],
      submitLabel: "Submit",
      successMessage: "Submitted!",
    };
    applyDraft({ form: { ...current, fields } });
  };

  const selectedField = formConfig.fields.find((f) => f.columnId === selectedColumnId);
  const selectedColumn = columns.find((c) => c.id === selectedColumnId);

  // Only member+ can edit. Viewers see the form render, not the builder.
  if (ROLE_RANK[role] < ROLE_RANK["member"]) {
    return null;
  }

  return (
    <div className="border border-[color:var(--color-border)] rounded-lg overflow-hidden bg-[color:var(--color-surface)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-rail)]">
        <h2 className="text-sm font-semibold text-[color:var(--color-fg)]">Configure form fields</h2>
      </div>

      <div className="flex min-h-0" style={{ minHeight: 320 }}>
        {/* Left pane — column checklist */}
        <div className="w-56 border-r border-[color:var(--color-border)] flex flex-col overflow-y-auto">
          <p className="px-3 py-2 text-xs text-[color:var(--color-fg-muted)] font-medium uppercase tracking-wide">
            Columns
          </p>
          {columns.map((col) => {
            const enabled = isFieldEnabled(col.id);
            return (
              <div
                key={col.id}
                className={`
                  flex items-center gap-2 px-3 py-2 cursor-pointer select-none
                  hover:bg-[color:var(--color-surface-hover)]
                  transition-colors duration-[var(--motion-fast)]
                  ${selectedColumnId === col.id ? "bg-[color:var(--color-surface-info)]" : ""}
                `}
                onClick={() => {
                  if (enabled) setSelectedColumnId(col.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") toggleField(col.id);
                }}
                role="button"
                tabIndex={0}
                aria-pressed={enabled}
              >
                {/* Toggle checkbox */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleField(col.id);
                  }}
                  className={`
                    flex-shrink-0 w-4 h-4 rounded border
                    ${enabled
                      ? "bg-[color:var(--color-primary)] border-[color:var(--color-primary)]"
                      : "bg-white border-[color:var(--color-border-strong)]"}
                    flex items-center justify-center
                    transition-colors duration-[var(--motion-fast)]
                  `}
                  aria-label={`${enabled ? "Remove" : "Add"} ${col.name}`}
                >
                  {enabled && (
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="none"
                      viewBox="0 0 12 12"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    >
                      <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <span
                  className={`text-sm truncate ${
                    enabled
                      ? "text-[color:var(--color-fg)]"
                      : "text-[color:var(--color-fg-muted)]"
                  }`}
                >
                  {col.name}
                </span>
              </div>
            );
          })}
          {columns.length === 0 && (
            <p className="px-3 py-4 text-xs text-[color:var(--color-fg-muted)] italic">
              No columns on this board.
            </p>
          )}
        </div>

        {/* Right pane — per-field settings */}
        <div className="flex-1 p-4">
          {selectedField && selectedColumn ? (
            <div className="flex flex-col gap-4 max-w-xs">
              <h3 className="text-sm font-semibold text-[color:var(--color-fg)]">
                {selectedColumn.name} settings
              </h3>

              {/* Required toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedField.required}
                  onChange={(e) =>
                    updateField(selectedColumnId!, { required: e.target.checked })
                  }
                  className="accent-[color:var(--color-primary)] w-4 h-4"
                />
                <span className="text-sm text-[color:var(--color-fg)]">Required</span>
              </label>

              {/* Label override */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[color:var(--color-fg-muted)]">
                  Label override
                </label>
                <input
                  type="text"
                  placeholder={selectedColumn.name}
                  value={selectedField.labelOverride ?? ""}
                  onChange={(e) =>
                    updateField(selectedColumnId!, {
                      labelOverride: e.target.value || undefined,
                    })
                  }
                  className="
                    h-8 px-3 text-sm rounded-[4px]
                    border border-[color:var(--color-border)]
                    focus:border-[color:var(--color-primary)]
                    focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]
                    bg-[color:var(--color-surface)] text-[color:var(--color-fg)]
                    placeholder:text-[color:var(--color-fg-muted)]
                  "
                />
              </div>

              {/* Help text */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[color:var(--color-fg-muted)]">
                  Help text
                </label>
                <input
                  type="text"
                  placeholder="Shown below the field label"
                  value={selectedField.helpText ?? ""}
                  onChange={(e) =>
                    updateField(selectedColumnId!, {
                      helpText: e.target.value || undefined,
                    })
                  }
                  className="
                    h-8 px-3 text-sm rounded-[4px]
                    border border-[color:var(--color-border)]
                    focus:border-[color:var(--color-primary)]
                    focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]
                    bg-[color:var(--color-surface)] text-[color:var(--color-fg)]
                    placeholder:text-[color:var(--color-fg-muted)]
                  "
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-[color:var(--color-fg-muted)]">
                {formConfig.fields.length === 0
                  ? "Toggle columns on the left to add fields."
                  : "Select a field on the left to edit its settings."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
