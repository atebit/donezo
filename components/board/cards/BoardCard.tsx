"use client";

/**
 * BoardCard — single task card for the mobile card list view.
 *
 * Visual spec:
 *   +---------------------------------------------+
 *   |  ● Status pill   [Title text (2-line max)]   |
 *   |  Avatar pile                           ⋯     |
 *   |  Due May 15  •  $1,200  •  4 files           |
 *   +---------------------------------------------+
 *
 * Shows:
 *   - Title (clamped to 2 lines via CSS).
 *   - Status pill (first `status` column, if visible and cell is non-empty).
 *   - Top-3 visible non-empty cell labels (column.visible && cell.value).
 *   - Assignee avatars (person column, up to 4 shown).
 *   - Summary row: Due {date} • {currency formatted} • {N files} — omit any null segment.
 *
 * Tap → navigate to task drawer (same href as table row).
 * In reorderMode: drag handle is shown, tap-to-open is suppressed.
 */

import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { GripVertical } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Cell, Column, Task } from "@/components/board/table/types";
import { useBoardStore } from "@/stores/board-store";

// ---------------------------------------------------------------------------
// Cell value helpers — read raw cell JSON without importing cell renderers.
// Keeping this module free of cell renderer imports prevents pulling in
// all cell UI (and their deps) into the mobile card bundle.
// ---------------------------------------------------------------------------

/** Extract a display-ready string from a cell value for the summary row. */
function readCellValue(cell: Cell | undefined, columnType: string): string | null {
  if (!cell) return null;

  switch (columnType) {
    case "date": {
      const raw = cell.date_value;
      if (!raw) return null;
      // ISO date string → locale display
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }
    case "currency":
    case "number": {
      const n = cell.number_value;
      if (n === null || n === undefined) return null;
      if (columnType === "currency") {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(n);
      }
      return String(n);
    }
    case "file": {
      // The actual count comes from attachments in the store; here we just
      // signal that the cell is non-empty so callers can skip it if 0.
      return null; // handled separately via attachmentsByTask
    }
    case "text":
    case "long_text":
    case "link":
    case "email":
    case "phone": {
      return cell.text_value ?? null;
    }
    case "checkbox": {
      return cell.boolean_value ? "Checked" : null;
    }
    default:
      return cell.text_value ?? null;
  }
}

/** Extract status label id from a status/priority cell. */
function readStatusLabelId(cell: Cell | undefined): string | null {
  if (!cell) return null;
  return cell.label_id ?? null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatusPillProps {
  labelId: string;
  columnId: string;
}

function StatusPill({ labelId, columnId }: StatusPillProps) {
  const label = useBoardStore((s) => {
    const labels = s.labelsByColumn.get(columnId);
    return labels?.find((l) => l.id === labelId) ?? null;
  });

  if (!label) return null;

  return (
    <span
      role="img"
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium leading-none flex-shrink-0"
      style={{
        backgroundColor: label.color ?? "var(--color-fg-muted)",
        color: "#fff",
      }}
      aria-label={`Status: ${label.name}`}
    >
      {label.name}
    </span>
  );
}

// ---------------------------------------------------------------------------
// BoardCard
// ---------------------------------------------------------------------------

export interface BoardCardProps {
  task: Task;
  /** Optional: drag handle listeners from dnd-kit sortable (only in reorderMode) */
  dragHandleListeners?: SyntheticListenerMap | undefined;
  dragHandleAttributes?: Record<string, unknown> | undefined;
}

export function BoardCard({ task, dragHandleListeners, dragHandleAttributes }: BoardCardProps) {
  const params = useParams<{ workspaceSlug: string; boardId: string }>();
  const reorderMode = useBoardStore((s) => s.reorderMode);

  const cells = useBoardStore((s) => s.cells);
  const columns = useBoardStore((s) => s.columns);
  const columnPrefsByBoard = useBoardStore((s) => s.columnPrefsByBoard);
  const boardId = useBoardStore((s) => s.boardId);
  const attachmentsByTask = useBoardStore((s) => s.attachmentsByTask);

  // Determine visible columns using the same logic as TaskRow.
  const boardPrefs = boardId ? (columnPrefsByBoard[boardId] ?? {}) : {};
  const visibleColumns = columns.filter((c) => {
    return !boardPrefs[c.id]?.hidden;
  });

  // --- Status pill ---
  const statusColumn = visibleColumns.find((c) => c.type === "status");
  const statusCell = statusColumn ? cells.get(`${task.id}:${statusColumn.id}`) : undefined;
  const statusLabelId = statusColumn ? readStatusLabelId(statusCell) : null;

  // --- Title column ---
  const textColumns = visibleColumns.filter((c) => c.type === "text");
  const titleColumn: Column | undefined =
    textColumns.length > 0
      ? textColumns.reduce<Column | undefined>(
          (min, c) => (min === undefined || c.position < min.position ? c : min),
          undefined,
        )
      : visibleColumns[0];

  // --- Top-3 visible non-empty cells (exclude title + status) ---
  const otherColumns = visibleColumns.filter(
    (c) => c.id !== titleColumn?.id && c.type !== "status" && c.type !== "person",
  );

  interface CellSummary {
    column: Column;
    display: string;
  }
  const topCells: CellSummary[] = [];
  for (const col of otherColumns) {
    if (topCells.length >= 3) break;
    const cell = cells.get(`${task.id}:${col.id}`);
    const display = readCellValue(cell, col.type);
    if (display) {
      topCells.push({ column: col, display });
    }
  }

  // --- Assignee avatars (person column) ---
  // Person cell stores { userIds: string[] } in json_value (see person/def.ts).
  const personColumn = visibleColumns.find((c) => c.type === "person");
  const personCell = personColumn ? cells.get(`${task.id}:${personColumn.id}`) : undefined;
  let assigneeIds: string[] = [];
  if (personCell?.json_value) {
    const jv = personCell.json_value as unknown;
    if (
      jv !== null &&
      typeof jv === "object" &&
      !Array.isArray(jv) &&
      "userIds" in jv &&
      Array.isArray((jv as { userIds: unknown }).userIds)
    ) {
      assigneeIds = (jv as { userIds: string[] }).userIds.slice(0, 4);
    }
  }

  // --- Summary row: date • currency • files ---
  const dateColumn = visibleColumns.find((c) => c.type === "date");
  const dateCell = dateColumn ? cells.get(`${task.id}:${dateColumn.id}`) : undefined;
  const dateDisplay = dateColumn ? readCellValue(dateCell, "date") : null;

  const currencyColumn = visibleColumns.find((c) => c.type === "currency");
  const currencyCell = currencyColumn ? cells.get(`${task.id}:${currencyColumn.id}`) : undefined;
  const currencyDisplay = currencyColumn ? readCellValue(currencyCell, "currency") : null;

  const fileCount = attachmentsByTask.get(task.id)?.length ?? 0;

  const summarySegments: string[] = [];
  if (dateDisplay) summarySegments.push(`Due ${dateDisplay}`);
  if (currencyDisplay) summarySegments.push(currencyDisplay);
  if (fileCount > 0) summarySegments.push(`${fileCount} file${fileCount !== 1 ? "s" : ""}`);

  // Task drawer href — same pattern as table row click / overflow menu
  const drawerHref =
    params?.workspaceSlug && params?.boardId
      ? `/w/${params.workspaceSlug}/b/${params.boardId}/t/${task.id}`
      : null;

  const cardContent = (
    <div
      className="rounded-[var(--radius-md)] border border-[color:var(--color-border-solid)] bg-[color:var(--color-surface)] p-3 w-full text-left relative"
      style={{ boxShadow: "var(--shadow-card)" }}
      data-task-id={task.id}
    >
      {/* Drag handle — shown only in reorder mode */}
      {reorderMode && (
        <button
          type="button"
          aria-label="Drag to reorder"
          className="absolute top-2 right-2 p-1 cursor-grab active:cursor-grabbing text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] rounded touch-none"
          // biome-ignore lint/suspicious/noExplicitAny: dnd-kit listeners are untyped at JSX spread site
          {...((dragHandleAttributes as any) ?? {})}
          // biome-ignore lint/suspicious/noExplicitAny: dnd-kit listeners are untyped at JSX spread site
          {...((dragHandleListeners as any) ?? {})}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
      )}

      {/* Row 1: Status pill + title */}
      <div className="flex items-start gap-2 pr-6">
        {statusColumn && statusLabelId && (
          <StatusPill labelId={statusLabelId} columnId={statusColumn.id} />
        )}
        <p
          className="text-sm font-medium text-[color:var(--color-fg)] leading-snug"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {task.title || "Untitled"}
        </p>
      </div>

      {/* Row 2: Top-3 non-empty cells */}
      {topCells.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
          {topCells.map(({ column, display }) => (
            <span key={column.id} className="text-xs text-[color:var(--color-fg-muted)]">
              <span className="font-medium">{column.name}:</span> {display}
            </span>
          ))}
        </div>
      )}

      {/* Row 3: Assignee avatars */}
      {assigneeIds.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5">
          {assigneeIds.map((userId) => (
            <span
              key={userId}
              className="w-6 h-6 rounded-full bg-[color:var(--color-primary)] text-white text-[10px] font-semibold flex items-center justify-center flex-shrink-0"
              title={userId}
              aria-hidden="true"
            >
              {userId.slice(0, 2).toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {/* Row 4: Summary row */}
      {summarySegments.length > 0 && (
        <div className="mt-1.5 text-xs text-[color:var(--color-fg-muted)]">
          {summarySegments.join(" • ")}
        </div>
      )}
    </div>
  );

  // In reorder mode, the card is not interactive for navigation.
  if (reorderMode || !drawerHref) {
    return <div className="w-full">{cardContent}</div>;
  }

  return (
    <Link
      href={drawerHref}
      className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] rounded-[var(--radius-md)]"
      aria-label={`Open task: ${task.title || "Untitled"}`}
    >
      {cardContent}
    </Link>
  );
}
