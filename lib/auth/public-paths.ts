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
  if (pathname.startsWith("/api/webhooks/")) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
