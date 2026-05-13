# E2E Tests — Playwright

Playwright end-to-end tests for Donezo. Tests live under `tests/e2e/` and are grouped into three sub-directories:

- `tests/e2e/*.spec.ts` — feature flow specs (auth, workspaces, boards, etc.)
- `tests/e2e/a11y/` — axe-core accessibility checks
- `tests/e2e/visual/` — screenshot regression snapshots

---

## Prerequisites

1. **Docker Desktop** — required for `supabase start` (local Supabase stack).
2. **Node 22** — via `.nvmrc` (`nvm use` or `fnm use`).
3. **pnpm 10.33.4** — `corepack enable && corepack prepare pnpm@10.33.4 --activate`.
4. **Playwright browsers** — installed via `pnpm test:e2e:install` (one-time).
5. **`.env.local`** — copy from `.env.example`; at minimum set:
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key from supabase status>`
   - `SUPABASE_SERVICE_ROLE_KEY=<local service-role key from supabase status>`

---

## Local run procedure

```bash
# 1. Start the local Supabase stack
supabase start

# 2. Apply migrations and seed (creates demo + e2e seed data)
pnpm db:reset

# 3. Install Playwright browsers (first time only)
pnpm test:e2e:install

# 4. Start the Next.js dev server in a separate terminal
pnpm dev

# 5. Run the full e2e suite (in another terminal)
pnpm test:e2e

# Or run specific sub-suites:
pnpm test:e2e:a11y    # axe-core a11y specs only
pnpm test:e2e:visual  # visual snapshot specs only
```

---

## Auth fixture

`tests/e2e/global-setup.ts` runs once before all specs. It:
1. Ensures the e2e seed user (`e2e-user@donezo.test`) exists in `auth.users`.
2. Signs in via `signInWithPassword`.
3. Saves the browser storage state (cookies + localStorage) to `tests/e2e/.auth/user.json`.

All specs inherit this via `use: { storageState: "tests/e2e/.auth/user.json" }` in `playwright.config.ts`. You do NOT need to sign in manually in each test.

The `tests/e2e/.auth/user.json` file is gitignored — it contains session tokens.

---

## Seed constants

`tests/e2e/fixtures/seed.ts` exports the deterministic UUIDs that match `supabase/seed.sql`. Import from this file instead of hard-coding IDs in specs:

```ts
import { E2E_BOARD_ID, E2E_WORKSPACE_SLUG } from "../fixtures/seed";
```

---

## Test status

| Suite | Status | Notes |
|-------|--------|-------|
| `auth.spec.ts` | Partially active | Sign-in redirect passes; sign-up/OAuth are `test.fixme` |
| `05-workspaces-boards.spec.ts` | Active (steps 1–7) | Steps 8–9 (invite) are `test.fixme` |
| `06-board-table.spec.ts` | Active (step 1) | Steps 2–10 are `test.fixme` |
| `07-column-system.spec.ts` | Active (step 1) | Steps 2–10 are `test.fixme` |
| `08-realtime.spec.ts` | All `test.fixme` | Needs second-user storageState |
| `09-comments-activity.spec.ts` | All `test.fixme` | Needs second-user storageState |
| `10-attachments.spec.ts` | All `test.fixme` | Needs second-user + file column seed |
| `11-filtering-views.spec.ts` | All `test.fixme` | Needs second-user storageState |
| `12-*.spec.ts` | All `test.fixme` | Needs additional view/column seeds |
| `invitation-accept.spec.ts` | All `test.fixme` | Needs invite token seed |
| `a11y/auth.a11y.spec.ts` | All active | Anonymous pages |
| `a11y/board.a11y.spec.ts` | All active | Uses auth storageState |
| `a11y/account.a11y.spec.ts` | All active | Uses auth storageState |
| `a11y/notifications.a11y.spec.ts` | All active | Uses auth storageState |
| `a11y/task-drawer.a11y.spec.ts` | All active | Uses auth storageState |
| `visual/*.visual.spec.ts` | All `test.fixme` | Baselines need Linux/Docker |

See `docs/conversion-plan/_dispatch/epic-15-test-debt.md` for the full triage.

---

## Visual snapshots

Visual snapshot tests compare screenshots against committed baselines. Baselines must be generated in a Linux environment (Playwright's Docker image) to avoid macOS/Linux font-rendering differences:

```bash
docker run --rm \
  -v $PWD:/work \
  -w /work \
  mcr.microsoft.com/playwright:v1.60.0-jammy \
  pnpm test:e2e:visual --update-snapshots
```

Commit the generated files under `tests/e2e/visual/__snapshots__/`.

---

## CI

The e2e suite runs in the `e2e` GitHub Actions job (wired in epic 15 stage 2). The job:
1. Runs `supabase start`.
2. Applies migrations + seed.
3. Builds and starts the Next.js app (`pnpm build && pnpm start`).
4. Runs `pnpm test:e2e`.

`reuseExistingServer: false` in CI ensures a clean server each run.
