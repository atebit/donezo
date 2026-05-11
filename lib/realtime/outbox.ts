"use client";

// Flush is triggered by hooks/board mount in S5; this module only exports the function.

import { toast } from "sonner";

import { useBoardStore } from "@/stores/board-store";
import type { OutboxActionId } from "@/stores/types/realtime";

import { outboxRegistry } from "./outbox-registry";

/**
 * Returns navigator.onLine; SSR-safe (returns true on the server where
 * navigator is not defined).
 */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/**
 * Wrap an upsert-style server action so that, if offline, the call is
 * enqueued in the store's outbox instead of throwing the network error.
 * Inserts and deletes must NOT use this wrapper — they should error
 * immediately when offline (their callers toast the error).
 *
 * @param actionId  the OutboxActionId tag used to replay on flush
 * @param action    the server action function (the actual reference, not a string)
 */
export function withOutbox<TArgs extends unknown[], TReturn>(
  actionId: OutboxActionId,
  action: (...args: TArgs) => Promise<TReturn>,
): (...args: TArgs) => Promise<TReturn | { queued: true }> {
  return async (...args: TArgs): Promise<TReturn | { queued: true }> => {
    const store = useBoardStore.getState();

    // Check for outbox overflow first
    if (store.outboxOverflow) {
      toast.error("Offline queue is full — recent changes won't sync. Reconnect to flush.");
      throw new Error("Outbox overflow: cannot enqueue more entries.");
    }

    // Check if offline (store connection state OR navigator.onLine)
    if (store.connection === "offline" || !isOnline()) {
      store.enqueueOutbox({
        actionId,
        args: args as unknown[],
        optimisticUpdatedAt: Date.now(),
      });
      return { queued: true };
    }

    // Online — try to invoke the action
    try {
      return await action(...args);
    } catch (err: unknown) {
      const error = err as Error;
      const message = error?.message ?? "";

      // Network-error heuristic: enqueue instead of re-throwing
      if (/network|fetch/i.test(message)) {
        // Re-check overflow before enqueuing after a failed network call
        const freshStore = useBoardStore.getState();
        if (freshStore.outboxOverflow) {
          toast.error("Offline queue is full — recent changes won't sync. Reconnect to flush.");
          throw new Error("Outbox overflow: cannot enqueue more entries.");
        }

        freshStore.enqueueOutbox({
          actionId,
          args: args as unknown[],
          optimisticUpdatedAt: Date.now(),
        });
        return { queued: true };
      }

      // Any other error (validation, auth, etc.) — re-throw for the caller
      throw err;
    }
  };
}

/**
 * Replays all queued entries in submission order.
 * Called by S5's mount-time effect on connection 'connected' transition
 * and on window 'online' events.
 *
 * On per-entry failure: toasts the error and DROPS the entry (no infinite retry).
 * Returns the count of successfully flushed entries and the count of dropped entries.
 *
 * Also resets outboxOverflow: false on successful flush (S1's note: S8 owns this reset).
 */
export async function flushOutbox(): Promise<{ flushed: number; dropped: number }> {
  const store = useBoardStore.getState();
  // Take a snapshot of the current outbox to replay (in submission order)
  const entries = [...store.outbox].sort((a, b) => a.enqueuedAt - b.enqueuedAt);

  let flushed = 0;
  let dropped = 0;

  for (const entry of entries) {
    const action = outboxRegistry[entry.actionId];
    if (!action) {
      // Unknown action id — drop it
      store.dequeueOutbox(entry.id);
      dropped++;
      toast.error(`Dropped queued action "${entry.actionId}": unknown action.`);
      continue;
    }

    try {
      await action(...(entry.args as unknown[]));
      useBoardStore.getState().dequeueOutbox(entry.id);
      flushed++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to sync queued change: ${message}`);
      useBoardStore.getState().dequeueOutbox(entry.id);
      dropped++;
    }
  }

  // Reset overflow flag now that flush succeeded (even partial)
  useBoardStore.setState({ outboxOverflow: false });

  return { flushed, dropped };
}
