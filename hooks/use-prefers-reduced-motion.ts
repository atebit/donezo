"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe hook that returns whether the user has requested reduced motion.
 * Returns `false` on the server and until the first client-side mount.
 * Subscribes to changes so it stays in sync if the OS setting changes.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Set initial value after mount.
    setPrefersReducedMotion(media.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    media.addEventListener("change", handleChange);
    return () => {
      media.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
}
