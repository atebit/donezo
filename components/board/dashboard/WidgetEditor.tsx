"use client";

/**
 * WidgetEditor — Base UI Dialog for creating/editing a dashboard widget.
 *
 * Two-step UI (per spec §E.5):
 *   1. Kind picker — 5 cards (number, bar, pie, line, table)
 *   2. Per-kind config form — React Hook Form + Zod over the WidgetConfigSchema union
 *
 * Save → appends/updates widget in dashboard config via useBoardView().applyDraft.
 * In create mode (widgetId = null), a new UUID-like id is generated.
 */

import { useId, useMemo, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BarChart2, Hash, LineChart, PieChart, Table } from "lucide-react";
import { z } from "zod";
import { useShallow } from "zustand/react/shallow";
import { useBoardView } from "@/hooks/use-board-view";
import {
  AggregationKindSchema,
  DateBucketSchema,
  WidgetConfigSchema,
  type WidgetConfig,
} from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";
import type { Database } from "@/lib/supabase/types";

type Column = Database["public"]["Tables"]["column"]["Row"];

// ---------------------------------------------------------------------------
// Widget kind card descriptor
// ---------------------------------------------------------------------------

const KIND_CARDS = [
  {
    kind: "number" as const,
    label: "Number",
    description: "A single aggregated value",
    icon: Hash,
  },
  {
    kind: "bar" as const,
    label: "Bar chart",
    description: "Compare values across groups",
    icon: BarChart2,
  },
  {
    kind: "pie" as const,
    label: "Pie chart",
    description: "Show distribution by label",
    icon: PieChart,
  },
  {
    kind: "line" as const,
    label: "Line chart",
    description: "Track values over time",
    icon: LineChart,
  },
  {
    kind: "table" as const,
    label: "Table",
    description: "A filtered list of tasks",
    icon: Table,
  },
] as const;

type WidgetKind = (typeof KIND_CARDS)[number]["kind"];

// ---------------------------------------------------------------------------
// Per-kind form schemas (plain Zod for RHF)
// ---------------------------------------------------------------------------

const NumberFormSchema = z.object({
  columnId: z.string().uuid("Pick a column"),
  aggregation: AggregationKindSchema,
  label: z.string().optional(),
});

const BarFormSchema = z.object({
  xColumnId: z.string().uuid("Pick an X column"),
  yAggregation: AggregationKindSchema,
  yColumnId: z.string().optional(),
});

const PieFormSchema = z.object({
  columnId: z.string().uuid("Pick a column"),
  aggregation: AggregationKindSchema,
});

const LineFormSchema = z.object({
  dateColumnId: z.string().uuid("Pick a date column"),
  yAggregation: AggregationKindSchema,
  yColumnId: z.string().optional(),
  bucket: DateBucketSchema,
});

const TableFormSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(10),
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WidgetEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing widget to edit. Null = create mode. */
  widgetId: string | null;
  existingConfig?: WidgetConfig | null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WidgetEditor({ open, onOpenChange, widgetId, existingConfig }: WidgetEditorProps) {
  const [selectedKind, setSelectedKind] = useState<WidgetKind | null>(
    existingConfig?.kind ?? null,
  );
  const formInstanceId = useId();

  const columns = useBoardStore(useShallow((s) => s.columns));
  const { effective, applyDraft } = useBoardView();

  function handleSave(newConfig: WidgetConfig) {
    const current = effective.dashboard ?? { layout: [], widgets: {} };
    const id = widgetId ?? `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const updatedWidgets = { ...current.widgets, [id]: newConfig };

    // For create mode: append to layout with y=Infinity (react-grid-layout places at bottom).
    let updatedLayout = current.layout;
    if (!widgetId) {
      updatedLayout = [
        ...updatedLayout,
        { i: id, x: 0, y: Number.POSITIVE_INFINITY, w: 4, h: 3 },
      ];
    }

    applyDraft({
      dashboard: {
        layout: updatedLayout,
        widgets: updatedWidgets,
      },
    });
    onOpenChange(false);
    // Reset kind selection after close.
    if (!existingConfig) setSelectedKind(null);
  }

  function handleClose() {
    onOpenChange(false);
    if (!existingConfig) setSelectedKind(null);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg rounded-xl bg-[color:var(--color-surface)] shadow-[var(--shadow-modal)] focus:outline-none"
          aria-labelledby={`${formInstanceId}-title`}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[color:var(--color-border-strong)]">
            <Dialog.Title
              id={`${formInstanceId}-title`}
              className="text-base font-semibold text-[color:var(--color-fg-strong)]"
            >
              {widgetId ? "Edit widget" : "Add widget"}
            </Dialog.Title>
            <Dialog.Close
              className="text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] focus-visible:outline-none"
              onClick={handleClose}
            >
              ✕
            </Dialog.Close>
          </div>

          <div className="p-6">
            {!selectedKind ? (
              /* Step 1 — Kind picker */
              <KindPicker
                onSelect={(kind) => {
                  setSelectedKind(kind);
                }}
              />
            ) : (
              /* Step 2 — Per-kind config form */
              <ConfigForm
                kind={selectedKind}
                columns={columns}
                existingConfig={existingConfig ?? null}
                onSave={handleSave}
                onBack={() => setSelectedKind(null)}
              />
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// KindPicker
// ---------------------------------------------------------------------------

function KindPicker({ onSelect }: { onSelect: (kind: WidgetKind) => void }) {
  return (
    <div>
      <p className="text-sm text-[color:var(--color-fg-muted)] mb-4">
        Choose the type of widget to add:
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {KIND_CARDS.map(({ kind, label, description, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            onClick={() => onSelect(kind)}
            className="flex flex-col items-start gap-2 rounded-lg border border-[color:var(--color-border-strong)] p-4 text-left hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none focus-visible:border-[color:var(--color-primary)] transition-colors"
          >
            <Icon size={20} className="text-[color:var(--color-fg-muted)]" />
            <div>
              <div className="text-sm font-medium text-[color:var(--color-fg)]">{label}</div>
              <div className="text-xs text-[color:var(--color-fg-muted)]">{description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConfigForm — per-kind
// ---------------------------------------------------------------------------

interface ConfigFormProps {
  kind: WidgetKind;
  columns: Column[];
  existingConfig: WidgetConfig | null;
  onSave: (config: WidgetConfig) => void;
  onBack: () => void;
}

function ConfigForm({ kind, columns, existingConfig, onSave, onBack }: ConfigFormProps) {
  switch (kind) {
    case "number":
      return (
        <NumberForm
          columns={columns}
          existing={existingConfig?.kind === "number" ? existingConfig : null}
          onSave={onSave}
          onBack={onBack}
        />
      );
    case "bar":
      return (
        <BarForm
          columns={columns}
          existing={existingConfig?.kind === "bar" ? existingConfig : null}
          onSave={onSave}
          onBack={onBack}
        />
      );
    case "pie":
      return (
        <PieForm
          columns={columns}
          existing={existingConfig?.kind === "pie" ? existingConfig : null}
          onSave={onSave}
          onBack={onBack}
        />
      );
    case "line":
      return (
        <LineForm
          columns={columns}
          existing={existingConfig?.kind === "line" ? existingConfig : null}
          onSave={onSave}
          onBack={onBack}
        />
      );
    case "table":
      return (
        <TableForm
          existing={existingConfig?.kind === "table" ? existingConfig : null}
          onSave={onSave}
          onBack={onBack}
        />
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-[color:var(--color-fg)]">{label}</label>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

const inputClass =
  "rounded border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-3 py-1.5 text-sm text-[color:var(--color-fg)] focus:outline-none focus:border-[color:var(--color-primary)]";

const selectClass = inputClass;

const AGGREGATION_OPTIONS: { value: string; label: string }[] = [
  { value: "count", label: "Count" },
  { value: "count_empty", label: "Count empty" },
  { value: "count_unique", label: "Count unique" },
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
  { value: "median", label: "Median" },
];

function FormFooter({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex justify-between mt-6">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] focus-visible:outline-none"
      >
        ← Back
      </button>
      <button
        type="submit"
        className="rounded-md bg-[color:var(--color-primary)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none"
      >
        Save widget
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NumberForm
// ---------------------------------------------------------------------------

function NumberForm({
  columns,
  existing,
  onSave,
  onBack,
}: {
  columns: Column[];
  existing: Extract<WidgetConfig, { kind: "number" }> | null;
  onSave: (c: WidgetConfig) => void;
  onBack: () => void;
}) {
  type FormValues = z.infer<typeof NumberFormSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(NumberFormSchema),
    defaultValues: {
      columnId: existing?.columnId ?? "",
      aggregation: (existing?.aggregation as z.infer<typeof AggregationKindSchema>) ?? "count",
      label: existing?.label ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    onSave({ kind: "number", ...values });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label="Column" error={errors.columnId?.message}>
        <select {...register("columnId")} className={selectClass}>
          <option value="">Select a column…</option>
          {columns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.name} ({col.type})
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Aggregation" error={errors.aggregation?.message}>
        <select {...register("aggregation")} className={selectClass}>
          {AGGREGATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Label (optional)" error={errors.label?.message}>
        <input
          {...register("label")}
          type="text"
          placeholder="e.g. Sum of Budget"
          className={inputClass}
        />
      </FormField>

      <FormFooter onBack={onBack} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// BarForm
// ---------------------------------------------------------------------------

function BarForm({
  columns,
  existing,
  onSave,
  onBack,
}: {
  columns: Column[];
  existing: Extract<WidgetConfig, { kind: "bar" }> | null;
  onSave: (c: WidgetConfig) => void;
  onBack: () => void;
}) {
  type FormValues = z.infer<typeof BarFormSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(BarFormSchema),
    defaultValues: {
      xColumnId: existing?.xColumnId ?? "",
      yAggregation: (existing?.yAggregation as z.infer<typeof AggregationKindSchema>) ?? "count",
      yColumnId: existing?.yColumnId ?? "",
    },
  });

  function onSubmit(values: FormValues) {
    const config: Extract<WidgetConfig, { kind: "bar" }> = {
      kind: "bar",
      xColumnId: values.xColumnId,
      yAggregation: values.yAggregation,
      ...(values.yColumnId ? { yColumnId: values.yColumnId } : {}),
    };
    onSave(config);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label="X axis (group by)" error={errors.xColumnId?.message}>
        <select {...register("xColumnId")} className={selectClass}>
          <option value="">Select a column…</option>
          {columns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.name} ({col.type})
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Y aggregation" error={errors.yAggregation?.message}>
        <select {...register("yAggregation")} className={selectClass}>
          {AGGREGATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Y column (optional — uses count if empty)">
        <select {...register("yColumnId")} className={selectClass}>
          <option value="">Task count</option>
          {columns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.name} ({col.type})
            </option>
          ))}
        </select>
      </FormField>

      <FormFooter onBack={onBack} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// PieForm
// ---------------------------------------------------------------------------

function PieForm({
  columns,
  existing,
  onSave,
  onBack,
}: {
  columns: Column[];
  existing: Extract<WidgetConfig, { kind: "pie" }> | null;
  onSave: (c: WidgetConfig) => void;
  onBack: () => void;
}) {
  type FormValues = z.infer<typeof PieFormSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(PieFormSchema),
    defaultValues: {
      columnId: existing?.columnId ?? "",
      aggregation: (existing?.aggregation as z.infer<typeof AggregationKindSchema>) ?? "count",
    },
  });

  function onSubmit(values: FormValues) {
    onSave({ kind: "pie", ...values });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label="Column (group by)" error={errors.columnId?.message}>
        <select {...register("columnId")} className={selectClass}>
          <option value="">Select a column…</option>
          {columns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.name} ({col.type})
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Aggregation" error={errors.aggregation?.message}>
        <select {...register("aggregation")} className={selectClass}>
          {AGGREGATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormFooter onBack={onBack} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// LineForm
// ---------------------------------------------------------------------------

function LineForm({
  columns,
  existing,
  onSave,
  onBack,
}: {
  columns: Column[];
  existing: Extract<WidgetConfig, { kind: "line" }> | null;
  onSave: (c: WidgetConfig) => void;
  onBack: () => void;
}) {
  type FormValues = z.infer<typeof LineFormSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(LineFormSchema),
    defaultValues: {
      dateColumnId: existing?.dateColumnId ?? "",
      yAggregation: (existing?.yAggregation as z.infer<typeof AggregationKindSchema>) ?? "count",
      yColumnId: existing?.yColumnId ?? "",
      bucket: existing?.bucket ?? "month",
    },
  });

  // Only date / timeline columns for the X axis.
  const dateColumns = useMemo(
    () => columns.filter((c) => c.type === "date" || c.type === "timeline"),
    [columns],
  );

  function onSubmit(values: FormValues) {
    const config: Extract<WidgetConfig, { kind: "line" }> = {
      kind: "line",
      dateColumnId: values.dateColumnId,
      yAggregation: values.yAggregation,
      bucket: values.bucket,
      ...(values.yColumnId ? { yColumnId: values.yColumnId } : {}),
    };
    onSave(config);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label="Date column (X axis)" error={errors.dateColumnId?.message}>
        <select {...register("dateColumnId")} className={selectClass}>
          <option value="">Select a date/timeline column…</option>
          {dateColumns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.name} ({col.type})
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Time bucket" error={errors.bucket?.message}>
        <select {...register("bucket")} className={selectClass}>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
      </FormField>

      <FormField label="Y aggregation" error={errors.yAggregation?.message}>
        <select {...register("yAggregation")} className={selectClass}>
          {AGGREGATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Y column (optional — uses count if empty)">
        <select {...register("yColumnId")} className={selectClass}>
          <option value="">Task count</option>
          {columns.map((col) => (
            <option key={col.id} value={col.id}>
              {col.name} ({col.type})
            </option>
          ))}
        </select>
      </FormField>

      <FormFooter onBack={onBack} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// TableForm
// ---------------------------------------------------------------------------

function TableForm({
  existing,
  onSave,
  onBack,
}: {
  existing: Extract<WidgetConfig, { kind: "table" }> | null;
  onSave: (c: WidgetConfig) => void;
  onBack: () => void;
}) {
  type FormValues = z.infer<typeof TableFormSchema>;
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(TableFormSchema),
    defaultValues: {
      limit: existing?.limit ?? 10,
    },
  });

  function onSubmit(values: FormValues) {
    onSave({
      kind: "table",
      limit: values.limit,
      ...(existing?.filter ? { filter: existing.filter } : {}),
      ...(existing?.sort ? { sort: existing.sort } : {}),
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label="Max rows (1–100)" error={errors.limit?.message}>
        <input
          {...register("limit")}
          type="number"
          min="1"
          max="100"
          className={inputClass}
        />
      </FormField>

      <p className="text-xs text-[color:var(--color-fg-muted)]">
        The table widget shows the top N tasks from the current view. Filtering and sorting are
        inherited from the dashboard view's settings.
      </p>

      <FormFooter onBack={onBack} />
    </form>
  );
}
