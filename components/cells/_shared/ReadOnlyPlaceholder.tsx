"use client";
// Placeholder editor for read-only derived cell types (updated_by, created_by, created_at_col, formula).
// The orchestrator (S15) early-returns to read-mode for derived types so this is rarely rendered;
// it's the safe fallback if the editor ever opens.
import { useEffect } from "react";

export function ReadOnlyPlaceholder({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    onClose();
  }, [onClose]);
  return null;
}
