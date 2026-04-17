# Donezo — Comprehensive Audit

Audit date: 2026-04-16. Branch: `main`. Head: `e7037bf Add Google-only login flow and docs`.

This folder is the result of a full pass over the repo to inventory what exists, where
it breaks, and what needs to be built before Donezo can be called a "full-featured"
monday.com clone. It supersedes and extends `docs/pre-planning/`.

## What this repo is

A fork of a MERN-stack monday.com clone (originally [idandavid1/My-Day](https://github.com/idandavid1/My-Day)).
UI-heavy: the board/group/task/columns experience is largely wired. The weak spots
are the backend (broken auth, unprotected endpoints, hardcoded secrets, ancient
MongoDB driver), feature gaps (no multi-workspace, no permissions, no
notifications), and operational hygiene (no env docs, no tests, no CI).

## Files

| File | Scope |
|------|-------|
| [01-architecture.md](01-architecture.md) | Runtime architecture, repo layout, how the pieces fit |
| [02-backend.md](02-backend.md) | Backend deep-dive: routes, services, auth, DB, sockets |
| [03-frontend.md](03-frontend.md) | Frontend deep-dive: routing, pages, state, components, services |
| [04-feature-matrix.md](04-feature-matrix.md) | Every feature rated E2E / Partial / Missing with evidence |
| [05-security.md](05-security.md) | Secrets, auth correctness, authorization, cookies, injection, sockets |
| [06-data-model.md](06-data-model.md) | Board/group/task/user shapes and API contracts |
| [07-gaps-and-tech-debt.md](07-gaps-and-tech-debt.md) | Bugs, dead code, inconsistencies, known sharp edges |
| [08-dependencies.md](08-dependencies.md) | Package audit: outdated, abandoned, unused |
| [09-roadmap-to-full-featured.md](09-roadmap-to-full-featured.md) | Sequenced plan to ship a full-featured app |
| [10-supabase-migration.md](10-supabase-migration.md) | Secondary audit: lift assessment for moving persistence/auth/realtime to Supabase |

## Executive summary

**What works well**
- Core board UX — groups, tasks, drag-drop, inline editing, modals — is wired end-to-end.
- Most dynamic columns are implemented (status, priority, person, date, number, file, checkbox, updated-by).
- Realtime board updates via Socket.IO are functional for happy-path single-board collab.
- Google OAuth login was just landed and is correctly implemented server-side ([backend/api/auth/auth.service.js:41-63](backend/api/auth/auth.service.js)).
- SCSS architecture is reasonable: design tokens, component-scoped files, clear naming.

**What's critically broken**
- **Password login does not verify passwords.** [backend/api/auth/auth.service.js:18-25](backend/api/auth/auth.service.js) fetches the user and returns it without calling `bcrypt.compare`. Any password succeeds against any username.
- **All board write endpoints are unauthenticated.** [backend/api/board/board.routes.js:6](backend/api/board/board.routes.js) has `requireAuth` commented out — any client can create, modify, or delete boards.
- **MongoDB credentials are hardcoded and already in git history.** `backend/config/dev.js:2` and `prod.js:2` share the same Atlas URI + password. Rotation required.
- **Cryptr secret fallback is hardcoded** (`'Secret-Puk-1234'` at `backend/api/auth/auth.service.js:6`). If `SECRET1` env var isn't set in prod, tokens are trivially forgeable.
- **Cookies are missing `HttpOnly`.** Session token is readable from JS — XSS can exfiltrate.
- **Socket.IO has no auth, no authorization, and `origin: '*'`.** Any client can join any board's topic and impersonate any user via `set-user-socket`.
- **`mongodb` driver is v3.2.7** (2018). Missing 5+ years of patches. `react-beautiful-dnd` is abandoned.

**What's missing for "full-featured"**
- Email/password signup UI (backend has it; frontend only exposes Google).
- Permissions / board membership enforcement. Every board is public and mutable.
- Workspaces (multi-tenant). UI has a sidebar concept but the data model is flat.
- Board duplicate, column rename, group collapse, bulk task actions, cross-board search.
- Timeline / Calendar views. Kanban components exist but are not wired into the view toggle.
- Notifications (in-app or email), presence indicators, typing, concurrent-edit safety.
- Input validation anywhere. No Joi/Zod/Mongoose schemas on writes.
- Tests — ~5% coverage. Backend has zero tests.
- Observability: no rate limiting, no structured logging, no audit trail.

**Recommended first sprint (in order)**
1. Fix login password check + uncomment `requireAuth` on board routes + add `HttpOnly` cookie flag.
2. Rotate MongoDB credentials in Atlas; move all secrets to env vars; add `.env.example`.
3. Upgrade `mongodb` driver or migrate to `mongoose` (already installed but unused).
4. Migrate `react-beautiful-dnd` → `@hello-pangea/dnd` (drop-in).
5. Add server-side input validation on board/task/user endpoints.
6. Authenticate socket connections; verify topic membership before joining/emitting.

See [09-roadmap-to-full-featured.md](09-roadmap-to-full-featured.md) for the full sequenced plan.
