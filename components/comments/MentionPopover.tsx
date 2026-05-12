"use client";

/**
 * MentionPopover — suggestion list rendered by the Tiptap mention extension.
 *
 * Appears on `@` trigger. "Everyone on this board" is always pinned first.
 * Navigation: ↑/↓/Enter selects, Esc closes.
 *
 * Component is imperatively controlled via a ref (MentionSuggestionBridge):
 * the ProseMirror suggestion plugin calls bridge.onOpen/onUpdate/onClose/onKeyDown.
 * The host component (CommentEditor) renders <MentionPopover ref={bridgeRef} />.
 */

import { Users } from "lucide-react";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { MentionItem, MentionSuggestionBridge } from "@/components/rich-text/MentionExtension";
import { Avatar } from "@/components/shared/Avatar";
import { EVERYONE_MENTION_ID } from "@/lib/comments/types";
import { cn } from "@/lib/utils";

interface MentionPopoverProps {
  /** CSS class applied to the popover container. */
  className?: string;
}

export const MentionPopover = forwardRef<MentionSuggestionBridge, MentionPopoverProps>(
  function MentionPopover({ className }, ref) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<MentionItem[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    // Imperative command ref — called when the user selects a suggestion
    const commandRef = useRef<((item: MentionItem) => void) | null>(null);

    const listRef = useRef<HTMLDivElement>(null);

    // Scroll active item into view
    useEffect(() => {
      if (!open) return;
      const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, open]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          commandRef.current?.(item);
          setOpen(false);
        }
      },
      [items],
    );

    // Expose bridge to parent via forwardRef
    useImperativeHandle(
      ref,
      () => ({
        onOpen(newItems, command, rect) {
          setItems(newItems);
          commandRef.current = command;
          setActiveIndex(0);
          setPosition(calcPosition(rect));
          setOpen(true);
        },
        onUpdate(newItems, command, rect) {
          setItems(newItems);
          commandRef.current = command;
          setActiveIndex(0);
          setPosition(calcPosition(rect));
        },
        onClose() {
          setOpen(false);
        },
        onKeyDown(event) {
          if (!open) return false;
          if (event.key === "ArrowUp") {
            setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
            return true;
          }
          if (event.key === "ArrowDown") {
            setActiveIndex((i) => (i >= items.length - 1 ? 0 : i + 1));
            return true;
          }
          if (event.key === "Enter") {
            selectItem(activeIndex);
            return true;
          }
          if (event.key === "Escape") {
            setOpen(false);
            return true;
          }
          return false;
        },
      }),
      [open, items, activeIndex, selectItem],
    );

    if (!open) return null;

    return (
      <div
        role="listbox"
        aria-label="Mention suggestions"
        className={cn(
          "fixed z-[var(--z-popover)]",
          "flex flex-col overflow-hidden",
          "rounded-md border border-[color:var(--color-border-strong)]",
          "bg-[color:var(--color-surface)] shadow-[var(--shadow-modal)]",
          "w-64 max-h-64 overflow-y-auto",
          className,
        )}
        style={{ top: position.top, left: position.left }}
      >
        <div ref={listRef} className="flex flex-col gap-0 p-1">
          {items.map((item, index) => (
            <MentionRow
              key={item.id}
              item={item}
              isActive={index === activeIndex}
              onSelect={() => selectItem(index)}
              onHover={() => setActiveIndex(index)}
            />
          ))}
          {items.length === 0 && (
            <div className="px-2 py-1 text-sm text-[color:var(--color-fg-muted)]">
              No members found
            </div>
          )}
        </div>
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function MentionRow({
  item,
  isActive,
  onSelect,
  onHover,
}: {
  item: MentionItem;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const isEveryone = item.id === EVERYONE_MENTION_ID;

  return (
    <div
      role="option"
      aria-selected={isActive}
      tabIndex={-1}
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer select-none",
        "text-sm text-[color:var(--color-fg)]",
        isActive
          ? "bg-[color:var(--color-surface-hover)]"
          : "hover:bg-[color:var(--color-surface-hover)]",
      )}
      onMouseDown={(e) => {
        // Prevent blur on click
        e.preventDefault();
        onSelect();
      }}
      onMouseEnter={onHover}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {isEveryone ? (
        <span
          className="flex items-center justify-center rounded-full shrink-0 bg-[color:var(--color-surface-hover)]"
          style={{ width: 22, height: 22 }}
          aria-hidden="true"
        >
          <Users size={12} />
        </span>
      ) : (
        <Avatar src={item.avatarUrl} displayName={item.displayName} email={item.email} size={22} />
      )}
      <div className="flex flex-col min-w-0">
        <span className="truncate font-medium leading-tight">
          {isEveryone ? "Everyone on this board" : (item.displayName ?? item.email ?? "Unknown")}
        </span>
        {isEveryone ? (
          <span className="text-xs text-[color:var(--color-fg-muted)] leading-tight">
            Notify all board members
          </span>
        ) : item.email ? (
          <span className="text-xs text-[color:var(--color-fg-muted)] truncate leading-tight">
            {item.email}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute fixed position from the editor decoration's bounding rect.
 * Positions the popover below the trigger with a small gap.
 */
function calcPosition(rect: DOMRect): { top: number; left: number } {
  return {
    top: rect.bottom + window.scrollY + 4,
    left: rect.left + window.scrollX,
  };
}
