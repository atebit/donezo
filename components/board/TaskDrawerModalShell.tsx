"use client";

/**
 * TaskDrawerModalShell — slide-in animation wrapper for the intercepting-route variant.
 *
 * Renders a fixed overlay backdrop + the <TaskDrawer> sliding in from the right.
 * Closing (Esc key, backdrop click, or explicit close) calls router.back() which
 * dismisses the intercepting route and returns to the board page.
 *
 * Animation: slide in from right using --motion-drawer (600ms) per spec F.7.
 */

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { TaskDrawerProps } from "./TaskDrawer";
import { TaskDrawer } from "./TaskDrawer";

type TaskDrawerModalShellProps = Omit<TaskDrawerProps, "variant">;

export function TaskDrawerModalShell(props: TaskDrawerModalShellProps) {
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close via Esc key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        router.back();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

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

      {/* Drawer panel */}
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
