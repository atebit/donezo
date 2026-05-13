"use client";

/**
 * useCmdK — global Cmd-K (macOS) / Ctrl-K (elsewhere) keyboard binding.
 *
 * Design notes (Epic 11 §G.2 / dispatch Q11):
 * - Registers a keydown listener at the document level on mount.
 * - Fires when the Meta+K (Mac) or Ctrl+K (non-Mac) chord is pressed.
 * - Skips the binding when an `<input>`, `<textarea>`, or `contenteditable`
 *   element has focus — UNLESS that element is inside the palette container
 *   (identified by [data-cmdk-palette]).
 * - Returns { isOpen, open, close } — the caller mounts <GlobalSearchPalette>
 *   when isOpen is true.
 *
 * Platform detection uses `navigator.platform` (contains "Mac" on macOS) with a
 * fallback to `navigator.userAgent` for broader compatibility.
 */

import { useCallback, useEffect, useState } from "react";

/** Returns true when the current platform is macOS. Safe to call in the browser. */
function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  // navigator.platform is deprecated but still reliable for Mac detection.
  return (
    navigator.platform.includes("Mac") ||
    // Fallback for Safari 15.4+ / Chrome 130+ where platform may be empty.
    /MacIntel|MacPPC/i.test(navigator.userAgent)
  );
}

/** Returns true when the active element should suppress the Cmd-K shortcut. */
function shouldSkip(activeElement: Element | null): boolean {
  if (!activeElement) return false;

  // Allow the binding when focus is inside the palette itself.
  if (activeElement.closest("[data-cmdk-palette]")) return false;

  const tag = activeElement.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if ((activeElement as HTMLElement).contentEditable === "true") return true;

  return false;
}

export interface UseCmdKResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export function useCmdK(): UseCmdKResult {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mac = isMac();
      const shortcutPressed = mac ? e.metaKey && e.key === "k" : e.ctrlKey && e.key === "k";
      if (!shortcutPressed) return;

      if (shouldSkip(document.activeElement)) return;

      e.preventDefault();
      // Toggle: if already open, close it; otherwise open.
      setIsOpen((prev) => !prev);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return { isOpen, open, close };
}
