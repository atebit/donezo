import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isPublicPath } from "@/lib/auth/public-paths";
import { env } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";
import type { Database } from "@/lib/supabase/types";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // Re-query user on the refreshed-cookie response (cheap; cookie-only).
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op; updateSession already wrote cookies on `response`.
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPath =
    path === "/sign-in" ||
    path === "/sign-up" ||
    path === "/forgot-password" ||
    path === "/reset-password";
  const publicPath = isPublicPath(path);

  // Unauthed user hitting a gated path → redirect to sign-in with ?next=
  if (!user && !publicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Authed user hitting an auth path → bounce to home.
  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Authed user with unverified email → /verify-email (except already there).
  if (user && !user.email_confirmed_at && path !== "/verify-email" && !publicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-email";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
