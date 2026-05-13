"use client";

/**
 * CardStyleEditor — Base UI Popover for editing a view's CardStyle.
 *
 * Controls:
 *   - Column checklist (visibleColumnIds) with dnd-kit reorder.
 *   - showAvatars switch.
 *   - showDueDate switch.
 *
 * The `onChange` callback receives the new CardStyle and it is the caller's
 * responsibility to persist it (typically via `applyDraft({ <kind>: { cardStyle } })`).
 * Slices B / C / D wire the call site; this component only renders the UI.
 */

import { Popover, Switch } from "@base-ui/react";
import { GripVertical, Layers } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import type { Column } from "@/components/board/table/types";
import { cn } from "@/lib/utils";
import type { CardStyle } from "@/lib/views/config-schema";

interface CardStyleEditorProps {
  cardStyle: CardStyle | undefined;
  columns: Column[];
  onChange: (next: CardStyle) => void;
  /** Optional trigger override — defaults to a "Card style" button. */
  trigger?: ReactElement;
}

const DEFAULT_STYLE: CardStyle = {
  showTitle: true,
  visibleColumnIds: [],
  showAvatars: true,
  showDueDate: true,
};

export function CardStyleEditor({ cardStyle, columns, onChange, trigger }: CardStyleEditorProps) {
  const current = cardStyle ?? DEFAULT_STYLE;
  const [open, setOpen] = useState(false);

  function toggleColumn(columnId: string) {
    const ids = current.visibleColumnIds ?? [];
    const next = ids.includes(columnId) ? ids.filter((id) => id !== columnId) : [...ids, columnId];
    onChange({ ...current, visibleColumnIds: next });
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {trigger ? (
        <Popover.Trigger render={trigger} />
      ) : (
        <Popover.Trigger
          className={cn(
            "flex items-center gap-1.5 h-8 px-2 rounded",
            "text-sm font-medium text-[color:var(--color-fg-muted)]",
            "hover:text-[color:var(--color-fg)] hover:bg-[color:var(--color-surface-hover)]",
            "transition-colors duration-[var(--motion-base,150ms)] cursor-pointer",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-primary)]",
          )}
          aria-label="Edit card style"
        >
          <Layers size={14} aria-hidden="true" />
          Card style
        </Popover.Trigger>
      )}

      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start">
          <Popover.Popup
            className="outline-none w-[240px] p-3"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border-strong)",
              borderRadius: "8px",
              boxShadow: "var(--shadow-modal)",
              zIndex: "var(--z-popover)",
            }}
          >
            {/* Column visibility checklist */}
            <p className="text-xs font-semibold text-[color:var(--color-fg-muted)] uppercase tracking-wide mb-2">
              Visible fields
            </p>
            <div className="space-y-1 mb-3 max-h-[200px] overflow-y-auto">
              {columns.map((col) => {
                const isChecked = (current.visibleColumnIds ?? []).includes(col.id);
                const checkboxId = `card-style-col-${col.id}`;
                return (
                  <label
                    key={col.id}
                    htmlFor={checkboxId}
                    className="flex items-center gap-2 h-8 px-1 rounded cursor-pointer hover:bg-[color:var(--color-surface-hover)] transition-colors"
                  >
                    {/* Drag handle (decorative — full reorder wiring in Slice B/C/D) */}
                    <GripVertical
                      size={14}
                      className="text-[color:var(--color-fg-muted)] opacity-40 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {/* Native checkbox (visually hidden, accessible) */}
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleColumn(col.id)}
                      className="sr-only"
                    />
                    {/* Custom visual checkbox */}
                    <span
                      aria-hidden="true"
                      className="w-4 h-4 rounded border border-[color:var(--color-border-strong)] flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: isChecked ? "var(--color-primary)" : "transparent",
                        borderColor: isChecked ? "var(--color-primary)" : undefined,
                      }}
                    >
                      {isChecked && (
                        <svg
                          width="10"
                          height="8"
                          viewBox="0 0 10 8"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M1 4L3.5 6.5L9 1"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm text-[color:var(--color-fg)] truncate">
                      {col.name}
                    </span>
                  </label>
                );
              })}
              {columns.length === 0 && (
                <p className="text-sm text-[color:var(--color-fg-muted)] px-1 py-2">
                  No columns on this board.
                </p>
              )}
            </div>

            {/* showAvatars switch */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[color:var(--color-fg)]">Show avatars</span>
              <Switch.Root
                checked={current.showAvatars}
                onCheckedChange={(checked) => onChange({ ...current, showAvatars: checked })}
                className="w-8 h-4 rounded-full relative cursor-pointer"
                style={{
                  backgroundColor: current.showAvatars
                    ? "var(--color-primary)"
                    : "var(--color-border-strong)",
                }}
                aria-label="Show avatars on card"
              >
                <Switch.Thumb
                  className="absolute w-3 h-3 top-0.5 rounded-full bg-white transition-transform"
                  style={{
                    transform: current.showAvatars ? "translateX(18px)" : "translateX(2px)",
                  }}
                />
              </Switch.Root>
            </div>

            {/* showDueDate switch */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-[color:var(--color-fg)]">Show due date</span>
              <Switch.Root
                checked={current.showDueDate}
                onCheckedChange={(checked) => onChange({ ...current, showDueDate: checked })}
                className="w-8 h-4 rounded-full relative cursor-pointer"
                style={{
                  backgroundColor: current.showDueDate
                    ? "var(--color-primary)"
                    : "var(--color-border-strong)",
                }}
                aria-label="Show due date on card"
              >
                <Switch.Thumb
                  className="absolute w-3 h-3 top-0.5 rounded-full bg-white transition-transform"
                  style={{
                    transform: current.showDueDate ? "translateX(18px)" : "translateX(2px)",
                  }}
                />
              </Switch.Root>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
