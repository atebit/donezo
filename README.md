# Donezo

A monday.com-class project and task management tool, built on Next.js 15, Supabase, and Vercel.

## Status

Donezo is a shipping Next.js 15 + Supabase + Vercel application, rebuilt across 17 epics from an earlier CRA + Express + MongoDB codebase. See [`docs/conversion-plan/00-overview.md`](docs/conversion-plan/00-overview.md) for the architecture and epic-by-epic scope; see [`CHANGELOG.md`](CHANGELOG.md) for the rebuild history.

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router, RSC-first, Turbopack) |
| Language | TypeScript (strict) |
| UI | Tailwind v4 + shadcn/ui + Base UI (`@base-ui/react`) |
| Forms | React Hook Form + Zod |
| Tables | TanStack Table + TanStack Virtual |
| Drag & drop | dnd-kit |
| Rich text | Tiptap |
| Client state | Zustand (UI-only; no Redux) |
| Database | Supabase Postgres (RLS is the auth source of truth) |
| Auth | Supabase Auth (`@supabase/ssr`) |
| Realtime | Supabase Realtime (Postgres Changes + Presence + Broadcast) |
| Storage | Supabase Storage |
| Email | Resend + React Email |
| Error tracking | Sentry |
| Hosting | Vercel |
| CI | GitHub Actions (9 parallel jobs) |
| Tests | Vitest (unit) + Playwright (e2e) + pgTAP (RLS policies) |
| Linting | Biome (formatter + linter) |
| Package manager | pnpm |

## Local development

### Prerequisites

- Node 22 LTS (`.nvmrc` provided)
- pnpm via corepack
- Supabase CLI (`brew install supabase/tap/supabase` or `npx supabase`)
- A Supabase project (local or hosted)

### Setup

```bash
corepack enable
pnpm install
cp .env.example .env.local   # fill in Supabase keys
pnpm dev                      # starts Next.js on :3000 with Turbopack
```

### Environment variables

Copy `.env.example` and fill in the values:

| Variable | Required | Source |
|---|---|---|
| `SUPABASE_URL` | yes | Supabase project settings |
| `SUPABASE_ANON_KEY` | yes | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Supabase project settings (server-only) |
| `SUPABASE_JWT_SECRET` | yes | Supabase project settings |
| `NEXT_PUBLIC_SITE_URL` | yes | `http://localhost:3000` for dev |
| `RESEND_API_KEY` | no | Required for email notifications |
| `SENTRY_DSN` | no | Required for error tracking |

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server (Turbopack, port 3000) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm typecheck` | Run `tsc --noEmit` |
| `pnpm lint` | Biome check (lint + format) |
| `pnpm lint:fix` | Biome auto-fix |
| `pnpm format` | Biome format |
| `pnpm test` | Vitest (unit tests) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm test:e2e:a11y` | Playwright accessibility tests |
| `pnpm test:e2e:visual` | Playwright visual regression tests |
| `pnpm test:policies` | pgTAP RLS policy tests |
| `pnpm db:types` | Regenerate Supabase TypeScript types |
| `pnpm db:push` | Push migrations to linked Supabase project |
| `pnpm db:reset` | Reset linked database and re-run migrations |
| `pnpm db:diff` | Diff local schema against linked project |
| `pnpm db:lint` | Lint SQL migrations |
| `pnpm email:preview` | Preview React Email templates locally |

## CI pipeline

GitHub Actions runs **9 parallel jobs** on every push to `main` and every PR:

1. **Lint** — `biome check`
2. **Typecheck** — `tsc --noEmit`
3. **Build** — `next build` with Supabase env vars
4. **Unit tests** — Vitest
5. **E2E tests** — Playwright
6. **A11y tests** — Playwright accessibility suite
7. **Visual tests** — Playwright visual regression
8. **RLS policy tests** — pgTAP against a Supabase instance
9. **DB lint** — Supabase schema linting

## Repository layout

```
app/                       Next.js App Router routes + server actions
  (auth)/                    sign-in, sign-up, callback
  (app)/                     authed app shell
    w/[workspaceSlug]/       workspace pages
      b/[boardId]/           board layout, table/kanban/calendar views
        labels/actions.ts    label CRUD server actions
        comments/actions.ts  comment server actions
        tasks/actions.ts     task CRUD server actions
        views/actions.ts     view management server actions
components/
  board/                     board chrome: header, toolbar, tabs, item drawer
    table/                   table view: virtualizer, task rows, group headers
  cells/                     one folder per cell type (status, text, date, etc.)
  comments/                  comment composer, list, reactions
  shared/                    sidebar, topbar, avatar, breadcrumbs
  ui/                        shadcn/ui primitives (sheet, button, menu-list)
lib/
  auth/                      current-user, require-user helpers
  authorization/             role checks (board, workspace)
  board/                     load-board-snapshot server helper
  cells/                     cell type registry, label-text-color
  realtime/                  wrapped actions, outbox, cursor broadcast
  supabase/                  client/server/admin Supabase client factories
  validations/               Zod schemas (label, comment, view, etc.)
hooks/                       client-side hooks (use-board, use-cmdk, etc.)
stores/                      Zustand stores (board-store, sidebar-store, etc.)
emails/                      React Email templates
supabase/
  migrations/                SQL migrations (YYYYMMDDHHMMSS_description.sql)
  seed.sql                   Dev seed data
tests/
  unit/                      Vitest unit tests
  e2e/                       Playwright E2E tests
  policies/                  pgTAP RLS policy tests
docs/
  conversion-plan/           canonical rebuild plan (17 epics + design system)
  diary/                     daily dev log
```

## Development workflow

### Epic-based execution

The rebuild follows a sequential epic plan in `docs/conversion-plan/`. Each epic:

1. **Plan** — `/plan-epic <NN>` enters planning mode, produces a dispatch plan of parallel-safe slices
2. **Branch** — `epic/<NN>-<short-name>` off `main`; large epics use sub-branches
3. **Execute** — `/execute-epic` dispatches parallel executor agents, one per slice
4. **Review loop** — after each stage, the reviewer checks against the definition of done and produces followup slices until clean
5. **Land** — merge epic branch into `main`, unblocking the next epic

### AI-assisted development

The project uses [Claude Code](https://claude.com/claude-code) with custom agents and commands:

| File | Purpose |
|---|---|
| `CLAUDE.md` | Repo rules, stack defaults, conventions |
| `.claude/commands/plan-epic.md` | `/plan-epic` — enter planning mode for an epic |
| `.claude/commands/execute-epic.md` | `/execute-epic` — dispatch parallel executor agents |
| `.claude/agents/epic-researcher.md` | Opus-backed planner, reviewer, architectural decision-maker |
| `.claude/agents/epic-executor.md` | Sonnet-backed executor for individual slices |

### Conventions

- **Branching:** `epic/<NN>-<kebab>` for epic branches, `epic/<NN>-<kebab>/<slice>` for sub-branches
- **Commits:** imperative mood, scope-prefixed when natural (e.g. `schema: add workspaces table`)
- **IDs:** UUID v4 from Postgres (`gen_random_uuid()`), never client-generated
- **Timestamps:** `timestamptz` everywhere, display converts to user locale
- **Soft deletes:** `deleted_at timestamptz null`; hard delete only via admin paths
- **Mutations:** server actions in `app/**/actions.ts` next to the route that calls them
- **Authorization:** RLS is primary; server-side `requireBoardRole` / `getWorkspaceRole` is defense-in-depth
- **Cell types:** referenced by short string id (`text`, `status`, `person`, ...), never by component name
