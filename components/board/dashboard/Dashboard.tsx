"use client";

/**
 * Dashboard — react-grid-layout-driven container for dashboard widgets.
 *
 * This component is dynamically imported with `{ ssr: false }` from the page
 * because react-grid-layout references `window` at import time.
 *
 * Responsibilities:
 *   - Reads dashboard config from the active view (layout + widgets dict).
 *   - Renders a <Responsive> grid with <WidthProvider> wrapping.
 *   - Provides a "+ Add widget" toolbar button (top-right).
 *   - Propagates layout changes to the draft config (debounced 750ms on top
 *     of useBoardView's existing 200ms debounce, per spec §E.2).
 *   - Handles widget CRUD via <WidgetEditor />.
 *
 * Import: dynamic(() => import('@/components/board/dashboard/Dashboard'), { ssr: false })
 *
 * Epic 12, Slice E — E.2.
 */

import "react-grid-layout/css/styles.css";
import "./dashboard.css";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Layout } from "react-grid-layout";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";

import { useBoardView } from "@/hooks/use-board-view";
import {
  type DashboardConfig,
  DashboardConfigSchema,
  type WidgetConfig,
} from "@/lib/views/config-schema";
import { Widget } from "./Widget";
import { WidgetEditor } from "./WidgetEditor";

// ---------------------------------------------------------------------------
// react-grid-layout setup
// ---------------------------------------------------------------------------

const ResponsiveGridLayout = WidthProvider(Responsive);

/** Layout cols at each responsive breakpoint. */
const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };

/** Row height in pixels. */
const ROW_HEIGHT = 60;

// ---------------------------------------------------------------------------
// UUID helper — generates a random widget id (client-side only).
// ---------------------------------------------------------------------------

function newWidgetId(): string {
  return `w_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Dashboard component
// ---------------------------------------------------------------------------

export function Dashboard() {
  const { effective, applyDraft } = useBoardView();

  // Parse the dashboard sub-config (default: empty layout + empty widgets).
  const dashboardConfig: DashboardConfig = DashboardConfigSchema.parse(effective.dashboard ?? {});

  // ---------------------------------------------------------------------------
  // Widget editor state
  // ---------------------------------------------------------------------------
  const [editorState, setEditorState] = useState<{
    open: boolean;
    widgetId: string | null;
    existingConfig?: WidgetConfig;
  }>({ open: false, widgetId: null });

  const openCreateEditor = () => setEditorState({ open: true, widgetId: null });

  const openEditEditor = (widgetId: string) => {
    const existingConfig = dashboardConfig.widgets[widgetId];
    setEditorState({
      open: true,
      widgetId,
      ...(existingConfig ? { existingConfig } : {}),
    });
  };

  const closeEditor = () => setEditorState((prev) => ({ ...prev, open: false }));

  // ---------------------------------------------------------------------------
  // Widget CRUD
  // ---------------------------------------------------------------------------

  const handleSaveWidget = useCallback(
    (widgetId: string | null, config: WidgetConfig) => {
      const id = widgetId ?? newWidgetId();
      const current = dashboardConfig;

      const isNew = !widgetId;
      const newLayout = isNew
        ? [
            ...current.layout,
            {
              i: id,
              x: 0,
              // Placing at Infinity causes react-grid-layout to auto-pack at the
              // bottom, which is the correct "add to end" behavior.
              y: Number.POSITIVE_INFINITY,
              w: 4,
              h: 3,
            },
          ]
        : current.layout;

      applyDraft({
        dashboard: {
          ...current,
          widgets: { ...current.widgets, [id]: config },
          layout: newLayout,
        },
      });
    },
    [dashboardConfig, applyDraft],
  );

  const handleDeleteWidget = useCallback(
    (widgetId: string) => {
      const current = dashboardConfig;
      const newWidgets = { ...current.widgets };
      delete newWidgets[widgetId];
      const newLayout = current.layout.filter((item) => item.i !== widgetId);
      applyDraft({ dashboard: { ...current, widgets: newWidgets, layout: newLayout } });
    },
    [dashboardConfig, applyDraft],
  );

  // ---------------------------------------------------------------------------
  // Layout change handler — debounced 750ms
  // ---------------------------------------------------------------------------

  const layoutDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLayoutChange = useCallback(
    (layout: Layout) => {
      if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
      layoutDebounceRef.current = setTimeout(() => {
        const current = dashboardConfig;
        // Map the readonly Layout items to mutable GridLayoutItemSchema-compatible objects.
        const mutableLayout = layout.map((item) => ({
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        }));
        applyDraft({
          dashboard: {
            ...current,
            layout: mutableLayout,
          },
        });
      }, 750);
    },
    [dashboardConfig, applyDraft],
  );

  // Clean up the debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Active filter — from the effective view config.
  // ---------------------------------------------------------------------------
  const activeFilter = effective.filter;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const widgetEntries = Object.entries(dashboardConfig.widgets);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[color:var(--color-border)] shrink-0">
        <span className="text-sm font-medium text-[color:var(--color-fg-subtle)]">Dashboard</span>
        <button
          type="button"
          onClick={openCreateEditor}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)] border border-[color:var(--color-border)] transition-colors"
          data-testid="add-widget-button"
        >
          <Plus size={14} />
          Add widget
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        {widgetEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="text-4xl opacity-30" aria-hidden>
              📊
            </div>
            <p className="text-sm text-[color:var(--color-fg-subtle)]">
              No widgets yet. Click &ldquo;+ Add widget&rdquo; to get started.
            </p>
          </div>
        ) : (
          <ResponsiveGridLayout
            className="react-grid-layout"
            layouts={{ lg: dashboardConfig.layout }}
            cols={GRID_COLS}
            rowHeight={ROW_HEIGHT}
            draggableHandle=".widget-drag-handle"
            onLayoutChange={handleLayoutChange}
            resizeHandles={["se"]}
            margin={[12, 12]}
            containerPadding={[0, 0]}
          >
            {widgetEntries.map(([widgetId, widgetConfig]) => (
              <div key={widgetId} data-testid={`widget-${widgetId}`}>
                <Widget
                  id={widgetId}
                  config={widgetConfig}
                  {...(activeFilter ? { activeFilter } : {})}
                  onEdit={openEditEditor}
                  onDelete={handleDeleteWidget}
                />
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      {/* Widget editor dialog */}
      <WidgetEditor
        open={editorState.open}
        onOpenChange={(o) => {
          if (!o) closeEditor();
        }}
        widgetId={editorState.widgetId}
        {...(editorState.existingConfig ? { existingConfig: editorState.existingConfig } : {})}
        onSave={handleSaveWidget}
      />
    </div>
  );
}
