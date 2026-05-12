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
  // Reserved for Epic 12 — permissive shape.
  kanban: z.unknown().optional(),
  calendar: z.unknown().optional(),
  timeline: z.unknown().optional(),
  dashboard: z.unknown().optional(),
  form: z.unknown().optional(),
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
