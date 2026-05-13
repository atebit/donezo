"use client";

/**
 * FormView — runtime renderer for the "form" view kind.
 *
 * Reads view.config.form.fields and renders one <FormField /> per configured
 * field. React Hook Form drives the form state; validation and submission are
 * handled client-side and then forwarded to the `submitForm` server action.
 *
 * Visual contract (Epic 12 § F.2):
 *   - Single-column form, max-width 640px, centred.
 *   - Input chrome: radius 4px, padding 8px 16px, focus border --color-primary.
 *
 * Empty states:
 *   - 0 fields configured → "Configure form fields from the view menu."
 *   - 0 groups on board → "Add a group to this board before accepting submissions."
 *
 * Epic 12, Slice F — F.2.
 */

import { useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { submitForm } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/form/actions";
import { useBoard } from "@/hooks/use-board";
import { useBoardView } from "@/hooks/use-board-view";
import { useBoardStore } from "@/stores/board-store";
import { FormField } from "./FormField";

export function FormView() {
  const { board } = useBoard();
  const boardId = board.id;

  // ---------------------------------------------------------------------------
  // Read groups and columns from the store (stable shallow selectors).
  // ---------------------------------------------------------------------------
  const { groups, columns } = useBoardStore(
    useShallow((s) => ({
      groups: s.groups,
      columns: s.columns,
    })),
  );

  // ---------------------------------------------------------------------------
  // Resolve form config from the active view.
  // ---------------------------------------------------------------------------
  const { active, effective } = useBoardView();
  const viewId = active?.id ?? null;

  // Parse form config from the effective config object.
  const formConfig = effective.form ?? {
    targetGroupId: null,
    fields: [],
    submitLabel: "Submit",
    successMessage: "Submitted!",
  };

  const configuredFields = formConfig.fields ?? [];
  const submitLabel = formConfig.submitLabel ?? "Submit";
  const successMessage = formConfig.successMessage ?? "Submitted!";

  // ---------------------------------------------------------------------------
  // Local form state (values keyed by columnId).
  // ---------------------------------------------------------------------------
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (columnId: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [columnId]: value }));
  };

  // ---------------------------------------------------------------------------
  // Validation helpers
  // ---------------------------------------------------------------------------

  // Build a column map for quick lookup.
  const columnMap = new Map(columns.map((c) => [c.id, c]));

  // Empty state checks.
  const liveGroups = groups.filter((g) => !g.deleted_at);
  const hasGroups = liveGroups.length > 0;
  const hasFields = configuredFields.length > 0;

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!viewId) {
      toast.error("No active view found.");
      return;
    }

    // Client-side required field check.
    const missingRequired = configuredFields.filter((field) => {
      if (!field.required) return false;
      const val = values[field.columnId];
      return val === null || val === undefined || val === "";
    });

    if (missingRequired.length > 0) {
      const firstMissing = missingRequired[0];
      const col = firstMissing ? columnMap.get(firstMissing.columnId) : undefined;
      const label = firstMissing?.labelOverride ?? col?.name ?? "A required field";
      toast.error(`"${label}" is required.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const valuesArray = Object.entries(values)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([columnId, value]) => ({ columnId, value }));

      const result = await submitForm({
        boardId,
        viewId,
        values: valuesArray,
      });

      if (result.ok) {
        setSubmitted(true);
        setValues({});
        toast.success(successMessage);
      } else {
        toast.error(result.error.message ?? "Failed to submit form.");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setValues({});
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // No groups — error state.
  if (!hasGroups) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[40vh] gap-3 px-4 text-center">
        <p className="text-sm text-[color:var(--color-fg-muted)]">
          Add a group to this board before accepting submissions.
        </p>
      </div>
    );
  }

  // No fields configured — empty state.
  if (!hasFields) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[40vh] gap-3 px-4 text-center">
        <p className="text-sm text-[color:var(--color-fg-muted)]">
          Configure form fields from the view menu.
        </p>
      </div>
    );
  }

  // Success state after submit.
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[40vh] gap-4 px-4 text-center">
        <p className="text-base font-medium text-[color:var(--color-fg)]">{successMessage}</p>
        <button
          type="button"
          onClick={handleReset}
          className="h-9 px-4 text-sm rounded cursor-pointer bg-[color:var(--color-primary)] text-white hover:opacity-90 transition-opacity"
        >
          Submit another response
        </button>
      </div>
    );
  }

  // Main form.
  return (
    <div className="flex justify-center px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[640px] flex flex-col gap-6"
        aria-label="Form view"
        noValidate
      >
        {configuredFields.map((field) => {
          const column = columnMap.get(field.columnId);
          if (!column) return null; // column deleted — skip field

          return (
            <FormField
              key={field.columnId}
              field={field}
              column={{
                id: column.id,
                name: column.name,
                type: column.type,
                settings: column.settings as Record<string, unknown> | null,
              }}
              value={values[field.columnId] ?? null}
              onChange={handleChange}
            />
          );
        })}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-9 px-6 text-sm font-medium rounded cursor-pointer bg-[color:var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            style={{ borderRadius: "4px" }}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Submitting…" : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
