"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { starBoard } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/actions";
import { MemberStack } from "@/components/shared/MemberStack";
import { IconStar } from "@/lib/icons";
import type { SidebarBoard } from "@/lib/workspace-context";

type BoardCardProps = {
  board: SidebarBoard;
  workspaceSlug: string;
  isStarred: boolean;
};

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function BoardCard({ board, workspaceSlug, isStarred }: BoardCardProps) {
  const [, startTransition] = useTransition();
  const [optimisticStarred, setOptimisticStarred] = useOptimistic(isStarred);

  function handleStarToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      setOptimisticStarred(!optimisticStarred);
      await starBoard({ boardId: board.id, starred: !optimisticStarred });
    });
  }

  // SidebarBoard does not carry updated_at or description — these are not fetched
  // by loadSidebarBoards. We render what we have and note the gap in followups.
  const updatedAt = (board as SidebarBoard & { updated_at?: string }).updated_at;
  const description = (board as SidebarBoard & { description?: string }).description;

  return (
    <article
      style={{
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border-solid)",
        borderRadius: 8,
        padding: 16,
        boxShadow: "var(--shadow-card)",
        position: "relative",
      }}
    >
      {/* Star toggle */}
      <button
        type="button"
        aria-label={optimisticStarred ? "Unstar board" : "Star board"}
        aria-pressed={optimisticStarred}
        onClick={handleStarToggle}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 4,
          color: optimisticStarred ? "var(--color-label-yellow)" : "var(--color-fg-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconStar size={16} aria-hidden="true" fill={optimisticStarred ? "currentColor" : "none"} />
      </button>

      {/* Board name */}
      <Link
        href={`/w/${workspaceSlug}/b/${board.id}`}
        style={{
          display: "block",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--color-fg-strong)",
          textDecoration: "none",
          paddingRight: 32,
          marginBottom: 4,
        }}
        className="hover:underline"
      >
        {board.name}
      </Link>

      {/* Description — may be absent if SidebarBoard shape is slim */}
      {description && (
        <p
          className="line-clamp-2"
          style={{ fontSize: 13, color: "var(--color-fg-muted)", marginBottom: 12 }}
        >
          {description}
        </p>
      )}

      {/* Footer: member stack + last activity */}
      <div className="flex items-center justify-between" style={{ marginTop: description ? 0 : 8 }}>
        {/* Empty stack — member data not fetched at sidebar level (see followups) */}
        <MemberStack members={[]} size={22} max={4} />

        {updatedAt && (
          <span style={{ fontSize: 12, color: "var(--color-fg-muted)" }}>
            {relativeTime(updatedAt)}
          </span>
        )}
      </div>
    </article>
  );
}
