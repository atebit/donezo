"use client";

/**
 * TaskDrawerModalShell — slide-in animation wrapper for the intercepting-route variant.
 *
 * On desktop (≥768px): renders a fixed overlay backdrop + the <TaskDrawer> sliding in
 * from the right with role="dialog" aria-modal="true".
 *
 * On mobile (<768px): does NOT render the outer dialog wrapper or backdrop — the inner
 * <TaskDrawer> renders a Base UI Sheet which owns both the dialog role and the backdrop
 * natively. Rendering two nested role="dialog" elements would confuse screen readers
 * and violate WCAG 4.1.2 (ARIA overlapping dialogs). See Epic 14 followup-1 F3.
 *
 * Closing (Esc key, backdrop click, or explicit close) calls router.back() which
 * dismisses the intercepting route and returns to the board page.
 *
 * Animation: slide in from right using --motion-drawer per spec F.7 (desktop only).
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { TaskDrawerProps } from "./TaskDrawer";
import { TaskDrawer } from "./TaskDrawer";

type TaskDrawerModalShellProps = Omit<TaskDrawerProps, "variant">;

export function TaskDrawerModalShell(props: TaskDrawerModalShellProps) {
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);

  // true on desktop (≥768px); false on mobile and during SSR.
  // On mobile, the inner <Sheet> provided by TaskDrawer owns dialog semantics,
  // so this shell must not add a second role="dialog" wrapper.
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Defensive Esc-key handler. On mobile, Base UI's Sheet also handles Esc
  // internally — keeping this here is harmless and provides belt-and-suspenders
  // dismissal for both variants.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        router.back();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Mobile: let TaskDrawer's Sheet handle the dialog role + backdrop.
  // No outer wrapper or backdrop needed here.
  if (!isDesktop) {
    return <TaskDrawer {...props} variant="modal" />;
  }

  // Desktop: render the slide-in overlay with the dialog role + backdrop.
  return (
    <>
      {/* Backdrop — click to close. aria-hidden so screen readers skip it;
          Esc key handler above provides keyboard dismissal. */}
      <div
        className="fixed inset-0 z-[var(--z-modal)] bg-[color:var(--color-overlay)]"
        style={{ backdropFilter: "blur(1px)" }}
        onClick={() => router.back()}
        aria-hidden="true"
      />

      {/* Drawer panel — owns the dialog role on desktop. */}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 z-[var(--z-modal)] h-screen overflow-hidden"
        style={{
          animation: `slideInFromRight var(--motion-drawer) cubic-bezier(0.32, 0.72, 0, 1)`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
      >
        <TaskDrawer {...props} variant="modal" />
      </div>

      {/* Slide-in keyframe — injected inline since Tailwind v4 doesn't ship a slide-in-from-right by default */}
      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
