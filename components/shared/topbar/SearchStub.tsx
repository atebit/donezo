"use client";

/**
 * SearchStub — Cmd-K palette launcher button.
 *
 * Replaces the old disabled-stub placeholder (Epic 11 Slice G).
 * Visual spec (§G.3): text "Search", muted, with a "⌘K" (Mac) or "Ctrl K"
 * (non-Mac) hint badge on the right.
 *
 * The actual palette is rendered here so its state is co-located with the
 * launcher button. useCmdK provides the open/close state and registers the
 * global keyboard shortcut.
 */

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useCmdK } from "@/hooks/use-cmdk";
import { cn } from "@/lib/utils";
import { GlobalSearchPalette } from "./GlobalSearchPalette";

/** Detect macOS on the client side. */
function usePlatformHint(): string {
  const [hint, setHint] = useState("⌘K"); // default for SSR / initial render

  useEffect(() => {
    // navigator is only available in the browser.
    const mac = navigator.platform.includes("Mac") || /MacIntel|MacPPC/i.test(navigator.userAgent); // eslint-disable-line
    setHint(mac ? "⌘K" : "Ctrl K");
  }, []);

  return hint;
}

export function SearchStub() {
  const { isOpen, open, close } = useCmdK();
  const platformHint = usePlatformHint();

  return (
    <>
      {/* Launcher button */}
      <button
        type="button"
        onClick={open}
        className={cn(
          "flex items-center gap-2 px-3 h-8 rounded-[var(--radius-sm)]",
          "border border-[color:var(--color-border-solid)]",
          "text-sm text-[color:var(--color-fg-muted)]",
          "bg-transparent cursor-pointer select-none",
          "hover:bg-[color:var(--color-surface-hover)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]",
        )}
        aria-label="Open global search (Cmd K)"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Search size={14} aria-hidden />
        <span>Search</span>
        {/* Platform hint badge */}
        <kbd
          aria-hidden
          className={cn(
            "inline-flex items-center justify-center",
            "min-w-[28px] h-5 px-1 rounded",
            "text-[10px] font-medium leading-none",
            "bg-[color:var(--color-surface-raised,#f0f0f0)]",
            "text-[color:var(--color-fg-muted)]",
            "border border-[color:var(--color-border)]",
          )}
        >
          {platformHint}
        </kbd>
      </button>

      {/* Palette — rendered as a portal; only mounted when the palette state is needed */}
      <GlobalSearchPalette isOpen={isOpen} onClose={close} />
    </>
  );
}
