import { GROUP_PALETTE } from "@/lib/group-palette";

/**
 * Returns the `--color-group-N` CSS variable name (without the var()) for a
 * palette hex string.
 *
 * Returns `"--color-group-1"` as a fallback when the hex isn't in the palette.
 * Server-stored data should always be a palette hex per the action layer's
 * whitelist enforcement (isValidGroupColor), but the fallback prevents visual
 * breakage from stale or migrated data.
 *
 * Usage:
 *   style={{ color: `var(${colorToToken(group.color)})` }}
 *   style={{ borderLeftColor: `var(${colorToToken(group.color)})` }}
 */
export function colorToToken(hex: string): string {
  const idx = (GROUP_PALETTE as readonly string[]).indexOf(hex.toLowerCase());
  if (idx === -1) return "--color-group-1";
  return `--color-group-${idx + 1}`;
}
