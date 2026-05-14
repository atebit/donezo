/**
 * Cell type registry — the contract for every cell type in the product.
 *
 * Schema mapping note: the DB calls the column-config field `settings`
 * (not `config`), and the column's user-visible name is `column.name`
 * (not `column.title`). The registry's `TConfig` generic corresponds to
 * `column.settings`. The CellTypeDef's `label` is the human name shown
 * in the add-column type picker, not the column instance's name.
 */

import type { ComponentType } from "react";
import type { Database } from "@/lib/supabase/types";
import type { AggregateRenderDescriptor } from "./aggregate-descriptors";

// ---------------------------------------------------------------------------
// CellRow / TaskRow — re-exported from generated types, not redefined
// ---------------------------------------------------------------------------

export type CellRow = Database["public"]["Tables"]["cell"]["Row"];
export type TaskRow = Database["public"]["Tables"]["task"]["Row"];

// ---------------------------------------------------------------------------
// CellTypeId
//
// Hand-written union mirroring the migration's column_type_check constraint
// (`supabase/migrations/<TS>_extend_column_type_check.sql`). Supabase's type
// generator emits `string` for check-constrained columns, so we maintain this
// union manually. Keep in sync with the constraint and with S2's
// `CellTypeIdSchema` (lib/validations/column.ts).
// ---------------------------------------------------------------------------

export type CellTypeId =
  | "text"
  | "long_text"
  | "status"
  | "priority"
  | "person"
  | "date"
  | "timeline"
  | "number"
  | "currency"
  | "checkbox"
  | "file"
  | "link"
  | "tags"
  | "rating"
  | "email"
  | "phone"
  | "country"
  | "vote"
  | "week"
  | "location"
  | "updated_by"
  | "created_by"
  | "created_at_col"
  | "formula";

// ---------------------------------------------------------------------------
// AggregationKind
// ---------------------------------------------------------------------------

export type AggregationKind =
  | "count"
  | "count_empty"
  | "count_non_empty"
  | "count_unique"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "median"
  | "percent_by_label"
  | "percent_checked"
  | "range"
  | "earliest"
  | "latest";

// ---------------------------------------------------------------------------
// FilterOperator
// ---------------------------------------------------------------------------

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "in"
  | "not_in"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "between"
  | "before"
  | "after"
  | "today"
  | "this_week"
  | "this_month";

// ---------------------------------------------------------------------------
// CellTypeDef<TValue, TConfig>
//
// The single interface every cell type must satisfy. One definition per
// type-id folder under `components/cells/<type>/def.ts`.
//
// `TConfig` corresponds to `column.settings` (jsonb) in the DB — the
// per-column configuration set at column-creation time.
// `TValue` is the strongly-typed value produced by fromRow / consumed by toRow.
// ---------------------------------------------------------------------------

export type CellTypeDef<TValue, TConfig = Record<string, never>> = {
  /** Short string id matching `CellTypeId`. */
  id: CellTypeId;

  /** Human-readable name shown in the add-column type picker (e.g. "Status"). */
  label: string;

  /** Lucide icon component used in column headers and the type picker. */
  icon: ComponentType<{ className?: string }>;

  /** Default per-column config when the column is first created. */
  defaultConfig: TConfig;

  /** Default cell value when a new task row is created. */
  defaultValue: TValue | null;

  /**
   * Whether the editor renders inline inside the cell or inside a floating
   * Base UI Popover. The `<CellEditor />` orchestrator (S15) reads this to
   * decide rendering strategy. (Added per Q14.)
   */
  editorMode: "inline" | "popover";

  // ------------------------------------------------------------------
  // Codec: row ↔ value
  // ------------------------------------------------------------------

  /**
   * Extract the strongly-typed value from a `cell` row (or undefined when
   * the row doesn't exist yet). Must be a pure function.
   */
  fromRow: (row: CellRow | undefined) => TValue | null;

  /**
   * Produce the `Partial<CellRow>` patch to upsert. MUST explicitly null
   * every value column it does NOT own, so stale data from a previous column
   * type is cleared (see `cell_one_value_check` constraint).
   */
  toRow: (value: TValue | null) => Partial<CellRow>;

  // ------------------------------------------------------------------
  // Renderers
  // ------------------------------------------------------------------

  /** Read-mode renderer shown in the table cell. */
  Cell: ComponentType<{ value: TValue | null; config: TConfig; row: TaskRow }>;

  /**
   * Edit-mode renderer. Emits `onChange` with a new value; `onClose` signals
   * the orchestrator to save and close. The orchestrator handles the
   * optimistic update + server action + rollback dance — editors stay thin.
   */
  Editor: ComponentType<{
    value: TValue | null;
    config: TConfig;
    onChange: (next: TValue | null) => void;
    onClose: () => void;
  }>;

  /**
   * Optional per-column settings UI rendered in the add-column modal and
   * the column header settings panel.
   */
  ConfigEditor?: ComponentType<{ config: TConfig; onChange: (c: TConfig) => void }>;

  // ------------------------------------------------------------------
  // Aggregation
  // ------------------------------------------------------------------

  /** Which aggregation kinds are available for this cell type. */
  aggregations: AggregationKind[];

  /**
   * The aggregation kind shown by default in the group footer for this cell type.
   * Falls back to `aggregations[0]` when absent.
   *
   * Introduced in Epic 16 (Slice C) to make footer aggregation type-aware.
   */
  defaultAggregation?: AggregationKind;

  /**
   * Compute and format an aggregation across a column of values for a group
   * footer row. Returns either a display-ready string (legacy, renders as plain
   * text) or an `AggregateRenderDescriptor` (structured payload rendered by
   * `<AggregateRender />`).
   *
   * String returns continue to work at every existing call site — backward-
   * compatible. Descriptor returns are only consumed by `FooterCell` in
   * `GroupFooter.tsx`.
   */
  aggregate: (
    values: TValue[],
    kind: AggregationKind,
    config: TConfig,
  ) => string | AggregateRenderDescriptor;

  // ------------------------------------------------------------------
  // Filtering
  // ------------------------------------------------------------------

  /** Which filter operators apply to this cell type. */
  filterOperators: FilterOperator[];

  /**
   * Evaluate whether a cell value matches a filter expression.
   * Called client-side for instant filtering; the server action re-validates.
   */
  matchesFilter: (value: TValue | null, op: FilterOperator, operand: unknown) => boolean;

  // ------------------------------------------------------------------
  // Search
  // ------------------------------------------------------------------

  /**
   * Render the value as a plain-text searchable string. Used by in-board search
   * (Epic 11) to test whether a cell matches a free-text query.
   *
   * MUST be a pure function. Return "" when the cell is empty or when search has
   * no useful representation (e.g. file cell — file names are searched via the
   * attachment table directly in v2; for v1 file returns "").
   *
   * `config` is the column.settings jsonb (typed as TConfig). Some types resolve
   * labels via config (e.g. status pulls label title from column.labels).
   */
  toSearchString: (value: TValue | null, config: TConfig) => string;

  /**
   * Optional compact-mode operand input for the filter builder. When absent, the
   * filter UI falls back to the regular `Editor` rendered in a Base UI Popover.
   *
   * `compact: true` signals the editor to shrink internal paddings and hide
   * footer chrome that's appropriate for a free-standing cell edit.
   *
   * `op` is the active filter operator — useful for editors that switch between
   * single-value and multi-value modes (e.g. status `equals` vs `in`).
   */
  OperandEditor?: ComponentType<{
    value: unknown;
    config: TConfig;
    op: FilterOperator;
    compact: true;
    onChange: (next: unknown) => void;
    onClose: () => void;
  }>;

  // ------------------------------------------------------------------
  // Sorting
  // ------------------------------------------------------------------

  /** Comparator for ascending sort. Return negative/zero/positive. */
  compare: (a: TValue | null, b: TValue | null) => number;

  // ------------------------------------------------------------------
  // Type conversion
  // ------------------------------------------------------------------

  /**
   * Per-destination-type conversion entries. When a column changes from this
   * type to another, the server action resolves `convertTo[newType].fn(value)`
   * for each existing cell row. Omitted pairs lose all data (user is warned).
   *
   * `lossy: true` marks conversions that may silently discard data (e.g.
   * text → status, where a free-form string can't map to a label). The
   * `changeColumnType` server action (S5) checks this flag and requires the
   * caller to pass `confirmDataLoss: true` before proceeding.
   *
   * Backward-compatibility note: the `changeColumnType` action already probes
   * the runtime shape at call time (`typeof entry === "function"` vs `{ fn, lossy? }`),
   * so consolidating to the object shape here is forward-compatible with S5.
   */
  convertTo: Partial<
    Record<CellTypeId, { fn: (value: TValue | null) => unknown; lossy?: boolean }>
  >;
};
