# Donezo — Repo Rules

This repo is mid-rewrite: a CRA + Express + MongoDB app is being rebuilt as a Next.js 15 + Supabase + Vercel app. The canonical plan is in [`docs/conversion-plan/`](docs/conversion-plan/), starting with [`00-overview.md`](docs/conversion-plan/00-overview.md). Read the overview before doing anything substantive.

## Legacy code

- `frontend/` (CRA + MUI + Redux) and `backend/` (Express + MongoDB) are **legacy**. They stay running until parity is reached, then get deleted in one cleanup commit.
- **Do not patch legacy code.** No dependabot fixes, no refactors, no new features there. Bug fixes only if they block users in production.
- The new app is built fresh — no porting, no compatibility with legacy data shapes.

## Workflow — one epic at a time

Epics in `docs/conversion-plan/` execute **sequentially off `main`**, not in parallel:

1. **Plan** — `/plan-epic <NN>` enters planning mode for epic NN. Reads the epic doc, asks ambiguity-resolving follow-ups, produces a dispatch plan of parallel-safe slices.
2. **Branch** — once the plan is approved, create `epic/<NN>-<short-name>` off `main`. For large epics (05, 06, 08, 11 likely), use sub-branches `epic/<NN>-<short-name>/<slice>` PRing into the epic branch.
3. **Execute** — `/execute-epic` dispatches Sonnet executor agents in parallel, one per slice. Each gets a self-contained spec.
4. **Review & followup loop** — after each stage of parallel slices lands, the `epic-researcher` (Opus) reviews the merged diff against the epic doc's definition of done. If anything is incomplete, incorrect, or out of step with the stack defaults, it produces a **followup slice spec** at `docs/conversion-plan/_dispatch/epic-<NN>-followup-<N>.md`. `/execute-epic` then dispatches Sonnet executors against the followup. **This loop repeats until the review pass returns clean** — the epic is not done when slices return "done", it's done when the reviewer confirms the definition of done is met.
5. **Land** — sub-PRs into epic branch, epic branch into `main`. Merge unblocks the next epic.

Never start the next epic before the previous epic's PR is merged into `main`.

## Model strategy

- **Opus 4.7** is the lead. It plans epics, researches the existing code/docs, audits assumptions, designs schemas and component contracts, and resolves ambiguity. The orchestrator running this conversation should be Opus.
- **Sonnet** is the executor. It implements slices from a finished spec — fast, parallel, narrow scope.
- **Escalation:** if a Sonnet executor hits architectural ambiguity, missing info, an unexpected schema mismatch, or anything that would require it to guess at design, it must **stop and return a "needs-direction" report**, not invent a solution. The orchestrator then routes to Opus (the `epic-researcher` agent) for resolution and re-dispatches.

## Branching, commits, PRs

- Default branch: `main`.
- Branch names: `epic/<NN>-<kebab>` and `epic/<NN>-<kebab>/<slice-kebab>`.
- Commits: imperative mood, scope-prefixed when natural (e.g. `schema: add workspaces table`). Reference the epic number in the PR description, not every commit.
- PRs into `main` must come from the epic branch only. Sub-slice PRs target the epic branch.
- Never force-push to `main`. Never skip hooks.

## Stack — non-negotiable defaults

From the overview doc; restate here so executors don't drift:

- **pnpm** package manager. Not npm, not yarn.
- **Next.js 15 App Router**, RSC-first. `"use client"` only for interactivity.
- **Server Actions** for mutations. No `/api` route handlers except webhooks.
- **TypeScript strict.** Generated Supabase types via `supabase gen types typescript`.
- **Tailwind v4 + shadcn/ui + Base UI** (`@base-ui/react`). The current shadcn `base-nova` style uses Base UI, which is the explicit successor to Radix; we adopt it as the canonical primitive layer for this rebuild. No MUI, no SCSS in new code.
- **Forms:** React Hook Form + Zod. Same Zod schema validates client + server action.
- **Tables:** TanStack Table + TanStack Virtual.
- **DnD:** dnd-kit.
- **Rich text:** Tiptap.
- **Client state:** Zustand for UI-only state. No Redux.
- **DB:** Supabase Postgres. **RLS is the source of truth for authorization.**
- **Realtime:** Supabase Realtime. No Socket.IO.
- **Storage:** Supabase Storage. No Cloudinary.
- **Email:** Resend + React Email.
- **Hosting:** Vercel.
- **Tests:** Vitest (unit) + Playwright (e2e) + pgTAP (RLS policies).

## Conventions

- All ids are `uuid v4` from Postgres (`gen_random_uuid()`). No client-generated ids.
- All times are `timestamptz`. Display converts to user locale.
- Soft deletes via `deleted_at timestamptz null`. Hard delete only via admin paths.
- Migrations: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`.
- Server actions: `app/**/actions.ts` next to the route that calls them.
- Cell types referenced by short string id (`text`, `status`, `person`, ...) — never by class or component name.
- Accessibility is built in from the start; epic 14 is a polish/audit pass, not the first time we think about a11y.
