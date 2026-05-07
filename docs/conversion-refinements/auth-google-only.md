# Refinement — Auth: Google-only sign-in, no email/password

## Summary

Simplify the auth surface to a single sign-in method: **Continue with Google**. Remove email/password and magic-link flows entirely. The logged-out root route redirects directly to `/sign-in`, which renders only the Google OAuth button.

## Motivation

- Reduces implementation scope and eliminates the full email/password UI (sign-up, forgot-password, reset-password, verify-email pages and their server actions).
- OAuth is strictly better UX for a productivity tool — no password to forget, no email verification gate before first use.
- Email/password can be added later if enterprise SSO requirements demand a fallback; this is not a permanent architectural decision, just a scoped MVP choice.

## Changes to Epic 03 scope

### Remove

- Supabase Auth provider: email/password (do not enable in the dashboard).
- Supabase Auth provider: magic link (do not enable in the dashboard).
- Route `app/(auth)/sign-up` — not needed; Google OAuth auto-creates the account.
- Route `app/(auth)/forgot-password` — not needed.
- Route `app/(auth)/reset-password` — not needed.
- Route `app/(auth)/verify-email` — not needed.
- Server actions: `signInWithEmail`, `signUpWithEmail`, `requestPasswordReset`, `resetPassword`.
- Account settings: password-change section.
- Any "or sign in with email" / "create account" links on the sign-in page.

### Keep

- `app/(auth)/sign-in` — single page, single button: **Continue with Google**.
- `app/(auth)/callback` — OAuth redirect handler (unchanged).
- Server action: `signInWithGoogle`.
- Server action: `signOut`.
- Server action: `updateProfile` (name, avatar — not password).
- `withUser` server-action wrapper.
- Middleware session refresh.
- Profile auto-creation trigger.

### Add / change

- **Logged-out root redirect**: `app/page.tsx` (or middleware) redirects unauthenticated visitors to `/sign-in` immediately. There is no marketing splash or landing page at `/` for now.
- **Sign-in page** (`app/(auth)/sign-in/page.tsx`): renders only the app logo/name, a one-line tagline if desired, and a single "Continue with Google" button. No email input, no password input, no "forgot password" link, no "create account" link.

## Sign-in page design spec

```
┌─────────────────────────────────────┐
│                                     │
│            [App logo]               │
│             Donezo                  │
│                                     │
│   ┌─────────────────────────────┐   │
│   │   G   Continue with Google  │   │
│   └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

- Centered card, minimal chrome.
- No form fields.
- Google button uses the official Google sign-in button styling (white/light background, Google logo, "Continue with Google" label) per Google brand guidelines.

## Middleware / redirect logic

```
Unauthenticated request to any route
  → redirect to /sign-in

Unauthenticated request to /sign-in or /auth/callback
  → allow through

Authenticated request to /sign-in
  → redirect to / (or the workspace home)
```

This is handled in `middleware.ts` using the Supabase SSR session check — no change to the middleware architecture, just the redirect targets.

## Account settings impact

The account settings page keeps:
- Display name
- Avatar upload
- "Sign out everywhere" (revoke all sessions)

Remove:
- Email change (Google owns the email; Supabase surfaces it read-only via the OAuth payload).
- Password change section.

## Future: adding email/password back

If email/password is needed later:

1. Enable the provider in the Supabase dashboard.
2. Add back the removed server actions and routes.
3. Update the sign-in page to show both options.

No schema migration required — Supabase stores credentials per-provider in `auth.identities`.
