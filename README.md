# Donezo

A monday.com-class internal project and task management tool, built on Next.js 15, Supabase, and Vercel.

## Status

Mid-rebuild. The original CRA + Express + MongoDB app has been removed from git (archived in earlier history); the new app is being rebuilt epic-by-epic. See [`docs/conversion-plan/00-overview.md`](docs/conversion-plan/00-overview.md) for the full plan.

## Stack

- **Framework:** Next.js 15 (App Router, RSC-first)
- **Language:** TypeScript (strict)
- **UI:** Tailwind v4 + shadcn/ui (Base UI primitives)
- **Forms:** React Hook Form + Zod
- **State:** RSC + Zustand for client-only UI state
- **DB:** Supabase Postgres (RLS as source of truth for authorization)
- **Auth:** Supabase Auth (`@supabase/ssr`)
- **Realtime:** Supabase Realtime
- **Storage:** Supabase Storage
- **Email:** Resend + React Email
- **Errors:** Sentry
- **Hosting:** Vercel
- **Tests:** Vitest (unit) + Playwright (e2e) + pgTAP (RLS policies)
- **Tooling:** Biome (formatter + linter), pnpm

## Local development

Requires Node 22 LTS and pnpm via corepack.

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full setup, scripts, branch conventions, and the Vercel project setup checklist.

## Repository layout

```
app/                  # Next.js App Router routes + server actions
components/           # UI components (ui/ for shadcn primitives)
lib/                  # auth, env, logger, server-action helpers, Supabase clients
hooks/                # client-side hooks
stores/               # Zustand stores (UI state only)
emails/               # React Email templates
supabase/             # config.toml, migrations, seed
tests/                # unit, e2e, RLS policy tests
docs/
  conversion-plan/    # canonical rebuild plan, one file per epic
  audit/              # original codebase audit, decision memos
.claude/              # agent and command definitions for the dispatch workflow
.github/workflows/    # CI
```

Full layout in [`docs/conversion-plan/00-overview.md`](docs/conversion-plan/00-overview.md).

## Workflow

The rebuild executes one epic at a time off `main`, with parallel-safe slices dispatched per epic and a per-stage review-and-followup loop. The rules and agent definitions live in [`CLAUDE.md`](CLAUDE.md) and [`.claude/`](.claude/).
