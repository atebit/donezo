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

## Schema migrations

Schema changes go through Supabase CLI:

1. `supabase migration new <description>` — creates `supabase/migrations/<ts>_<desc>.sql`
2. Edit the generated file. Never edit a deployed migration.
3. `pnpm db:push` — applies the migration to the linked cloud project.
4. `pnpm db:types` — regenerates `lib/supabase/types.ts`.
5. Commit the migration AND the regenerated types together.

Note: there is no local Supabase / Docker workflow. Cloud is the source of truth. All developers and CI point at the same project. Coordinate migration PRs to avoid two simultaneous schema changes.

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
- **Tailwind v4 + shadcn/ui + Base UI** (`@base-ui/react`, the explicit successor to Radix used by shadcn's `base-nova` style). Design tokens live in `app/globals.css` under `@theme`. No `tailwind.config.ts`. No MUI, no SCSS in new code. shadcn components are copied into `components/ui/` and owned by this repo.
- **Forms: React Hook Form + Zod.** The same Zod schema validates both client-side and inside the Server Action.
- **RLS is the source of truth for authorization.** Row-Level Security policies in Supabase Postgres enforce access control. Application-layer checks are defense-in-depth, not the gate.
- **All ids are `uuid v4`** from Postgres (`gen_random_uuid()`). No client-generated ids.
- **All times are `timestamptz`.** Display converts to the user's locale.
- **Soft deletes via `deleted_at timestamptz null`.** Hard delete only through admin paths.
- **No `console.log`** — Biome rule `suspicious.noConsoleLog: error`. Use `logger` from `lib/logger.ts` (server-side) or leave a `biome-ignore` comment with justification at bootstrap/boundary callsites.

## Storybook

Storybook is **deferred** per epic 01 decision Q4. Cell renderers will use Playwright component tests (epic 07). Storybook will be reconsidered in epic 07 if Playwright component tests prove insufficient. Visual review of UI work happens via Vercel preview deploys in the meantime.

## Legacy code

The legacy CRA + MUI + Redux frontend and Express + MongoDB backend have been **removed from git** (after epic 01, commit `a5d47c2`). Maintainers may keep local copies of `frontend/` and `backend/` outside the repo, or untracked inside it — both paths are now in `.gitignore`. They exist for dev reference only.

- Do not re-add legacy code to the repo.
- Do not import from a local copy.
- Git history before `a5d47c2` still contains the legacy code if needed for archaeology.

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
