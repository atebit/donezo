import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — canonical empty-state primitive.
 *
 * Props:
 *   icon        — LucideIcon (48px, --color-fg-muted)
 *   title       — heading text (font-display, 24px, weight 500)
 *   description — optional body copy (14px, --color-fg-muted)
 *   action      — optional ReactNode (primary button rendered by the caller)
 *   className   — optional extra classes on the root container
 *
 * Visual spec (Epic 14 §Polish):
 *   - Centered vertically and horizontally inside its containing block.
 *   - max-width ~28rem so copy stays readable.
 *   - Icon: 48px, color --color-fg-muted.
 *   - Title: font-display, text-2xl, font-medium.
 *   - Description: text-sm, text-muted-foreground (maps to --color-fg-muted).
 *   - CTA: primary button, rendered by the caller via `action` prop.
 *
 * Server-safe — no "use client" needed; purely presentational.
 */

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-12 px-6 text-center mx-auto",
        "max-w-[28rem] w-full",
        className,
      )}
    >
      <Icon
        size={48}
        aria-hidden="true"
        style={{ color: "var(--color-fg-muted)" }}
        className="shrink-0 opacity-60"
      />
      <h2
        style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 500 }}
        className="text-[color:var(--color-fg)] leading-snug"
      >
        {title}
      </h2>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
