"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { renameBoard } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/actions";
import { BoardActivityTrigger } from "@/components/activity/BoardActivityTrigger";
import { BoardDescriptionModal } from "@/components/board/BoardDescriptionModal";
import { BoardSettingsMenu } from "@/components/board/BoardSettingsMenu";
import { BoardStarToggle } from "@/components/board/BoardStarToggle";
import { ConnectionStatus } from "@/components/board/ConnectionStatus";
import { OutboxBanner } from "@/components/board/OutboxBanner";
import { PresencePile } from "@/components/board/PresencePile";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { InviteModal } from "@/components/shared/InviteModal";
import { MemberModal } from "@/components/shared/MemberModal";
import { MemberStack } from "@/components/shared/MemberStack";
import { useBoard } from "@/hooks/use-board";
import { IconSettings, IconUserPlus, IconUsers } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string;
};

interface BoardHeaderClientProps {
  members: Member[];
  createdByName: string | null;
  currentUserId: string; // new — provided by BoardHeader.tsx server component
}

export function BoardHeaderClient({
  members,
  createdByName,
  currentUserId,
}: BoardHeaderClientProps) {
  const { board } = useBoard();
  const [membersOpen, setMembersOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const handleRenameCommit = useCallback(
    async (next: string) => {
      await renameBoard({ boardId: board.id, name: next });
    },
    [board.id],
  );

  const handleRenameFromMenu = useCallback(() => {
    // EditableTitle does not expose an imperative focus method.
    // The "Rename" settings menu item is a no-op for now.
    // TODO: Stage 4 followup — extend EditableTitle to expose a .focus() ref method
    // so the settings menu "Rename" item can programmatically trigger editing.
    toast.info("Click the board title to rename it.");
  }, []);

  const handleInvite = useCallback(() => {
    setInviteOpen(true);
  }, []);

  // Adapt members for MemberStack (subset of fields)
  const memberStackItems = members.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    email: m.email,
    avatarUrl: m.avatarUrl,
  }));

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-[var(--z-board-header)] bg-white",
          "flex items-center gap-2 px-[38px] py-[16px] pr-[30px]",
        )}
      >
        {/* Board title */}
        <EditableTitle
          initialValue={board.name}
          onCommit={handleRenameCommit}
          variant="h1"
          ariaLabel="Board name"
          placeholder="Untitled board"
        />

        {/* Star toggle */}
        <BoardStarToggle />

        {/* Divider */}
        <div className="mx-2 h-4 w-px bg-[color:var(--color-border)]" aria-hidden />

        {/* Tool row */}
        <div className="flex items-center gap-1">
          {/* Activity — placeholder; epic 12 */}
          <button
            type="button"
            aria-label="Activity feed (coming soon)"
            disabled
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-[color:var(--color-fg-muted)] opacity-50 cursor-not-allowed"
          >
            Activity
          </button>

          {/* Members tool */}
          <button
            type="button"
            aria-label="View board members"
            onClick={() => setMembersOpen(true)}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]"
          >
            <IconUsers size={14} />
            Members
          </button>

          {/* Invite tool */}
          <button
            type="button"
            aria-label="Invite people to this board"
            onClick={handleInvite}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]"
          >
            <IconUserPlus size={14} />
            Invite
          </button>

          {/* Description tool */}
          <button
            type="button"
            aria-label="Edit board description"
            onClick={() => setDescriptionOpen(true)}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-[color:var(--color-fg-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]"
          >
            <IconSettings size={14} />
            Description
          </button>
        </div>

        {/* live presence — green-dotted avatars of users on this board right now (Epic 08) */}
        <PresencePile members={memberStackItems} currentUserId={currentUserId} />
        <ConnectionStatus />
        <OutboxBanner />

        {/* Member avatar stack */}
        <MemberStack members={memberStackItems} max={4} size={24} className="ml-2" />

        {/* Board activity trigger — Epic 09 */}
        <BoardActivityTrigger members={members} />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings overflow */}
        <BoardSettingsMenu
          onOpenDescription={() => setDescriptionOpen(true)}
          onRename={handleRenameFromMenu}
        />
      </header>

      {/* Modals */}
      <MemberModal
        members={members}
        open={membersOpen}
        onOpenChange={setMembersOpen}
        title="Board members"
      />

      <BoardDescriptionModal
        open={descriptionOpen}
        onOpenChange={setDescriptionOpen}
        createdByName={createdByName}
        memberCount={members.length}
      />

      <InviteModal
        workspaceId={board.workspace_id}
        boardId={board.id}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </>
  );
}
