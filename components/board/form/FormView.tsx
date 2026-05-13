"use client";

/**
 * FormView — runtime renderer for the form view.
 *
 * Reads view.config.form.fields and renders one <FormField /> per field.
 * React Hook Form drives form state; Zod validates on submit.
 * Submit calls the `submitForm` server action.
 *
 * Visual contract (Epic 12 spec — Form view):
 *   - Single-column form, max-width 1024px, centered.
 *   - Input chrome matches Epic 03 auth forms: radius 4px, padding 8px 16px,
 *     focus border --color-primary.
 *
 * Empty states (per dispatch plan):
 *   - No fields configured: "Configure form fields from the view menu."
 *     (inline "Configure fields" button when role >= member)
 *   - No groups on board (Q7): "Add a group to this board before accepting submissions."
 *
 * Role gating:
 *   - Viewer+ may submit (Q24, implemented via SECURITY DEFINER SQL function).
 *   - Member+ may see the "Configure fields" button.
 */

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { submitForm } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/form/actions";
import { useBoard } from "@/hooks/use-board";
import { useBoardView } from "@/hooks/use-board-view";
import { ROLE_RANK } from "@/lib/authorization";
import type { FormConfig } from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";
import { FormBuilder } from "./FormBuilder";
import { FormField } from "./FormField";

// Key used in RHF values: we store per-column values under the column id.
type FormValues = Record<string, unknown>;

export function FormView() {
  const { board, role } = useBoard();
  const { active, effective } = useBoardView();
  const { columns, groups } = useBoardStore(
    useShallow((s) => ({ columns: s.columns, groups: s.groups })),
  );

  const [showBuilder, setShowBuilder] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const formConfig: FormConfig = effective.form ?? {
    targetGroupId: null,
    fields: [],
    submitLabel: "Submit",
    successMessage: "Submitted!",
  };

  // FormConfig doesn't have title/description in v1 (per Slice A's schema).
  // These are referenced as future extension points below but kept as undefined.

  // Pre-populate RHF default values from field defaultValue settings.
  const defaultValues: FormValues = {};
  for (const field of formConfig.fields) {
    if (field.defaultValue !== undefined) {
      defaultValues[field.columnId] = field.defaultValue;
    }
  }

  const {
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues });

  // Determine if there are active (non-deleted) groups on this board.
  const hasGroups = groups.some((g) => !g.deleted_at);

  // Build a map of column id → column row for quick lookup.
  const columnMap = new Map(columns.map((c) => [c.id, c]));

  const onSubmit = async (data: FormValues) => {
    if (!active) {
      toast.error("No active view found.");
      return;
    }

    // Build the values array from RHF data — only include fields that are in the config.
    const values = formConfig.fields
      .filter((f) => columnMap.has(f.columnId))
      .map((f) => ({
        columnId: f.columnId,
        value: data[f.columnId] ?? null,
      }));

    const result = await submitForm({
      boardId: board.id,
      viewId: active.id,
      values,
    });

    if (!result.ok) {
      const errorCode = (result as { ok: false; error: { code: string; message: string } }).error?.code;
      const code = (result as unknown as { code?: string }).code ?? errorCode;

      if (code === "NO_GROUPS") {
        toast.error("Add a group to this board before accepting submissions.");
        return;
      }
      if (code === "NO_FIELDS") {
        toast.error("Configure form fields before submitting.");
        return;
      }
      toast.error(
        (result as { ok: false; error: { code: string; message: string } }).error?.message ??
          "Submission failed. Please try again.",
      );
      return;
    }

    setSubmitSuccess(true);
    toast.success(formConfig.successMessage ?? "Submitted!");
    reset(defaultValues);
    // Reset success banner after 5 s.
    setTimeout(() => setSubmitSuccess(false), 5000);
  };

  const isEditor = ROLE_RANK[role] >= ROLE_RANK["member"];

  // ----- Empty state: no groups on board -----
  if (!hasGroups) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6 py-12 gap-4">
        <p
          className="text-sm text-[color:var(--color-fg-muted)] text-center max-w-sm"
          data-testid="form-no-groups"
        >
          Add a group to this board before accepting submissions.
        </p>
        {isEditor && (
          <button
            type="button"
            onClick={() => setShowBuilder((v) => !v)}
            className="text-xs text-[color:var(--color-primary)] underline underline-offset-2"
          >
            Configure fields
          </button>
        )}
        {showBuilder && <FormBuilder formConfig={formConfig} />}
      </div>
    );
  }

  // ----- Empty state: no fields configured -----
  if (formConfig.fields.length === 0) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6 py-12 gap-4">
        <p
          className="text-sm text-[color:var(--color-fg-muted)] text-center max-w-sm"
          data-testid="form-no-fields"
        >
          Configure form fields from the view menu.
        </p>
        {isEditor && (
          <button
            type="button"
            onClick={() => setShowBuilder((v) => !v)}
            className="
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
              bg-[color:var(--color-primary)] text-white
              hover:opacity-90 transition-opacity duration-[var(--motion-fast)]
            "
            data-testid="form-configure-btn"
          >
            <span aria-hidden="true">⚙</span>
            Configure fields
          </button>
        )}
        {showBuilder && <FormBuilder formConfig={formConfig} />}
      </div>
    );
  }

  // ----- Success banner -----
  if (submitSuccess) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-6 py-12">
        <div
          className="
            max-w-2xl w-full flex flex-col items-center gap-6
            bg-[color:var(--color-surface)] border border-[color:var(--color-border)]
            rounded-lg px-8 py-12 text-center
          "
          data-testid="form-success"
        >
          <svg
            className="w-12 h-12 text-[color:var(--color-primary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-lg font-semibold text-[color:var(--color-fg)]">
            {formConfig.successMessage ?? "Submitted!"}
          </p>
          <button
            type="button"
            onClick={() => {
              setSubmitSuccess(false);
              reset(defaultValues);
            }}
            className="
              px-4 py-2 rounded-md text-sm font-medium
              bg-[color:var(--color-primary)] text-white
              hover:opacity-90 transition-opacity duration-[var(--motion-fast)]
            "
          >
            Submit another response
          </button>
        </div>
      </div>
    );
  }

  // ----- Main form render -----
  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-6 py-8">
      {/* Configure button (member+ only) — top-right */}
      <div className="flex justify-end mb-4" style={{ maxWidth: 1024, margin: "0 auto", width: "100%", marginBottom: 16 }}>
        {isEditor && (
          <button
            type="button"
            onClick={() => setShowBuilder((v) => !v)}
            className="
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
              border border-[color:var(--color-border)]
              text-[color:var(--color-fg-muted)]
              hover:text-[color:var(--color-fg)]
              hover:bg-[color:var(--color-surface-hover)]
              transition-colors duration-[var(--motion-fast)]
            "
            data-testid="form-configure-btn"
          >
            <span aria-hidden="true">⚙</span>
            Configure fields
          </button>
        )}
      </div>

      {/* Builder panel (toggleable) */}
      {showBuilder && (
        <div className="mb-8" style={{ maxWidth: 1024, margin: "0 auto 32px", width: "100%" }}>
          <FormBuilder formConfig={formConfig} />
        </div>
      )}

      {/* Form title / description — FormConfig v1 does not include these fields.
          Placeholder for v1.5 public form sharing. */}

      {/* The form itself */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
        style={{ maxWidth: 1024, margin: "0 auto", width: "100%" }}
        noValidate
        data-testid="form-view-form"
      >
        {formConfig.fields.map((fieldConfig) => {
          const col = columnMap.get(fieldConfig.columnId);
          if (!col) return null; // Column removed from board — skip.

          return (
            <Controller
              key={fieldConfig.columnId}
              name={fieldConfig.columnId}
              control={control}
              rules={
                fieldConfig.required
                  ? {
                      validate: (v) =>
                        v != null && v !== ""
                          ? true
                          : `${fieldConfig.labelOverride ?? col.name} is required`,
                    }
                  : {}
              }
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1">
                  <FormField
                    column={col}
                    fieldConfig={fieldConfig}
                    value={field.value}
                    onChange={field.onChange}
                  />
                  {fieldState.error && (
                    <p className="text-xs text-red-500" role="alert">
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
            />
          );
        })}

        {/* Submit button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="
              px-6 py-2 rounded-md text-sm font-medium
              bg-[color:var(--color-primary)] text-white
              hover:opacity-90 disabled:opacity-50
              transition-opacity duration-[var(--motion-fast)]
            "
            data-testid="form-submit-btn"
          >
            {isSubmitting ? "Submitting…" : (formConfig.submitLabel ?? "Submit")}
          </button>
        </div>
      </form>
    </div>
  );
}
