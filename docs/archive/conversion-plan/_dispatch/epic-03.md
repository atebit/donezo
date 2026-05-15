# Epic 03: Authentication — Dispatch Plan

**Status:** draft, awaiting orchestrator approval
**Drafted on:** 2026-05-06
**Source epic doc:** `docs/conversion-plan/03-auth.md`
**Branch:** `epic/03-auth` off `main` (commit `26f1270`)

## User decisions (locked autonomously per planning steer)

| #  | Question | Decision | Rationale |
|----|---|---|---|
| 1  | Form library | **React Hook Form + `@hookform/resolvers/zod` + Zod** | CLAUDE.md non-negotiable. Single Zod schema validates client + server action. |
| 2  | Validation message style | **Terse, single-sentence, lowercase except proper nouns.** "Email is required." / "Password must be at least 10 characters." | Matches Base UI defaults; fewer copy bikesheds. |
| 3  | Error display pattern | **Field-level under the input** for `field`-tagged action errors; **toast** (sonner; already wired epic 01) for top-level / non-field errors. | Same pattern epic 01's `PingButton` already uses. |
| 4  | Post-sign-in redirect target | **`/` (the existing health-check page).** Middleware honors `?next=<path>` if present. Until epic 05 ships a real workspace home, `/` is the only authed landing surface. Add a small server-rendered "Signed in as `<email>`" indicator + sign-out button on `/` so it's clear the auth round-trip worked. | App shell at `(app)/` is empty placeholder; `/` is the only complete route. Post-epic-05 the default may change to `/w/[firstWorkspace]` — flagged in followups list. |
| 5  | Magic-link / session expiry | **Supabase defaults.** Magic-link: 60 min. Access token: 1h. Refresh token: 30 days. | No reason to deviate; defaults are sensible. |
| 6  | Password min length | **10 characters.** No complexity requirements (NIST 800-63B guidance). | Matches modern best practice; password manager friendly. |
| 7  | Sign-up self-service vs. invite-only | **Self-service WITH email-domain allowlist (initially `OFF` / wide-open).** Allowlist mechanism scaffolded but list is empty in v1; user can populate when going public. Code-side enforcement via Supabase Edge Function `before-user-created` hook. **Slice scope ships the function code + dashboard config doc; user deploys the Edge Function manually (flagged below).** | Epic doc explicitly recommends allowlist; deferring the list contents to runtime is safer than guessing internal domains. |
| 8  | Email verification gating for email/password sign-ups | **Required.** Middleware redirects users with `email_confirmed_at = null` to `/verify-email` (within `(auth)`). Google OAuth users are auto-verified by Google. | Epic doc explicit. |
| 9  | Anonymous / guest mode | **Drop entirely.** No flag, no scaffolding. | Internal release per epic doc Open Questions. Re-introducible later. |
| 10 | 2FA / TOTP | **Defer to a later epic.** Not scaffolded. | Epic doc explicit. |
| 11 | Google OAuth scope | **Plain Google OAuth (any Google account)**, restricted by email allowlist (Q7). NOT Google Workspace SSO. | Epic doc Open Questions recommendation. |
| 12 | Avatar bucket policy | **Public-read.** Bucket name `avatars`. Path convention: `<userId>/avatar.<ext>`. Max 2 MB, image/* only. | Epic doc recommendation; avatars are not sensitive. |
| 13 | Where avatar bucket gets created | **Migration in epic 03**, not the dashboard. `supabase/migrations/<ts>_avatars_bucket.sql` inserts the bucket row + a permissive `storage.objects` policy for `bucket_id='avatars'` (public read; authenticated insert/update/delete only on own folder). Lets every developer + CI get the bucket without manual dashboard work. | Schema-as-code consistency; epic 10 keeps general storage scope. |
| 14 | `withUser` rewrite breakage | **Breaking — accept it.** Current handler returns `ActionResult<O>`; new contract returns raw `O` and the wrapper builds `ActionResult<O>` (per epic doc snippet; cleaner). Rewrite affects `app/actions.ts` (1 callsite — `pingAction`) and `tests/unit/with-user.test.ts` (4 cases). Update both in slice C. | Epic doc snippet is the canonical shape. The current synthetic-user shape was always a stub. |
| 15 | `withUser` return on unauth | **`{ ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in required" } }`** — uppercase code, matching the existing `INTERNAL` convention in `lib/actions/with-user.ts`. (Epic doc snippet uses lowercase `unauthenticated`; we lock the existing convention.) | Codebase consistency wins over epic doc text. |
| 16 | `requireUser` failure mode | **`redirect("/sign-in?next=<currentPath>")`** via `next/navigation`. Caller of `requireUser` does not get a return path; the redirect throws. | Epic doc snippet is canonical. |
| 17 | Where `currentPath` for `next=` comes from inside `requireUser` | **`requireUser` does NOT receive a path argument; the middleware redirect handles `?next=` rendering.** `requireUser` is a defense-in-depth no-`next`-param redirect to `/sign-in`. Callers needing `next=` semantics get them from middleware (which knows the request URL). | Avoids passing request context through every RSC. |
| 18 | Profile auto-create trigger | **Already shipped in epic 02 migration.** Verify in the smoke test — do NOT re-add. The trigger inserts `(id, email, display_name, avatar_url)` from `auth.users.raw_user_meta_data` (`display_name` → `full_name` → `name` → email-prefix fallback). Google OAuth populates `raw_user_meta_data.name` + `avatar_url`; works out of the box. | Epic 02 done; verifying not duplicating. |
| 19 | Profile column names | **`profile.id` / `profile.display_name` / `profile.email` / `profile.avatar_url`** (per actual epic 02 schema, NOT the `user_id` / `full_name` text in the epic 03 doc). Slice copy uses the actual schema. | Epic doc text is stale relative to the migration. The migration is canonical. |
| 20 | Account-settings password change re-verification | **Skip for v1.** `supabase.auth.updateUser({ password })` accepts new password directly; we trust the active session. Documented as "defer to epic 14 if security review requires." | Epic doc says "for safety we re-verify by re-signing-in" — that pattern is fragile and not idiomatic; modern apps use session reauth challenges instead. Smaller scope, ship faster. |
| 21 | "Sign out everywhere" implementation | **`supabase.auth.signOut({ scope: 'global' })`** in a server action. No admin client needed. | Supabase JS supports `scope: 'global' \| 'local' \| 'others'`. Simpler than admin path. |
| 22 | Connected-providers UI (link/unlink Google) | **Skip for v1; show a static "Sign-in method: <email/password \| google>" line.** Link/unlink is non-trivial and not on the critical path. | Defer; can land as epic 14 polish. |
| 23 | Email change confirmation flow | **Use Supabase default `email_change` template.** UI shows "We've sent a confirmation link to your new email. Click it to complete the change." Polling not required (user clicks link in email). | Standard Supabase flow; no custom code. |
| 24 | Email-template branding | **Defer template HTML to a follow-up.** Epic 03 ships the auth flows working with default Supabase templates. Brand HTML lands in epic 13 (notifications/email) where Resend + React Email are wired and we have a brand-token story. The `emails/auth/*.html` folder per epic doc task #14 is created empty as a placeholder with a README pointing at epic 13. | React Email / brand tokens not in 03; templating in two places is a mess. |
| 25 | Playwright tests | **Scaffold only — no run.** Per epic 02 dispatch and CLAUDE.md, Playwright is wired in epic 15. Slice F creates `tests/e2e/auth.spec.ts` with the happy-path tests (sign-up + verify + sign-in + sign-out) **as a `.skip`-gated spec file** that imports Playwright types but doesn't actually execute. Epic 15 unskips. | Playwright runtime is not yet installed. Don't break CI. |
| 26 | `withUser` Supabase client wiring | **`ActionContext = { supabase, userId }`** per epic doc. `supabase` is the per-request server client (`createClient()` from `lib/supabase/server.ts`). userId is `user.id` from `getUser()`. Existing `withUser` `ctx.user` shape (with `.email`) is replaced — only `userId` is exposed; if a callsite needs the email it can re-query via `ctx.supabase.auth.getUser()`. | Matches the epic doc's planned signature; clients consume narrower context. |
| 27 | Middleware matcher | **`["/((?!_next/static\|_next/image\|favicon.ico\|.*\\..*).*)"]`** per epic doc. Excludes static assets and files with extensions. | Epic doc canonical. |
| 28 | Public paths | **`/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/callback`** (plus webhooks under `/api/webhooks/*`). Everything else under `(app)/` is gated. | Epic doc semantics, plus `/` is public health-check per Q4. |
| 29 | OAuth callback path | **`/auth/callback`** (NOT inside `(auth)` route group; route handlers don't compose with route groups cleanly when an `(app)`-level layout wraps differently). Implemented as `app/auth/callback/route.ts`. The empty `app/(auth)/callback/.gitkeep` from epic 01 is removed. | Cleaner Next.js routing; no layout interference for the GET handler. |
| 30 | `app/actions.ts` ping action | **Update to compile with the new `withUser`** (return raw object instead of `ActionResult`). Behavior preserved. | Necessary for the rewrite (Q14). |
| 31 | Middleware integration with epic 02's `lib/supabase/middleware.ts` stub | **Replace the stub.** `lib/supabase/middleware.ts` exports `updateSession(request: NextRequest): Promise<NextResponse>` — does the cookie-refresh dance + returns the response with refreshed cookies attached. The new root `middleware.ts` calls `updateSession`, then on the returned response runs the auth-redirect logic and returns either `NextResponse.redirect` or the refreshed `response`. | Epic 02 stubbed it for exactly this purpose; keep the layering. |
| 32 | Passing user from middleware to `middleware.ts` redirect logic | **Re-call `supabase.auth.getUser()` inside `middleware.ts`** after `updateSession` runs (cheap; cookie-only). Don't try to thread the user object through return values; keeps `updateSession` pure. | Two `getUser()` calls per request is fine — both hit cookies, no network. |
| 33 | Session helper in RSCs | **`getCurrentUser()` and `requireUser()` in `lib/auth/current-user.ts`.** RSC layouts that need the user call `requireUser()`; pages that conditionally render call `getCurrentUser()`. | Epic doc canonical. |
| 34 | Hard-coding user in `(app)/` shell | **No — DON'T touch `(app)/`** in epic 03 except minimum to ensure middleware redirects work end-to-end. The `(app)/layout.tsx` currently just renders children; epic 05 builds the real shell. | Out of scope. |
| 35 | Unit-test the new `withUser` | **Yes — rewrite `tests/unit/with-user.test.ts`** to mock `lib/supabase/server.createClient` and assert: (a) returns `UNAUTHENTICATED` when `getUser()` returns no user, (b) calls handler with `{ supabase, userId }`, (c) maps thrown plain errors to `INTERNAL`, (d) maps `{ code, message, field }`-shaped throws to `ok: false`. Same `// @ts-expect-error vitest is wired in epic 15` import pattern as the existing file. | Test discipline; small surface. |
| 36 | shadcn `Form` + `Input` + `Label` primitives | **Add via `pnpm dlx shadcn@latest add form input label`** (Base UI–compatible shadcn registry — already wired in epic 01). These land in `components/ui/`. Slice A owns the install. | Standard shadcn flow; `cli` already configured per epic 01. |
| 37 | Toast on success | **`sonner.toast.success(...)`** — wired in epic 01 root layout. Use directly. | No new dep. |
| 38 | OAuth redirect URL passed to `signInWithOAuth` | **`<NEXT_PUBLIC_SITE_URL>/auth/callback?next=<encoded next>`**. New env key `NEXT_PUBLIC_SITE_URL` is required (e.g., `http://localhost:3000` in dev, `https://donezo.app` in prod). Add to `lib/env.ts` as required + `.env.example`. | Supabase OAuth needs an absolute redirect URL; cannot derive from request inside an action without `headers()`. Explicit is better. |
| 39 | Where the `/` health-check learns about the user | **Convert `app/page.tsx` to async RSC** that calls `getCurrentUser()` and renders either "Signed in as `<email>`" + `SignOutButton` or "Sign in" link. The existing `<PingButton />` stays (now confirms an action works while authed). | Minimal change; demonstrates the auth round-trip end-to-end. |
| 40 | Sign-out server action location | **`app/(auth)/actions.ts`** — colocated with the auth route group. The `SignOutButton` (client component used on `/`) imports from there. | App Router co-location. |
| 41 | Storage bucket for avatars implementation | Migration uses `storage.buckets` insert + RLS policies on `storage.objects` filtered by `bucket_id = 'avatars'`. Public bucket flag `true`. Path-prefix policy: authenticated users can `insert/update/delete` only where `(storage.foldername(name))[1] = auth.uid()::text`. Public can `select`. | Storage RLS is the supported pattern. |
| 42 | `app/actions.ts` (existing `pingAction`) authed gating | **Now actually gated** by `withUser` (was synthetic). Hitting `/` while signed out → middleware redirects → user signs in → ping works. Demonstrates auth end-to-end. | Bonus smoke test; no extra code. |
| 43 | When env-key flips for `NEXT_PUBLIC_SITE_URL` happen | **Required from the start** — added in slice A as `z.string().url()` (not optional). Every deploy needs it, dev included. User must add `NEXT_PUBLIC_SITE_URL=http://localhost:3000` to `.env.local` before running dev. | Simpler than a deferred-flip; no need for graceful degradation. Flagged in F1 manual steps. |
| 44 | Domain-allowlist Edge Function: scaffold or skip | **Scaffold under `supabase/functions/before-user-created/index.ts`** with an empty `ALLOWED_DOMAINS` env-driven array (defaults to wide-open if unset). Epic 03 ships the code; user deploys via `supabase functions deploy before-user-created` and configures the auth hook in dashboard manually (flagged). | Defers risk of getting locked out of own DB while still shipping the mechanism. |
| 45 | Where to put `lib/auth/` helpers | `lib/auth/current-user.ts` (per epic doc). The empty `lib/auth/.gitkeep` from epic 01 gets replaced. | Canonical path. |
| 46 | What `withUser` returns when handler returns `void` | **`{ ok: true, data: undefined }`.** Discriminated by `ok` boolean — callers that don't need data ignore `data`. | Standard pattern; `O = void` is allowed. |
| 47 | Server action input validation | **Each action `.parse()`s its input with the action's Zod schema inside the handler.** If parse throws, `withUser` catches and maps to `{ ok: false, code: "VALIDATION", message, field }` (slice C extends `withUser` to special-case `ZodError`). | Single source of truth for validation; epic doc snippet shows this shape. |
| 48 | Sign-up form: full-name field | **Required, min 1 char, max 80 chars.** Stored to `auth.users.raw_user_meta_data.display_name` so the trigger picks it up. | Epic doc explicit; `display_name` aligns with profile column name. |
| 49 | "Resend verification email" cooldown | **30s client-side throttle on the button + Supabase server-side rate limit (default 1/min).** No persistent cooldown UI. | Don't hammer Supabase Auth; users see "Resend" button is disabled for 30s after click. |
| 50 | Forgot-password redirect URL | **`<NEXT_PUBLIC_SITE_URL>/reset-password`** passed via `redirectTo` in `resetPasswordForEmail`. `/reset-password` reads the recovery token from URL hash (Supabase JS handles via `onAuthStateChange('PASSWORD_RECOVERY')`). | Supabase canonical flow. |
| 51 | Account settings sub-pages | **Single `app/(app)/account/page.tsx`** with tabbed sections (Profile / Email / Password / Sessions). No sub-routes. | Smaller surface; later split if needed. |
| 52 | Avatar upload UI | **Slice E ships the form field + server action `updateAvatar(formData)` that reads `File` from FormData, uploads to `avatars/<userId>/avatar.<ext>` via `supabase.storage`, sets `profile.avatar_url`.** No image cropping / preview tooling — accept the file as uploaded. Polish in epic 14. | Smallest viable upload flow. |
| 53 | Where the avatar URL is read in UI | **From `profile.avatar_url`** (joined into `getCurrentUser()` helper). Helper returns `{ id, email, displayName, avatarUrl }` shape (camelCased TS), not the raw Supabase `User`. Two reads per request (one `auth.getUser()`, one `profile.select`) — acceptable. | App-friendly DTO; avoids snake_case leakage. |
| Q54 | shadcn `form.tsx` for base-nova | **Skip.** base-nova registry returns no `form` files; Base UI primitives don't need a Slot-based wrapper. Slices E and F use `react-hook-form` directly (`useForm` + `register` + `formState.errors`) with the Slice A `Input` and `Label`. If a shared `<FormField>` helper emerges, slice E or F adds it as a Base UI–native component (no Radix dep). |

## Open questions for the user (resolved autonomously per the steer)

The user steered "flag only what genuinely needs a decision." None of these are kickoff-blockers — code ships either way, F1 surfaces the manual steps. Resolutions are locked below the table; each is overridable by the user before merge.

### Resolutions

- **U1 → ship code, dashboard config in F1.** Slice F implements the full Google OAuth code path (button, redirect, callback). The Google Cloud project + Supabase dashboard paste is a manual F1 step the user runs whenever they're ready. Until then, the Google button on `/sign-in` will trigger Supabase's "provider not enabled" error — F1 surfaces this as part of the smoke test. No prod-vs-preview project split for now (one Google Cloud OAuth client, two redirect URIs).
- **U2 → `http://localhost:3000` for dev + `.env.example`; `https://donezo.vercel.app` placeholder for prod.** Slice A adds `NEXT_PUBLIC_SITE_URL` as required. F1 surfaces the prod value for the user to paste into Vercel + Supabase dashboard. The placeholder is documented as overridable; if the actual Vercel domain differs, user updates `.env.local` and the Vercel env var.
- **U3 → wide-open allowlist v1.** `ALLOWED_DOMAINS=""` shipped, comment in the Edge Function explains how to tighten later. No domain restrictions until the user goes public.
- **U4 → manual F1 step, values pre-rendered.** F1 documents the exact Supabase dashboard URL Configuration values to enter (Site URL, three Redirect URL globs). Slices land independently; the user does the dashboard config when they next sit at a keyboard. F2 verifies the round-trip.

### Original concerns (kept for reference)



| # | Question | Why it matters |
|---|---|---|
| **U1** | **Google OAuth credentials.** This requires a Google Cloud Console project: create OAuth 2.0 client ID + secret, set authorized redirect URI to `https://petbfbymsgujgwttxlec.supabase.co/auth/v1/callback`. Then paste client ID + secret into Supabase dashboard → Authentication → Providers → Google. **Are you willing to do this manual setup, and do you want a separate Google Cloud project for prod vs preview?** Without it, slice E's Google sign-in button will be present in UI but non-functional until you complete this step. | I cannot create Google Cloud projects or paste secrets into your Supabase dashboard. This is a hard human step. |
| **U2** | **`NEXT_PUBLIC_SITE_URL` value for dev / prod.** I'll default `.env.local` to `http://localhost:3000` and `.env.example` to the same. **Confirm your production URL** (e.g., the Vercel project's primary domain) so I can add it to the docs as the prod-env value to enter in Vercel dashboard. If you don't know yet, default to `https://donezo.vercel.app` and we change later. | Affects OAuth + password-reset redirect URLs; mismatch breaks those flows. |
| **U3** | **Email allowlist initial value.** The Edge Function defaults to wide-open (no allowlist). For the internal release, do you want me to default it to your email's domain (`gmail.com` per the active git user — but that's likely not what you want)? Recommend leaving wide-open in v1 and tightening when you go public. **Confirm wide-open is OK** so I can ship the function code with `ALLOWED_DOMAINS=""` and a comment. | Could lock the user (you) out of their own product if I guess wrong. |
| **U4** | **Supabase Site URL + Redirect URLs in dashboard.** I'll document the values to set in Supabase dashboard → Authentication → URL Configuration: Site URL = `<NEXT_PUBLIC_SITE_URL>`; Redirect URLs = `http://localhost:3000/**`, `<prod-url>/**`, `<preview-url-pattern>/**`. **Confirm you'll set these manually** (I cannot edit the dashboard). | OAuth + email links break if the dashboard's URL config doesn't match the redirect URLs in code. |

(Anything else — copy text, button labels, color of the Google logo — I'll pick reasonable defaults; you can tweak in followups.)

## Preconditions verified

- On `epic/03-auth`, working tree clean. Branch is at `26f1270` (origin/main) — the PR #35 merge that landed epic 02. Verified via `git status` + `git log -1`.
- Epic 02's `lib/supabase/{client,server,middleware,admin,index,types}.ts` all exist. Real `Database` type generated and committed (per F1/Q6) at `lib/supabase/types.ts` (20 KB).
- `lib/supabase/middleware.ts` is the stub — exports `updateSession(_request: NextRequest): NextResponse` returning `NextResponse.next()`. **Epic 03 replaces this implementation.**
- Project root has NO `middleware.ts` yet — epic 03 creates it.
- `lib/actions/with-user.ts` returns synthetic uuid `00000000-…` per epic 02 (line 8). 1 callsite (`app/actions.ts`); 1 test file (`tests/unit/with-user.test.ts`).
- `lib/env.ts` has `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` required (per F3); `SUPABASE_SERVICE_ROLE_KEY` optional. **No `NEXT_PUBLIC_SITE_URL`** — slice A adds it as required.
- `lib/auth/.gitkeep` exists; directory empty.
- `lib/validations/.gitkeep` exists; directory empty.
- `app/(auth)/{sign-in,sign-up,callback}/.gitkeep` exist; directories empty. **`forgot-password`, `reset-password`, `verify-email`, `account` directories DO NOT yet exist.** Epic 03 creates them.
- `app/auth/` directory does NOT exist; slice F creates `app/auth/callback/route.ts` (NOT inside `(auth)` route group — see Q29).
- `app/(app)/layout.tsx` is the no-op `<>{children}</>` placeholder. **Untouched in epic 03** (per Q34).
- `app/(app)/` has `error.tsx`, `layout.tsx`, `w/[workspaceSlug]/{settings,b/[boardId]/{settings,calendar,dashboard,table,kanban,timeline,t/[taskId]}}/.gitkeep` — all empty. Untouched.
- `app/page.tsx` renders the health-check + `<PingButton />`. **Slice F converts to async RSC** with sign-in indicator + sign-out (per Q39).
- `app/actions.ts` has `pingAction = withUser(...)` returning `ActionResult` directly. **Slice C rewrites both `withUser` and this callsite** (Q14, Q30).
- `tests/unit/{env,supabase-admin,with-user}.test.ts` exist. **Slice C rewrites `with-user.test.ts`** (Q35).
- `components/ui/{button.tsx,sonner.tsx}` exist (Base UI + sonner). **Slice A adds `form.tsx`, `input.tsx`, `label.tsx`** via `pnpm dlx shadcn@latest add form input label` (Q36).
- `supabase/migrations/` has `20260506224930_initial_schema.sql` and `20260506230238_view_board_pos_idx.sql`. The profile auto-create trigger lives at lines 372–392 of the initial migration; **fully functional, no edits needed** (Q18). The seed user (`11111111-…`) sits in `auth.users` + `public.profile` and **must NOT be touched** by epic 03.
- `supabase/seed.sql` exists with demo data; untouched.
- `supabase/functions/` does NOT yet exist. Slice D creates `supabase/functions/before-user-created/index.ts` (Q44).
- Biome 2.x linter active. `noRestrictedImports` rule blocks `@/lib/supabase/admin` from `components/**` / `app/**/_components/**` / `"use client"` files. Epic 03 must respect this — no auth UI touches the admin client.
- Stack defaults from `CLAUDE.md` apply (restated in each slice).
- `@supabase/ssr@^0.10.2` and `@supabase/supabase-js@^2.105.3` installed. **Add `react-hook-form@^7` and `@hookform/resolvers@^3` in slice A.**

## Stack defaults (restated for executors)

From `CLAUDE.md` — non-negotiable unless `03-auth.md` explicitly overrides:

- **pnpm only.** No npm, no yarn.
- **Next.js 15 App Router**, RSC-first. `"use client"` only for interactive forms / client-side state.
- **Server Actions** for mutations. The OAuth callback is a route handler (one of the few exemptions — webhooks + auth callback).
- **TypeScript strict** with `verbatimModuleSyntax: true`. Use `import type` for types. Imports of `Database` from `@/lib/supabase/types` are type-only.
- **Biome 2.x** lint. `suspicious.noConsole: error` (use `logger` server-side). `noRestrictedImports` blocks `@/lib/supabase/admin` from client surfaces.
- **Zod** validates env, server-action input, form input. **Same schema** for client form + server action.
- **React Hook Form** owns form state. `zodResolver` from `@hookform/resolvers/zod`.
- **Base UI primitives** via shadcn registry (`base-nova` style). Add `form` / `input` / `label` via `pnpm dlx shadcn@latest add ...`.
- **`sonner.toast`** for top-level success / error feedback.
- **uuid v4** ids from Postgres; **timestamptz** for times; **soft-delete** via `deleted_at` on top-level entities.
- **Migrations:** `supabase/migrations/YYYYMMDDHHMMSS_description.sql`. Never edit a deployed migration.
- **RLS:** epic 04 ships policies. Epic 03 lives in a default-deny world — server actions that need DB writes during signup go through the **service-role admin client** (`adminClient()`). User-scoped reads/writes via the per-request server client (`createClient()` from `lib/supabase/server.ts`) will return empty results until epic 04 — this is acceptable for the user's own profile read because `profile` RLS will land in 04 with `using (id = auth.uid())`. Until then, profile reads from authed users return empty; **slice E uses `adminClient()` for profile reads in epic 03** and adds a `// TODO epic 04: switch to authed client once profile RLS lands` comment.
- **Forbidden-scope is a hard rule.** If a slice spec lists a path under "Forbidden scope" and you discover you need to edit it, **stop and return a needs-direction report** — do NOT edit first.
- **Never modify** `frontend/` or `backend/` (gitignored regardless).

## Execution order

```
Stage 1: A (deps + env + Zod schemas + shadcn primitives)            [solo — touches package.json/lock + env.ts]
            ↓
Stage 2: B (root middleware + lib/supabase/middleware.ts impl)       ┐
         C (rewrite withUser + lib/auth/current-user + tests)        ├─ parallel
         D (avatars storage migration + Edge Function scaffold)      ┘
            ↓
Per-stage review pass after stage 2.
            ↓
Stage 3: E (account settings page + avatar upload action + profile DTO helper) ┐
         F (sign-in / sign-up / forgot / reset / verify-email pages,           ├─ parallel
            OAuth callback route, sign-out action, /-page indicator)           │
         G (CONTRIBUTING.md auth contract + emails/auth/README +               ┘
            Playwright .skip spec)
            ↓
Per-stage review pass after stage 3.
            ↓
Sequential follow-ups:
  F1. Manual user steps (Google Cloud creds, Supabase dashboard URL/redirect config,
      Edge Function deploy, NEXT_PUBLIC_SITE_URL env)
  F2. Smoke test (sign up → verify → sign in → /, sign out → / again,
      forgot password → reset, account settings update)
  F3. (none) — env keys are flipped in slice A
            ↓
Epic-level review pass.
            ↓
PR into main.
```

---

## Slice A — Deps + env + Zod schemas + shadcn form primitives

**Owner:** epic-executor (sonnet) · **Stage:** 1 (solo) · **Branch:** `epic/03-auth/slice-a-deps-env-schemas`

### Scope

- `/package.json` — additive: `react-hook-form` (^7), `@hookform/resolvers` (^3) to `dependencies`. **No other field touched.**
- `/pnpm-lock.yaml` — regenerated as side effect.
- `/lib/env.ts` — add `NEXT_PUBLIC_SITE_URL: z.string().url()` (required) — Q43.
- `/.env.example` — add `NEXT_PUBLIC_SITE_URL=http://localhost:3000` line under the existing Supabase block, before `RESEND_API_KEY`.
- `/lib/validations/auth.ts` — **new** — Zod schemas: `SignInSchema`, `SignUpSchema`, `ForgotPasswordSchema`, `ResetPasswordSchema`, `UpdateProfileSchema`, `UpdatePasswordSchema`, `UpdateEmailSchema`. Plus `type` exports.
- `/components/ui/form.tsx`, `/components/ui/input.tsx`, `/components/ui/label.tsx` — added via `pnpm dlx shadcn@latest add form input label`. Slice MUST run the shadcn CLI; do NOT hand-write.
- `/tests/unit/validations-auth.test.ts` — **new** — Vitest spec asserting each schema rejects the canonical bad inputs and accepts the canonical good ones (~30 LOC). Same `// @ts-expect-error vitest is wired in epic 15` pattern.

### Forbidden scope

Everything else. Specifically NOT: `lib/supabase/**`, `lib/actions/**`, `lib/auth/**`, `app/**`, `middleware.ts` (root), `supabase/**`, `biome.json`, `tsconfig.json`, `next.config.ts`, `CONTRIBUTING.md`, `.github/**`, legacy. **Hard rule** — escalate.

### Spec details

1. **Install deps:**
   ```
   pnpm add react-hook-form @hookform/resolvers
   ```
   Inspect lockfile diff — if anything beyond expected adds churns, escalate. (Both packages are well-isolated; no transitive surprises expected.)

2. **Run shadcn CLI:**
   ```
   pnpm dlx shadcn@latest add form input label
   ```
   This drops `form.tsx`, `input.tsx`, `label.tsx` into `components/ui/`. If the CLI fails (registry mismatch, etc.), escalate — do NOT hand-write the components.

   **Update per Q54:** the registry produces only `input.tsx` and `label.tsx` for base-nova; `form` returns no files (verified). That's expected — slices E and F use RHF directly. Slice A does NOT hand-write a `form.tsx`.

3. **`lib/env.ts`** — add the line **before `SUPABASE_SERVICE_ROLE_KEY`**:
   ```ts
   NEXT_PUBLIC_SITE_URL: z.string().url(),
   ```
   No other edits.

4. **`.env.example`** — add the line:
   ```
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
   under the comment `# Wired in epic 02 (Supabase schema)` block, on its own; or under a new comment `# Wired in epic 03 (auth)`. Either acceptable; pick the cleaner one.

5. **`lib/validations/auth.ts`** (~70 LOC):
   ```ts
   import { z } from "zod";

   const Email = z.string().email("Enter a valid email.");
   const Password = z.string().min(10, "Password must be at least 10 characters.");
   const DisplayName = z.string().min(1, "Name is required.").max(80, "Name must be 80 characters or fewer.");

   export const SignInSchema = z.object({ email: Email, password: z.string().min(1, "Password is required.") });
   export type SignInInput = z.infer<typeof SignInSchema>;

   export const SignUpSchema = z.object({ email: Email, password: Password, displayName: DisplayName });
   export type SignUpInput = z.infer<typeof SignUpSchema>;

   export const ForgotPasswordSchema = z.object({ email: Email });
   export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

   export const ResetPasswordSchema = z.object({ password: Password });
   export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

   export const UpdateProfileSchema = z.object({ displayName: DisplayName });
   export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

   export const UpdatePasswordSchema = z.object({ password: Password });
   export type UpdatePasswordInput = z.infer<typeof UpdatePasswordSchema>;

   export const UpdateEmailSchema = z.object({ email: Email });
   export type UpdateEmailInput = z.infer<typeof UpdateEmailSchema>;
   ```
   Note: `SignInSchema.password` only requires `min(1)` (the user might have a 6-char legacy-Supabase-default password); only `SignUpSchema.password` enforces 10-char minimum.

6. **`tests/unit/validations-auth.test.ts`** — small spec covering one rejecting + one accepting case per schema. Use the existing `// @ts-expect-error vitest is wired in epic 15` import pattern.

### Definition of done

- `pnpm install` clean, lockfile committed.
- `pnpm typecheck` green. `pnpm lint` green. `pnpm build` green.
- `lib/env.ts` requires `NEXT_PUBLIC_SITE_URL`. **App will fail to boot without it set in `.env.local`.** Document this in the slice done-report.
- `.env.example` has the new key.
- `lib/validations/auth.ts` exports all 7 schemas + types.
- `components/ui/input.tsx` and `components/ui/label.tsx` exist (via shadcn CLI; `form` is intentionally absent per Q54).
- `tests/unit/validations-auth.test.ts` exists, valid TypeScript.
- `git status` shows only intended files.

### Escalation triggers

- shadcn CLI fails or registry doesn't have `form` / `input` / `label` for the active Base UI style.
- `react-hook-form` / `@hookform/resolvers` peer-dep mismatch with React 19.1.
- Lockfile churn beyond expected adds.

---

## Slice B — Root middleware + `lib/supabase/middleware.ts` real implementation

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel · **Branch:** `epic/03-auth/slice-b-middleware`

### Scope

- `/middleware.ts` — **new** at project root. Calls `updateSession(request)` to refresh session + cookies, then runs auth-redirect logic.
- `/lib/supabase/middleware.ts` — **rewrite** the stub. Exports `updateSession(request: NextRequest): Promise<NextResponse>` that performs the cookie-refresh dance per the `@supabase/ssr` middleware recipe.
- `/lib/auth/public-paths.ts` — **new** — `export const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email", "/auth/callback"] as const;` and `export const HOME_PATH = "/" as const;` (also public per Q4). Helper: `isPublicPath(pathname: string): boolean` — returns true for `/`, any `PUBLIC_PATHS` prefix, or anything under `/api/webhooks/`.

### Forbidden scope

`lib/supabase/{client,server,admin,index,types}.ts`, `lib/actions/**`, `lib/env.ts`, `lib/validations/**`, `app/**`, `components/**`, `supabase/**`, `package.json`, `pnpm-lock.yaml`, `biome.json`, `tsconfig.json`, `next.config.ts`, `CONTRIBUTING.md`, `.github/**`, legacy. **Hard rule.**

### Dependencies on other slices

None — fully parallel-safe with C and D. (Slice A's `NEXT_PUBLIC_SITE_URL` env key is read by E/F at runtime, not by middleware.)

### Spec details

1. **`lib/supabase/middleware.ts`** — replace stub with real implementation per the `@supabase/ssr` Next.js middleware recipe ([docs](https://supabase.com/docs/guides/auth/server-side/nextjs#middleware)):
   ```ts
   import { createServerClient } from "@supabase/ssr";
   import { type NextRequest, NextResponse } from "next/server";
   import { env } from "@/lib/env";
   import type { Database } from "./types";

   export async function updateSession(request: NextRequest): Promise<NextResponse> {
     let response = NextResponse.next({ request });

     const supabase = createServerClient<Database>(
       env.NEXT_PUBLIC_SUPABASE_URL,
       env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
       {
         cookies: {
           getAll() {
             return request.cookies.getAll();
           },
           setAll(cookiesToSet) {
             cookiesToSet.forEach(({ name, value }) => {
               request.cookies.set(name, value);
             });
             response = NextResponse.next({ request });
             cookiesToSet.forEach(({ name, value, options }) => {
               response.cookies.set(name, value, options);
             });
           },
         },
       },
     );

     // Touch getUser to trigger refresh; result discarded — root middleware re-queries.
     await supabase.auth.getUser();

     return response;
   }
   ```

2. **`middleware.ts` (root)** — new:
   ```ts
   import { type NextRequest, NextResponse } from "next/server";
   import { createServerClient } from "@supabase/ssr";
   import { env } from "@/lib/env";
   import type { Database } from "@/lib/supabase/types";
   import { updateSession } from "@/lib/supabase/middleware";
   import { isPublicPath } from "@/lib/auth/public-paths";

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
   ```

3. **`lib/auth/public-paths.ts`**:
   ```ts
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
   ```

4. **Test:** No new unit tests in this slice (middleware is integration-tested in F1 smoke). The `isPublicPath` helper is small enough to skip; if it grows, epic 04 adds tests.

### Definition of done

- `middleware.ts` exists at project root with the matcher above.
- `lib/supabase/middleware.ts` no longer contains the `TODO epic 03` stub.
- `lib/auth/public-paths.ts` exists with the helper.
- `pnpm typecheck` green. `pnpm lint` green. `pnpm build` green (boot will succeed; runtime auth-redirect logic verified in F2).
- `lib/auth/.gitkeep` removed (a real file is now in the directory).

### Escalation triggers

- `@supabase/ssr` middleware recipe API surface differs from the snippet (e.g., `cookies.setAll` shape changed in 0.10.x → 0.11.x). Verify against installed version.
- Edge runtime restrictions (e.g., `pino` logger import in middleware → fail). Don't import logger in middleware.
- Matcher excludes static assets but accidentally also excludes routes with dots in paths — verify behavior on `/auth/callback` (no dots, fine).

---

## Slice C — Rewrite `withUser` + `lib/auth/current-user.ts` + tests

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel · **Branch:** `epic/03-auth/slice-c-with-user-current-user`

### Scope

- `/lib/actions/with-user.ts` — **rewrite.** New signature per Q14 + Q15 + Q26 + Q46 + Q47.
- `/lib/actions/index.ts` — add export for `ActionContext` type.
- `/lib/auth/current-user.ts` — **new.** Q33 + Q53.
- `/app/actions.ts` — **edit** the `pingAction` to match the new `withUser` shape (handler returns `O`, not `ActionResult<O>`). Q30.
- `/tests/unit/with-user.test.ts` — **rewrite** for the new contract. Q35.

### Forbidden scope

`lib/supabase/**` (B owns middleware), `lib/env.ts`, `lib/validations/**` (A), `app/(auth)/**` (F), `app/(app)/**`, `middleware.ts` root (B), `components/**`, `supabase/**`, `package.json`, `biome.json`, `tsconfig.json`, `CONTRIBUTING.md`, `.github/**`, legacy. **Hard rule.**

### Dependencies on other slices

None — fully parallel-safe with B and D. (`app/actions.ts` is edited; orchestrator confirms it's not also touched in any other slice. F edits the **page** at `app/page.tsx`, not `app/actions.ts`.)

### Spec details

1. **`lib/actions/with-user.ts`** — rewrite (~50 LOC):
   ```ts
   import { z } from "zod";
   import { createClient } from "@/lib/supabase/server";
   import { logger } from "@/lib/logger";

   export type ActionContext = {
     supabase: Awaited<ReturnType<typeof createClient>>;
     userId: string;
   };

   export type ActionResult<T> =
     | { ok: true; data: T }
     | { ok: false; error: { code: string; message: string; field?: string } };

   export function withUser<I, O>(
     handler: (ctx: ActionContext, input: I) => Promise<O>,
   ): (input: I) => Promise<ActionResult<O>> {
     return async (input: I) => {
       const start = performance.now();
       const action = handler.name || "anonymous";
       const supabase = await createClient();
       const {
         data: { user },
       } = await supabase.auth.getUser();
       if (!user) {
         logger.info({ action }, "action denied — unauthenticated");
         return { ok: false, error: { code: "UNAUTHENTICATED", message: "Sign in required" } };
       }
       try {
         const data = await handler({ supabase, userId: user.id }, input);
         logger.info({ action, durationMs: performance.now() - start, userId: user.id }, "action complete");
         return { ok: true, data };
       } catch (err) {
         if (err instanceof z.ZodError) {
           const first = err.issues[0];
           return {
             ok: false,
             error: {
               code: "VALIDATION",
               message: first?.message ?? "Invalid input",
               field: first?.path.join(".") || undefined,
             },
           };
         }
         if (err && typeof err === "object" && "code" in err && "message" in err) {
           return { ok: false, error: err as { code: string; message: string; field?: string } };
         }
         logger.error({ err, action, userId: user.id }, "action threw");
         return { ok: false, error: { code: "INTERNAL", message: "Unexpected error" } };
       }
     };
   }
   ```

2. **`lib/actions/index.ts`** — extend:
   ```ts
   export { type ActionContext, type ActionResult, withUser } from "./with-user";
   ```

3. **`lib/auth/current-user.ts`** — new (~50 LOC):
   ```ts
   import { redirect } from "next/navigation";
   import { createClient } from "@/lib/supabase/server";
   import { adminClient } from "@/lib/supabase/admin";

   export type CurrentUser = {
     id: string;
     email: string;
     displayName: string | null;
     avatarUrl: string | null;
     emailConfirmedAt: string | null;
   };

   export async function getCurrentUser(): Promise<CurrentUser | null> {
     const supabase = await createClient();
     const {
       data: { user },
     } = await supabase.auth.getUser();
     if (!user) return null;

     // TODO epic 04: switch to authed `supabase` client once profile RLS lands.
     // Until then, profile rows are unreadable to authed clients (default-deny).
     const admin = adminClient();
     const { data: profile } = await admin
       .from("profile")
       .select("display_name, avatar_url")
       .eq("id", user.id)
       .maybeSingle();

     return {
       id: user.id,
       email: user.email ?? "",
       displayName: profile?.display_name ?? null,
       avatarUrl: profile?.avatar_url ?? null,
       emailConfirmedAt: user.email_confirmed_at ?? null,
     };
   }

   export async function requireUser(): Promise<CurrentUser> {
     const user = await getCurrentUser();
     if (!user) redirect("/sign-in");
     return user;
   }
   ```

4. **`app/actions.ts`** — rewrite to match the new `withUser` (handler returns raw `O`):
   ```ts
   "use server";
   import { withUser } from "@/lib/actions";

   export const pingAction = withUser(async ({ userId }) => {
     return { pong: true as const, userId, timestamp: new Date().toISOString() };
   });
   ```
   Note: `app/_components/ping-button.tsx` already destructures `res.data.timestamp` — still works. Don't edit the client.

5. **`tests/unit/with-user.test.ts`** — rewrite (~80 LOC):
   - Mock `@/lib/supabase/server` `createClient` returning `{ auth: { getUser: vi.fn() } }`.
   - **Test A:** `getUser` returns `{ data: { user: null } }` → action returns `{ ok: false, error: { code: "UNAUTHENTICATED", ... } }` and handler is NOT called.
   - **Test B:** `getUser` returns `{ data: { user: { id: "u-1" } } }` → handler is called with `{ supabase, userId: "u-1" }` and `input` echoes through; result is `{ ok: true, data: ... }`.
   - **Test C:** Handler throws plain `Error` → `{ ok: false, error: { code: "INTERNAL", ... } }`.
   - **Test D:** Handler throws `{ code: "NOT_FOUND", message: "..." }` → that exact error returned.
   - **Test E:** Handler throws `z.ZodError` → `{ ok: false, error: { code: "VALIDATION", message, field } }`.
   - Same `// @ts-expect-error vitest is wired in epic 15` import pattern.

### Definition of done

- `lib/actions/with-user.ts` no longer contains `SYNTHETIC_USER`. Uses real `auth.getUser()`.
- `lib/auth/current-user.ts` exists.
- `app/actions.ts` compiles and matches the new contract.
- `tests/unit/with-user.test.ts` rewritten with 5 tests above. Valid TypeScript.
- `pnpm typecheck` green. `pnpm lint` green. `pnpm build` green.

### Escalation triggers

- `Awaited<ReturnType<typeof createClient>>` doesn't infer the right `SupabaseClient<Database>` shape.
- Logger import in server action causes edge-runtime issues (it shouldn't — server actions run on Node, not edge by default).

---

## Slice D — Avatars storage migration + Edge Function scaffold

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel · **Branch:** `epic/03-auth/slice-d-storage-edge-function`

### Scope

- `/supabase/migrations/<YYYYMMDDHHMMSS>_avatars_bucket.sql` — **new**. Creates the `avatars` storage bucket + RLS policies on `storage.objects`.
- `/supabase/functions/before-user-created/index.ts` — **new**. Email-domain allowlist hook. Defaults to allow-all when `ALLOWED_DOMAINS` env is unset.
- `/supabase/functions/before-user-created/README.md` — **new**. How to deploy + how to configure the dashboard hook.

### Forbidden scope

`lib/**`, `app/**`, `middleware.ts` root, `components/**`, `package.json`, `biome.json`, `tsconfig.json`, `next.config.ts`, `CONTRIBUTING.md`, `.github/**`, legacy. Other migrations untouched. `supabase/seed.sql` untouched. `supabase/config.toml` untouched. **Hard rule.**

### Dependencies on other slices

None — fully parallel-safe with B and C.

### Spec details

1. **Migration `<ts>_avatars_bucket.sql`** (~30 LOC):
   ```sql
   -- Avatars bucket: public-read, owner-write.
   insert into storage.buckets (id, name, public)
   values ('avatars', 'avatars', true)
   on conflict (id) do nothing;

   -- Public can read every avatar.
   create policy "avatars are publicly readable"
   on storage.objects for select
   to public
   using (bucket_id = 'avatars');

   -- Authenticated users can write only inside their own folder: <userId>/...
   create policy "users can upload to own avatar folder"
   on storage.objects for insert
   to authenticated
   with check (
     bucket_id = 'avatars'
     and (storage.foldername(name))[1] = auth.uid()::text
   );

   create policy "users can update their own avatar"
   on storage.objects for update
   to authenticated
   using (
     bucket_id = 'avatars'
     and (storage.foldername(name))[1] = auth.uid()::text
   );

   create policy "users can delete their own avatar"
   on storage.objects for delete
   to authenticated
   using (
     bucket_id = 'avatars'
     and (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

2. **`supabase/functions/before-user-created/index.ts`** (~40 LOC) — Deno Edge Function for the Auth Hook (`before-user-created` event):
   ```ts
   // Supabase Auth Hook: before-user-created.
   // Runs in Deno. Configure in Supabase dashboard → Authentication → Hooks.
   // Env: ALLOWED_DOMAINS — comma-separated. Empty / unset = allow all.

   // deno-lint-ignore-file no-explicit-any
   Deno.serve(async (req: Request) => {
     try {
       const payload = await req.json();
       const email: string | undefined = payload?.user?.email;
       const allowedRaw = Deno.env.get("ALLOWED_DOMAINS") ?? "";
       const allowed = allowedRaw.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);

       // Wide-open: no allowlist configured.
       if (allowed.length === 0) {
         return new Response(JSON.stringify({ decision: "continue" }), {
           headers: { "content-type": "application/json" },
         });
       }

       if (!email) {
         return new Response(
           JSON.stringify({ decision: "reject", message: "Email required" }),
           { status: 200, headers: { "content-type": "application/json" } },
         );
       }

       const domain = email.split("@")[1]?.toLowerCase();
       if (!domain || !allowed.includes(domain)) {
         return new Response(
           JSON.stringify({
             decision: "reject",
             message: `Sign-up is restricted. Contact your admin if you should have access.`,
           }),
           { status: 200, headers: { "content-type": "application/json" } },
         );
       }

       return new Response(JSON.stringify({ decision: "continue" }), {
         headers: { "content-type": "application/json" } },
       );
     } catch (_err) {
       // Fail open on hook errors — better than locking everyone out.
       return new Response(JSON.stringify({ decision: "continue" }), {
         headers: { "content-type": "application/json" } },
       );
     }
   });
   ```

3. **`supabase/functions/before-user-created/README.md`** — short doc:
   ```
   # before-user-created hook

   Restricts new sign-ups to an allowlist of email domains.

   ## Behavior

   - `ALLOWED_DOMAINS` unset or empty → allow all sign-ups (default).
   - `ALLOWED_DOMAINS="example.com,foo.org"` → only sign-ups whose email ends in one of those domains succeed; others are rejected with a friendly message.

   ## Deploy

   ```
   supabase functions deploy before-user-created --no-verify-jwt
   supabase secrets set ALLOWED_DOMAINS="example.com,foo.org"   # or omit to allow all
   ```

   ## Wire it up

   In Supabase dashboard → Authentication → Hooks → "Before user created":
   - Hook type: HTTP
   - Endpoint: `https://<project-ref>.supabase.co/functions/v1/before-user-created`
   - Save.

   To disable temporarily: clear the hook in the dashboard.

   ## Fail-open

   On any function error, the hook returns `continue` (allows sign-up) rather than blocking. Better than locking everyone out due to a bug.
   ```

### Definition of done

- Migration file exists at `supabase/migrations/<ts>_avatars_bucket.sql` with all 4 policies + bucket insert. **Migration is NOT auto-applied by the slice — F1 manually runs `pnpm db:push` after merge.**
- Edge Function file exists with the allow-all-by-default behavior.
- README documents the deploy + dashboard hookup steps.
- File parses syntactically (lowercase keywords, trailing newlines, etc.).
- `pnpm typecheck`, `pnpm lint`, `pnpm build` green (Edge Function is Deno code, NOT Node — Biome may flag the `Deno.*` reference; if so, add `// biome-ignore lint/correctness/noUndeclaredVariables: deno runtime` or add a tsconfig exclude for `supabase/functions/**`. Verify and apply minimally; escalate if it requires a meaningful tsconfig change beyond `exclude`).

### Escalation triggers

- Migration fails to apply on cloud DB during F1 (e.g., `storage.objects` policy already exists with a conflicting name).
- Biome / TypeScript barfs on the Deno-style code in a way that requires real tsconfig changes (escalate; orchestrator decides whether to add `supabase/functions/**` to `tsconfig.exclude`).
- Auth Hook payload shape (the JSON the hook receives + the response shape it expects) differs from the assumed `{ user: { email } }` → `{ decision: "continue" | "reject", message? }`. **Verify against current Supabase Auth Hooks docs before locking the function logic** — if the actual contract differs, escalate (likely needs orchestrator to confirm shape).

---

## Stage 3 begins — wait for stage 2 review CLEAN

Slices E, F, G are large (UI surface). They sit on top of B (middleware), C (`withUser` + `requireUser`), and A (validations + form primitives). DO NOT dispatch stage 3 until stage 2 review returns CLEAN.

---

## Slice E — Account settings page + avatar upload action + profile DTO helper

**Owner:** epic-executor (sonnet) · **Stage:** 3, parallel · **Branch:** `epic/03-auth/slice-e-account-settings`

### Scope

- `/app/(app)/account/page.tsx` — **new**. RSC. `requireUser()` at top; renders `<AccountSettingsClient>`.
- `/app/(app)/account/account-settings.tsx` — **new** client component. `"use client"`. Tabs: Profile / Email / Password / Sessions. RHF + Zod forms (per A's schemas). On success → `sonner.toast.success`; on field error → inline; on top-level error → `sonner.toast.error`.
- `/app/(app)/account/actions.ts` — **new** server actions:
  - `updateProfile(input: UpdateProfileInput) → ActionResult<{ displayName: string }>`
  - `updateAvatar(formData: FormData) → ActionResult<{ avatarUrl: string }>` (reads `File` from FormData)
  - `updateEmail(input: UpdateEmailInput) → ActionResult<{ pendingEmail: string }>`
  - `updatePassword(input: UpdatePasswordInput) → ActionResult<{ ok: true }>`
  - `signOutEverywhere() → ActionResult<{ ok: true }>` (calls `supabase.auth.signOut({ scope: 'global' })`, then `redirect("/sign-in")`)
- `/lib/auth/profile.ts` — **new** helpers:
  - `updateProfileRow(userId: string, patch: { display_name?: string; avatar_url?: string }): Promise<void>` — uses `adminClient()` to write `public.profile`. (No RLS yet → service-role required.)

### Forbidden scope

`app/(auth)/**` (F), `app/page.tsx` (F), `app/actions.ts` (C), `app/_components/**`, `lib/auth/current-user.ts` (C), `lib/auth/public-paths.ts` (B), `lib/supabase/**`, `lib/actions/**`, `lib/env.ts`, `lib/validations/**`, `middleware.ts` root, `components/ui/**`, `supabase/**`, `package.json`, `biome.json`, `tsconfig.json`, `CONTRIBUTING.md`, `.github/**`, legacy. **Hard rule.**

### Dependencies on other slices

Hard deps: A (Zod schemas, form primitives), C (`requireUser`, `withUser`), D (avatars bucket). All must be merged before E starts.

Soft dep: B for end-to-end auth-redirect verification, but E can compile and lint without B.

### Spec details

1. **`app/(app)/account/page.tsx`**:
   ```tsx
   import { requireUser } from "@/lib/auth/current-user";
   import { AccountSettings } from "./account-settings";

   export default async function AccountPage() {
     const user = await requireUser();
     return <AccountSettings user={user} />;
   }
   ```

2. **`app/(app)/account/account-settings.tsx`** (~250 LOC) — client component with 4 sections (no real tab UI primitive yet — render as 4 stacked cards with `<h2>` headers; epic 14 / future epic adds tabs primitive). Each section is its own RHF form. Use `Form`, `Input`, `Label` from slice A.

3. **`app/(app)/account/actions.ts`** (~150 LOC):
   - All actions wrapped in `withUser`.
   - Inside each handler: `Schema.parse(input)`; on success, call appropriate Supabase Auth method (`auth.updateUser({ ... })`) or profile helper (`updateProfileRow(...)`).
   - `updateAvatar`: validate file type (image/*) + size (≤2 MB); upload via `ctx.supabase.storage.from('avatars').upload('${userId}/avatar.${ext}', file, { upsert: true })`; on success, `updateProfileRow(userId, { avatar_url: <publicUrl> })`.
   - `updateEmail`: `ctx.supabase.auth.updateUser({ email })` — Supabase sends confirmation to new address; UI displays "Check your inbox for a confirmation link."
   - `updatePassword`: `ctx.supabase.auth.updateUser({ password })`. Per Q20, no re-verification.
   - `signOutEverywhere`: `await ctx.supabase.auth.signOut({ scope: 'global' });` then `redirect("/sign-in")` from `next/navigation`.

4. **`lib/auth/profile.ts`** (~25 LOC):
   ```ts
   import { adminClient } from "@/lib/supabase/admin";

   export async function updateProfileRow(
     userId: string,
     patch: { display_name?: string; avatar_url?: string },
   ): Promise<void> {
     const admin = adminClient();
     const { error } = await admin
       .from("profile")
       .update({ ...patch, updated_at: new Date().toISOString() })
       .eq("id", userId);
     if (error) throw { code: "DB", message: error.message };
   }
   ```

### Definition of done

- All files exist with the contracts above.
- Account settings page renders 4 sections, each with a working form bound to the corresponding action.
- Avatar upload writes to `avatars/<userId>/avatar.<ext>` and updates `profile.avatar_url`.
- Sign-out-everywhere clears all sessions for the user and redirects to `/sign-in`.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` green.
- No `@/lib/supabase/admin` imports leak into client components (Biome rule enforces).

### Escalation triggers

- Supabase Storage bucket policy doesn't allow upload (likely a path-prefix mismatch in the policy vs. the path used by the action). Verify in F2.
- `auth.updateUser({ email })` flow requires additional config (e.g., "Enable email change" toggle in dashboard) — flag for U4.
- Account-settings UI complexity exceeds slice budget — escalate; we can split off Email + Password into a stage 4 followup.

---

## Slice F — Auth pages (sign-in / sign-up / forgot / reset / verify-email) + OAuth callback + sign-out + `/`-page indicator

**Owner:** epic-executor (sonnet) · **Stage:** 3, parallel · **Branch:** `epic/03-auth/slice-f-auth-pages`

### Scope

- `/app/(auth)/layout.tsx` — **new**. Centered-card layout shell for all auth pages.
- `/app/(auth)/sign-in/page.tsx` — **new** RSC wrapper. Renders `<SignInForm>`.
- `/app/(auth)/sign-in/sign-in-form.tsx` — **new** client component. RHF + `SignInSchema`. Email/password form + Google button.
- `/app/(auth)/sign-up/page.tsx` — **new** RSC. Renders `<SignUpForm>`.
- `/app/(auth)/sign-up/sign-up-form.tsx` — **new** client component. Email/password/displayName form + Google button.
- `/app/(auth)/forgot-password/page.tsx`, `/app/(auth)/forgot-password/forgot-password-form.tsx` — **new**.
- `/app/(auth)/reset-password/page.tsx`, `/app/(auth)/reset-password/reset-password-form.tsx` — **new**. Reads recovery token via `onAuthStateChange('PASSWORD_RECOVERY')`; calls `updateUser({ password })`.
- `/app/(auth)/verify-email/page.tsx`, `/app/(auth)/verify-email/verify-email-client.tsx` — **new**. Polls `getUser()` every 3s; "Resend email" button (30s throttle per Q49).
- `/app/(auth)/actions.ts` — **new** server actions:
  - `signInWithEmail(input: SignInInput) → ActionResult<{ ok: true }>` — calls `signInWithPassword`; on success redirects via cookie set + client navigation; on failure returns error.
  - `signUpWithEmail(input: SignUpInput) → ActionResult<{ ok: true }>` — calls `signUp({ email, password, options: { data: { display_name }, emailRedirectTo: '<SITE_URL>/auth/callback' } })`.
  - `signInWithGoogle() → ActionResult<{ url: string }>` — calls `signInWithOAuth({ provider: 'google', options: { redirectTo: '<SITE_URL>/auth/callback?next=<next>' } })`; returns the URL for client redirect.
  - `requestPasswordReset(input: ForgotPasswordInput) → ActionResult<{ ok: true }>` — calls `resetPasswordForEmail(email, { redirectTo: '<SITE_URL>/reset-password' })`.
  - `resetPassword(input: ResetPasswordInput) → ActionResult<{ ok: true }>` — calls `updateUser({ password })`. Redirects to `/`.
  - `signOut() → ActionResult<{ ok: true }>` — calls `signOut()` + `redirect("/sign-in")`.
  - `resendVerificationEmail() → ActionResult<{ ok: true }>` — calls `auth.resend({ type: 'signup', email: <currentUser.email> })`.
- `/app/auth/callback/route.ts` — **new**. GET route handler. Exchanges `?code=` for session, redirects to `?next=` (default `/`).
- `/app/page.tsx` — **edit** to async RSC: read `getCurrentUser()`; render either signed-in indicator (email + `<SignOutButton />`) or "Sign in" link. Keep `<PingButton />` so the auth round-trip is observable.
- `/app/_components/sign-out-button.tsx` — **new** client component using the `signOut` action.
- `/app/(auth)/sign-in/.gitkeep`, `/app/(auth)/sign-up/.gitkeep`, `/app/(auth)/callback/.gitkeep` — **delete** (replaced by real files; `callback` becomes empty since OAuth callback moved to `app/auth/callback/`. Also delete the `(auth)/callback/` directory entirely).

### Forbidden scope

`app/(app)/**` (E owns account; rest of `(app)/` is empty epic-05 territory), `app/actions.ts` (C; `pingAction` lives there and stays unchanged), `lib/**` except for nothing (F adds no `lib/**` files), `middleware.ts` root (B), `components/ui/**` (A added the form primitives), `supabase/**`, `package.json`, `biome.json`, `tsconfig.json`, `CONTRIBUTING.md` (G), `.github/**`, legacy. **Hard rule.**

### Dependencies on other slices

Hard deps: A (Zod schemas, form primitives), B (middleware redirect logic to test against), C (`getCurrentUser`).

### Spec details

1. **`app/(auth)/layout.tsx`** — simple centered layout:
   ```tsx
   export default function AuthLayout({ children }: { children: React.ReactNode }) {
     return (
       <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-8">
         <h1 className="text-2xl font-semibold">Donezo</h1>
         <div className="w-full rounded-xl border border-border bg-bg p-6 shadow-sm">{children}</div>
       </main>
     );
   }
   ```

2. **Auth forms** — pattern (illustrated for sign-in; rest follow same shape):
   - **Server wrapper** (`page.tsx`):
     ```tsx
     import { SignInForm } from "./sign-in-form";

     export default function SignInPage() {
       return <SignInForm />;
     }
     ```
   - **Client form** (`sign-in-form.tsx`):
     - `"use client"`.
     - `useForm<SignInInput>({ resolver: zodResolver(SignInSchema) })`.
     - On submit: `useTransition` → call `signInWithEmail(values)`; on `ok: true`, `router.push(next ?? "/")`; on `ok: false` with `field`, `form.setError(field, { message })`; otherwise `toast.error(message)`.
     - Below the form, divider + Google button. Google button calls `signInWithGoogle()` server action; on `ok`, `window.location.href = data.url`.
     - Footer links: "No account? Sign up" / "Forgot password?".
     - Read `?next=<path>` from `useSearchParams` for the post-sign-in redirect target.

3. **`app/(auth)/actions.ts`** — server actions. Each action:
   - `"use server"` directive at top.
   - For unauthed actions (sign-in, sign-up, forgot, reset): create supabase via `createClient()` from `lib/supabase/server`; do NOT use `withUser` (caller is unauthed by definition).
   - For `signOut()` and `resendVerificationEmail()`: do NOT use `withUser` either — sign-out should work even on a stale session; resend reads `getUser()` directly and tolerates null.
   - Validate input with the appropriate Zod schema; return field errors via `{ ok: false, error: { code: "VALIDATION", field, message } }`.
   - On Supabase auth error: map to `{ ok: false, error: { code: "AUTH", message: error.message } }`.

4. **`app/auth/callback/route.ts`** (~30 LOC):
   ```ts
   import { NextResponse, type NextRequest } from "next/server";
   import { createClient } from "@/lib/supabase/server";
   import { env } from "@/lib/env";

   export async function GET(request: NextRequest) {
     const url = new URL(request.url);
     const code = url.searchParams.get("code");
     const next = url.searchParams.get("next") ?? "/";
     if (code) {
       const supabase = await createClient();
       await supabase.auth.exchangeCodeForSession(code);
     }
     // Use absolute URL based on env to avoid host-spoofing tricks.
     return NextResponse.redirect(new URL(next, env.NEXT_PUBLIC_SITE_URL));
   }
   ```

5. **`app/page.tsx`** — convert to async RSC:
   ```tsx
   import Link from "next/link";
   import { PingButton } from "./_components/ping-button";
   import { SignOutButton } from "./_components/sign-out-button";
   import { getCurrentUser } from "@/lib/auth/current-user";

   export default async function HomePage() {
     const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown";
     const user = await getCurrentUser();
     return (
       <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-6 p-8">
         <h1 className="text-3xl font-semibold">Donezo</h1>
         <p className="text-fg/70">Foundation health-check</p>
         <p className="font-mono text-sm">build: {sha.slice(0, 7)}</p>
         {user ? (
           <div className="flex items-center gap-3">
             <span className="text-sm">Signed in as <strong>{user.email}</strong></span>
             <SignOutButton />
           </div>
         ) : (
           <Link href="/sign-in" className="text-sm underline">Sign in</Link>
         )}
         <PingButton />
       </main>
     );
   }
   ```

6. **`app/_components/sign-out-button.tsx`** (~20 LOC client):
   ```tsx
   "use client";
   import { useTransition } from "react";
   import { Button } from "@/components/ui/button";
   import { signOut } from "@/app/(auth)/actions";

   export function SignOutButton() {
     const [pending, startTransition] = useTransition();
     return (
       <Button
         size="sm"
         variant="outline"
         disabled={pending}
         onClick={() => startTransition(() => signOut().then(() => {}))}
       >
         {pending ? "Signing out…" : "Sign out"}
       </Button>
     );
   }
   ```

### Definition of done

- All listed pages render without runtime errors.
- Sign-in form submits → server action → success → redirect to `?next=` (or `/`); failure → inline error.
- Sign-up form submits → user created in `auth.users` → profile row auto-created via trigger → redirect to `/verify-email`.
- Verify-email page polls and detects verification, then redirects to `/`.
- Forgot/reset flow round-trips end to end (manual smoke in F2).
- Google button initiates OAuth flow (returns URL; client navigates).
- OAuth callback exchanges code → session cookie set → redirect to `next`.
- `/` shows "Signed in as <email>" + sign-out when authed; "Sign in" link otherwise.
- Sign-out clears the session and redirects to `/sign-in`.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` green.
- The 3 `.gitkeep` files under `app/(auth)/{sign-in,sign-up,callback}/` are removed; `app/(auth)/callback/` directory is removed (callback now lives at `app/auth/callback/`).

### Escalation triggers

- Server-action redirect from inside a `useTransition` callback misbehaves (Next 15 quirks). If so, use `router.push` from `useRouter()` after action returns.
- `signInWithOAuth` redirect URL rejected by Supabase (mismatch with dashboard Redirect URLs config) — flag in F1.
- Recovery-token flow on `/reset-password` requires URL hash parsing client-side; verify `@supabase/supabase-js` `onAuthStateChange('PASSWORD_RECOVERY')` event fires reliably.
- Verify-email polling hammers Supabase if not throttled — verify the 3s interval is correct.

---

## Slice G — CONTRIBUTING.md auth contract + emails/auth/ placeholder + Playwright .skip spec

**Owner:** epic-executor (sonnet) · **Stage:** 3, parallel · **Branch:** `epic/03-auth/slice-g-docs-and-tests`

### Scope

- `/CONTRIBUTING.md` — **edit** to add a new "Authentication" subsection per epic doc task #17 (every authed page uses `requireUser`; every authed action uses `withUser`).
- `/emails/auth/README.md` — **new**. Placeholder pointing at epic 13 for actual templates.
- `/tests/e2e/auth.spec.ts` — **new** Playwright spec. **`.skip`-gated** at the file level (`test.skip(true, "playwright wired in epic 15")`). Contains the happy-path scaffolding so epic 15 can unskip without rewriting.

### Forbidden scope

`lib/**`, `app/**`, `middleware.ts` root, `components/**`, `supabase/**`, `package.json`, `biome.json`, `tsconfig.json`, `next.config.ts`, `.github/**`, legacy. Other CONTRIBUTING.md sections untouched. **Hard rule.**

### Dependencies on other slices

None — fully parallel-safe. (Documents the contract; doesn't import it.)

### Spec details

1. **`CONTRIBUTING.md`** — insert a new section between "Schema migrations" and "Branch naming":
   ```
   ## Authentication

   - **Every authed page** in the `app/(app)/` tree calls `requireUser()` from `@/lib/auth/current-user` at the top of its server component. `requireUser()` redirects to `/sign-in` if there's no session.
   - **Every authed server action** is wrapped in `withUser()` from `@/lib/actions`. The handler receives `{ supabase, userId }`. The wrapper rejects unauthenticated callers with `{ ok: false, error: { code: "UNAUTHENTICATED" } }`.
   - **Public pages** (`/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/callback`) are listed in `lib/auth/public-paths.ts`. The root middleware enforces the redirect rules.
   - **Service-role admin client** (`adminClient()` from `@/lib/supabase/admin`) bypasses RLS. Use only inside server actions and route handlers; the Biome `noRestrictedImports` rule blocks client-component imports.
   - **Email allowlist** (sign-up domain restriction) lives in the `before-user-created` Supabase Edge Function. See `supabase/functions/before-user-created/README.md`.
   - **Email templates** (verify, reset, magic link, invite, email-change) currently use Supabase's default templates. Branded templates land in epic 13 alongside Resend + React Email.
   ```

2. **`emails/auth/README.md`** — create directory + README:
   ```
   # Auth email templates

   This folder will hold branded HTML for Supabase Auth emails (confirm, reset, magic link, invite, email change).

   In epic 03, we ship the auth flows working with Supabase's **default** templates. Branded HTML lands in **epic 13** (notifications/email) alongside Resend + React Email.

   When epic 13 lands:
   1. Author React Email components per template type.
   2. Render to HTML at build time and copy into Supabase dashboard → Authentication → Email Templates.
   3. Commit the rendered HTML here for diffing across versions.
   ```

3. **`tests/e2e/auth.spec.ts`** — Playwright spec, `.skip`-gated:
   ```ts
   import { test, expect } from "@playwright/test";

   test.skip(true, "playwright wired in epic 15");

   test.describe("auth happy path", () => {
     test("sign up → verify email → sign in → sign out", async ({ page }) => {
       // Signup
       await page.goto("/sign-up");
       await page.fill('input[name="email"]', "test+e2e@donezo.local");
       await page.fill('input[name="displayName"]', "E2E Test");
       await page.fill('input[name="password"]', "test-password-12345");
       await page.click('button[type="submit"]');
       await expect(page).toHaveURL(/verify-email/);

       // (Inbucket / mailpit click of verify link omitted in scaffold; epic 15 wires it.)

       // Sign-in
       await page.goto("/sign-in");
       await page.fill('input[name="email"]', "test+e2e@donezo.local");
       await page.fill('input[name="password"]', "test-password-12345");
       await page.click('button[type="submit"]');
       await expect(page).toHaveURL("/");
       await expect(page.getByText("Signed in as")).toBeVisible();

       // Sign-out
       await page.click('text="Sign out"');
       await expect(page).toHaveURL(/sign-in/);
     });

     test("forgot password sends an email", async ({ page }) => {
       await page.goto("/forgot-password");
       await page.fill('input[name="email"]', "test+e2e@donezo.local");
       await page.click('button[type="submit"]');
       await expect(page.getByText(/check your inbox/i)).toBeVisible();
     });

     test("Google OAuth button initiates redirect", async ({ page, context }) => {
       await page.goto("/sign-in");
       const popupPromise = page.waitForEvent("popup");
       await page.click('text="Continue with Google"');
       const popup = await popupPromise;
       await expect(popup).toHaveURL(/accounts\.google\.com/);
     });
   });
   ```
   Note: `@playwright/test` is NOT yet installed (epic 15). This file may NOT typecheck under the current `tsconfig` because the import won't resolve. **Workaround:** wrap the import in `// @ts-expect-error playwright wired in epic 15` (same pattern as the vitest tests). If even that doesn't satisfy `tsc`, escalate — orchestrator may add `tests/e2e/**` to `tsconfig.exclude`.

### Definition of done

- `CONTRIBUTING.md` has the new "Authentication" section.
- `emails/auth/README.md` exists.
- `tests/e2e/auth.spec.ts` exists, `.skip`-gated, doesn't break `pnpm typecheck` / `pnpm build`.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` green.

### Escalation triggers

- `tsc` rejects the Playwright spec even with `@ts-expect-error`. Escalate; orchestrator decides between `tsconfig.exclude` or installing Playwright as a typesonly dep.

---

## Sequential follow-ups

These run on `epic/03-auth` after stage 3 review returns CLEAN.

### F1 — Manual user steps (orchestrator coordinates with user)

These cannot be automated by an executor. Document outcomes in the F1 done-report.

1. **`NEXT_PUBLIC_SITE_URL` in `.env.local`** — user adds (e.g., `http://localhost:3000` for dev). App will not boot without it (slice A made it required).
2. **`NEXT_PUBLIC_SITE_URL` in Vercel envs** — user adds preview + prod values via Vercel dashboard.
3. **Supabase dashboard URL configuration** (per U4):
   - Authentication → URL Configuration → Site URL = the production `NEXT_PUBLIC_SITE_URL`.
   - Redirect URLs add: `http://localhost:3000/**`, `<prod-url>/**`, the Vercel preview pattern (e.g., `https://*-atebit.vercel.app/**`).
4. **Google OAuth credentials** (per U1):
   - Create Google Cloud project + OAuth 2.0 client ID + secret.
   - Authorized redirect URI: `https://petbfbymsgujgwttxlec.supabase.co/auth/v1/callback`.
   - Paste client ID + secret into Supabase dashboard → Authentication → Providers → Google → Enable.
5. **Apply avatars-bucket migration**:
   ```
   pnpm db:push          # pushes the new <ts>_avatars_bucket.sql migration
   pnpm db:types         # regen + commit
   ```
6. **Deploy Edge Function** (per Q44):
   ```
   supabase functions deploy before-user-created --no-verify-jwt
   # Allowlist intentionally empty in v1 per Q7 / U3.
   ```
   Then in Supabase dashboard → Authentication → Hooks → "Before user created":
   - Hook type: HTTP
   - Endpoint: `https://petbfbymsgujgwttxlec.supabase.co/functions/v1/before-user-created`
   - Save.
7. **Confirm "Enable email change" is ON** in Supabase dashboard (default ON; verify).

### F2 — Smoke test

After F1, the orchestrator runs a manual smoke against a local dev server pointed at the cloud DB:

1. `pnpm install --frozen-lockfile` clean. `pnpm typecheck`, `pnpm lint`, `pnpm build` green.
2. `pnpm dev`. Visit `http://localhost:3000`. **Unauthed:** see "Sign in" link + ping button.
3. Click "Sign in" → land on `/sign-in`.
4. Sign-up flow: go to `/sign-up`, create a test user (`test+e2e+<timestamp>@<your-allowed-domain>`). Should land on `/verify-email`. Check Supabase dashboard → Auth → Users for the row + `public.profile` row.
5. Click verify link in email → land on `/` signed in.
6. Forgot-password: sign out, go to `/forgot-password`, enter email, click link in email → land on `/reset-password`, set new password, redirected to `/` signed in.
7. Google OAuth: sign out, click Google button on `/sign-in`. (Requires F1.4 done.) Should round-trip and land on `/` signed in.
8. Click "Sign out" from `/`. Should redirect to `/sign-in`.
9. Visit `/account` while authed → settings page renders. Update display name → toast confirms. Upload avatar → image appears.
10. Visit any path under `(app)/` while signed out → redirected to `/sign-in?next=<path>`. After sign-in, lands on `<path>`.
11. **Default-deny check:** open browser devtools → Application → Cookies → confirm `sb-...-auth-token` cookie is `HttpOnly`, `Secure`, `SameSite=Lax`.
12. Document outcomes; if anything fails, file followup spec.

### F3 — none

`NEXT_PUBLIC_SITE_URL` was made required in slice A (Q43). No deferred env-flip step needed.

---

## Risk notes

1. **Default-deny RLS during 03→04 window.** Until epic 04 ships RLS policies, every authed read/write via the per-request server client returns empty. Slice E uses `adminClient()` for profile reads/writes as the documented escape hatch. **Authed users will see empty profile data** if any future code path forgets the admin client between epic 03 and 04. F2 verifies the account-settings page renders correctly.

2. **`NEXT_PUBLIC_SITE_URL` required at boot.** Adding a new required env key (slice A) means **every developer and every CI run must set it** before the app boots. F1 step 1 covers it for the user. CI will fail until the GitHub Actions secret is added (orchestrator surfaces in PR description).

3. **Google OAuth blocked on user setup.** Q U1 — without Google Cloud creds in the Supabase dashboard, the Google button works in UI but throws on click. Document this in slice F's done-report so the orchestrator surfaces it.

4. **Edge Function shape risk.** Q44's `before-user-created` payload + response shape is taken from current Supabase Auth Hooks docs. If Supabase changes the contract between now and F1, the function silently fails open (per the `try/catch` design) — the worst-case behavior is "allowlist not enforced," not "users can't sign up." Acceptable; flag for follow-up if allowlist becomes load-bearing.

5. **Cookie + middleware interaction.** The `@supabase/ssr` cookie dance is finicky — `setAll` must be called in both `request.cookies` AND `response.cookies`, in that order, with `NextResponse.next({ request })` re-created in between. Slice B's snippet matches the official recipe; deviation breaks session refresh silently (user sees logged-out state on every page load). F2 verifies session persists across navigations.

6. **Avatar bucket policies + storage.foldername.** The path-prefix policy uses `(storage.foldername(name))[1] = auth.uid()::text`. If the upload code uses a different path shape (e.g., `<userId>-avatar.png` flat), the policy denies. Slice E's path is `<userId>/avatar.<ext>` — matches. F2 verifies upload succeeds.

7. **`withUser` rewrite is breaking.** Slice C changes the contract; `app/actions.ts` and `tests/unit/with-user.test.ts` both edited in the same slice to keep things atomic. Any future epic-03 stage-2 followup that touches `app/actions.ts` would conflict — flag in done-report.

8. **OAuth callback path location** (Q29). Putting the callback at `app/auth/callback/route.ts` (NOT in `(auth)` route group) is unusual. The reasoning: route handlers don't need layout composition, and putting it outside the route group avoids any future `(auth)/layout.tsx` redirect logic accidentally affecting the callback. Acceptable; documented.

9. **`exchangeCodeForSession` race.** After Google sign-in, the callback exchanges the code, sets cookies, redirects to `next`. The browser then loads `next`, middleware refreshes session — there's a tiny window where the cookie is set in the response but the next request hasn't sent it. `@supabase/ssr` handles this; F2 verifies.

10. **Email-change confirmation flow** (Q23). User changes email on account settings → Supabase emails the **new** address with a confirmation link. The link points back at the Supabase project's callback URL → triggers `email_confirm_change` → updates `auth.users.email`. We don't need custom UI for this beyond the toast. Verify in F2.

11. **Verify-email polling.** The `/verify-email` client polls `getUser()` every 3s. Supabase Auth has a default rate limit of ~30/min for verify-email endpoint; 3s polling is 20/min, safely under. If user leaves the tab open all day, that's 28,800/day — fine but wasteful. Acceptable for v1; epic 14 polish can add visibility-API gating.

12. **Slice E's avatar upload validates client-side only.** File-type + size checks happen in the action via `formData.get('file')`'s `File.type` + `File.size`. A malicious client could spoof. Mitigation: bucket policy restricts path to `<userId>/...`; Supabase Storage may also enforce mime-type at the bucket level (configurable in dashboard). Acceptable for v1; epic 10 hardens.

13. **`tests/e2e/auth.spec.ts` typecheck risk.** If `@playwright/test` import fails `tsc` even with `@ts-expect-error`, slice G escalates. Fallback: orchestrator adds `tests/e2e/**` to `tsconfig.exclude` and `biome.json` ignore.

14. **No app-side `signOut` from middleware.** If a session is corrupt/invalid, the middleware can't trigger sign-out cleanly (would need to set cookies + redirect in the same response). Acceptable: Supabase Auth handles invalid-session by returning `null` from `getUser()`, middleware then redirects to `/sign-in`, user signs in fresh.

15. **`(app)/` shell still empty.** Epic 03 doesn't build the workspace home. After sign-in, users land on `/` (the foundation health-check). This is intentional per Q4 — but it's user-visibly weird until epic 05 ships a real shell. Document in epic 03's PR description.

## Constraints carried into later epics

- **`requireUser()` and `withUser()` are the canonical auth gates.** Epic 04 extends `withUser` (or wraps it) for role-based authorization; never replaces it. Epic 05+ uses both.
- **`adminClient()` is the only RLS-bypass path.** Epic 04 will tighten policy so that `getCurrentUser`'s profile read can use the per-request authed client; until then, `adminClient` is the documented escape hatch. Other epics MUST NOT introduce a second admin client.
- **Email-allowlist Edge Function is the canonical gate** for sign-up restrictions. Future invite-only flows (epic 05's workspace invitations) layer on top — the Edge Function still gates account creation; the invitation gates *workspace-membership* creation.
- **Avatars bucket** = `avatars`, public-read, owner-write to `<userId>/...`. Other storage buckets (epic 10) follow the same path-prefix-policy pattern.
- **`NEXT_PUBLIC_SITE_URL`** is the canonical absolute base for any redirect / email URL. Future server actions that send email or build absolute links use it.
- **Default columns / labels** (carried from epic 02) unchanged.
- **No additional auth providers** without an explicit decision. Future SSO/SAML/Apple/Microsoft adds → epic of their own.
- **Branded email templates** ship in epic 13. Epic 03 uses Supabase defaults.
- **Playwright e2e tests run in epic 15.** Auth happy-path spec is `.skip`-gated until then.
