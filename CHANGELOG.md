# Changelog

All notable changes to Donezo are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

---

## [Unreleased] — 2026-05-14

### Epic 17 — Legacy Cleanup

Documentation and repository hygiene pass after all 16 product epics shipped. See [`docs/conversion-plan/17-legacy-cleanup.md`](docs/conversion-plan/17-legacy-cleanup.md).

- **Q1 — Deleted local `frontend/` and `backend/` folders from disk.** Both directories were untracked (`.gitignore`-listed). Recovery path: git commit `a5d47c2`.
- **Q2 — Archived pre-rebuild documentation subtrees.** `docs/audit/`, `docs/pre-planning/`, and `docs/conversion-refinements/` moved to `docs/archive/` via `git mv`. An umbrella `docs/archive/_README.md` explains the archive.
- **Q3 — Reworded anti-pattern guardrails** in `CLAUDE.md`, `CONTRIBUTING.md`, and related docs from "in new code" phrasing to "this repo uses X, not Y" phrasing.
- **Documentation pass** across `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, and `docs/conversion-plan/` — dropped "mid-rebuild" / "being rebuilt" framing; updated stale legacy-stack references; preserved provenance notes pointing at commit `a5d47c2` where origin is interesting.

---

## [0.1.0] — 2026-05-13

Initial internal release. This version represents the full initial rebuild from the
legacy CRA + Express + MongoDB stack to Next.js 15 + Supabase + Vercel.

See [`docs/conversion-plan/`](docs/conversion-plan/) for the full scope, architecture
decisions, and per-epic definition of done.

### Added

- **Epic 01 — Project Foundation & Deploy Pipeline:** Next.js 15 app shell, Tailwind
  v4 + shadcn/ui + Base UI design system, Vercel deployment with preview deploys per
  PR, local dev loop with Supabase CLI.

- **Epic 02 — Supabase Project & Schema:** Canonical normalized Postgres schema for
  the entire product (workspaces, boards, groups, tasks, cells, comments, attachments,
  notifications, saved views), timestamped migrations, generated TypeScript types,
  seed script.

- **Epic 03 — Authentication:** Supabase Auth with Google OAuth, email/password, and
  magic-link sign-in; SSR-aware session handling via `@supabase/ssr`; sign-in, sign-up,
  password-reset, and account-settings UI.

- **Epic 04 — Authorization (RLS + Roles):** Owner/admin/member/viewer role hierarchy
  enforced entirely at the database layer via Postgres RLS; SECURITY DEFINER helper
  functions; pgTAP policy tests proving correctness.

- **Epic 05 — Workspaces & Boards:** Workspace switcher, board list, full CRUD on
  workspaces and boards, member invitations, board starring and archiving.

- **Epic 06 — Groups & Tasks (Table View):** Virtualized task table with collapsible
  groups, drag-and-drop ordering, inline title editing, bulk select and actions,
  add/rename/duplicate/delete flows.

- **Epic 07 — Dynamic Column System:** 23 cell types (text, status, priority, person,
  date, timeline, number, currency, formula, checkbox, file, link, tags, rating, email,
  phone, country, vote, week, location, created-by, last-updated, and more); add,
  rename, reorder, hide, and remove columns; per-type renderers, editors, validators,
  aggregators, sorters, and filterers.

- **Epic 08 — Realtime & Presence:** Live cell edits via Supabase Realtime (Postgres
  Changes); presence dots showing who is viewing a board; Broadcast for typing
  indicators; last-write-wins concurrency per cell.

- **Epic 09 — Comments, Activity Log, and Mentions:** Rich-text Tiptap comments with
  @mentions and threaded replies; per-task and per-board activity feed with structured
  payloads rendered as human-readable diffs.

- **Epic 10 — Attachments & File Storage:** Multi-file uploads per task, image/PDF
  inline previews, Supabase Storage bucket policies, drag-drop into task drawer and
  file column, inline image embedding in comments.

- **Epic 11 — Filtering, Sorting, Search, Saved Views:** Per-board filter builder
  with any column and operator, multi-key sort, full-text task search, saved views
  with filter + sort + grouping + column-visibility presets, URL-sync for shareable
  filtered states.

- **Epic 12 — Alternate Views (Kanban, Calendar, Timeline, Dashboard, Form):** Six
  views of the same board data — Table, Kanban, Calendar, Timeline (Gantt), Dashboard
  (charts), and Form (data entry) — with per-view saved configurations.

- **Epic 13 — Notifications (In-App + Email):** Real-time in-app notification bell and
  center; Resend email notifications for mentions, assignments, due-date reminders,
  comment replies, and board invitations; per-user channel preferences; email digest
  option.

- **Epic 14 — Mobile, Accessibility, and Polish:** Responsive mobile layout, WCAG 2.1
  AA compliance baseline, dark mode, loading skeletons, empty states, transitions,
  next-intl i18n scaffolding (English-only v1).

- **Epic 15 — Observability, Testing, and CI/CD:** Sentry error tracking (browser +
  server + Edge), structured Pino logs, Vercel Analytics + Speed Insights, GitHub
  Actions CI pipeline (lint, typecheck, build, unit tests, RLS policy tests, e2e),
  scheduled cron jobs (digest mailer, due-soon scanner, notification cleanup, orphan
  cleanup, position compaction), runbooks, secret-rotation tooling, CHANGELOG.

---

[0.1.0]: https://github.com/atebitcreative/donezo/releases/tag/v0.1.0
