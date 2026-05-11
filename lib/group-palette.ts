/**
 * Canonical 12-swatch palette for group accent colors.
 *
 * These values map to the `--color-group-1` … `--color-group-12` tokens
 * defined in `app/globals.css`. A color in the DB should always be one of
 * these swatches (or the default `#c4c4c4` set by the migration default).
 */

export const GROUP_PALETTE = [
  "#a25ddc",
  "#fbbc04",
  "#f1e4de",
  "#fdcfe8",
  "#f28b82",
  "#fff475",
  "#ccff90",
  "#cbf0f8",
  "#a7ffeb",
  "#d7aefb",
  "#e6c9a8",
  "#e8eaed",
] as const;

/** Union type of all valid group color hex strings. */
export type GroupColor = (typeof GROUP_PALETTE)[number];

/**
 * Returns `true` when `c` (case-insensitive) is one of the 12 palette swatches.
 *
 * Use this in server actions to reject colors that aren't in the palette before
 * writing to the DB (the DB itself accepts any hex string; this is a product rule).
 */
export function isValidGroupColor(c: string): c is GroupColor {
  const lower = c.toLowerCase();
  return (GROUP_PALETTE as readonly string[]).some((swatch) => swatch.toLowerCase() === lower);
}
