"use client";

type NoWorkspacesProps = {
  onCreate?: () => void;
};

export function NoWorkspaces({ onCreate }: NoWorkspacesProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <h1 style={{ fontSize: 32, fontWeight: 700, color: "var(--color-fg)" }}>Welcome to Donezo</h1>
      <p style={{ fontSize: 14, color: "var(--color-fg-muted)", maxWidth: 360 }}>
        Create your first workspace to get started.
      </p>
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-2 px-5 py-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white font-medium text-sm hover:opacity-90 transition-opacity"
        >
          Create workspace
        </button>
      )}
    </div>
  );
}
