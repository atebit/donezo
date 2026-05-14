# Contributing to Donezo

## Local setup

1. `git clone <repo-url> && cd donezo`
2. `corepack enable`
3. `pnpm install`
4. `cp .env.example .env.local` — fill in Supabase keys from a teammate or from the Vercel-Supabase integration in the Vercel dashboard.
5. `supabase login && supabase link --project-ref <REF>`
6. `pnpm db:types` — regenerates `lib/supabase/types.ts` from the linked schema.
7. `pnpm dev`

The dev server starts on `http://localhost:3000`.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Start Next.js dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run Biome checks |
| `pnpm lint:fix` | Run Biome checks and auto-fix |
| `pnpm format` | Format with Biome |
| `pnpm typecheck` | TypeScript type-check (`tsc --noEmit`) |
| `pnpm test` | Run Vitest unit tests |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm test:e2e` | Run Playwright e2e tests (wired in epic 15) |
| `pnpm email:preview` | Start React Email dev server for visual template preview |

## Schema migrations

Schema changes go through Supabase CLI:

1. `supabase migration new <description>` — creates `supabase/migrations/<ts>_<desc>.sql`
2. Edit the generated file. Never edit a deployed migration.
3. `pnpm db:push` — applies the migration to the linked cloud project.
4. `pnpm db:types` — regenerates `lib/supabase/types.ts`.
5. Commit the migration AND the regenerated types together.

Note: there is no local Supabase / Docker workflow. Cloud is the source of truth. All developers and CI point at the same project. Coordinate migration PRs to avoid two simultaneous schema changes.

## Authentication

- **Every authed page** in the `app/(app)/` tree calls `requireUser()` from `@/lib/auth/current-user` at the top of its server component. `requireUser()` redirects to `/sign-in` if there's no session.
- **Every authed server action** is wrapped in `withUser()` from `@/lib/actions`. The handler receives `{ supabase, userId }`. The wrapper rejects unauthenticated callers with `{ ok: false, error: { code: "UNAUTHENTICATED" } }`.
- **Public pages** (`/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/callback`) are listed in `lib/auth/public-paths.ts`. The root middleware enforces the redirect rules.
- **Service-role admin client** (`adminClient()` from `@/lib/supabase/admin`) bypasses RLS. Use only inside server actions and route handlers; the Biome `noRestrictedImports` rule blocks client-component imports.
- **Email allowlist** (sign-up domain restriction) lives in the `before-user-created` Supabase Edge Function. See `supabase/functions/before-user-created/README.md`.
- **Email templates** (verify, reset, magic link, invite, email-change) currently use Supabase's default templates. Branded templates land in epic 13 alongside Resend + React Email.

## Branch naming

**Epic work:**
- Epic branch: `epic/<NN>-<kebab>` (e.g. `epic/01-foundation`)
- Slice sub-branch: `epic/<NN>-<kebab>/<slice-kebab>` (e.g. `epic/01-foundation/slice-e`)

**Non-epic work:**
- `feat/<short-description>`
- `fix/<short-description>`
- `chore/<short-description>`

## Commits

- Imperative mood: "add auth middleware", not "adding" or "added".
- Scope-prefix when natural: `schema: add workspaces table`, `ci: update node version`.
- Reference the epic number in the **PR description**, not every commit message.

## Conventions

These are non-negotiable stack defaults. Executors and contributors must not drift from them.

- **pnpm only.** Not npm, not yarn. The `packageManager` field in `package.json` pins the exact version via corepack.
- **Next.js 15 App Router, RSC-first.** Use `"use client"` only for components that require browser APIs or React state/effects. Default to Server Components.
- **Server Actions for mutations.** No `/api` route handlers except for webhooks. Actions live in `app/**/actions.ts` co-located with the route that calls them.
- **TypeScript strict.** `any` is banned via Biome rule. Use `unknown` at untrusted boundaries. Imports of types must use `import type`.
- **Tailwind v4 + shadcn/ui + Base UI** (`@base-ui/react`, the explicit successor to Radix used by shadcn's `base-nova` style). Design tokens live in `app/globals.css` under `@theme`. No `tailwind.config.ts`. This repo uses Tailwind v4 + shadcn/ui + Base UI, not MUI or SCSS. shadcn components are copied into `components/ui/` and owned by this repo.
- **Forms: React Hook Form + Zod.** The same Zod schema validates both client-side and inside the Server Action.
- **RLS is the source of truth for authorization.** Row-Level Security policies in Supabase Postgres enforce access control. Application-layer checks are defense-in-depth, not the gate.
- **All ids are `uuid v4`** from Postgres (`gen_random_uuid()`). No client-generated ids.
- **All times are `timestamptz`.** Display converts to the user's locale.
- **Soft deletes via `deleted_at timestamptz null`.** Hard delete only through admin paths.
- **No `console.log`** — Biome rule `suspicious.noConsoleLog: error`. Use `logger` from `lib/logger.ts` (server-side) or leave a `biome-ignore` comment with justification at bootstrap/boundary callsites.

## Storybook

Storybook is **deferred** per epic 01 decision Q4. Cell renderers will use Playwright component tests (epic 07). Storybook will be reconsidered in epic 07 if Playwright component tests prove insufficient. Visual review of UI work happens via Vercel preview deploys in the meantime.

## Legacy code

The legacy CRA + MUI + Redux frontend and Express + MongoDB backend were removed from git in commit `a5d47c2` and are no longer on disk. See git history at or before that commit for archaeology. Do not re-add legacy code to the repo; do not import from old code or port files into the new substrate.

## Vercel project setup (manual, one-time, by repo admin)

Run these steps after epic 01 merges to `main`. These are human-executed steps — do not automate them with the Vercel CLI inside CI.

1. `vercel login` — authenticate with your Vercel account.
2. `vercel link` from the repo root — link the local repo to a Vercel project (create a new project when prompted).
3. In the Vercel dashboard, configure the project:
   - **Build command:** `pnpm build`
   - **Install command:** `pnpm install --frozen-lockfile`
   - **Output directory:** default (`.next`)
   - **Production branch:** `main`
   - **Preview deploys:** all other branches
4. Add environment variables in the Vercel dashboard (Settings → Environment Variables). Leave values blank for now; each epic fills in its own:
   - `NEXT_PUBLIC_SUPABASE_URL` — wired in epic 02
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — wired in epic 02
   - `SUPABASE_SERVICE_ROLE_KEY` — wired in epic 02
   - `RESEND_API_KEY` — wired in epic 13
   - `SENTRY_DSN` — wired in epic 15
5. Open a test PR and confirm that the Vercel bot posts a preview deploy URL in the PR comments and that the preview renders the health-check page.

## Custom domain

TBD; deferred per epic 01 decision Q11. Tracked in the conversion plan. Preview deploys use Vercel's generated URLs until a domain is provisioned.

## Comments & activity

Every mutation server action emits one activity row via `logActivity`. The set of activity types is closed (see `lib/activity.ts`); add new ones in lockstep with the matching renderer in `components/activity/renderers/`. Missing renderers degrade to a generic line — but every new action type should ship with its renderer in the same PR.

Comment writes go through the user-client (RLS-enforced). Notification fan-out goes through the service role (`lib/notifications/notify.ts`). Mention extraction is `lib/comments/mentions.ts`; `@everyone` is the sentinel `attrs.id = "everyone"` and expands to all board members at notify time.

Reactions have no `updated_at` — store idempotency keys on the PK tuple `(comment_id, user_id, emoji)`.

The task drawer uses Next.js intercepting routes (`@modal/(.)t/[taskId]`). Direct URL navigation hits the full-page route at `t/[taskId]`. Both render the same `<TaskDrawer />`; only the shell differs.

`@everyone` on public boards expands to explicit `board_member` rows only (Option A from followup Q-A1). Workspace members with implicit access are not notified. Documented as intended behavior.

## Email (Resend + React Email) — epic 13

### Environment variables

| Variable | Required in prod | Description |
|---|---|---|
| `RESEND_API_KEY` | Yes | Resend API key. Without it, `sendEmail` logs envelopes and returns `{ skipped: true }`. |
| `EMAIL_FROM` | No | Sender address. Default: `Donezo <noreply@donezo.app>`. |
| `EMAIL_SAFE_LIST` | No | Comma-separated whitelist of recipient addresses. Set on preview deploys to prevent accidental sends to real users. |
| `INTERNAL_CRON_SECRET` | Yes (≥32 chars) | Shared secret for cron route handlers. |
| `SUPABASE_DB_WEBHOOK_SECRET` | Yes (≥32 chars) | Shared secret for the Supabase DB webhook. |

### Instant email path

1. **Primary:** Supabase database webhook fires on `notification` INSERT → `app/api/webhooks/notifications/route.ts` → renders template + calls Resend.
2. **Polling fallback:** `app/api/cron/notifications-mailer/route.ts` runs every 5 minutes, picking up rows the webhook missed (lookback: 30 min).

### Supabase database webhook setup (manual — dashboard config)

The Supabase local CLI (v2.98.2) does not yet support a `[db.webhooks]` block in `supabase/config.toml`. Configure the webhook manually in the Supabase dashboard:

1. Open **Supabase Dashboard → Database → Webhooks**.
2. Click **Create a new hook**.
3. Fill in:
   - **Name:** `notification_email`
   - **Table:** `public.notification`
   - **Events:** `INSERT`
   - **URL:** `${NEXT_PUBLIC_SITE_URL}/api/webhooks/notifications`
   - **HTTP method:** `POST`
   - **HTTP headers:** `Authorization: Bearer ${SUPABASE_DB_WEBHOOK_SECRET}`
4. Save.

In local dev (without `SUPABASE_DB_WEBHOOK_SECRET` set), the route runs in open mode and skips auth — this is intentional for developer convenience. Production requires the secret to be set.

### Vercel Cron tiers

The cron schedules in `vercel.json` require **Vercel Pro** (or higher). On the Hobby tier, crons fire at most hourly. If deploying on Hobby:

- The polling fallback (`*/5 * * * *`) will not fire at 5-minute intervals.
- The digest cron (`*/15 * * * *`) will not fire at 15-minute intervals.
- Adjust the schedule in `vercel.json` to `0 * * * *` (hourly) before deploying to Hobby.

### Email preview

Run `pnpm email:preview` to start the React Email dev server. Templates live under `emails/`.

## Realtime & writes

Donezo's writes go through server actions only. Realtime is read-only on the client — postgres_changes events feed the Zustand store via idempotent `applyXxxUpsert` methods, gated on `updated_at`. Never write to the database directly from the client. Presence and broadcast (cursors, typing) are non-persistent advisory state; the server does not trust them.
