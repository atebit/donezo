"use client";

// TODO: map bg-yellow-100/text-yellow-900/border-yellow-300/bg-yellow-500 to
// design-system warning tokens (var(--color-warning-bg) etc.) once tokens are
// defined in design-system.md.

import { useBoardStore } from "@/stores/board-store";

export function OutboxBanner() {
  const count = useBoardStore((s) => s.outbox.length);
  if (count === 0) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 px-3 py-1 text-xs rounded bg-yellow-100 text-yellow-900 border border-yellow-300"
    >
      <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
      Syncing {count} pending change{count === 1 ? "" : "s"}…
    </div>
  );
}
