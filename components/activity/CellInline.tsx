"use client";

/**
 * CellInline — compact cell value renderer for the activity feed.
 *
 * Wraps `cellRegistry[type].Cell` to render a from/to value in the activity log.
 * This preserves the same visual chrome (status pill colors, date format, etc.) as
 * the table view — a visual spec requirement from dispatch D.7.
 *
 * Prop contract note:
 *   CellTypeDef.Cell is typed as ComponentType<{ value, config, row: TaskRow }>.
 *   The activity feed only has a column payload value, not a full task row.
 *   We pass a minimal synthetic TaskRow that satisfies the type contract; individual
 *   Cell components only use `row` for identity (e.g. task id in person cells).
 *   If a cell type's Cell component requires meaningful row data to render correctly,
 *   that is a known limitation noted in the activity renderer for that type.
 *
 * Escalation note from D.10:
 *   If a cell type's Cell props differ from this compact-mode contract, the specific
 *   renderer in the registry should handle the mismatch rather than widening this
 *   wrapper. Kept intentionally thin.
 */

import type React from "react";
import { cellRegistry } from "@/lib/cells/registry";
import type { CellTypeId, TaskRow } from "@/lib/cells/types";

// ---------------------------------------------------------------------------
// Minimal synthetic TaskRow for read-only activity rendering.
// All fields set to safe defaults; only 'id' is semantically meaningful.
// ---------------------------------------------------------------------------

const SYNTHETIC_ROW: TaskRow = {
  id: "__activity_inline__",
  board_id: "",
  group_id: "",
  position: 0,
  title: "",
  created_at: new Date(0).toISOString(),
  created_by: null,
  deleted_at: null,
  updated_at: new Date(0).toISOString(),
  updated_by: null,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CellInlineProps {
  /** Cell type string id (e.g. "status", "date", "person"). */
  type: CellTypeId;
  /** The raw JSON payload value to render (from / to fields in activity payload). */
  value: unknown;
  /** Optional per-column config (column.settings). Defaults to empty config. */
  config?: unknown;
  /** Optional CSS class applied to the wrapper. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CellInline({ type, value, config, className }: CellInlineProps) {
  const def = cellRegistry[type];

  if (!def) {
    // Unknown type — render raw value as fallback.
    return (
      <span className={className} data-testid={`cell-inline-unknown-${type}`}>
        {typeof value === "string" ? value : JSON.stringify(value)}
      </span>
    );
  }

  // Pass the raw payload value directly after coercion.
  // The payload stored in activity.payload.from / .to already matches TValue
  // (the same shape that toRow serializes from). We coerce with `any` here
  // because CellTypeDef<TValue,TConfig> uses per-type generics that are
  // heterogeneous across the registry; biome-ignore is documented in registry.ts.
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous per-type defs — same rationale as cellRegistry.
  const CellComponent = def.Cell as React.ComponentType<any>;
  // biome-ignore lint/suspicious/noExplicitAny: same rationale.
  const typedValue = value as any;
  // biome-ignore lint/suspicious/noExplicitAny: same rationale.
  const typedConfig = (config ?? def.defaultConfig) as any;

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center" }}
      data-testid={`cell-inline-${type}`}
    >
      <CellComponent value={typedValue} config={typedConfig} row={SYNTHETIC_ROW} />
    </span>
  );
}
