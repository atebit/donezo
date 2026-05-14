"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Tooltip } from "@base-ui/react";
import { Search } from "lucide-react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SearchStub } from "@/components/shared/topbar/SearchStub";
import type { CurrentUser } from "@/lib/auth/current-user";
import { IconChevronLeft, IconChevronRight, IconSearch } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useCmdK } from "@/hooks/use-cmdk";
import { useWorkspaceMaybe } from "@/hooks/use-workspace";
import { useSidebarStore } from "@/stores/sidebar-store";
import { BoardList } from "./BoardList";
import type { SidebarBoard } from "./BoardList";
import { NewBoardButton } from "./NewBoardButton";
import { UserMenu } from "./UserMenu";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

type Workspace = {
  id: string;
  slug: string;
  name: string;
};

// ---------------------------------------------------------------------------
// Shared styles for the collapsed icon rail
// ---------------------------------------------------------------------------

const tooltipPopupCn =
  "rounded-md bg-[color:var(--color-fg-strong)] px-2 py-1 text-xs text-white shadow-sm z-[var(--z-popover)]";

const railIconBtnCn =
  "flex items-center justify-center w-9 h-9 rounded-[var(--radius-sm)] " +
  "text-[color:var(--color-fg-muted)] hover:text-[color:var(--color-fg)] " +
  "hover:bg-[color:var(--color-surface-hover)] transition-colors duration-[var(--motion-base)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]";

// ---------------------------------------------------------------------------
// CollapsedRail — icon-only sidebar rendered when desktop sidebar is collapsed
// ---------------------------------------------------------------------------

interface CollapsedRailProps {
  workspaceName: string;
  workspaceSlug: string;
  sidebarBoards: { starred: SidebarBoard[]; boards: SidebarBoard[] } | undefined;
  activeBoardId: string | undefined;
  user: CurrentUser;
  onExpand: () => void;
}

function CollapsedRail({
  workspaceName,
  workspaceSlug,
  sidebarBoards,
  activeBoardId,
  user,
  onExpand,
}: CollapsedRailProps) {
  const { open: openSearch } = useCmdK();

  const allBoards: SidebarBoard[] = [
    ...(sidebarBoards?.starred ?? []),
    ...(sidebarBoards?.boards ?? []),
  ];

  const initial = workspaceName.charAt(0).toUpperCase() || "W";

  return (
    <div className="flex flex-col h-full w-full items-center">
      {/* Workspace initial — click to expand sidebar */}
      <div className="w-full flex justify-center py-2 border-b border-[color:var(--color-border)] flex-shrink-0">
        <Tooltip.Provider delay={300}>
          <Tooltip.Root>
            <Tooltip.Trigger
              render={<button type="button" onClick={onExpand} />}
              className={cn(railIconBtnCn, "text-sm font-semibold")}
              aria-label={`${workspaceName} — expand sidebar`}
            >
              {initial}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner side="right" sideOffset={8}>
                <Tooltip.Popup className={tooltipPopupCn}>
                  {workspaceName || "Workspace"}
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      </div>

      {/* Board icons — one per board, scrollable */}
      <div className="flex-1 w-full overflow-y-auto py-1.5 flex flex-col items-center gap-0.5">
        {allBoards.map((board) => {
          const isActive = board.id === activeBoardId;
          return (
            <Tooltip.Provider key={board.id} delay={300}>
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={<Link href={`/w/${workspaceSlug}/b/${board.id}`} />}
                  className={cn(
                    railIconBtnCn,
                    "text-sm font-semibold no-underline",
                    isActive &&
                      "bg-[color:var(--color-surface-raised)] text-[color:var(--color-fg)]",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {board.name.charAt(0).toUpperCase()}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner side="right" sideOffset={8}>
                    <Tooltip.Popup className={tooltipPopupCn}>{board.name}</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          );
        })}
      </div>

      {/* Bottom: search, notifications, account */}
      <div className="w-full flex flex-col items-center gap-1 py-2 border-t border-[color:var(--color-border)] flex-shrink-0">
        <Tooltip.Provider delay={300}>
          <Tooltip.Root>
            <Tooltip.Trigger
              render={<button type="button" onClick={openSearch} />}
              className={railIconBtnCn}
              aria-label="Open global search"
            >
              <Search size={16} aria-hidden="true" />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner side="right" sideOffset={8}>
                <Tooltip.Popup className={tooltipPopupCn}>Search</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
        <NotificationBell workspaceSlug={workspaceSlug || undefined} />
        <UserMenu user={user} variant="small" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarInner — shared content for both desktop aside and mobile Sheet
// ---------------------------------------------------------------------------

interface SidebarInnerProps {
  workspaces: Workspace[];
  user: CurrentUser;
  mobileMode?: boolean;
}

const COLLAPSED_W = 52;
const EXPANDED_W = 230;

function SidebarInner({ workspaces, user, mobileMode = false }: SidebarInnerProps) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const setCollapsed = useSidebarStore((s) => s.setCollapsed);
  const search = useSidebarStore((s) => s.search);
  const setSearch = useSidebarStore((s) => s.setSearch);
  const setMobileSidebarOpen = useSidebarStore((s) => s.setMobileSidebarOpen);

  const ctx = useWorkspaceMaybe();
  const currentWorkspace = ctx?.workspace ?? null;
  const sidebarBoards = ctx?.sidebarBoards ?? undefined;

  const pathname = usePathname();
  const boardSegmentMatch = pathname.match(/\/w\/[^/]+\/b\/([^/]+)/);
  const activeBoardId = boardSegmentMatch?.[1] ?? undefined;

  // Close mobile drawer on navigation.
  useEffect(() => {
    if (mobileMode && pathname) setMobileSidebarOpen(false);
  }, [pathname, mobileMode, setMobileSidebarOpen]);

  const width = mobileMode ? "100%" : collapsed ? COLLAPSED_W : EXPANDED_W;

  return (
    // Wrapper owns the width transition and position:relative so the toggle
    // pill can hang outside the aside's overflow:hidden boundary without
    // being clipped.
    <div
      style={{
        position: "relative",
        width,
        minWidth: width,
        maxWidth: width,
        height: "100%",
        flexShrink: 0,
        transition: mobileMode ? undefined : `width var(--motion-slow) var(--ease-standard)`,
      }}
    >
    <aside
      aria-label="Workspace sidebar"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "var(--color-surface-rail)",
        borderRight: mobileMode ? "none" : "1px solid var(--color-border)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Collapsed icon rail — desktop only, absolute overlay */}
      {!mobileMode && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: collapsed ? 1 : 0,
            pointerEvents: collapsed ? undefined : "none",
            transition: collapsed
              ? "opacity var(--motion-base) var(--ease-standard) 100ms"
              : "opacity var(--motion-fast) var(--ease-standard)",
          }}
        >
          <CollapsedRail
            workspaceName={currentWorkspace?.name ?? ""}
            workspaceSlug={currentWorkspace?.slug ?? ""}
            sidebarBoards={sidebarBoards}
            activeBoardId={activeBoardId}
            user={user}
            onExpand={() => setCollapsed(false)}
          />
        </div>
      )}

      {/* Expanded content — fades out when collapsing */}
      <div
        style={{
          opacity: mobileMode ? 1 : collapsed ? 0 : 1,
          transition: mobileMode
            ? undefined
            : collapsed
              ? "opacity var(--motion-fast) var(--ease-standard)"
              : `opacity var(--motion-base) var(--ease-standard) 250ms`,
          pointerEvents: !mobileMode && collapsed ? "none" : undefined,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          width: mobileMode ? "100%" : EXPANDED_W,
          overflow: "hidden",
        }}
      >
        {/* Workspace switcher */}
        <div
          style={{
            padding: "0 4px 4px",
            borderBottom: "1px solid var(--color-border)",
            flexShrink: 0,
          }}
        >
          <WorkspaceSwitcher workspaces={workspaces} currentWorkspace={currentWorkspace} />
        </div>

        {/* Board search + new board button */}
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
            <NewBoardButton />
          </div>
        ) : null}

        {/* Board list */}
        <div style={{ flex: 1, padding: "8px 4px", overflowY: "auto" }}>
          {currentWorkspace && (
            <BoardList
              workspaceSlug={currentWorkspace.slug}
              activeBoardId={activeBoardId}
              initialBoards={sidebarBoards}
            />
          )}
        </div>

        {/* Bottom controls: global search, notifications, account */}
        <div
          style={{
            padding: "8px 12px",
            borderTop: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <SearchStub />
          </div>
          <NotificationBell workspaceSlug={currentWorkspace?.slug} />
          <UserMenu user={user} variant="small" />
        </div>
      </div>

    </aside>

      {/* Collapse toggle pill — outside <aside> so overflow:hidden doesn't clip it */}
      {!mobileMode && (
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceSidebar — public export
// Renders desktop aside + mobile Sheet, both backed by SidebarInner.
// ---------------------------------------------------------------------------

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  user: CurrentUser;
}

export function WorkspaceSidebar({ workspaces, user }: WorkspaceSidebarProps) {
  const mobileSidebarOpen = useSidebarStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useSidebarStore((s) => s.setMobileSidebarOpen);

  return (
    <>
      {/* Desktop: visible md+ */}
      <div className="hidden md:flex" style={{ flexShrink: 0, height: "100%" }}>
        <SidebarInner workspaces={workspaces} user={user} />
      </div>

      {/* Mobile: Sheet drawer */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          style={{ width: "100vw", maxWidth: "100vw", padding: 0 }}
          aria-label="Workspace navigation"
        >
          <SidebarInner workspaces={workspaces} user={user} mobileMode />
        </SheetContent>
      </Sheet>
    </>
  );
}
