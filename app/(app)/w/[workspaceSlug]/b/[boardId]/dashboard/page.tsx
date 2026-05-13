/**
 * Dashboard view page — /w/[workspaceSlug]/b/[boardId]/dashboard
 *
 * RSC shell that dynamically imports <Dashboard /> with { ssr: false }.
 *
 * The dynamic import is REQUIRED: react-grid-layout references `window` at
 * module import time; importing it in an RSC or a non-guarded client component
 * causes a `ReferenceError: window is not defined` build error.
 *
 * Data is hydrated by the board layout via <BoardDataProvider>. This page
 * simply renders the dynamically imported container.
 *
 * Epic 12, Slice E — E.1.
 */

import dynamic from "next/dynamic";

const DashboardClient = dynamic(
  () => import("@/components/board/dashboard/Dashboard"),
  { ssr: false },
);

export default function DashboardPage() {
  return <DashboardClient />;
}
