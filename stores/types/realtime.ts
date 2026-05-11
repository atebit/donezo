export type ConnectionStatus = "connected" | "reconnecting" | "offline";

// viewing.type is "board" today; "task" is forward-compat for Epic 09 (task drawer).
// task_id is only set when type === "task".
export type PresenceViewing = { type: "board" } | { type: "task"; task_id: string };

export type PresenceEntry = {
  user_id: string;
  online_at: number; // epoch ms
  viewing: PresenceViewing;
};

// Supabase Realtime presence state: keyed by presence key (we use userId),
// each value is an array of one entry per active tab/connection for that user.
export type PresenceState = Record<string, PresenceEntry[]>;

// Broadcast: cursor position in the table view.
export type CursorPayload = {
  user_id: string;
  task_id: string;
  column_id: string;
  at: number; // epoch ms — used to expire stale cursors
};

// Broadcast: typing indicator. `context` is opaque (e.g. `comment:<task_id>`).
export type TypingPayload = {
  user_id: string;
  context: string;
  at: number; // epoch ms — used to expire after 5s
};

// ----- Outbox -----
// Queueable actions: upsert-style only. Inserts/deletes do NOT queue and must
// error immediately when offline (handled by S8's wrapper, not by the store).
export type OutboxActionId =
  | "setCellValue"
  | "bulkSetCellValue"
  | "renameGroup"
  | "renameTask"
  | "updateTaskFields"; // any future task-field upsert

export type OutboxEntry = {
  id: string; // uuid v4 generated client-side ONLY for de-duplication of the outbox itself; NOT a DB id
  actionId: OutboxActionId;
  args: unknown[]; // serialized server-action args; server action validates via Zod on flush
  optimisticUpdatedAt: number; // epoch ms, used purely for ordering/visibility
  enqueuedAt: number; // epoch ms
};
