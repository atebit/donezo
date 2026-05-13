# Epic 15 — E2E Test Debt

This document tracks tests that are marked `test.fixme` in the e2e suite and the reason each was deferred. Items should be resolved in follow-up slices or epic 15 stage 2/3.

---

## Slice 1F entries (Playwright runtime, 2026-05-13)

### Group A — Email / OAuth flows (auth.spec.ts)

| Test | Reason | Fix required |
|------|--------|-------------|
| `sign up → verify email → sign in → sign out` | Full signup + email-verify flow requires Inbucket/Mailpit integration to click the verification link. Not wired in CI. | Wire Supabase local Inbucket email capture in CI job; read the magic link via Inbucket API. |
| `forgot password sends an email` | Same Inbucket requirement. | Same as above. |
| `Google OAuth button initiates redirect` | OAuth popup test requires live Google OAuth endpoint or a browser-native mock. Not appropriate for local CI. | Skip permanently in unit/e2e; test at Cypress Cloud / dedicated OAuth test environment. |

### Group B — Multi-user / second storageState (08, 09, 10, 11 specs, 05 steps 8-9)

| Spec | Tests | Reason | Fix required |
|------|-------|--------|-------------|
| `08-realtime.spec.ts` | All 5 | Tests require two authenticated browser contexts (User A + User B) sharing a board. Only one storageState fixture is wired (e2e-user). | Seed a second user (`user-b+e2e@donezo.local`), create a second storageState fixture (`tests/e2e/.auth/user-b.json`), make them a member of the e2e board. |
| `09-comments-activity.spec.ts` | All 13 | Same two-user requirement. | Same as 08 fix. |
| `10-attachments.spec.ts` | All 7 | Two/three users + file column seed + Supabase Storage. | Wire second/third user fixtures; add `file` column to e2e seed; configure Supabase Storage in local stack. |
| `11-filtering-views.spec.ts` | All 9 | Two users (admin + member). | Same as 08 fix. |
| `05-workspaces-boards.spec.ts` | Steps 8 and 9 | Invitation flow requires second user and live invite token. | Seed invite token; sign in as invitee. |
| `invitation-accept.spec.ts` | All 1 | Same invitation token requirement. | Same as above. |

### Group C — Complex feature tests requiring additional seed data (06, 07 specs)

| Spec | Tests | Reason | Fix required |
|------|-------|--------|-------------|
| `06-board-table.spec.ts` | Steps 2–10 | Tests create groups and tasks dynamically; each test step depends on previous state. Need isolated test order or `beforeAll` setup. | Wire `test.describe.configure({ mode: 'serial' })` or use beforeAll to set up test state. |
| `07-column-system.spec.ts` | Steps 2–10 | Tests require a board with status column + labels (not in e2e seed). | Add status column + labels to e2e seed; or create them in beforeAll. |

### Group D — Visual snapshot baselines (all 5 visual specs)

| Spec | Reason | Fix required |
|------|--------|-------------|
| `visual/board-table.visual.spec.ts` | Baselines require Linux/Docker for font determinism. macOS fonts differ from CI. | Generate in Docker: `docker run --rm -v $PWD:/work -w /work mcr.microsoft.com/playwright:v1.60.0-jammy pnpm test:e2e:visual --update-snapshots` |
| `visual/board-kanban.visual.spec.ts` | Same | Same |
| `visual/workspace-home.visual.spec.ts` | Same | Same |
| `visual/account-settings.visual.spec.ts` | Same | Same |
| `visual/notifications.visual.spec.ts` | Same | Same |

### Group E — Performance board (12-alternate-views-perf.spec.ts)

| Test | Reason | Fix required |
|------|--------|-------------|
| All perf tests | Require a board seeded with 1,000 tasks, kanban/calendar/timeline views. Current e2e seed only has 3 tasks. | Extend e2e seed with a `perf-board` UUID + 1k tasks (or use a separate `seed:perf` script). |

### Group F — Complex DnD + view-specific interactions (12-* specs)

| Spec | Reason | Fix required |
|------|--------|-------------|
| `12-calendar-drag.spec.ts` | Requires calendar view with date column + tasks with dates. Current e2e board has no date column. | Add date column + date cells to e2e board seed. |
| `12-dashboard.spec.ts` | Requires dashboard view with widgets. View seed not wired. | Add a dashboard view to e2e seed. |
| `12-form-submit.spec.ts` | Requires form view. View seed not wired. | Add a form view to e2e seed. |
| `12-kanban-drag.spec.ts` | Requires kanban view with status column. Not in e2e seed. | Add status column + kanban view to e2e seed. |
| `12-timeline-drag.spec.ts` | Requires timeline view with date/range columns. Not in e2e seed. | Add timeline view to e2e seed. |
| `12-view-switching.spec.ts` | Requires multiple views seeded. Not in e2e seed. | Add multiple view types to e2e seed. |

---

## Resolution priority

1. **High** (Group D): Visual baselines — generate in Docker on first CI run.
2. **High** (Group B second-user): Wire `user-b` storageState to unlock 08/09/11.
3. **Medium** (Group C): Add status column to e2e seed (unlocks 07, parts of 06).
4. **Medium** (Group F): Add view seeds (unlocks 12-* specs).
5. **Low** (Group A): Email capture (nice-to-have, not blocking).
6. **Low** (Group E): Perf board seed (separate from functional coverage).
