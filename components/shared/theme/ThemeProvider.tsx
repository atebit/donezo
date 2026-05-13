"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Thin wrapper around next-themes ThemeProvider.
 *
 * - attribute="data-theme"  → writes `data-theme="dark"` on <html>
 * - defaultTheme="system"   → follows OS preference on first visit
 * - enableSystem            → enables the "system" option in ThemeToggle
 *
 * Renders no UI — pure context provider.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
