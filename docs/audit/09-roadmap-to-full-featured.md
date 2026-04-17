# Roadmap to Full-Featured

A sequenced plan to take the current fork to a credible monday.com-class product. Ordered so stability and security come before feature expansion.

Each phase has a rough effort estimate (S = <1 day, M = 1-3 days, L = 3-10 days, XL = multi-week) and a concrete definition of done.

---

## Phase 0 — Stop the bleeding (S–M)

Security and correctness fixes that must ship before anyone touches the deployment.

- **Rotate MongoDB Atlas credentials.** Change the password in Atlas and revoke the existing one. (S)
- **Add `bcrypt.compare` to login.** `backend/api/auth/auth.service.js:18-25`. (S)
- **Uncomment `requireAuth`** on `backend/api/board/board.routes.js:6` and `backend/api/user/user.routes.js:7`. (S)
- **Make guest mode env-driven**, default off in production. (S)
- **Add `httpOnly: true` + `maxAge`** to cookie options. (S)
- **Require `SECRET1`** at boot (throw if missing). (S)
- **Move Mongo URI + db name + Google client id + Cloudinary config to env vars.** Add `.env.example`. (S)
- **Fix `board.service.getById` missing `await`.** (S)
- **Drop `password` from `user.service.update` field list** (or re-hash when present). (S)
- **Fix logger `NODE_NEV` typo.** (S)
- **Add `backend` `start` and `dev` scripts.** (S)

**Definition of done**: no hardcoded secrets in source, auth actually works, third parties can't mutate boards, backend runs from `npm run dev`.

## Phase 1 — Baseline ops (M)

- Install `helmet`, `compression`, `express-rate-limit`, and `zod` (or `joi`) on the backend.
- Apply rate limiting to `/api/auth/*`.
- Add validation schemas for board/task/group/user write endpoints. Reject unknown fields.
- Replace homegrown `logger.service.js` with `pino` (+ `pino-pretty` in dev).
- Wire a centralized error-handling middleware; return structured `{error, code}` bodies.
- Add a frontend toast system (sonner or react-hot-toast) and surface API errors there instead of console-logging.
- Delete redundant `<Provider>` in `root-cmp.jsx`. Combine `system.reducer` or delete it.
- Migrate `react-beautiful-dnd` → `@hello-pangea/dnd` (drop-in import change).

**Definition of done**: every failed API call shows the user something useful; bad request bodies are rejected before they touch MongoDB.

## Phase 2 — Data integrity & concurrency (M–L)

Decision point: stay on Mongo, migrate to Mongoose, or migrate to Supabase/Postgres. See [10-supabase-migration.md](10-supabase-migration.md) for the Supabase option.

Whichever path:
- Add `updatedAt` (or version) to boards. PUT uses it as a precondition; respond 409 on mismatch.
- Move task writes to atomic operations (Mongo positional operators or, in Postgres, scoped UPDATEs).
- Normalize `task.status` / `task.priority` to store label **id**, not title. Stop the cascade-rename in the reducer.
- Unify `cmpsOrder` on a single shape (`{id, type}`).
- Seed script for boards (not just users) to make local dev reproducible.

**Definition of done**: two clients editing different tasks on the same board cannot overwrite each other.

## Phase 3 — Auth & multi-user foundations (M–L)

- Add `/api/auth/me` so the frontend can rehydrate `user` on hard refresh.
- Frontend signup UI (backend already supports it — just needs a form).
- User profile page: edit name/avatar, change password (separate endpoint that requires old password).
- Socket auth: pass the cookie/token in `io({withCredentials: true})` handshake; verify server-side; derive `userId` from the token; reject `set-user-socket`.
- Topic-ACL: before joining a board's socket room, verify membership.
- Session expiration: embed `iat`/`exp` in the Cryptr payload or switch to JWT with refresh.

**Definition of done**: sockets and REST agree on the same auth model; a stranger can't join your board's room.

## Phase 4 — Permissions & workspaces (L)

- Data model: `workspace` → `board` (many-to-one). `membership` linking users to workspaces and boards with a role.
- Backend: enforce `workspace:read`, `board:read/write`, `board:admin`. `requireAuth` + a `requireBoardAccess(role)` middleware.
- Frontend: filter boards by workspace; board settings page for member management with roles.
- Invites: email-based invite tokens stored server-side; accept route that joins the invitee to a workspace.

**Definition of done**: users see only the boards they have access to; roles gate mutations.

## Phase 5 — Column system maturation (M)

- Separate label collections per column (status vs priority vs custom).
- Rename column affordance.
- New column types: **text**, **timeline** (start/end), **rating**, **link**, **tags**.
- Multi-file attachments (array, not single string).
- Column-level permissions (read-only columns, admin-only columns).

## Phase 6 — Alternate views (L)

- Wire Kanban into a view toggle; either keep `react-beautiful-dnd` or move Kanban to `dnd-kit` (since it needs nested drop zones).
- Calendar view (react-big-calendar or custom).
- Timeline / Gantt view (react-gantt or visx-based custom).
- Saved views per board with filter + sort presets.

## Phase 7 — Collaboration quality of life (L)

- Presence indicators (who's viewing the board now, using socket `presence` events).
- Typing indicators in comments.
- @-mentions in comments with a notification payload.
- Activity log coverage for every mutation (group rename, column change, file upload, member add/remove).
- Board-level undo for recent destructive operations (optional but high-impact).

## Phase 8 — Notifications (M–L)

- In-app notification center — driven by activities that mention or affect the user.
- Email provider (Resend, Postmark, SES) for digest + high-priority notifications.
- Notification preferences per user.

## Phase 9 — Polish & production readiness (M)

- Accessibility pass: ARIA labels on all interactive controls, modal focus trapping, keyboard-navigable drag/drop, color-blind safe status indicators.
- Mobile: dedicated layouts for board list / task detail. Touch-friendly DnD or a "reorder mode" instead of DnD on mobile.
- Dark mode (SCSS already has tokens — wire a theme provider).
- Observability: Sentry on frontend + backend; structured log shipping.
- CI: lint + type check + tests on every PR. GitHub Actions is sufficient.
- Test coverage: at least service-layer tests on the backend, reducer + thunk tests on the frontend. Playwright for critical happy-path E2Es.
- Docker: Dockerfile + Compose for local dev; deployment recipe for Fly / Render / Vercel (frontend) + Fly / Railway (backend).

## Phase 10 — Build tooling modernization (L)

- CRA → Vite. Drop the `react-scripts` transitive dep tree, get instant HMR, move env vars to `VITE_*`.
- Redux → Redux Toolkit. Replace `http.service.js` + most thunks with RTK Query.
- React 18 → 19.
- MUI 5 → 6. Or reconsider the UI toolkit entirely — the app uses MUI lightly; a Tailwind + shadcn stack would remove a lot of weight.

---

## First-sprint proposal (2 weeks, one engineer)

Phase 0 + Phase 1 are both achievable in a single sprint and unlock everything downstream. Deliverables:

1. Security fixes merged and deployed behind a freshly-rotated Atlas credential.
2. `.env.example` + README updated to reflect reality.
3. Rate limiting + input validation + structured error responses.
4. Toast-based error surface on the frontend.
5. `@hello-pangea/dnd` migration.
6. `bcrypt.compare` on login + `httpOnly` cookie.

That alone moves the project from "demo" to "safe to run internally with real users."

## Decision points you should make before Phase 2

- **Database**: stay on MongoDB (upgrade driver, add schema via Mongoose), or migrate to Supabase/Postgres? Supabase brings auth + realtime + storage as a bundle but is a large migration. See [10-supabase-migration.md](10-supabase-migration.md).
- **Build tooling**: keep CRA and defer, or migrate to Vite up front? Later is cheaper in the short run; earlier is cheaper in the long run.
- **Auth provider**: keep rolling your own (Cryptr cookie), adopt a library (lucia, NextAuth if you move to Next, Auth.js), or let Supabase's auth take over? If Supabase wins the DB decision, the answer is "Supabase auth".
- **UI toolkit**: keep MUI + SCSS, or consolidate on one system (Tailwind + shadcn, or MUI-only).
