"use client";

type NoBoardsInWorkspaceProps = {
  workspaceName: string;
  onCreate?: () => void;
};

export function NoBoardsInWorkspace({ workspaceName, onCreate }: NoBoardsInWorkspaceProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <h2 style={{ fontSize: 24, fontWeight: 600, color: "var(--color-fg)" }}>
        {workspaceName} is ready for its first board
      </h2>
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="px-5 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Create board
        </button>
      )}
      <p style={{ fontSize: 13, color: "var(--color-fg-muted)" }}>
        or pick a template — coming soon
      </p>
    </div>
  );
}
