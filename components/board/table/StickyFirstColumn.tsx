"use client";

import type { ReactNode } from "react";

interface StickyFirstColumnProps {
  children: ReactNode;
  /** Additional Tailwind classes to layer on top of the sticky positioning. */
  className?: string;
}

/**
 * StickyFirstColumn — utility wrapper that pins its content to the left edge
 * of a horizontally-scrolling table container.
 *
 * In epic 06 there is only one column (task title), so horizontal scroll does
 * not occur and this wrapper is a visual no-op. It is wired here so that S11
 * (drag handles) and S12 (bulk-select checkboxes) can consume it in epic 06
 * Stage 4 without touching this file, and epic 07 column-CRUD can rely on it
 * for multi-column layouts.
 *
 * Usage:
 *   <StickyFirstColumn className="z-[var(--z-sticky)] bg-[color:var(--color-surface)]">
 *     <DragHandle ... />
 *   </StickyFirstColumn>
 */
export function StickyFirstColumn({ children, className }: StickyFirstColumnProps) {
  return <div className={`sticky left-0 z-[var(--z-sticky)] ${className ?? ""}`}>{children}</div>;
}
