import type { ReactNode } from "react";
import { Topbar } from "@/components/shared/topbar/Topbar";
import type { CurrentUser } from "@/lib/auth/current-user";
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
      {/* Skip-to-content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:left-4 focus:top-4 focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:bg-primary focus:text-primary-foreground focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Single sidebar — handles both desktop aside and mobile Sheet */}
      <WorkspaceSidebar workspaces={flatWorkspaces} user={user} />

      {/* Main content column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "hidden",
        }}
      >
        <Topbar />

        <main
          id="main-content"
          style={{
            flex: 1,
            overflow: "auto",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
