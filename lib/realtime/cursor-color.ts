/**
 * cursor-color.ts — stable, deterministic color assignment for cursor overlays.
 *
 * Maps a user_id string to a unique HSL color. The hue is derived from a
 * simple character-code hash, then shifted out of the red band (h ∈ [0, 20])
 * to avoid visual conflict with the offline indicator (which uses red).
 */

/**
 * Returns a stable HSL color string for a given user_id.
 * The same user_id always returns the same color.
 * Hues in [0, 20] (red band) are shifted forward to [21, ...].
 */
export function cursorColorForUser(userId: string): string {
  // Simple hash: sum of (char code * position weight) mod 360
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash + userId.charCodeAt(i) * (i + 1)) % 360;
  }

  // Ensure hash is non-negative
  hash = ((hash % 360) + 360) % 360;

  // Shift the red band [0, 20] → [21, 41] to keep red distinct for offline UI.
  // This maps hues linearly: values in 0..20 become 21..41, and values >= 21
  // are left untouched. We scale the remaining 340 degrees into [21, 360].
  const RED_BAND_END = 20;
  const SHIFT = RED_BAND_END + 1; // 21

  let hue: number;
  if (hash <= RED_BAND_END) {
    // Map 0..20 → 21..41 (one-to-one shift)
    hue = hash + SHIFT;
  } else {
    hue = hash;
  }

  return `hsl(${hue}, 70%, 50%)`;
}
