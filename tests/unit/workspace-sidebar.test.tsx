// @ts-expect-error RTL wired in epic 15
import { render, screen } from "@testing-library/react";
// @ts-expect-error vitest runner wired in epic 15
import { describe, expect, it } from "vitest";
import { WorkspaceSidebar } from "@/components/shared/sidebar/WorkspaceSidebar";
import type { SidebarBoards } from "@/lib/workspace-context";
import { WorkspaceProvider } from "@/lib/workspace-context";

const ws1 = { id: "ws-1", slug: "my-workspace", name: "My Workspace" };
const ws2 = { id: "ws-2", slug: "other-workspace", name: "Other Workspace" };

const boards: SidebarBoards = {
  starred: [{ id: "b-1", name: "Starred Board", is_private: false, workspace_id: "ws-1" }],
  boards: [{ id: "b-2", name: "Regular Board", is_private: false, workspace_id: "ws-1" }],
};

// workspace role — stored as variable to avoid aria-role lint false positive
const memberRole = "member" as const;

describe.skip("WorkspaceSidebar", () => {
  it("renders 'Select a workspace' copy when rendered outside a WorkspaceProvider", () => {
    render(<WorkspaceSidebar workspaces={[]} />);
    expect(screen.getByText("Select a workspace to see your boards")).toBeTruthy();
  });

  it("renders board groups when rendered inside a WorkspaceProvider with sidebarBoards", () => {
    render(
      <WorkspaceProvider workspace={ws1} role={memberRole} sidebarBoards={boards}>
        <WorkspaceSidebar workspaces={[ws1, ws2]} />
      </WorkspaceProvider>,
    );
    expect(screen.getByText("Starred Board")).toBeTruthy();
    expect(screen.getByText("Regular Board")).toBeTruthy();
  });
});
