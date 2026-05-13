/**
 * lib/email/tokens.ts
 *
 * Email-safe inline brand tokens.
 * Sourced from docs/conversion-plan/design-system.md.
 * Use these in React Email templates (inline styles only — no external CSS).
 */

export const emailTokens = {
  /** Primary action blue — buttons, links */
  colorPrimary: "#0073ea",
  /** Primary hover */
  colorPrimaryHover: "#0060b9",
  /** Text on primary background */
  colorPrimaryForeground: "#ffffff",
  /** Default body text */
  colorFg: "#323338",
  /** Muted secondary text */
  colorFgMuted: "#676879",
  /** Subtle/inactive text */
  colorFgSubtle: "#c5c7d0",
  /** White surface */
  colorSurface: "#ffffff",
  /** Light grey surface (auth pages, email bg wash) */
  colorSurfaceAuth: "#f7f7f7",
  /** Row hover / info surface */
  colorSurfaceInfo: "#f5f6f8",
  /** Soft border (with opacity baked in) */
  colorBorder: "#d0d4e4",
  /** Strong border */
  colorBorderStrong: "#a8aebb",
  /** Card shadow color */
  colorShadowCard: "#c3c6d4",
  /** Inline link */
  colorLink: "#1f76c2",

  // Typography
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontSizeBase: "14px",
  fontSizeSm: "12px",
  fontSizeLg: "16px",
  fontSizeXl: "20px",
  lineHeightBase: "1.5",

  // Spacing
  radiusMd: "8px",
  radiusSm: "4px",

  // Layout
  containerWidth: "600px",
} as const;
