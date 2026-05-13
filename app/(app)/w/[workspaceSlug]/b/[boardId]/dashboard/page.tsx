"use client";

/**
 * Dashboard view page — /w/[workspaceSlug]/b/[boardId]/dashboard
 *
 * Client page (not RSC) because `next/dynamic` with `ssr: false` is only
 * allowed in Client Components in Next.js 15. react-grid-layout references
 * `window` at import time, so the underlying <Dashboard /> must be loaded
 * client-only. Data is still hydrated by the board layout via
 * <BoardDataProvider>; this page is a thin client shell.
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
