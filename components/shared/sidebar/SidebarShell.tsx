import type { ReactNode } from "react";
import { Topbar } from "@/components/shared/topbar/Topbar";
import type { CurrentUser } from "@/lib/auth/current-user";
import { MainSidebar } from "./MainSidebar";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

type Workspace = {
  id: string;
  slug: string;
  name: string;
};

type WorkspaceMemberRow = {
  workspace: Workspace | Workspace[] | null;
};

type SidebarShellProps = {
  user: CurrentUser;
  workspaces: WorkspaceMemberRow[];
  children: ReactNode;
};

function extractWorkspace(row: WorkspaceMemberRow): Workspace | null {
  if (!row.workspace) return null;
  if (Array.isArray(row.workspace)) return row.workspace[0] ?? null;
  return row.workspace;
}

export function SidebarShell({ user, workspaces, children }: SidebarShellProps) {
  const flatWorkspaces = workspaces.map(extractWorkspace).filter((w): w is Workspace => w !== null);

  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      {/* Main nav rail (desktop) + mobile bottom bar + mobile drawer */}
      <MainSidebar user={user} workspaces={flatWorkspaces} />

      {/* Workspace rail + main content area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Workspace sidebar — desktop only; mobile uses the Sheet drawer in MainSidebar */}
        <div className="hidden md:flex" style={{ flexShrink: 0 }}>
          <WorkspaceSidebar workspaces={flatWorkspaces} />
        </div>

        {/* Main content column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            overflow: "hidden",
          }}
        >
          {/* Topbar */}
          <Topbar user={user} />

          {/* Page content */}
          <main
            style={{
              flex: 1,
              overflow: "auto",
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
