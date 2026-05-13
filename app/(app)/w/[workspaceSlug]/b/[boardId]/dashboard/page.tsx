/**
 * Dashboard view page — /w/[workspaceSlug]/b/[boardId]/dashboard
 *
 * RSC shell. Data is hydrated by the board layout via <BoardDataProvider>.
 * This page dynamically imports <Dashboard /> with `ssr: false` because
 * react-grid-layout references `window` at import time.
 *
 * Mirror of the other per-kind pages (kanban/page.tsx, calendar/page.tsx).
 *
 * Epic 12, Slice E — E.1.
 */

import dynamic from "next/dynamic";

// Dashboard.tsx uses a named export (not default) to comply with biome's
// noDefaultExport rule for non-page files. We use `.then` to map it to a
// default-shaped module for next/dynamic.
const Dashboard = dynamic(
  () => import("@/components/board/dashboard/Dashboard").then((m) => ({ default: m.Dashboard })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-sm text-[color:var(--color-fg-subtle)]">
        Loading dashboard…
      </div>
    ),
  },
);

export default function DashboardPage() {
  return <Dashboard />;
}
