# Epic 03 — Authentication

## Goal

Replace every legacy auth artifact (Cryptr cookies, hand-rolled bcrypt, the broken login service) with Supabase Auth integrated into Next.js via `@supabase/ssr`. Support Google OAuth, email/password, and magic-link sign-in. Provide sign-in / sign-up / password-reset / verify-email / account-settings UI and the SSR session-handling primitives every other epic depends on.

## Why this is its own epic

Authorization ([04](04-authorization-rls.md)) and every authenticated feature need a session-aware Supabase client and a known user identity. Mixing auth into the foundation epic muddles concerns; mixing it into a feature epic produces inconsistent patterns. This epic delivers one auth surface that everything else uses identically.

## In scope

- Supabase Auth providers configured: Google OAuth, email/password, magic link.
- SSR-aware Supabase clients (browser + server + middleware).
- Next.js middleware that refreshes sessions on every request.
- Auth route group: `app/(auth)/sign-in`, `sign-up`, `forgot-password`, `reset-password`, `verify-email`, `callback`.
- Server actions: `signInWithEmail`, `signUpWithEmail`, `signInWithGoogle`, `requestPasswordReset`, `resetPassword`, `signOut`, `updateProfile`, `updatePassword`.
- Account settings page: name, avatar, email, password change, sign out everywhere.
- Email verification flow.
- Server-action wrapper `withUser` that all authed actions use.
- Profile auto-creation trigger (already in [02](02-supabase-schema.md) schema; verify it works).

## Out of scope

- RLS policies ([04](04-authorization-rls.md)).
- Workspace invitations ([05](05-workspaces-boards.md) — sends email but uses the auth machinery here).
- SSO / SAML.
- 2FA (TOTP) — Supabase supports it; defer until internal users ask.
- Account deletion (deferred — admin-driven for now).

## Dependencies

[01](01-foundation.md), [02](02-supabase-schema.md).

## Architecture & design choices

### Why `@supabase/ssr`

The official `@supabase/ssr` package is the only correct way to use Supabase Auth in Next.js App Router. It handles the cookie dance between RSC, server actions, route handlers, and middleware. Rolling our own session handling is exactly the legacy mistake we're avoiding.

### Three Supabase clients

All in `lib/supabase/`:

- **`client.ts`** — `createBrowserClient`. Used in `"use client"` components. Reads cookies from the browser; subscribes to `onAuthStateChange`.
- **`server.ts`** — `createServerClient`. Used in RSC and server actions. Reads cookies via `next/headers`. Per-request; do not cache across requests.
- **`middleware.ts`** — `createServerClient` configured for the Next.js middleware runtime. Refreshes the session and re-attaches updated cookies to the response.

Skeleton (full implementations in [02](02-supabase-schema.md) tasks):

```ts
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — ignore; middleware handles refresh.
          }
        },
      },
    },
  );
}
```

### Middleware

```ts
// middleware.ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect logic
  const path = request.nextUrl.pathname;
  const isAuthPath = path.startsWith("/sign-in") || path.startsWith("/sign-up") ||
                     path.startsWith("/forgot-password") || path.startsWith("/reset-password");
  const isPublic = isAuthPath || path === "/" || path.startsWith("/auth/callback");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
```

### `withUser` server-action wrapper

Every authed server action goes through this. It loads the user once and rejects unauthenticated calls. The authorization layer ([04](04-authorization-rls.md)) extends this wrapper.

```ts
// lib/actions/with-user.ts
import { createClient } from "@/lib/supabase/server";

export type ActionContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; field?: string } };

export function withUser<I, O>(
  fn: (ctx: ActionContext, input: I) => Promise<O>,
) {
  return async (input: I): Promise<ActionResult<O>> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: { code: "unauthenticated", message: "Sign in required" } };

    try {
      const data = await fn({ supabase, userId: user.id }, input);
      return { ok: true, data };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err) {
        return { ok: false, error: err as { code: string; message: string; field?: string } };
      }
      // Unexpected — log to Sentry, return generic.
      console.error(err);
      return { ok: false, error: { code: "internal", message: "Something went wrong" } };
    }
  };
}
```

Usage:

```ts
"use server";
import { withUser } from "@/lib/actions/with-user";
import { z } from "zod";

const Input = z.object({ workspaceId: z.string().uuid(), title: z.string().min(1) });

export const createBoard = withUser(async ({ supabase, userId }, raw) => {
  const input = Input.parse(raw);
  const { data, error } = await supabase
    .from("board")
    .insert({ workspace_id: input.workspaceId, title: input.title, created_by: userId })
    .select()
    .single();
  if (error) throw { code: "db_error", message: error.message };
  return data;
});
```

### Auth providers

**Google OAuth (primary)** — internal users overwhelmingly use Google. Configure in Supabase dashboard under Authentication → Providers → Google. Client ID + secret from Google Cloud Console. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.

**Email/password (secondary)** — required for guest accounts and contractors who don't have Google. Email verification on by default.

**Magic link (tertiary)** — passwordless email. Useful for password recovery and the "sign in without remembering my password" flow. Configurable via Supabase email templates.

OAuth callback handler:

```ts
// app/(auth)/callback/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, request.url));
}
```

### Email templates

Supabase ships default email templates for confirm-email, reset-password, invite, magic-link. We override them in the dashboard with branded HTML. React Email isn't used here (Supabase doesn't accept React templates) — use the WYSIWYG editor with our brand tokens. Same templates ship to all environments.

### Forms: React Hook Form + Zod

Every auth form uses RHF + Zod. One Zod schema validates the form (client) and the server action (server). Example:

```ts
// lib/validations/auth.ts
import { z } from "zod";

export const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type SignInInput = z.infer<typeof SignInSchema>;
```

Form component uses `useForm({ resolver: zodResolver(SignInSchema) })`. Server action calls `SignInSchema.parse(input)`.

### Session retrieval inside RSCs

`getUser()` in middleware refreshes the session. RSCs call `await supabase.auth.getUser()` per request — fast, cookie-only check. Layouts that need the user (the app shell) read it once and pass down via React context or props. Don't refetch in every component.

A helper:

```ts
// lib/auth/current-user.ts
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
```

### Account settings page

`app/(app)/account/page.tsx`:

- Display name (from `profile.full_name`).
- Avatar (upload via Supabase Storage `avatars` bucket → updates `profile.avatar_url`).
- Email (editable; triggers email-confirmation flow on change).
- Change password form (requires current password — Supabase Auth `updateUser` accepts `password` directly; for safety we re-verify by re-signing-in with the old password before update).
- Sign out everywhere (revokes all refresh tokens for the user via admin client).
- Connected providers list (Google connected? show; allow link/unlink).

The avatar bucket is created in [10](10-attachments.md) infrastructure but the `avatars` bucket specifically is created here so account settings works before file attachments do. Public bucket; URLs on the profile.

### Cookie hardening

Supabase cookies are `HttpOnly`, `Secure`, `SameSite=Lax` by default in `@supabase/ssr`. No legacy hand-rolled cookie config to fight with. Verify via dev-tools.

### CSRF

Server actions are CSRF-safe by default in Next.js (origin checks + same-site cookies). Don't use cross-origin route handlers for mutations. If we add a webhook handler in [13](13-notifications.md), it gets a shared-secret header check.

### Rate limiting

Supabase Auth has built-in rate limits per email and per IP. We don't need additional rate limiting on auth endpoints. For custom server actions later, see [15](15-observability-testing-cicd.md).

### Email verification gating

Newly-signed-up users via email/password must verify before accessing the app. Middleware checks `user.email_confirmed_at`. If null, redirect to `/verify-email` which polls until verified or resends the email.

Google users skip this — Google has already verified.

### "Internal tool" mode

For the initial internal release, we lock signup to a domain allowlist (e.g., `@yourcompany.com`) via a Supabase Auth hook (Edge Function: `before-user-created`). Configurable. Easy to remove later when we open up.

## Tasks

1. **Configure Supabase Auth providers** in dashboard (prod + preview): Google OAuth (creds from Google Cloud), email/password, magic link. Set Site URL and Redirect URLs to the Vercel domain + `localhost:3000`.
2. **Apply email allowlist hook** (Supabase Edge Function `before-user-created`) restricting signup to allowed domains. Document how to extend.
3. **Implement the three Supabase clients** per [02](02-supabase-schema.md) tasks if not done. Verify TS types resolve.
4. **Write the middleware** per the snippet above. Test: visiting `/` while signed out redirects to `/sign-in`.
5. **Build `withUser` wrapper** in `lib/actions/with-user.ts`. Add unit test for the unauth path.
6. **Build `requireUser` and `getCurrentUser`** in `lib/auth/current-user.ts`.
7. **Build sign-in page** with Google button + email/password form. Use shadcn `Form` + RHF + Zod. Server actions: `signInWithEmail`, `signInWithGoogle`.
8. **Build sign-up page**. Same shape as sign-in plus full-name field. Server action: `signUpWithEmail`. After signup, redirect to `/verify-email`.
9. **Build verify-email page**. Polls `getUser()` every 3s; updates UI when `email_confirmed_at` is set. "Resend email" button.
10. **Build forgot-password and reset-password pages.** Forgot triggers `supabase.auth.resetPasswordForEmail`. Reset accepts the recovery token from the URL hash and calls `updateUser({ password })`.
11. **Build OAuth callback route handler** at `app/(auth)/callback/route.ts`.
12. **Build account settings page.** Name, avatar (uses Supabase Storage `avatars` bucket — create here, even though general storage is [10](10-attachments.md)), email, change password, sign out everywhere.
13. **Wire sign-out.** Server action `signOut()` calls `supabase.auth.signOut()` and redirects.
14. **Brand the Supabase email templates.** Edit in dashboard; copy/paste HTML from `emails/auth/*.html` (a folder of static HTML kept in repo for diffing).
15. **Write Playwright happy-path tests:** sign up → verify email (click magic link in mailcatcher) → land on home; sign in with Google (using a test account); sign out. Mocked email-receipt via Inbucket (Supabase's local-dev mail catcher) or `mailpit`.
16. **Update Vercel envs.** Production domain set as Supabase Site URL and added to Redirect URLs.
17. **Document the auth contract** in `CONTRIBUTING.md`: every authed page uses `requireUser`, every authed action uses `withUser`.

## Definition of done

- A new user can sign up with Google in production; their `auth.users` row appears in Supabase, and a `profile` row is auto-created.
- A new user can sign up with email/password, receive the verification email, click the link, and access the app.
- A signed-in user can change name, avatar, email, password.
- An unauthenticated user hitting any path under `(app)` is redirected to `/sign-in?next=<path>` and lands at `<path>` after sign-in.
- Server actions wrapped in `withUser` reject `unauthenticated` callers cleanly.
- Cookies are `HttpOnly`, `Secure`, `SameSite=Lax`. No client-readable session token.
- Email allowlist (if enabled) blocks signups outside the allowed domains with a clear error.
- Playwright auth happy-path tests pass in CI.

## Open questions

- **Domain allowlist mechanism**: Edge Function hook vs database check vs Supabase's "email-domain restriction" feature. Edge Function is most flexible. Pick one before starting.
- **Anonymous / guest mode**: the legacy app supported a guest mode for demos. Internal release doesn't need it. Drop entirely or keep behind a feature flag?
- **2FA**: Supabase supports TOTP. Skip for v1; revisit when an HR or finance board lands.
- **Org-managed Google Workspace**: do we want to require Google Workspace SSO? Or any Google account? Recommend "any Google account, restricted by email allowlist."
- **Avatar bucket policy**: public-read or signed-URL only? Recommend public-read for simplicity (avatars aren't sensitive).
