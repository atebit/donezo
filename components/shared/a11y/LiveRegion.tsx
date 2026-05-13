"use client";

import { useCallback } from "react";

// ── Singleton message store ────────────────────────────────────────────────
// LiveRegion is mounted once near the app root. We expose a module-level
// setter so useAnnouncer() can be called from anywhere without prop-drilling.

let _setMessage: ((msg: string) => void) | null = null;

/**
 * useAnnouncer — returns a stable (msg: string) => void function that writes
 * to the single polite ARIA live region mounted near the app root.
 *
 * Usage:
 *   const announce = useAnnouncer();
 *   announce("Task saved.");
 */
export function useAnnouncer(): (msg: string) => void {
  return useCallback((msg: string) => {
    if (_setMessage) {
      _setMessage(msg);
    }
  }, []);
}

/**
 * LiveRegion — a polite ARIA live region that provides accessible
 * announcements for major state changes (cell updates, comment posted, etc.).
 *
 * Mount ONCE near the app root (inside ThemeProvider is fine). Consumers
 * call useAnnouncer() to trigger a message; no additional rendering needed.
 *
 * Visually hidden but readable by screen readers.
 */
export function LiveRegion() {
  // Register the setter on mount; tear down on unmount.
  const refCallback = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      _setMessage = (msg: string) => {
        // Clearing first then setting forces a re-announcement even for
        // identical consecutive messages (some screen readers cache the value).
        node.textContent = "";
        // Use a microtask to ensure the empty string is committed before
        // the new content is written.
        Promise.resolve().then(() => {
          node.textContent = msg;
        });
      };
    } else {
      _setMessage = null;
    }
  }, []);

  return (
    <div
      ref={refCallback}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      // Visually hidden — screen readers read it, sighted users don't see it.
      style={{
        position: "absolute",
        width: "1px",
        height: "1px",
        padding: 0,
        margin: "-1px",
        overflow: "hidden",
        clip: "rect(0, 0, 0, 0)",
        whiteSpace: "nowrap",
        border: 0,
      }}
    />
  );
}
