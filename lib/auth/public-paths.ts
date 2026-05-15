export const PUBLIC_PATHS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/auth/callback",
] as const;

export const HOME_PATH = "/" as const;

export function isPublicPath(pathname: string): boolean {
  if (pathname === HOME_PATH) return true;
  // API endpoints with their own auth (bearer tokens via withCronAuth, webhook
  // signatures, etc.) must bypass cookie-based middleware auth or they 307 to
  // /sign-in before reaching the handler.
  if (pathname.startsWith("/api/webhooks/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname === "/api/health") return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
