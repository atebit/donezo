import { z } from "zod";

// ---------------------------------------------------------------------------
// Filter tree
// ---------------------------------------------------------------------------

export const FilterOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "is_empty",
  "is_not_empty",
  "in",
  "not_in",
  "lt",
  "lte",
  "gt",
  "gte",
  "between",
  "before",
  "after",
  "today",
  "this_week",
  "this_month",
]);

export const ComparisonSchema = z.object({
  columnId: z.string().uuid(),
  operator: FilterOperatorSchema,
  operand: z.unknown(), // type depends on cell type; runtime-validated by the cell registry
});

export type FilterTree =
  | { kind: "and"; clauses: FilterTree[] }
  | { kind: "or"; clauses: FilterTree[] }
  | { kind: "comparison"; comparison: z.infer<typeof ComparisonSchema> };

export const FilterTreeSchema: z.ZodType<FilterTree> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("and"), clauses: z.array(FilterTreeSchema) }),
    z.object({ kind: z.literal("or"), clauses: z.array(FilterTreeSchema) }),
    z.object({ kind: z.literal("comparison"), comparison: ComparisonSchema }),
  ]),
);

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

export const SortKeySchema = z.object({
  columnId: z.string().uuid(),
  direction: z.enum(["asc", "desc"]),
});
export type SortKey = z.infer<typeof SortKeySchema>;

// ---------------------------------------------------------------------------
// Group-by
// ---------------------------------------------------------------------------

export const GroupBySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("native") }),
  z.object({ kind: z.literal("column"), columnId: z.string().uuid() }),
]);
export type GroupBy = z.infer<typeof GroupBySchema>;

// ---------------------------------------------------------------------------
// Density
// ---------------------------------------------------------------------------

export const DensitySchema = z.enum(["compact", "default", "spacious"]);
export type Density = z.infer<typeof DensitySchema>;

// ---------------------------------------------------------------------------
// View kind
// ---------------------------------------------------------------------------

export const ViewKindSchema = z.enum([
  "table",
  "kanban",
  "calendar",
  "timeline",
  "dashboard",
  "form",
]);
export type ViewKind = z.infer<typeof ViewKindSchema>;

// ---------------------------------------------------------------------------
// CardStyle — shared by Kanban / Calendar / Timeline (Epic 12 § "Card style configuration")
// ---------------------------------------------------------------------------
export const CardStyleSchema = z.object({
  showTitle: z.literal(true).default(true),
  visibleColumnIds: z.array(z.string().uuid()).default([]),
  showAvatars: z.boolean().default(true),
  showDueDate: z.boolean().default(true),
});
export type CardStyle = z.infer<typeof CardStyleSchema>;

// ---------------------------------------------------------------------------
// Kanban
// ---------------------------------------------------------------------------
export const KanbanConfigSchema = z
  .object({
    groupByColumnId: z.string().uuid().nullable().default(null), // null = "pick a column" empty state
    cardStyle: CardStyleSchema.optional(),
  })
  .default({ groupByColumnId: null });
export type KanbanConfig = z.infer<typeof KanbanConfigSchema>;

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------
export const CalendarViewModeSchema = z.enum(["month", "week", "day", "agenda"]).default("month");
export const CalendarConfigSchema = z
  .object({
    dateColumnId: z.string().uuid().nullable().default(null), // refs a `date` or `timeline` column
    viewMode: CalendarViewModeSchema,
    cardStyle: CardStyleSchema.optional(),
  })
  .default({ dateColumnId: null, viewMode: "month" });
export type CalendarConfig = z.infer<typeof CalendarConfigSchema>;

// ---------------------------------------------------------------------------
// Timeline (Gantt)
// ---------------------------------------------------------------------------
export const TimelineScaleSchema = z
  .enum(["day", "week", "month", "quarter", "year"])
  .default("week");
export const TimelineColorBySchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({ kind: z.literal("status"), columnId: z.string().uuid() }),
    z.object({ kind: z.literal("priority"), columnId: z.string().uuid() }),
    z.object({ kind: z.literal("person"), columnId: z.string().uuid() }),
  ])
  .default({ kind: "none" });
export const TimelineConfigSchema = z
  .object({
    timelineColumnId: z.string().uuid().nullable().default(null), // refs a `timeline` cell column
    scale: TimelineScaleSchema,
    colorBy: TimelineColorBySchema,
    cardStyle: CardStyleSchema.optional(),
  })
  .default({ timelineColumnId: null, scale: "week", colorBy: { kind: "none" } });
export type TimelineConfig = z.infer<typeof TimelineConfigSchema>;

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export const AggregationKindSchema = z.enum([
  "count",
  "count_empty",
  "count_unique",
  "sum",
  "avg",
  "min",
  "max",
  "median",
  "percent_by_label",
  "percent_checked",
  "range",
  "earliest",
  "latest",
]);
export const DateBucketSchema = z.enum(["day", "week", "month"]);

export const WidgetConfigSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("number"),
    columnId: z.string().uuid(),
    aggregation: AggregationKindSchema,
    label: z.string().optional(),
  }),
  z.object({
    kind: z.literal("bar"),
    xColumnId: z.string().uuid(),
    yAggregation: AggregationKindSchema,
    yColumnId: z.string().uuid().optional(),
    groupBy: z.string().uuid().optional(),
  }),
  z.object({
    kind: z.literal("pie"),
    columnId: z.string().uuid(),
    aggregation: AggregationKindSchema,
  }),
  z.object({
    kind: z.literal("line"),
    dateColumnId: z.string().uuid(),
    yAggregation: AggregationKindSchema,
    yColumnId: z.string().uuid().optional(),
    bucket: DateBucketSchema,
  }),
  z.object({
    kind: z.literal("table"),
    filter: FilterTreeSchema.optional(),
    sort: z.array(SortKeySchema).optional(),
    limit: z.number().int().positive().max(100),
  }),
]);
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;

export const GridLayoutItemSchema = z.object({
  i: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
});

export const DashboardConfigSchema = z
  .object({
    layout: z.array(GridLayoutItemSchema).default([]),
    widgets: z.record(z.string(), WidgetConfigSchema).default({}),
  })
  .default({ layout: [], widgets: {} });
export type DashboardConfig = z.infer<typeof DashboardConfigSchema>;

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------
export const FormFieldSchema = z.object({
  columnId: z.string().uuid(),
  required: z.boolean().default(false),
  labelOverride: z.string().optional(),
  helpText: z.string().optional(),
  defaultValue: z.unknown().optional(), // typed at runtime against the column's cell def
});
export const FormConfigSchema = z
  .object({
    targetGroupId: z.string().uuid().nullable().default(null), // null → first group on submit
    fields: z.array(FormFieldSchema).default([]),
    submitLabel: z.string().default("Submit"),
    successMessage: z.string().default("Submitted!"),
  })
  .default({
    targetGroupId: null,
    fields: [],
    submitLabel: "Submit",
    successMessage: "Submitted!",
  });
export type FormConfig = z.infer<typeof FormConfigSchema>;

// ---------------------------------------------------------------------------
// Helper — return the Zod-default config for a given view kind.
// Used by AddViewMenu when creating a new view of a specific kind.
// ---------------------------------------------------------------------------
export function defaultConfigForKind(kind: string): Record<string, unknown> {
  switch (kind) {
    case "kanban":
      return KanbanConfigSchema.parse({});
    case "calendar":
      return CalendarConfigSchema.parse({});
    case "timeline":
      return TimelineConfigSchema.parse({});
    case "dashboard":
      return DashboardConfigSchema.parse({});
    case "form":
      return FormConfigSchema.parse({});
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// The whole config jsonb
// ---------------------------------------------------------------------------

export const ViewConfigSchema = z.object({
  filter: FilterTreeSchema.optional(),
  sort: z.array(SortKeySchema).optional(),
  groupBy: GroupBySchema.optional(),
  columnVisibility: z.record(z.string().uuid(), z.boolean()).optional(),
  columnWidths: z.record(z.string().uuid(), z.number().positive()).optional(),
  columnOrder: z.array(z.string().uuid()).optional(),
  density: DensitySchema.optional(),
  search: z.string().optional(),
  // Epic 12 — strict per-kind sub-schemas (replace permissive z.unknown slots).
  // Use .removeDefault() so that an absent key stays absent (undefined) rather
  // than having the sub-schema's .default() fire and inject values into the top-
  // level config object.
  kanban: KanbanConfigSchema.removeDefault().optional(),
  calendar: CalendarConfigSchema.removeDefault().optional(),
  timeline: TimelineConfigSchema.removeDefault().optional(),
  dashboard: DashboardConfigSchema.removeDefault().optional(),
  form: FormConfigSchema.removeDefault().optional(),
});
export type ViewConfig = z.infer<typeof ViewConfigSchema>;

/**
 * Permissively parse a view config jsonb blob.
 * Returns {} when parsing fails to avoid crashing the board.
 */
export function parseViewConfig(raw: unknown): ViewConfig {
  const r = ViewConfigSchema.safeParse(raw);
  if (r.success) return r.data;
  if (process.env.NODE_ENV !== "production") {
    // biome-ignore lint/suspicious/noConsole: dev-only validation warning; no logger available here
    console.warn("[view] config failed validation; falling back to defaults", r.error);
  }
  return {};
}
