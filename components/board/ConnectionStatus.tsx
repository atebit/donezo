"use client";

import { useBoardStore } from "@/stores/board-store";

/**
 * ConnectionStatus — renders nothing when connected; shows a pill when
 * reconnecting or offline.
 *
 * - `reconnecting`: yellow pulsing dot + "Reconnecting…"
 * - `offline`: red dot + offline message
 *
 * Uses role="status" + aria-live="polite" for accessibility.
 *
 * TODO: map dot colors to --color-warning / --color-danger once tokens are
 * defined in design-system.md (currently using Tailwind yellow-500 / red-500).
 *
 * Epic 08: Realtime & Presence
 */
export function ConnectionStatus() {
  const connection = useBoardStore((s) => s.connection);

  if (connection === "connected") return null;

  const isReconnecting = connection === "reconnecting";

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: isReconnecting ? "#fef9c3" : "#fee2e2",
        color: isReconnecting ? "#854d0e" : "#991b1b",
      }}
    >
      {/* TODO: use var(--color-warning) / var(--color-danger) once tokens land */}
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${isReconnecting ? "animate-pulse bg-yellow-500" : "bg-red-500"}`}
      />
      {isReconnecting ? "Reconnecting…" : "You're offline. Changes will sync when you reconnect."}
    </span>
  );
}
