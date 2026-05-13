"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useWorkspaceMaybe } from "@/hooks/use-workspace";
import { IconChevronLeft, IconChevronRight, IconSearch } from "@/lib/icons";
import { useSidebarStore } from "@/stores/sidebar-store";
import { BoardList } from "./BoardList";
import { NewBoardButton } from "./NewBoardButton";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

type Workspace = {
  id: string;
  slug: string;
  name: string;
};

type WorkspaceSidebarProps = {
  workspaces: Workspace[];
  /**
   * When true, the sidebar is rendered inside a mobile Sheet drawer.
   * The collapse toggle pill is hidden and the sidebar fills the available width.
   */
  mobileDrawerMode?: boolean;
};

export function WorkspaceSidebar({ workspaces, mobileDrawerMode = false }: WorkspaceSidebarProps) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const search = useSidebarStore((s) => s.search);
  const setSearch = useSidebarStore((s) => s.setSearch);
  const setMobileSidebarOpen = useSidebarStore((s) => s.setMobileSidebarOpen);

  const ctx = useWorkspaceMaybe();
  const currentWorkspace = ctx?.workspace ?? null;
  const sidebarBoards = ctx?.sidebarBoards ?? undefined;

  // Derive active board id from pathname: /w/<slug>/b/<boardId>(/...)?
  const pathname = usePathname();
  const boardSegmentMatch = pathname.match(/\/w\/[^/]+\/b\/([^/]+)/);
  const activeBoardId = boardSegmentMatch?.[1] ?? undefined;

  // Close mobile drawer on navigation when in drawer mode.
  // pathname is read to trigger the effect on every route change.
  useEffect(() => {
    if (mobileDrawerMode && pathname) {
      setMobileSidebarOpen(false);
    }
  }, [pathname, mobileDrawerMode, setMobileSidebarOpen]);

  // In mobile drawer mode: fill the full width of the sheet (100vw set on SheetContent).
  // In desktop mode: 230px open, 30px collapsed.
  const width = mobileDrawerMode ? "100%" : collapsed ? 30 : 230;

  return (
    <aside
      aria-label="Workspace sidebar"
      style={{
        position: "relative",
        width,
        minWidth: mobileDrawerMode ? "100%" : width,
        maxWidth: mobileDrawerMode ? "100%" : width,
        height: "100%",
        backgroundColor: "var(--color-surface-rail)",
        borderRight: "1px solid var(--color-border)",
        overflow: "hidden",
        transition: `width var(--motion-slow) var(--ease-standard)`,
        flexShrink: 0,
      }}
    >
      {/* Inner content — fades in/out with delay */}
      <div
        style={{
          opacity: mobileDrawerMode ? 1 : collapsed ? 0 : 1,
          transition: mobileDrawerMode
            ? undefined
            : collapsed
              ? "opacity var(--motion-fast) var(--ease-standard)"
              : `opacity var(--motion-base) var(--ease-standard) 250ms`,
          pointerEvents: !mobileDrawerMode && collapsed ? "none" : undefined,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          width: mobileDrawerMode ? "100%" : 230,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* Workspace switcher header */}
        <div
          style={{
            padding: "12px 4px 4px",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <WorkspaceSwitcher workspaces={workspaces} currentWorkspace={currentWorkspace} />
        </div>

        {/* Workspace tools bar */}
        {currentWorkspace ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "6px 8px",
              borderBottom: "1px solid var(--color-border)",
              flexShrink: 0,
            }}
          >
            {/* Search boards */}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
                backgroundColor: "var(--color-surface-hover)",
                borderRadius: "var(--radius-sm)",
                padding: "4px 8px",
              }}
            >
              <IconSearch size={12} style={{ color: "var(--color-fg-muted)", flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search boards..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search boards"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 12,
                  color: "var(--color-fg)",
                  outline: "none",
                  width: "100%",
                }}
              />
            </div>

            {/* Add board */}
            <NewBoardButton />
          </div>
        ) : null}

        {/* Board list or empty state */}
        <div style={{ flex: 1, padding: "8px 4px", overflowY: "auto" }}>
          {currentWorkspace ? (
            <BoardList
              workspaceSlug={currentWorkspace.slug}
              activeBoardId={activeBoardId}
              initialBoards={sidebarBoards}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 8,
                padding: "24px 16px",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 13, color: "var(--color-fg-muted)", lineHeight: 1.5 }}>
                Select a workspace to see your boards
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse toggle pill — hidden in mobile drawer mode */}
      {!mobileDrawerMode && (
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
          style={{
            position: "absolute",
            top: "50%",
            right: -10,
            transform: "translateY(-50%)",
            width: 20,
            height: 40,
            backgroundColor: "var(--color-surface-rail)",
            border: "1px solid var(--color-border-solid)",
            borderRadius: "var(--radius-pill)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 1,
            boxShadow: "var(--shadow-card)",
          }}
          className="hover:bg-[var(--color-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
        >
          {collapsed ? (
            <IconChevronRight size={12} aria-hidden="true" />
          ) : (
            <IconChevronLeft size={12} aria-hidden="true" />
          )}
        </button>
      )}
    </aside>
  );
}
