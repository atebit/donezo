import Link from "next/link";
import { IconLock, IconStar } from "@/lib/icons";
import type { OptimisticBoard } from "./BoardList";

type BoardListItemProps = {
  board: OptimisticBoard;
  workspaceSlug: string;
  activeBoardId?: string | undefined;
  onToggleStar: (boardId: string, currentlyStarred: boolean) => void;
};

export function BoardListItem({
  board,
  workspaceSlug,
  activeBoardId,
  onToggleStar,
}: BoardListItemProps) {
  const isActive = board.id === activeBoardId;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        borderRadius: "var(--radius-sm)",
        paddingLeft: 8,
        paddingRight: 4,
        backgroundColor: isActive ? "var(--color-surface-active)" : undefined,
      }}
      className={isActive ? undefined : "hover:bg-[var(--color-surface-row-hover)] group"}
    >
      <Link
        href={`/w/${workspaceSlug}/b/${board.id}`}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: isActive ? "var(--color-fg-strong)" : "var(--color-fg)",
          fontWeight: isActive ? 600 : 400,
          textDecoration: "none",
          padding: "5px 0",
          overflow: "hidden",
        }}
      >
        {board.is_private && (
          <IconLock
            size={12}
            aria-label="Private board"
            style={{ color: "var(--color-fg-muted)", flexShrink: 0 }}
          />
        )}
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {board.name}
        </span>
      </Link>

      <button
        type="button"
        aria-label={board.starred ? "Unstar board" : "Star board"}
        onClick={() => onToggleStar(board.id, board.starred)}
        style={{
          padding: 4,
          borderRadius: "var(--radius-sm)",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: board.starred ? "var(--color-label-yellow)" : "var(--color-fg-subtle)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-[var(--color-surface-hover)] transition-opacity"
      >
        <IconStar
          size={13}
          aria-hidden="true"
          style={{ fill: board.starred ? "currentColor" : "none" }}
        />
      </button>
    </div>
  );
}
