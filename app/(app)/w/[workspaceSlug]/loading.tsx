import { DashboardSkeleton } from "@/components/shared/skeletons/DashboardSkeleton";
import { WorkspaceSidebarSkeleton } from "@/components/shared/skeletons/WorkspaceSidebarSkeleton";

/**
 * Workspace route loading skeleton.
 *
 * Shown while app/(app)/w/[workspaceSlug]/layout.tsx is awaiting
 * workspace data + sidebar boards from the server.
 *
 * Composes WorkspaceSidebarSkeleton (left rail) + DashboardSkeleton (main content).
 */
export default function WorkspaceLoading() {
  return (
    <div className="flex h-full w-full">
      <WorkspaceSidebarSkeleton />
      <div className="flex-1 overflow-hidden">
        <DashboardSkeleton />
      </div>
    </div>
  );
}
