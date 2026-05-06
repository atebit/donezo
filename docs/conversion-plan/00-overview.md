# Donezo Conversion Plan — Overview

A re-architecture of Donezo from a CRA + Express + MongoDB stack into a Next.js + Supabase + Vercel application. This folder is the canonical plan; each subsequent file is an engineering epic with enough context to execute end-to-end without referring back to the legacy codebase.

The goal is a credible monday.com-class internal tool. Billing, tenant isolation hardening, automations/recipes, public API, integrations, and white-labeling are deliberately deferred until the core product is solid.

## Why this plan exists

The audit at [`docs/audit/`](../audit/00-index.md) inventories the legacy codebase and concludes that a structural rebuild beats incremental fixes ([decision memo](../audit/11-recommendation-migrate-now.md)). This conversion plan is the execution of that decision. We are not porting code — we are rebuilding on the right substrate, salvaging only the visual design and product knowledge.

## Target stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | RSC + server actions remove the bespoke REST layer. File-based routing, middleware, edge runtime, image optimization, built-in caching. |
| Language | **TypeScript (strict)** | No untyped service modules, no `any`-typed Redux state. Generated Supabase types enforce DB shape end-to-end. |
| UI | **Tailwind v4 + shadcn/ui + Radix primitives** | Replace MUI + SCSS. Tokens-driven theming, accessible primitives, consistent component vocabulary. Drops ~600KB of MUI. |
| Forms | **React Hook Form + Zod** | One schema validates client and server-action inputs. |
| Tables | **TanStack Table + TanStack Virtual** | Virtualized rows for 10k+ task boards. Headless, fully styleable. |
| DnD | **dnd-kit** | Replaces abandoned `react-beautiful-dnd`. Touch-capable. Nested drop zones for kanban. |
| Charts | **Recharts** | Used by dashboard view. |
| Rich text | **Tiptap** | Comments, long-text cells, mentions. |
| State | **React Server Components + Zustand for client-only state** | No Redux. Server state lives on the server; client store is for UI state (modals, drag, selection). |
| Data | **Supabase Postgres** | Managed Postgres, RLS, generated types via `supabase gen types`. |
| Auth | **Supabase Auth** (`@supabase/ssr`) | Google OAuth + email/password + magic link. SSR-aware cookies. |
| Realtime | **Supabase Realtime** | Postgres Changes + Presence + Broadcast. Replaces Socket.IO. |
| Storage | **Supabase Storage** | Replaces Cloudinary. Bucket policies via RLS. |
| Email | **Resend + React Email** | Transactional + digests. |
| Errors | **Sentry** | Frontend + edge + server-action coverage. |
| Hosting | **Vercel** | Preview deploys per PR, edge middleware, image optimization, env management. |
| CI | **GitHub Actions** | Lint + typecheck + test + RLS-policy tests. |
| Tests | **Vitest + Playwright + pgTAP** | Unit, E2E, RLS policy. |
| Logs | **Pino** (server) + **Vercel logs** | Structured JSON. |
| Analytics | **Vercel Analytics + Speed Insights** | First-party, no cookie banner. |

## Design principles

These shape every epic. When in doubt, return to these.

1. **RSC-first.** Default to Server Components. Drop to `"use client"` only for interactivity (drag, picker popovers, optimistic UI). Server Actions handle mutations; no `/api` route handlers unless we need a webhook or third-party integration.
2. **RLS is the source of truth for authorization.** The server cannot trust the client, but it also doesn't need to: every query goes through Postgres with the user's JWT, and policies enforce access. Server-side checks are a defense-in-depth layer, not the primary gate.
3. **Type-safe end-to-end.** `supabase gen types typescript` runs on every schema change. Server actions accept Zod-validated input. Component props are narrow.
4. **Optimistic by default for cell edits.** Status, priority, checkbox, number, text edits update locally first, sync to server, reconcile via Realtime. Comments, attachments, structural edits (add/remove/reorder column) are pessimistic.
5. **Re-architect freely.** No backwards compatibility with the legacy data shape. We are not migrating data — we are rebuilding. The legacy app remains running until cutover; new app starts empty.
6. **One column-cell model from day one.** Stable column ids, cells keyed by column id, polymorphic value storage. The legacy "store the label title in `task.status`" pattern is gone.
7. **Concurrency is per-cell, not per-board.** Two users editing different cells on the same task never conflict. Last-write-wins per cell, with `updated_at` for visibility.
8. **Realtime is opt-in per channel.** Subscribe only to the active board. Tear down on navigation. Presence is an explicit feature, not implicit.
9. **Accessibility is not a phase.** Every component lands with keyboard nav, focus management, and ARIA. Phase 14 is a polish/audit pass, not the first time we think about it.
10. **No premature abstraction.** Cell types share an interface but have their own renderer/editor. No mega-component that switches on `column.type` inside the render path.

## Repository layout

```
app/
  (auth)/
    sign-in/
    sign-up/
    callback/
  (app)/
    layout.tsx                # authed shell: sidebar, topbar
    page.tsx                  # workspace home
    w/[workspaceSlug]/
      page.tsx                # workspace dashboard
      settings/
      b/[boardId]/
        layout.tsx            # board shell: tabs for views, filter bar
        page.tsx              # default (table) view
        table/
        kanban/
        calendar/
        timeline/
        dashboard/
        t/[taskId]/           # task drawer/modal route
        settings/
  api/
    webhooks/                 # third-party callbacks only
  globals.css
components/
  ui/                         # shadcn primitives
  board/
    table/
    kanban/
    calendar/
    timeline/
    dashboard/
  cells/                      # one folder per cell type
    text/
    status/
    person/
    date/
    ...
  comments/
  activity/
  filters/
  shared/
lib/
  supabase/
    client.ts                 # browser client
    server.ts                 # server-action / RSC client
    middleware.ts             # session refresh
    types.ts                  # generated, gitignored
  auth/
  authorization/              # role helpers, server-side guards
  realtime/
  cells/                      # cell-type registry, value codecs
  validations/                # zod schemas
  utils/
hooks/
stores/                       # zustand: ui state only
emails/                       # react-email templates
supabase/
  migrations/
  seed.sql
  config.toml
tests/
  e2e/                        # playwright
  unit/                       # vitest
  policies/                   # pgTAP RLS tests
.github/workflows/
```

## Sequencing & blockers

The order is not negotiable for the foundation epics. Feature epics (05+) are mostly parallel-executable once the foundation lands.

```
00 Overview (you are here)
↓
01 Foundation ──────────┐
                        ↓
02 Supabase schema ─────┤
                        ↓
03 Auth ────────────────┤
                        ↓
04 Authorization (RLS) ─┤
                        ↓
   ┌────────────────────┴──────────────────────┐
   ↓                                           ↓
05 Workspaces & boards         (parallel after 04)
   ↓
06 Groups & tasks (table)
   ↓
07 Column system ←──────── (07 blocks 11, 12)
   ↓
08 Realtime ←──────────── (08 blocks 09 presence work)
   ↓
09 Comments & activity
10 Attachments
11 Filtering / views
12 Alternate views
13 Notifications
14 Mobile / a11y / polish
15 Observability / testing / CI/CD ← runs alongside 05+
```

## Definition of done — overall product

A board where:
- A user signs in with Google (or email) and lands on their workspace home.
- They create a board, add groups, add tasks, and configure columns: status, person, date, number, text, file, link, tags, timeline, checkbox, rating.
- Two users on the same board see each other's cell edits live; presence dots show who's viewing.
- Comments support @mentions; mentioned users get an in-app notification and an email.
- Files attach to tasks via drag-drop; previews render inline.
- A filter bar narrows by column; saved views persist per user.
- Kanban, Calendar, Timeline, and Dashboard views all read from the same data.
- Roles (owner/admin/member/viewer) gate every mutation at the database level; RLS policy tests prove it.
- The full stack runs locally via `supabase start` + `pnpm dev`; production deploys to Vercel on `main` push; preview deploys on every PR.
- Sentry catches errors; Playwright covers the happy path; CI is green.

## What is explicitly out of scope (initial release)

- Stripe / billing / plans
- Public REST or GraphQL API for third parties
- Webhooks out
- Automations/recipes ("when status changes to Done, send Slack message")
- Integrations (Slack, GitHub, Gmail, Zapier)
- Mobile native apps
- Multi-language UI (scaffolding only — see [14](14-mobile-a11y-polish.md))
- White-labeling / custom domains per workspace
- SSO/SAML beyond Google OAuth
- Audit log export, compliance modes (SOC2/HIPAA)
- Public form sharing beyond authenticated users (form view exists; public sharing deferred)
- Cross-board mirror/dependency cell types (column types listed but stubbed in [07](07-column-system.md))

## How to read each epic doc

Every epic doc follows the same shape:

1. **Goal** — one sentence.
2. **Why this is its own epic** — what would break if we folded it into another.
3. **In scope / out of scope** — explicit.
4. **Dependencies** — which earlier epics must be merged.
5. **Architecture & design choices** — the substantive section. Every nontrivial decision documented with rationale.
6. **Schema additions / migrations** — SQL where relevant.
7. **Tasks** — checklist, ordered. Each task is a half-day to two-day chunk.
8. **Definition of done** — testable criteria.
9. **Open questions** — things to resolve before starting or during.

## Conventions

- **`pnpm`** is the package manager.
- **Migrations** are timestamped: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`.
- **Server actions** live in `app/**/actions.ts` next to the route that calls them.
- **Cell types** are referenced by short string ids (`text`, `status`, `person`, `date`, ...). Never by class name or component name.
- **All times are stored as `timestamptz`** in Postgres. Display layer converts to user's locale.
- **All ids are uuid v4** generated by Postgres (`gen_random_uuid()`). No client-generated ids.
- **Soft deletes** via `deleted_at timestamptz null`. Hard delete only via admin path.
