import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Menu list primitive — the canonical chrome for dropdown menus across the app.
 *
 * Token and spacing contract is locked in `docs/conversion-plan/design-system.md`.
 * (Original recipe: @mixin menu-modal() in the legacy SCSS partial, commit a5d47c2.)
 *
 * Usage:
 *   <MenuList>
 *     <MenuListItem onClick={...}>Rename</MenuListItem>
 *     <MenuListItem onClick={...}>Delete</MenuListItem>
 *   </MenuList>
 *
 * Wrap in a <Popover> or <Dialog> for positioning.
 */
export function MenuList({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0 rounded-md border bg-surface p-2 text-sm text-fg shadow-[var(--shadow-modal)]",
        "border-[color:var(--color-border-strong)]",
        "z-[var(--z-popover)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function MenuListItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left",
        "hover:bg-surface-hover",
        "focus-visible:bg-surface-hover focus-visible:outline-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
