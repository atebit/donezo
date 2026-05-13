"use client";

/**
 * Widget — frame component for each dashboard widget.
 *
 * Visual contract (must-match per component-system Visual fidelity — Dashboard):
 *   - 2px border var(--color-border-strong); hover border var(--color-primary)
 *   - Header separator: 1px solid var(--color-border-strong)
 *   - Header has: drag handle (class widget-drag-handle), title, overflow menu
 *
 * Switches on config.kind to render the appropriate widget body.
 */

import { useState } from "react";
import { GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Popover } from "@base-ui/react";
import type { WidgetConfig, ViewConfig } from "@/lib/views/config-schema";
import { MenuList, MenuListItem } from "@/components/ui/menu-list";
import { BarWidget } from "./widgets/BarWidget";
import { LineWidget } from "./widgets/LineWidget";
import { NumberWidget } from "./widgets/NumberWidget";
import { PieWidget } from "./widgets/PieWidget";
import { TableWidget } from "./widgets/TableWidget";

interface WidgetProps {
  widgetId: string;
  config: WidgetConfig;
  /** Active view-level filter to pass down to widget data selectors. */
  viewFilter?: ViewConfig["filter"];
  onEdit: (widgetId: string) => void;
  onDelete: (widgetId: string) => void;
}

export function Widget({ widgetId, config, viewFilter, onEdit, onDelete }: WidgetProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const title = getWidgetTitle(config);

  return (
    <div className="dashboard-widget">
      {/* Header */}
      <div className="dashboard-widget-header">
        {/* Drag handle — react-grid-layout drags only from this element */}
        <span
          className="widget-drag-handle"
          aria-label="Drag to reorder widget"
          role="presentation"
        >
          <GripVertical size={14} />
        </span>

        <span className="dashboard-widget-title">{title}</span>

        {/* Overflow menu */}
        <div className="dashboard-widget-actions">
          <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Popover.Trigger
              className="flex items-center justify-center w-6 h-6 rounded text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] focus-visible:outline-none"
              aria-label="Widget actions"
            >
              <MoreHorizontal size={14} />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner side="bottom" align="end" sideOffset={4}>
                <Popover.Popup className="outline-none z-[var(--z-popover)]">
                  <MenuList>
                    <MenuListItem
                      onClick={() => {
                        setMenuOpen(false);
                        onEdit(widgetId);
                      }}
                    >
                      <Pencil size={13} />
                      Edit
                    </MenuListItem>
                    <MenuListItem
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete(widgetId);
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 size={13} />
                      Delete
                    </MenuListItem>
                  </MenuList>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>

      {/* Body */}
      <div className="dashboard-widget-body">
        <WidgetBody config={config} viewFilter={viewFilter} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WidgetBody — switches on config.kind
// ---------------------------------------------------------------------------

function WidgetBody({
  config,
  viewFilter,
}: {
  config: WidgetConfig;
  viewFilter?: ViewConfig["filter"];
}) {
  switch (config.kind) {
    case "number":
      return (
        <NumberWidget
          columnId={config.columnId}
          aggregation={config.aggregation}
          label={config.label}
          filter={viewFilter}
        />
      );

    case "bar":
      return (
        <BarWidget
          xColumnId={config.xColumnId}
          yAggregation={config.yAggregation}
          yColumnId={config.yColumnId}
          filter={viewFilter}
        />
      );

    case "pie":
      return (
        <PieWidget
          columnId={config.columnId}
          aggregation={config.aggregation}
          filter={viewFilter}
        />
      );

    case "line":
      return (
        <LineWidget
          dateColumnId={config.dateColumnId}
          yAggregation={config.yAggregation}
          yColumnId={config.yColumnId}
          bucket={config.bucket}
          filter={viewFilter}
        />
      );

    case "table":
      return (
        <TableWidget
          filter={config.filter}
          sort={config.sort}
          limit={config.limit}
          viewFilter={viewFilter}
        />
      );

    default:
      return (
        <div className="flex items-center justify-center h-full text-sm text-[color:var(--color-fg-muted)]">
          Unknown widget type
        </div>
      );
  }
}

// ---------------------------------------------------------------------------
// Title helpers
// ---------------------------------------------------------------------------

function getWidgetTitle(config: WidgetConfig): string {
  switch (config.kind) {
    case "number":
      return config.label ?? `Number`;
    case "bar":
      return "Bar chart";
    case "pie":
      return "Pie chart";
    case "line":
      return "Line chart";
    case "table":
      return "Table";
    default:
      return "Widget";
  }
}
