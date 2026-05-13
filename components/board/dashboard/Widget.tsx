"use client";

/**
 * Widget — frame component for dashboard widgets.
 *
 * Renders:
 *   - A drag handle header (class `widget-drag-handle`) containing title +
 *     overflow menu (Edit / Delete).
 *   - The appropriate widget body component based on `config.kind`.
 *
 * Visual contract (component-system §1.4):
 *   - 2px border --color-border-strong; hover border --color-primary.
 *   - Header separator: 1px solid --color-border-strong.
 *
 * Epic 12, Slice E — E.3.
 */

import { GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FilterTree, WidgetConfig } from "@/lib/views/config-schema";
import { BarWidget } from "./widgets/BarWidget";
import { LineWidget } from "./widgets/LineWidget";
import { NumberWidget } from "./widgets/NumberWidget";
import { PieWidget } from "./widgets/PieWidget";
import { TableWidget } from "./widgets/TableWidget";

interface WidgetProps {
  id: string;
  config: WidgetConfig;
  activeFilter?: FilterTree | undefined;
  onEdit: (widgetId: string) => void;
  onDelete: (widgetId: string) => void;
}

/** Returns a human-readable default title for a widget kind. */
function defaultTitle(config: WidgetConfig): string {
  switch (config.kind) {
    case "number":
      return config.label ?? "Number";
    case "bar":
      return "Bar chart";
    case "pie":
      return "Pie chart";
    case "line":
      return "Line chart";
    case "table":
      return "Table";
  }
}

export function Widget({ id, config, activeFilter, onEdit, onDelete }: WidgetProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const title = defaultTitle(config);

  return (
    <div className="dashboard-widget">
      {/* Drag handle — the react-grid-layout draggableHandle target. */}
      <div className="widget-drag-handle">
        <GripVertical
          size={14}
          className="shrink-0"
          style={{ color: "var(--color-fg-subtle)", pointerEvents: "none" }}
          aria-hidden
        />
        <span className="widget-drag-handle-title">{title}</span>

        {/* Overflow menu — rendered inline to stay within the client boundary. */}
        <div className="widget-drag-handle-actions">
          <div style={{ position: "relative" }}>
            <button
              type="button"
              aria-label="Widget options"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "2px 4px",
                borderRadius: 4,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--color-fg-subtle)",
              }}
            >
              <MoreHorizontal size={14} />
            </button>

            {menuOpen && (
              <>
                {/* Backdrop to dismiss the menu on outside click. */}
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 49,
                  }}
                  onClick={() => setMenuOpen(false)}
                  aria-hidden
                />
                <div
                  role="menu"
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    zIndex: 50,
                    background: "var(--color-bg-elevated)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                    minWidth: 120,
                    padding: "4px 0",
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(id);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "6px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--color-fg)",
                      textAlign: "left",
                    }}
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(id);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "6px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                      color: "var(--color-error, #ef4444)",
                      textAlign: "left",
                    }}
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Widget body — switches on kind. */}
      {config.kind === "number" && (
        <NumberWidget config={config} {...(activeFilter ? { activeFilter } : {})} />
      )}
      {config.kind === "bar" && (
        <BarWidget config={config} {...(activeFilter ? { activeFilter } : {})} />
      )}
      {config.kind === "pie" && (
        <PieWidget config={config} {...(activeFilter ? { activeFilter } : {})} />
      )}
      {config.kind === "line" && (
        <LineWidget config={config} {...(activeFilter ? { activeFilter } : {})} />
      )}
      {config.kind === "table" && (
        <TableWidget config={config} {...(activeFilter ? { activeFilter } : {})} />
      )}
    </div>
  );
}
