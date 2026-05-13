"use client";

/**
 * Dashboard — react-grid-layout-driven container for dashboard widgets.
 *
 * This component is dynamically imported with { ssr: false } from the page
 * because react-grid-layout references `window` at module import time.
 *
 * Layout state lives in view.config.dashboard (DashboardConfigSchema).
 * On onLayoutChange, debounces 750ms then calls useBoardView().applyDraft().
 *
 * Spec reference: Slice E §E.2
 */

import { useCallback, useRef, useState } from "react";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";
import type { Layout } from "react-grid-layout";
import { Plus } from "lucide-react";
import { useBoardView } from "@/hooks/use-board-view";
import {
  DashboardConfigSchema,
  WidgetConfigSchema,
  type DashboardConfig,
  type WidgetConfig,
} from "@/lib/views/config-schema";
import { Widget } from "./Widget";
import { WidgetEditor } from "./WidgetEditor";
import "react-grid-layout/css/styles.css";
import "./dashboard.css";

/**
 * Generate a simple unique id for a new widget.
 * Client-side only — widget ids are only keys in the view.config JSONB,
 * never the DB PK (which is always gen_random_uuid() from Postgres).
 */
function generateWidgetId(): string {
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function Dashboard() {
  const { effective, applyDraft } = useBoardView();

  // Container width measurement (react-grid-layout v2 hook-based API).
  const { width, containerRef } = useContainerWidth();

  // Parse dashboard config with safe defaults.
  const dashConfig: DashboardConfig = DashboardConfigSchema.parse(
    effective.dashboard ?? {},
  );

  // WidgetEditor state: null = closed; widgetId = editing that widget.
  const [editorWidgetId, setEditorWidgetId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  // Debounce timer ref for layout changes (750ms debounce on top of applyDraft's 200ms).
  const layoutDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Layout change handler — debounced 750ms
  // ---------------------------------------------------------------------------
  const handleLayoutChange = useCallback(
    (layout: Layout) => {
      if (layoutDebounceRef.current) clearTimeout(layoutDebounceRef.current);
      layoutDebounceRef.current = setTimeout(() => {
        const currentDash = DashboardConfigSchema.parse(effective.dashboard ?? {});
        // Map to our GridLayoutItem shape (only i, x, y, w, h).
        const newLayout = layout.map((item) => ({
          i: item.i,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
        }));
        applyDraft({
          dashboard: {
            ...currentDash,
            layout: newLayout,
          },
        });
      }, 750);
    },
    [effective.dashboard, applyDraft],
  );

  // ---------------------------------------------------------------------------
  // Widget CRUD
  // ---------------------------------------------------------------------------
  const handleAddWidget = useCallback(() => {
    setEditorWidgetId(null);
    setEditorOpen(true);
  }, []);

  const handleEditWidget = useCallback((widgetId: string) => {
    setEditorWidgetId(widgetId);
    setEditorOpen(true);
  }, []);

  const handleDeleteWidget = useCallback(
    (widgetId: string) => {
      const currentDash = DashboardConfigSchema.parse(effective.dashboard ?? {});
      const { [widgetId]: _removed, ...remainingWidgets } = currentDash.widgets;
      const newLayout = currentDash.layout.filter((item) => item.i !== widgetId);
      applyDraft({
        dashboard: {
          ...currentDash,
          widgets: remainingWidgets,
          layout: newLayout,
        },
      });
    },
    [effective.dashboard, applyDraft],
  );

  const handleEditorOpenChange = useCallback(
    (open: boolean) => {
      setEditorOpen(open);
      if (!open) {
        setEditorWidgetId(null);
      }
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Derive widget ids from layout order (layout is the source of truth for order).
  // ---------------------------------------------------------------------------
  const orderedWidgetIds = dashConfig.layout
    .map((item) => item.i)
    .filter((id) => id in dashConfig.widgets);

  const hasWidgets = orderedWidgetIds.length > 0;

  // Convert stored layout to react-grid-layout format.
  const rglLayout: Layout = dashConfig.layout
    .filter((item) => item.i in dashConfig.widgets)
    .map((item) => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }));

  // The widget config for the editor (null when creating).
  const editorInitialConfig: WidgetConfig | null =
    editorWidgetId !== null ? (dashConfig.widgets[editorWidgetId] ?? null) : null;

  return (
    <div className="relative flex flex-col h-full min-h-0 overflow-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-end px-4 py-2 flex-shrink-0">
        <button
          type="button"
          onClick={handleAddWidget}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-[color:var(--color-primary)] text-white hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
        >
          <Plus size={14} />
          Add widget
        </button>
      </div>

      {/* Grid or empty state */}
      {hasWidgets ? (
        <div className="flex-1 px-4 pb-4">
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: rglLayout, md: rglLayout, sm: rglLayout, xs: rglLayout, xxs: rglLayout }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={60}
            draggableHandle=".widget-drag-handle"
            onLayoutChange={handleLayoutChange}
            margin={[12, 12]}
          >
            {orderedWidgetIds.map((widgetId) => {
              const config = dashConfig.widgets[widgetId];
              // Validate the config shape before rendering.
              const parsed = WidgetConfigSchema.safeParse(config);
              if (!parsed.success) return null;

              return (
                <div key={widgetId}>
                  <Widget
                    widgetId={widgetId}
                    config={parsed.data}
                    viewFilter={effective.filter}
                    onEdit={handleEditWidget}
                    onDelete={handleDeleteWidget}
                  />
                </div>
              );
            })}
          </ResponsiveGridLayout>
        </div>
      ) : (
        <div className="dashboard-empty-placeholder">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <p className="text-sm font-medium">No widgets yet</p>
          <p className="text-xs">Click &quot;Add widget&quot; to get started.</p>
        </div>
      )}

      {/* Widget editor dialog */}
      <WidgetEditor
        open={editorOpen}
        onOpenChange={handleEditorOpenChange}
        widgetId={editorWidgetId}
        existingConfig={editorInitialConfig}
      />
    </div>
  );
}
