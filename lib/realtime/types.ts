/**
 * Re-exports of payload types from the board store for hook consumers.
 * Centralizing here avoids direct store imports from non-store modules.
 */
export type {
  ConnectionStatus,
  CursorPayload,
  PresenceEntry,
  PresenceState,
  PresenceViewing,
  TypingPayload,
} from "@/stores/types/realtime";
