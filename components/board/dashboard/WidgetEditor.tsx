"use client";

/**
 * WidgetEditor — two-step Base UI Dialog for creating/editing dashboard widgets.
 *
 * Step 1: Kind picker (5 cards: number, bar, pie, line, table).
 * Step 2: Per-kind config form (React Hook Form + Zod).
 *
 * In "create" mode (`widgetId === null`): shows kind picker first, then config form.
 * In "edit" mode (`widgetId !== null`): opens directly on the config form for the
 *   existing widget.
 *
 * On save: calls onSave(widgetId, config) — parent (Dashboard.tsx) persists to draft.
 * On delete: calls onDelete(widgetId) — parent removes from layout + widgets map.
 *
 * Epic 12, Slice E — E.5.
 */

import { Dialog } from "@base-ui/react/dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, BarChart2, Hash, LineChart, PieChart, Table2, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useShallow } from "zustand/react/shallow";
import {
  AggregationKindSchema,
  DateBucketSchema,
  type WidgetConfig,
} from "@/lib/views/config-schema";
import { useBoardStore } from "@/stores/board-store";

// ---------------------------------------------------------------------------
// Widget kind metadata
// ---------------------------------------------------------------------------

type WidgetKind = WidgetConfig["kind"];

const WIDGET_KINDS: {
  kind: WidgetKind;
  label: string;
  description: string;
  Icon: React.ComponentType<{ size?: number }>;
}[] = [
  { kind: "number", label: "Number", description: "Single aggregated value", Icon: Hash },
  { kind: "bar", label: "Bar chart", description: "Compare values by category", Icon: BarChart2 },
  { kind: "pie", label: "Pie chart", description: "Show proportions", Icon: PieChart },
  { kind: "line", label: "Line chart", description: "Track values over time", Icon: LineChart },
  { kind: "table", label: "Table", description: "List tasks with columns", Icon: Table2 },
];

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

const DATE_BUCKET_OPTIONS: { value: string; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

// ---------------------------------------------------------------------------
// Per-kind Zod schemas for the form
// ---------------------------------------------------------------------------

const NumberFormSchema = z.object({
  columnId: z.string().min(1, "Select a column"),
  aggregation: AggregationKindSchema,
  label: z.string().optional(),
});

const BarFormSchema = z.object({
  xColumnId: z.string().min(1, "Select a column"),
  yAggregation: AggregationKindSchema,
  yColumnId: z.string().optional(),
});

const PieFormSchema = z.object({
  columnId: z.string().min(1, "Select a column"),
  aggregation: AggregationKindSchema,
});

const LineFormSchema = z.object({
  dateColumnId: z.string().min(1, "Select a date column"),
  yAggregation: AggregationKindSchema,
  yColumnId: z.string().optional(),
  bucket: DateBucketSchema,
});

const TableFormSchema = z.object({
  limit: z.number().int().min(1).max(100),
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WidgetEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode; string = edit mode */
  widgetId: string | null;
  /** undefined in create mode (no existing config) */
  existingConfig?: WidgetConfig | undefined;
  onSave: (widgetId: string | null, config: WidgetConfig) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WidgetEditor({
  open,
  onOpenChange,
  widgetId,
  existingConfig,
  onSave,
}: WidgetEditorProps) {
  // In edit mode start directly on the config form; create mode starts on kind picker.
  const [selectedKind, setSelectedKind] = useState<WidgetKind | null>(existingConfig?.kind ?? null);

  // Reset selected kind when dialog opens fresh.
  const handleOpenChange = (o: boolean) => {
    if (!o) {
      // Reset to initial state on close.
      setSelectedKind(existingConfig?.kind ?? null);
    }
    onOpenChange(o);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-[color:var(--color-overlay)]"
          style={{ backdropFilter: "blur(2px)" }}
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg rounded-xl bg-[color:var(--color-bg-elevated)] shadow-[var(--shadow-modal)] focus:outline-none"
          aria-labelledby="widget-editor-title"
          style={{ maxHeight: "90vh", overflow: "auto" }}
        >
          <div className="flex items-center justify-between p-5 pb-0">
            <div className="flex items-center gap-2">
              {selectedKind && !existingConfig && (
                <button
                  type="button"
                  onClick={() => setSelectedKind(null)}
                  className="flex items-center justify-center rounded p-1 hover:bg-[color:var(--color-surface-hover)]"
                  aria-label="Back to kind picker"
                >
                  <ArrowLeft size={15} />
                </button>
              )}
              <Dialog.Title
                id="widget-editor-title"
                className="text-base font-semibold text-[color:var(--color-fg)]"
              >
                {widgetId ? "Edit widget" : selectedKind ? "Configure widget" : "Add widget"}
              </Dialog.Title>
            </div>
            <Dialog.Close
              className="flex items-center justify-center rounded p-1 hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none"
              aria-label="Close"
            >
              <X size={15} />
            </Dialog.Close>
          </div>

          <div className="p-5">
            {!selectedKind ? (
              <KindPicker onSelect={setSelectedKind} />
            ) : (
              <ConfigForm
                kind={selectedKind}
                widgetId={widgetId}
                {...(existingConfig ? { existingConfig } : {})}
                onSave={onSave}
                onClose={() => onOpenChange(false)}
              />
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — KindPicker
// ---------------------------------------------------------------------------

function KindPicker({ onSelect }: { onSelect: (kind: WidgetKind) => void }) {
  return (
    <div>
      <p className="mb-3 text-sm text-[color:var(--color-fg-subtle)]">
        Choose the type of widget to add.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {WIDGET_KINDS.map(({ kind, label, description, Icon }) => (
          <button
            key={kind}
            type="button"
            onClick={() => onSelect(kind)}
            className="flex flex-col items-start gap-2 rounded-lg border-2 border-[color:var(--color-border)] p-3 text-left hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-surface-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
          >
            <Icon size={20} />
            <div>
              <div className="text-sm font-medium text-[color:var(--color-fg)]">{label}</div>
              <div className="text-xs text-[color:var(--color-fg-subtle)]">{description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — ConfigForm (per-kind)
// ---------------------------------------------------------------------------

interface ConfigFormProps {
  kind: WidgetKind;
  widgetId: string | null;
  existingConfig?: WidgetConfig | undefined;
  onSave: (widgetId: string | null, config: WidgetConfig) => void;
  onClose: () => void;
}

function ConfigForm({ kind, widgetId, existingConfig, onSave, onClose }: ConfigFormProps) {
  const numberExisting = existingConfig?.kind === "number" ? existingConfig : undefined;
  const barExisting = existingConfig?.kind === "bar" ? existingConfig : undefined;
  const pieExisting = existingConfig?.kind === "pie" ? existingConfig : undefined;
  const lineExisting = existingConfig?.kind === "line" ? existingConfig : undefined;
  const tableExisting = existingConfig?.kind === "table" ? existingConfig : undefined;

  switch (kind) {
    case "number":
      return (
        <NumberConfigForm
          widgetId={widgetId}
          {...(numberExisting ? { existing: numberExisting } : {})}
          onSave={onSave}
          onClose={onClose}
        />
      );
    case "bar":
      return (
        <BarConfigForm
          widgetId={widgetId}
          {...(barExisting ? { existing: barExisting } : {})}
          onSave={onSave}
          onClose={onClose}
        />
      );
    case "pie":
      return (
        <PieConfigForm
          widgetId={widgetId}
          {...(pieExisting ? { existing: pieExisting } : {})}
          onSave={onSave}
          onClose={onClose}
        />
      );
    case "line":
      return (
        <LineConfigForm
          widgetId={widgetId}
          {...(lineExisting ? { existing: lineExisting } : {})}
          onSave={onSave}
          onClose={onClose}
        />
      );
    case "table":
      return (
        <TableConfigForm
          widgetId={widgetId}
          {...(tableExisting ? { existing: tableExisting } : {})}
          onSave={onSave}
          onClose={onClose}
        />
      );
  }
}

// ---------------------------------------------------------------------------
// Per-kind form components
// ---------------------------------------------------------------------------

/** Shared column <select> helper. */
function ColumnSelect({
  value,
  onChange,
  error,
  placeholder,
  filterType,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  placeholder: string;
  /** If set, only show columns of this type. */
  filterType?: "date" | "timeline" | "number" | "currency" | undefined;
}) {
  const columns = useBoardStore(useShallow((s) => s.columns));

  const filtered = filterType
    ? columns.filter((c) =>
        filterType === "date" ? c.type === "date" || c.type === "timeline" : c.type === filterType,
      )
    : columns;

  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-1.5 text-sm text-[color:var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {filtered.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-[color:var(--color-error,#ef4444)]">{error}</p>}
    </div>
  );
}

/** Shared aggregation <select> helper. */
function AggregationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-1.5 text-sm text-[color:var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
    >
      {AGGREGATION_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---- NumberConfigForm ----

type NumberFormValues = z.infer<typeof NumberFormSchema>;

function NumberConfigForm({
  widgetId,
  existing,
  onSave,
  onClose,
}: {
  widgetId: string | null;
  existing?: Extract<WidgetConfig, { kind: "number" }> | undefined;
  onSave: (widgetId: string | null, config: WidgetConfig) => void;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NumberFormValues>({
    resolver: zodResolver(NumberFormSchema),
    defaultValues: {
      columnId: existing?.columnId ?? "",
      aggregation: existing?.aggregation ?? "count",
      label: existing?.label ?? "",
    },
  });

  function onSubmit(data: NumberFormValues) {
    onSave(widgetId, {
      kind: "number",
      columnId: data.columnId,
      aggregation: data.aggregation,
      label: data.label || undefined,
    });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label="Column">
        <ColumnSelect
          value={watch("columnId")}
          onChange={(v) => setValue("columnId", v)}
          error={errors.columnId?.message}
          placeholder="Select a column…"
        />
      </FormField>

      <FormField label="Aggregation">
        <AggregationSelect
          value={watch("aggregation")}
          onChange={(v) => setValue("aggregation", v as z.infer<typeof AggregationKindSchema>)}
        />
      </FormField>

      <FormField label="Label (optional)">
        <input
          {...register("label")}
          type="text"
          placeholder="Custom label…"
          className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-1.5 text-sm text-[color:var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
        />
      </FormField>

      <FormFooter onClose={onClose} />
    </form>
  );
}

// ---- BarConfigForm ----

type BarFormValues = z.infer<typeof BarFormSchema>;

function BarConfigForm({
  widgetId,
  existing,
  onSave,
  onClose,
}: {
  widgetId: string | null;
  existing?: Extract<WidgetConfig, { kind: "bar" }> | undefined;
  onSave: (widgetId: string | null, config: WidgetConfig) => void;
  onClose: () => void;
}) {
  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BarFormValues>({
    resolver: zodResolver(BarFormSchema),
    defaultValues: {
      xColumnId: existing?.xColumnId ?? "",
      yAggregation: existing?.yAggregation ?? "count",
      yColumnId: existing?.yColumnId ?? "",
    },
  });

  function onSubmit(data: BarFormValues) {
    onSave(widgetId, {
      kind: "bar",
      xColumnId: data.xColumnId,
      yAggregation: data.yAggregation,
      yColumnId: data.yColumnId || undefined,
    });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label="Group by column (X-axis)">
        <ColumnSelect
          value={watch("xColumnId")}
          onChange={(v) => setValue("xColumnId", v)}
          error={errors.xColumnId?.message}
          placeholder="Select a column…"
        />
      </FormField>

      <FormField label="Y-axis aggregation">
        <AggregationSelect
          value={watch("yAggregation")}
          onChange={(v) => setValue("yAggregation", v as z.infer<typeof AggregationKindSchema>)}
        />
      </FormField>

      <FormField label="Y-axis value column (optional)">
        <ColumnSelect
          value={watch("yColumnId") ?? ""}
          onChange={(v) => setValue("yColumnId", v)}
          placeholder="Task count (default)…"
        />
      </FormField>

      <FormFooter onClose={onClose} />
    </form>
  );
}

// ---- PieConfigForm ----

type PieFormValues = z.infer<typeof PieFormSchema>;

function PieConfigForm({
  widgetId,
  existing,
  onSave,
  onClose,
}: {
  widgetId: string | null;
  existing?: Extract<WidgetConfig, { kind: "pie" }> | undefined;
  onSave: (widgetId: string | null, config: WidgetConfig) => void;
  onClose: () => void;
}) {
  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PieFormValues>({
    resolver: zodResolver(PieFormSchema),
    defaultValues: {
      columnId: existing?.columnId ?? "",
      aggregation: existing?.aggregation ?? "count",
    },
  });

  function onSubmit(data: PieFormValues) {
    onSave(widgetId, {
      kind: "pie",
      columnId: data.columnId,
      aggregation: data.aggregation,
    });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label="Group by column">
        <ColumnSelect
          value={watch("columnId")}
          onChange={(v) => setValue("columnId", v)}
          error={errors.columnId?.message}
          placeholder="Select a column…"
        />
      </FormField>

      <FormField label="Aggregation">
        <AggregationSelect
          value={watch("aggregation")}
          onChange={(v) => setValue("aggregation", v as z.infer<typeof AggregationKindSchema>)}
        />
      </FormField>

      <FormFooter onClose={onClose} />
    </form>
  );
}

// ---- LineConfigForm ----

type LineFormValues = z.infer<typeof LineFormSchema>;

function LineConfigForm({
  widgetId,
  existing,
  onSave,
  onClose,
}: {
  widgetId: string | null;
  existing?: Extract<WidgetConfig, { kind: "line" }> | undefined;
  onSave: (widgetId: string | null, config: WidgetConfig) => void;
  onClose: () => void;
}) {
  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LineFormValues>({
    resolver: zodResolver(LineFormSchema),
    defaultValues: {
      dateColumnId: existing?.dateColumnId ?? "",
      yAggregation: existing?.yAggregation ?? "count",
      yColumnId: existing?.yColumnId ?? "",
      bucket: existing?.bucket ?? "month",
    },
  });

  function onSubmit(data: LineFormValues) {
    onSave(widgetId, {
      kind: "line",
      dateColumnId: data.dateColumnId,
      yAggregation: data.yAggregation,
      yColumnId: data.yColumnId || undefined,
      bucket: data.bucket,
    });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label="Date column (X-axis)">
        <ColumnSelect
          value={watch("dateColumnId")}
          onChange={(v) => setValue("dateColumnId", v)}
          error={errors.dateColumnId?.message}
          placeholder="Select a date column…"
          filterType="date"
        />
      </FormField>

      <FormField label="Time bucket">
        <select
          value={watch("bucket")}
          onChange={(e) => setValue("bucket", e.target.value as z.infer<typeof DateBucketSchema>)}
          className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-1.5 text-sm text-[color:var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
        >
          {DATE_BUCKET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Y-axis aggregation">
        <AggregationSelect
          value={watch("yAggregation")}
          onChange={(v) => setValue("yAggregation", v as z.infer<typeof AggregationKindSchema>)}
        />
      </FormField>

      <FormField label="Y-axis value column (optional)">
        <ColumnSelect
          value={watch("yColumnId") ?? ""}
          onChange={(v) => setValue("yColumnId", v)}
          placeholder="Task count (default)…"
        />
      </FormField>

      <FormFooter onClose={onClose} />
    </form>
  );
}

// ---- TableConfigForm ----

type TableFormValues = z.infer<typeof TableFormSchema>;

function TableConfigForm({
  widgetId,
  existing,
  onSave,
  onClose,
}: {
  widgetId: string | null;
  existing?: Extract<WidgetConfig, { kind: "table" }> | undefined;
  onSave: (widgetId: string | null, config: WidgetConfig) => void;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TableFormValues>({
    resolver: zodResolver(TableFormSchema),
    defaultValues: {
      limit: existing?.limit ?? 10,
    },
  });

  function onSubmit(data: TableFormValues) {
    onSave(widgetId, {
      kind: "table",
      limit: data.limit,
      filter: existing?.filter,
      sort: existing?.sort,
    });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <FormField label="Max rows (1–100)" error={errors.limit?.message}>
        <input
          {...register("limit", { valueAsNumber: true })}
          type="number"
          min={1}
          max={100}
          className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-1.5 text-sm text-[color:var(--color-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
        />
      </FormField>

      <FormFooter onClose={onClose} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Shared form primitives
// ---------------------------------------------------------------------------

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-[color:var(--color-fg-subtle)] uppercase tracking-wide">
        {label}
      </p>
      {children}
      {error && <p className="text-xs text-[color:var(--color-error,#ef4444)]">{error}</p>}
    </div>
  );
}

function FormFooter({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--color-border)]">
      <button
        type="button"
        onClick={onClose}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] focus-visible:outline-none"
      >
        Cancel
      </button>
      <button
        type="submit"
        className="rounded-md bg-[color:var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none disabled:opacity-50"
      >
        Save widget
      </button>
    </div>
  );
}
