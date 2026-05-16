/**
 * Dev-only login affordance — NOT for production use.
 *
 * Signs in the E2E seed user via Supabase email/password and redirects to the
 * app. Allows testing auth-adjacent UI in local dev and preview environments
 * without needing Google OAuth.
 *
 * Production guard: returns 404 when NODE_ENV === 'production'. This route
 * is unreachable on Vercel production deployments.
 *
 * Usage:
 *   GET /api/dev-login?next=/w/e2e-workspace
 *
 * E2E credentials are taken from environment variables, with fallback to the
 * seed defaults. Never hardcode production credentials here.
 *
 * This route is only dispatched in test/preview; it MUST NOT be imported from
 * any production code path.
 */

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e-user@donezo.test";
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD ?? "e2e-test-password-12345";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Hard production guard — this route must never be reachable in production.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const next = request.nextUrl.searchParams.get("next") ?? "/";

  // Build a response object we can write session cookies onto.
  // We use a redirect response so the browser lands on `next` after sign-in;
  // the cookies are set on the redirect response itself.
  const redirectUrl = new URL(next, env.NEXT_PUBLIC_SITE_URL);
  const response = NextResponse.redirect(redirectUrl);

  // Create a server Supabase client that writes its cookies directly onto the
  // response we are about to send.
  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: E2E_USER_EMAIL,
    password: E2E_USER_PASSWORD,
  });

  if (error) {
    return new NextResponse(
      `Dev login failed: ${error.message}. ` +
        `Make sure the E2E seed user exists (run: supabase db reset --local --yes).`,
      { status: 500 },
    );
  }

  return response;
}
