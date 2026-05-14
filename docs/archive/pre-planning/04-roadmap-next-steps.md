# Roadmap / Next Steps (Minimal Monday Clone)

This roadmap is sequenced to stabilize the app first, then expand features.

## Milestone 0 — Define “minimal Monday clone” scope (1–2 hours)

Clarify what *must* ship for your MVP:

- Board list + board page
- Groups and tasks
- Core columns:
  - Status, Person, Date
- Realtime collaboration (board updates)
- Basic auth (signup/login/logout)
- Basic filtering

Everything else (dashboards, files, numbers, priority, etc.) becomes optional until the MVP is stable.

## Milestone 1 — Fix auth & runtime config (High priority)

- Fix backend login password validation (bcrypt compare).
- Make cookie settings environment-aware (dev vs prod).
- Move secrets to env vars:
  - Mongo URI / db name
  - Cryptr secret(s)
  - Google OAuth client id
  - Cloudinary settings
- Add `backend` run scripts (`start` and ideally `dev` with nodemon) so README matches reality.
- Decide on guest-mode:
  - Either remove it
  - Or make it explicit (e.g. `GUEST_MODE=true`)

## Milestone 2 — Data shape hardening (High priority)

- Add a single authoritative “board/task shape” contract.
  - Either via runtime validation (Joi/Zod) or consistent constructors.
- Ensure all tasks have required fields:
  - `comments: []`
  - `updatedBy: { imgUrl: '', date: number }`
  - `memberIds: []`
- Align `local-board.service` seed shapes with server shapes (or remove local seed if not used).

## Milestone 3 — API improvements for collaboration safety (Medium–High)

- Add a board `updatedAt` and/or `version` field.
- Implement optimistic concurrency checks:
  - client sends last-known version
  - server rejects or merges on conflict
- Reduce full-board writes where possible:
  - Expand server endpoints for common operations (task move/reorder, add task, remove task, etc.)

## Milestone 4 — Column system MVP (Medium)

- Decide which columns are in MVP and enforce:
  - `cmpsOption` should only include truly implemented column types.
  - Remove `checkbox-picker` option until implemented.
- Split label sets:
  - status labels belong to status column
  - priority labels belong to priority column
  - (or store `labelsByCmpType`)
- Implement column rename (or hide UI affordance).

## Milestone 5 — Permissions & board membership (Medium)

- Decide minimal rule:
  - Only board members can edit
  - Others read-only
- Enforce in backend:
  - enable `requireAuth` for board writes
  - check membership in controller/service

## Milestone 6 — Polish & production readiness (Medium)

- Error handling:
  - avoid `window.location.assign('/')` on 500 from the API
  - show error toast/message
- Tests:
  - minimal unit tests around board filtering + reducer actions
  - backend tests for auth + board update endpoints
- Deployment workflow:
  - document env vars and setup

## Suggested first “continuation sprint” (most leverage)

- Fix auth login/password validation.
- Add backend start scripts and env-based config.
- Remove/disable unfinished column types from UI.
- Add a seed script for boards (not just users) so local dev is reproducible.

