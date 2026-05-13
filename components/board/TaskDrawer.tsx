"use client";

/**
 * TaskDrawer — the task detail drawer.
 *
 * Shared between the intercepting-route variant (<TaskDrawerModalShell>) and
 * the full-page route variant. Receives pre-fetched data as props and hydrates
 * the board store on mount via hydrateXxx actions.
 *
 * Tabs:
 *   - Updates (default): CommentComposer + CommentList (via UpdatesTab)
 *   - Activity: ActivityList scope=task (via ActivityTab)
 *   - Files: Attachment upload + list (via FilesTab, Epic 10)
 *
 * Presence: useTaskDrawerPresence tracks this user as "viewing task" on the
 * board channel (same channel as useBoardRealtime — Supabase deduplication).
 *
 * Visual spec (component-system §3.5):
 *   position: fixed; top: 0; right: 0; height: 100vh; min-width: 570px
 *   Bg white, border-inline-start: 1px solid #ccc
 *   Header: padding 20px 20px 6px 24px, height 53px, font-size 18px
 *
 * Mobile (< 768px): rendered as a full-viewport Sheet (shadcn/Base UI Dialog)
 * so the drawer occupies the entire screen instead of sliding over the board.
 * Desktop (≥ 768px): existing overlay behaviour unchanged.
 */

import { useEffect, useState } from "react";
import { FollowToggle } from "@/components/board/FollowToggle";
import type { MemberOption } from "@/components/comments/CommentEditor";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useTaskDrawerPresence } from "@/hooks/use-task-drawer-presence";
import type { Role } from "@/lib/authorization";
import type { Database } from "@/lib/supabase/types";
import { useBoardStore } from "@/stores/board-store";
import type { AttachmentRow } from "@/stores/types/attachments";
import type { ActivityRow, CommentReactionRow, CommentRow } from "@/stores/types/comments";
import type { TaskDrawerTab } from "./TaskDrawerTabs";
import { TaskDrawerTabs } from "./TaskDrawerTabs";
import { ActivityTab } from "./tabs/ActivityTab";
import { FilesTab } from "./tabs/FilesTab";
import { UpdatesTab } from "./tabs/UpdatesTab";

type TaskRow = Database["public"]["Tables"]["task"]["Row"];

export interface TaskDrawerProps {
  taskId: string;
  task: TaskRow;
  comments: CommentRow[];
  reactions: CommentReactionRow[];
  activity: ActivityRow[];
  /** SSR-first attachment rows for this task. Hydrated into the board store on mount. */
  attachments: AttachmentRow[];
  mentionableMembers: MemberOption[];
  currentUserId: string;
  boardRole: Role;
  /** "modal" = slide-in over board; "full" = standalone full-page view. */
  variant: "modal" | "full";
  /** Whether the current user is following this task. Loaded server-side. */
  isFollowing?: boolean;
}

export function TaskDrawer({
  taskId,
  task,
  comments,
  reactions,
  activity,
  attachments,
  mentionableMembers,
  currentUserId,
  boardRole,
  isFollowing = false,
}: TaskDrawerProps) {
  const [activeTab, setActiveTab] = useState<TaskDrawerTab>("updates");

  // true once hydrated on the client; false on SSR (useMediaQuery is SSR-safe)
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Hydrate the board store with pre-fetched server data
  const hydrateCommentsForTask = useBoardStore((s) => s.hydrateCommentsForTask);
  const hydrateReactionsForComments = useBoardStore((s) => s.hydrateReactionsForComments);
  const hydrateActivityForTask = useBoardStore((s) => s.hydrateActivityForTask);
  const hydrateAttachmentsForBoard = useBoardStore((s) => s.hydrateAttachmentsForBoard);

  useEffect(() => {
    hydrateCommentsForTask(taskId, comments);
    hydrateReactionsForComments(reactions);
    hydrateActivityForTask(taskId, activity);
    // Idempotent: hydrateAttachmentsForBoard merges into existing map,
    // so calling it here after the board-level hydration in BoardTable is safe.
    hydrateAttachmentsForBoard(attachments);
  }, [
    taskId,
    comments,
    reactions,
    activity,
    attachments,
    hydrateCommentsForTask,
    hydrateReactionsForComments,
    hydrateActivityForTask,
    hydrateAttachmentsForBoard,
  ]);

  // Track presence: user is viewing this task
  useTaskDrawerPresence(taskId);

  // Build profiles map from mentionableMembers for activity renderers + comment author display
  const profilesForActivity = new Map(
    mentionableMembers.map((m) => [
      m.id,
      {
        display_name: m.displayName ?? null,
        avatar_url: m.avatarUrl ?? null,
        email: m.email ?? null,
      },
    ]),
  );

  /** Shared inner content — same markup for mobile Sheet and desktop overlay. */
  const innerContent = (
    <>
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center gap-2"
        style={{ padding: "20px 20px 6px 24px", minHeight: 53 }}
      >
        <h2
          className="text-lg font-semibold text-[color:var(--color-fg-strong)] truncate flex-1"
          style={{ fontSize: 18 }}
        >
          {task.title || "Untitled"}
        </h2>
        <FollowToggle taskId={taskId} initialFollowing={isFollowing} />
      </div>

      {/* Tab strip */}
      <TaskDrawerTabs activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab content — scrollable */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
        role="tabpanel"
        aria-label={`${activeTab} tab content`}
      >
        <div className="p-6">
          {activeTab === "updates" && (
            <UpdatesTab
              taskId={taskId}
              boardId={task.board_id}
              currentUserId={currentUserId}
              boardRole={boardRole}
              mentionableMembers={mentionableMembers}
              profiles={profilesForActivity}
            />
          )}
          {activeTab === "activity" && (
            <ActivityTab taskId={taskId} profiles={profilesForActivity} />
          )}
          {activeTab === "files" && (
            <FilesTab
              taskId={taskId}
              boardId={task.board_id}
              currentUserId={currentUserId}
              boardRole={boardRole}
            />
          )}
        </div>
      </div>
    </>
  );

  // Mobile (<768px): render as a full-viewport Sheet so the drawer fills the
  // entire screen.  `open` is always true — the parent (TaskDrawerModalShell)
  // controls unmounting via router.back(), so the Sheet is always open while
  // this component is mounted.  showCloseButton=false because the parent
  // provides Esc-key + backdrop-click close behaviour.
  //
  // SheetTitle (visually hidden via sr-only) gives the Base UI Dialog an
  // accessible name, satisfying AT discoverability (WCAG 4.1.2 / Base UI req).
  if (!isDesktop) {
    return (
      <Sheet open defaultOpen>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="h-[100dvh] w-full rounded-none p-0 flex flex-col bg-white"
          data-testid="task-drawer"
        >
          <SheetTitle className="sr-only">{task.title || "Untitled"}</SheetTitle>
          {innerContent}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop (≥ 768px): existing overlay behaviour — plain div positioned by
  // TaskDrawerModalShell.
  return (
    <div
      className="flex flex-col bg-white"
      style={{
        borderInlineStart: "1px solid #ccc",
        minWidth: 570,
        height: "100vh",
      }}
      data-testid="task-drawer"
    >
      {innerContent}
    </div>
  );
}
