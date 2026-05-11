/**
 * Board home placeholder.
 * Epic 06 will replace this with the full table view.
 */
export default function BoardPage() {
  return (
    <main className="flex flex-1 items-center justify-center py-24 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-base font-medium text-[color:var(--color-fg)]">
          This board is empty. Add your first group.
        </p>
        <button
          type="button"
          disabled
          className="rounded-md border border-dashed border-[color:var(--color-border-strong)] px-4 py-2 text-sm text-[color:var(--color-fg-muted)] opacity-60 cursor-not-allowed"
          aria-label="Add first group (coming in epic 06)"
        >
          + Add group
        </button>
      </div>
    </main>
  );
}
