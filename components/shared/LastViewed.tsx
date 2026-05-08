import Link from "next/link";

import { MemberStack } from "@/components/shared/MemberStack";

type LastViewedBoard = {
  id: string;
  name: string;
  workspaceSlug: string;
  updatedAt: string;
  members: {
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  }[];
};

type LastViewedProps = {
  boards: LastViewedBoard[];
  className?: string;
};

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function LastViewed({ boards, className }: LastViewedProps) {
  if (boards.length === 0) return null;

  return (
    <section style={{ padding: "32px 16px" }} className={className}>
      <h2
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-fg-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 12,
        }}
      >
        Recently visited
      </h2>
      <ul className="flex flex-col gap-2">
        {boards.map((board) => (
          <li key={board.id}>
            <Link
              href={`/w/${board.workspaceSlug}/b/${board.id}`}
              className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <span
                  style={{ fontSize: 14, color: "var(--color-fg)", fontWeight: 500 }}
                  className="truncate block"
                >
                  {board.name}
                </span>
                <span style={{ fontSize: 12, color: "var(--color-fg-muted)" }}>
                  {relativeTime(board.updatedAt)}
                </span>
              </div>
              {board.members.length > 0 && (
                <MemberStack members={board.members} size={22} max={4} />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
