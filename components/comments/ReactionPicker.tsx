"use client";

/**
 * ReactionPicker — frimousse-powered emoji picker inside a Base UI Popover.
 *
 * API:
 *   <ReactionPicker
 *     trigger={<button>😀</button>}
 *     onSelect={(emoji) => ...}
 *   />
 *
 * Max width 320px, max-height 400px, scrollable (handled by frimousse Viewport).
 * Slice D's <CommentReactions /> owns the trigger button; this component
 * provides the popover content only.
 */

import { Popover } from "@base-ui/react";
import { EmojiPicker } from "frimousse";
import type { ReactElement } from "react";

interface ReactionPickerProps {
  /** The element that opens the picker — passed as Popover.Trigger render prop. */
  trigger: ReactElement;
  /** Called with the selected emoji string when the user picks one. */
  onSelect: (emoji: string) => void;
  /** Optional CSS class applied to the popover popup wrapper. */
  className?: string;
}

export function ReactionPicker({ trigger, onSelect, className }: ReactionPickerProps) {
  return (
    <Popover.Root>
      <Popover.Trigger render={trigger} />
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start">
          <Popover.Popup
            className={[
              "z-[var(--z-popover)] rounded-[var(--radius-md)]",
              "bg-[color:var(--color-surface)] shadow-[var(--shadow-modal)]",
              "border border-[color:var(--color-border-strong)]",
              "p-1",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ width: 320, maxHeight: 400 }}
          >
            <EmojiPicker.Root
              onEmojiSelect={(emoji) => {
                onSelect(emoji.emoji);
              }}
              style={{ width: "100%", height: "100%" }}
            >
              <div className="px-1 pb-1">
                <EmojiPicker.Search
                  placeholder="Search emoji…"
                  className="w-full rounded border border-[color:var(--color-border-strong)] bg-[color:var(--color-surface)] px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
                  aria-label="Search emoji"
                />
              </div>
              <EmojiPicker.Viewport style={{ height: 320, overflowY: "auto" }}>
                <EmojiPicker.Loading>
                  <div className="flex items-center justify-center p-4 text-sm text-[color:var(--color-fg-muted)]">
                    Loading emoji…
                  </div>
                </EmojiPicker.Loading>
                <EmojiPicker.Empty>
                  <div className="flex items-center justify-center p-4 text-sm text-[color:var(--color-fg-muted)]">
                    No emoji found.
                  </div>
                </EmojiPicker.Empty>
                <EmojiPicker.List
                  components={{
                    CategoryHeader({ category, ...props }) {
                      return (
                        <div
                          {...props}
                          className="sticky top-0 bg-[color:var(--color-surface)] px-2 py-1 text-xs font-semibold text-[color:var(--color-fg-muted)] uppercase tracking-wide"
                        >
                          {category.label}
                        </div>
                      );
                    },
                    Row({ children, ...props }) {
                      return (
                        <div {...props} className="flex">
                          {children}
                        </div>
                      );
                    },
                    Emoji({ emoji, ...props }) {
                      return (
                        <button
                          {...props}
                          type="button"
                          title={emoji.label}
                          aria-label={emoji.label}
                          className={[
                            "flex h-8 w-8 items-center justify-center rounded text-lg",
                            "hover:bg-[color:var(--color-surface-hover)]",
                            "focus-visible:outline-none focus-visible:bg-[color:var(--color-surface-hover)]",
                            emoji.isActive ? "bg-[color:var(--color-surface-hover)]" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {emoji.emoji}
                        </button>
                      );
                    },
                  }}
                />
              </EmojiPicker.Viewport>
            </EmojiPicker.Root>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
