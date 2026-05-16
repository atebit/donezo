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
  // Dev-only login affordance — the handler itself returns 404 in production;
  // list here so the middleware does not redirect unauthenticated callers to
  // /sign-in before they reach the 404 guard in the handler.
  if (pathname === "/api/dev-login") return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
