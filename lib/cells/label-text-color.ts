/**
 * WCAG 2.1 §1.4.3 luminance-based text-color picker for label chips.
 *
 * `label.color` is persisted as a free-form hex string (#RRGGBB or #RGB),
 * so there is no stable token slug at render time.  Computing the correct
 * foreground color from the background luminance is deterministic, requires
 * no schema changes, and works for both the 12-swatch palette and any future
 * custom-color input.
 */

/**
 * Expand "#RGB" shorthand to "#RRGGBB".
 * Returns null for anything else so the caller can decide what to do.
 */
function expandHex(raw: string): string | null {
  if (!raw.startsWith("#")) return null;
  const hex = raw.slice(1);
  if (hex.length === 3) {
    const [r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (hex.length === 6) return raw;
  return null;
}

/**
 * Computed relative luminance per WCAG 2.1 §1.4.3. Exported for testing
 * and for any future caller that needs the raw number.
 *
 * Returns 0 for invalid input (safe default — treats it as black).
 */
export function relativeLuminance(bgHex: string): number {
  const expanded = expandHex(bgHex.trim());
  if (!expanded) return 0;

  const hex = expanded.slice(1); // strip "#"
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return 0;

  const r8 = parseInt(hex.slice(0, 2), 16);
  const g8 = parseInt(hex.slice(2, 4), 16);
  const b8 = parseInt(hex.slice(4, 6), 16);

  // sRGB linearization: divide by 255, then apply WCAG piece-wise function.
  const linearize = (c8: number): number => {
    const c = c8 / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const R = linearize(r8);
  const G = linearize(g8);
  const B = linearize(b8);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Returns the WCAG-AA-compliant foreground color ("#000000" or "#ffffff")
 * for text rendered on top of the given background hex.
 *
 * Uses the relative-luminance formula from WCAG 2.1 §1.4.3. Background
 * luminance > 0.179 → "#000000"; otherwise → "#ffffff".
 *
 * Accepts:
 *   - "#RRGGBB" (case-insensitive)
 *   - "#RGB" shorthand (e.g. "#fff")
 * Anything else → "#000000" (safe default).
 */
export function labelTextColor(bgHex: string): "#000000" | "#ffffff" {
  // Validate first so invalid input always returns the safe default "#000000"
  // rather than accidentally returning "#ffffff" (which relativeLuminance(0) would).
  const trimmed = bgHex.trim();
  const expanded = expandHex(trimmed);
  if (!expanded) return "#000000";
  const hex = expanded.slice(1);
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#000000";

  return relativeLuminance(bgHex) > 0.179 ? "#000000" : "#ffffff";
}
