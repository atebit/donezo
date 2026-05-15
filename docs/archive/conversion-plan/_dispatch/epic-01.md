# Epic 01: Project Foundation & Deploy Pipeline — Dispatch Plan

**Status:** approved, ready to execute via `/execute-epic 01`
**Approved on:** 2026-05-06
**Source epic doc:** `docs/conversion-plan/01-foundation.md`
**Branch:** `epic/01-foundation` off `main`

## User decisions (locked)

| # | Question | Decision |
|---|---|---|
| 1 | Project root | **Repo root.** New app lives alongside legacy `frontend/` and `backend/`. |
| 2 | pnpm workspace | **No `pnpm-workspace.yaml`.** Single-package; add workspace file when a second package (e.g. `emails/`) shows up. |
| 3 | Node version | **Node 22 LTS.** Pin via both `.nvmrc` and `.node-version`. `engines.node: ">=22 <23"` in `package.json`. |
| 4 | Storybook | **Defer.** Out of epic 01. Document in `CONTRIBUTING.md` that cell renderers will get Playwright component tests instead, with Storybook reconsidered in epic 07 if needed. |
| 5 | shadcn install set | **Minimal.** `init` + only `button` + `sonner`. Other components installed on demand as future epics need them. |
| 6 | Sentry / Resend / Vercel Analytics | **Env-stub only.** Declare optional vars in `lib/env.ts`; do not install `@sentry/nextjs`, `@vercel/analytics`, etc. Epic 15 owns observability. |
| 7 | Local Supabase setup | **`supabase init` now.** Run during a sequential follow-up step; commit `supabase/config.toml` and any generated skeleton. |
| 8 | CI scope | **Lint + typecheck + build only.** Ubuntu, Node 22 via `.nvmrc`, pnpm via corepack, frozen lockfile, cache pnpm store + `.next/cache`. Triggers: `pull_request` on all branches, `push` on `main`. Concurrency cancel-in-progress. **No test job stub** — epic 15 adds it. |
| 9 | Biome migration path | **Accept ESLint at `create-next-app`, then replace with Biome in the same slice.** Two commits inside Slice A: (1) scaffold with ESLint as generator outputs, (2) remove ESLint and add Biome. Cleaner end state. |
| 10 | Vercel project linkage | **Manual by user, after the epic merges.** Slices do not run any Vercel CLI commands. `CONTRIBUTING.md` documents the user-driven steps from `01-foundation.md` § Vercel project setup. |
| 11 | Custom domain | **Defer.** Epic 03 will use Vercel preview URLs until a domain is provisioned. |
| 12 | Bundle analyzer | **Defer to epic 15.** |
| 13 | Build SHA source | **`git rev-parse HEAD` at build time** (works locally and on Vercel, no env-var dependency). Captured once during `next.config.ts` evaluation and exposed via `process.env.NEXT_PUBLIC_BUILD_SHA`. |
| 14 | Toast library | **shadcn `sonner`.** Mount `<Toaster />` in `app/layout.tsx`. |
| 15 | `withUser` server-action helper signature | **As proposed.** Contract:<br>```ts<br>type ActionResult<T> = { ok: true; data: T } \| { ok: false; error: { code: string; message: string; field?: string } };<br>function withUser<I, O>(handler: (ctx: { user: { id: string; email: string } }, input: I) => Promise<ActionResult<O>>): (input: I) => Promise<ActionResult<O>>;<br>```<br>Synthetic user: `{ id: "00000000-0000-0000-0000-000000000000", email: "dev@donezo.local" }`. **Critical note:** epic 03 must replace this synthetic user before any DB write happens — the all-zeros uuid would collide with `gen_random_uuid()` real inserts. |
| — | Root `README.md` | **Defer replacement.** Keep the existing legacy MERN README. Replace at parity, in the cleanup commit that deletes `frontend/` and `backend/`. |
| — | Stage 2 parallelism | **Serialize B → C → E** to avoid `package.json` / `pnpm-lock.yaml` contention. Slice D (`.gitkeep` skeleton) runs in parallel with stage 2. |

## Preconditions verified

- On `main`, working tree clean, in sync with `origin/main`. Latest commit `a353792`.
- No prior foundation work — no root `package.json`, `tsconfig.json`, `next.config.*`, `tailwind.config.*`, `app/`, `lib/`, `supabase/`, `.github/workflows/`, `.env.example`, `.nvmrc`, `.node-version`, `vercel.json`.
- Legacy `frontend/` (CRA) and `backend/` (Express) are self-contained subdirectories with their own `package.json`, `package-lock.json`, `.gitignore`, and `node_modules`. Neither shares root config with the new app.
- Root `.gitignore` is minimal (`node_modules`, `logs`, `.DS_Store`, `.env`, `backend/.env`, `frontend/.env`). **Append-only** modifications by Slice A; existing legacy entries must remain untouched.
- Epic 01 has no upstream epic dependencies (confirmed against `01-foundation.md` § Dependencies).
- `docs/conversion-plan/_dispatch/` will be created (this file is the first file in it).

## Stack defaults (restated for executors)

From `CLAUDE.md` — non-negotiable unless `01-foundation.md` explicitly overrides:

- **pnpm only.** Not npm, not yarn.
- **Next.js 15 App Router**, RSC-first. `"use client"` only for interactivity.
- **TypeScript strict.** Use the exact `compilerOptions` block from `01-foundation.md` lines 50–66.
- **Tailwind v4** via `@import "tailwindcss";` and `@theme` block in `app/globals.css`. **No** `tailwind.config.ts`.
- **shadcn/ui** copied into `components/ui/`, aliases `@/components`, `@/components/ui`, `@/lib/utils`.
- **Biome** is the formatter + linter. No ESLint, no Prettier in the final state of this epic.
- **Server Actions** for mutations. No `/api` route handlers except webhooks.
- **Zod** for validation.
- **uuid v4** ids from Postgres (`gen_random_uuid()`); **`timestamptz`** for times; **soft-delete** via `deleted_at timestamptz null` (DB conventions — not yet exercised in epic 01).
- **No `console.log`** — Biome rule `suspicious.noConsoleLog: error`. Use `logger` from `lib/logger.ts`.
- **Accessibility built in.** Keyboard nav, focus management, ARIA on every interactive surface.
- **Never modify legacy `frontend/` or `backend/`** in any slice.

## Execution order

```
Stage 1: A (Next.js scaffold + Biome)             [solo]
            ↓
Stage 2: B (tokens + shadcn) → C (env + helpers) → E (CI + CONTRIBUTING)   [serialized]
         D (.gitkeep skeleton)                                              [parallel-safe with stage 2]
            ↓
Stage 3: F (health-check page + ping action + error/404)                   [solo]
            ↓
Sequential follow-ups (single-executor or inline):
  1. supabase init (commits supabase/config.toml + skeleton)
  2. CONTRIBUTING.md adds the user-driven Vercel setup checklist (could fold into Slice E if cleaner)
  3. Smoke test on epic branch
            ↓
Per-stage review pass after each stage. Followup loop until reviewer returns CLEAN.
            ↓
Epic-level review pass. Followup loop until CLEAN.
            ↓
PR into main.
```

---

## Slice A — Next.js scaffold + TypeScript + Biome + scripts

**Owner:** epic-executor (sonnet) · **Stage:** 1 (solo) · **Branch:** commit directly on `epic/01-foundation`

### Scope (files this slice may touch)

- `/package.json`
- `/pnpm-lock.yaml`
- `/tsconfig.json`
- `/next.config.ts`
- `/next-env.d.ts`
- `/biome.json`
- `/.nvmrc`
- `/.node-version`
- `/.gitignore` — **append-only** additions for `.next`, `.vercel`, `.turbo`, `coverage`, `playwright-report/`, `test-results/`, `*.tsbuildinfo`, `lib/supabase/types.ts`, `.env*.local`. Existing entries (`node_modules`, `logs`, `.DS_Store`, `.env`, `backend/.env`, `frontend/.env`) must remain.
- `/app/layout.tsx` — minimal layout with `<Toaster />` import + element from `@/components/ui/sonner` (the file is created by Slice B; lint will warn until B lands — that is expected).
- `/app/page.tsx` — minimal generated content (Slice F replaces).
- `/app/globals.css` — only the `@import "tailwindcss";` directive plus a literal marker line `/* THEME_TOKENS — owned by Slice B */`. Slice B writes the `@theme` block after this marker.
- `/app/error.tsx` and `/app/not-found.tsx` — minimal stubs (Slice F replaces).

### Forbidden scope

`components/`, `lib/`, `.github/`, `vercel.json`, `supabase/`, legacy `frontend/`, `backend/`, `docs/`, `CLAUDE.md`, `README.md`, `.claude/`.

### Dependencies on other slices

None. Stage 1.

### Spec

1. **Scaffold Next.js** in repo root (NOT in a subdirectory):
   ```
   pnpm create next-app@latest . --ts --tailwind --app --eslint --use-pnpm --no-src-dir --import-alias "@/*" --turbopack
   ```
   (Generator does not have `--no-eslint` reliably across versions; we accept ESLint at create time and remove it below. This is decision Q9.)

2. **Replace `tsconfig.json`** with the exact block from `01-foundation.md` lines 50–66. Verify `paths: { "@/*": ["./*"] }`.

3. **Set `package.json` fields:**
   - `packageManager`: pinned to whatever pnpm version corepack resolves at execution (capture the full `pnpm@x.y.z+sha512.<hash>` string).
   - `engines.node`: `">=22 <23"`.

4. **Replace the scripts block** with the verbatim contents of `01-foundation.md` lines 192–206:
   ```json
   {
     "dev": "next dev --turbopack",
     "build": "next build",
     "start": "next start",
     "lint": "biome check .",
     "lint:fix": "biome check --write .",
     "format": "biome format --write .",
     "typecheck": "tsc --noEmit",
     "test": "vitest run --passWithNoTests",
     "test:watch": "vitest",
     "test:e2e": "echo 'playwright wired in epic 15' && exit 0"
   }
   ```
   Note `test` references vitest. Vitest is **not** installed in epic 01 — epic 15 wires it. Until then, the `test` script will fail if invoked. This is intentional: it preserves the script name for muscle memory and signals to epic 15 what to install. **Reviewer may flag and ask for a temporary `echo` stub instead.** Acceptable either way.

5. **Remove ESLint, install Biome:**
   - Remove `eslint`, `eslint-config-next`, `@eslint/*` from `package.json` deps. Delete `.eslintrc*` files. Delete `eslint.config.mjs` if generated.
   - `pnpm add -D -E @biomejs/biome`.
   - Generate `biome.json` (target Biome v1.9+, current major at execution time):
     ```json
     {
       "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
       "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
       "files": { "ignoreUnknown": true },
       "formatter": {
         "enabled": true,
         "indentStyle": "space",
         "indentWidth": 2,
         "lineWidth": 100
       },
       "javascript": { "formatter": { "trailingCommas": "all", "quoteStyle": "double" } },
       "linter": {
         "enabled": true,
         "rules": {
           "recommended": true,
           "suspicious": { "noConsoleLog": "error" },
           "style": {
             "useImportType": "error",
             "noDefaultExport": "error"
           },
           "correctness": { "noUnusedImports": "error" }
         }
       },
       "assist": { "actions": { "source": { "organizeImports": "on" } } },
       "overrides": [
         {
           "include": [
             "app/**/page.tsx",
             "app/**/layout.tsx",
             "app/**/error.tsx",
             "app/**/not-found.tsx",
             "app/**/loading.tsx",
             "app/**/route.ts",
             "next.config.ts",
             "components/ui/**",
             "**/*.stories.tsx"
           ],
           "linter": { "rules": { "style": { "noDefaultExport": "off" } } }
         }
       ]
     }
     ```
   - If Biome's exact rule path names differ in the executing version, adapt; behavior must match the intent above. Escalate if a rule is removed/renamed in a way that changes coverage.

6. **Pin Node:** create `.nvmrc` and `.node-version` both containing `22` (or the current 22.x LTS minor, e.g. `22.11`).

7. **Append `.gitignore` entries:**
   ```
   # Next.js
   .next/
   *.tsbuildinfo
   next-env.d.ts

   # Vercel
   .vercel/

   # Turbo
   .turbo/

   # Tests
   coverage/
   playwright-report/
   test-results/

   # Generated Supabase types
   lib/supabase/types.ts

   # Local env overrides
   .env*.local
   ```
   Do not remove or reorder existing entries.

8. **`app/globals.css`:**
   ```css
   @import "tailwindcss";

   /* THEME_TOKENS — owned by Slice B */
   ```

9. **`app/layout.tsx`** — minimal RSC layout that imports `Toaster` from `@/components/ui/sonner` and renders it inside `<body>`:
   ```tsx
   import type { Metadata } from "next";
   import { Toaster } from "@/components/ui/sonner";
   import "./globals.css";

   export const metadata: Metadata = {
     title: "Donezo",
     description: "Project and task management.",
   };

   export default function RootLayout({ children }: { children: React.ReactNode }) {
     return (
       <html lang="en" suppressHydrationWarning>
         <body className="bg-bg text-fg antialiased">
           {children}
           <Toaster />
         </body>
       </html>
     );
   }
   ```
   The `Toaster` import resolves once Slice B lands. Lint may warn during this slice; that is acceptable and expected.

10. **`app/page.tsx`, `app/error.tsx`, `app/not-found.tsx`:** minimal placeholders. Slice F will replace `page.tsx`, `error.tsx`, `not-found.tsx` with the real health-check + error-boundary content.

### Definition of done

- `pnpm install` succeeds, lockfile committed.
- `pnpm dev` starts on `:3000`, page renders without runtime errors. Toaster import warning is acceptable until Slice B.
- `pnpm typecheck` green.
- `pnpm lint` green (or warns only on the missing `Toaster` import — escalate if it errors and blocks merge).
- `pnpm build` green (Next.js will fail if Toaster import is missing — if so, escalate; we'll likely need to make Slice B run inside the same commit as A to keep build green, or have Slice A use a temporary placeholder Toaster).
- `tsconfig.json` matches the epic doc byte-for-byte.
- Biome flags `console.log`, `any`-default-export outside allowlisted paths, and unused imports.
- All legacy `.gitignore` entries intact; new entries appended.

**Build-green caveat:** if the missing `Toaster` import breaks `pnpm build` at end of Slice A, the executor should **temporarily** stub `app/layout.tsx` without `Toaster` (just `{children}` in `<body>`) and add a TODO comment `// TODO Slice B: mount <Toaster />`. Slice B then performs the layout edit. Document the decision in the slice's done report. Either approach is acceptable; pick whichever keeps both slices green.

### Escalation triggers

- `pnpm create next-app` flags drifted from spec.
- Biome rule renames in current major.
- `verbatimModuleSyntax: true` + Next.js generated server components combo errors on `next build`.
- Tailwind v4 `bg-bg`/`text-fg` token classes don't resolve at all (Slice B may need to adjust naming).

---

## Slice B — Tailwind v4 design tokens + shadcn init + minimal component install

**Owner:** epic-executor (sonnet) · **Stage:** 2, position 1 · **Branch:** commit on `epic/01-foundation` after A merges

### Scope

- `/app/globals.css` — only the lines after Slice A's marker (`/* THEME_TOKENS — owned by Slice B */`). Marker comment retained.
- `/components.json`
- `/components/ui/**` — everything shadcn writes during init + component installs.
- `/lib/utils.ts` — the `cn` helper shadcn writes.
- `/package.json` — additive only: shadcn-installed Radix packages, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`. Do not modify `scripts`, `packageManager`, `engines`, or any other field.
- `/pnpm-lock.yaml` — regenerated as a side effect.
- `/app/layout.tsx` — only if Slice A used the temporary stub workaround; Slice B then mounts `<Toaster />` per the contract in the layout file. If Slice A already mounted Toaster (post-Slice-B-build path), Slice B does not touch `layout.tsx`.

### Forbidden scope

`tsconfig.json`, `next.config.ts`, `biome.json`, `.gitignore`, `app/page.tsx`, `app/error.tsx`, `app/not-found.tsx`, anything under `lib/` other than `lib/utils.ts`, `.github/`, `supabase/`, legacy.

### Dependencies on other slices

**Depends on Slice A** (must run after A merges to epic branch).

### Spec

1. Insert the `@theme` block from `01-foundation.md` lines 78–97 verbatim into `app/globals.css` immediately after the marker comment. Keep the marker.

2. Run shadcn init non-interactively:
   ```
   pnpm dlx shadcn@latest init --yes --base-color neutral --css-variables --rsc
   ```
   Accept the default style. Aliases: `@/components`, `@/components/ui`, `@/lib/utils`. If init wants to overwrite `app/globals.css`, decline and merge by hand — preserve the `@theme` block.

3. Install minimal component set:
   ```
   pnpm dlx shadcn@latest add button sonner
   ```

4. Verify `lib/utils.ts` exports `cn`. Verify `components/ui/button.tsx` and `components/ui/sonner.tsx` exist.

5. If Slice A used the temporary Toaster-less layout: edit `app/layout.tsx` to import `Toaster` from `@/components/ui/sonner` and render it inside `<body>` after `{children}`. Remove the `// TODO Slice B` comment.

6. Verify the design tokens work: temporarily add `<div className="bg-bg text-fg border-border">test</div>` to `app/page.tsx`, run `pnpm build` and `pnpm dev`, confirm tokens resolve to the expected colors. **Do not commit the temp test** — verify locally and revert before completing the slice.

### Definition of done

- `components.json` exists with the documented aliases.
- `lib/utils.ts` exports `cn`.
- `components/ui/button.tsx` and `components/ui/sonner.tsx` exist.
- `app/globals.css` has the `@theme` block.
- `app/layout.tsx` mounts `<Toaster />`.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` all green.
- Tailwind tokens (`bg-bg`, `text-fg`, `border-border`) resolve correctly.

### Escalation triggers

- shadcn CLI prompts for inputs the script can't answer.
- Tailwind v4 token class names don't resolve as expected (likely a `--color-*` naming issue in `@theme`).
- Biome's `style.useImportType` conflicts with shadcn-generated code that `pnpm lint:fix` can't fix.

---

## Slice C — env validator + logger + server-action helper stub

**Owner:** epic-executor (sonnet) · **Stage:** 2, position 2 · **Branch:** commit on `epic/01-foundation` after B merges

### Scope

- `/lib/env.ts`
- `/lib/logger.ts`
- `/lib/actions/with-user.ts`
- `/lib/actions/index.ts`
- `/.env.example`
- `/tests/unit/env.test.ts`
- `/tests/unit/with-user.test.ts`
- `/package.json` — additive only: `zod`, `pino`, dev-dep `pino-pretty`.
- `/pnpm-lock.yaml` — regenerated.

### Forbidden scope

All paths owned by A, B, D, E, F. No edits to `app/*`, `components/*`, `next.config.ts`, `tsconfig.json`, `biome.json`, `.github/*`, `supabase/*`, legacy.

### Dependencies on other slices

Depends on Slice A (`package.json`, `tsconfig.json`, lockfile must exist) and B (lockfile must be settled — running C in parallel with B causes lock contention). Sequence: A → B → C.

### Spec

1. **`lib/env.ts`** — Zod schema based on `01-foundation.md` lines 142–154. For epic 01, only `NODE_ENV` is required:
   ```ts
   import { z } from "zod";

   const EnvSchema = z.object({
     NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
     NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
     NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
     SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
     RESEND_API_KEY: z.string().min(1).optional(),
     SENTRY_DSN: z.string().url().optional(),
   });

   const parsed = EnvSchema.safeParse(process.env);
   if (!parsed.success) {
     // Cannot use logger here — circular dep. Fall back to console.error with a one-time exemption.
     // biome-ignore lint/suspicious/noConsoleLog: bootstrap-time, before logger is available
     console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
     throw new Error("Invalid environment variables");
   }

   export const env = parsed.data;
   export type Env = z.infer<typeof EnvSchema>;
   ```

2. **`lib/logger.ts`** — server-only Pino logger:
   ```ts
   import pino from "pino";
   import { env } from "./env";

   if (typeof window !== "undefined") {
     throw new Error("logger imported in client code; use a client-side logger instead");
   }

   export const logger = pino(
     env.NODE_ENV === "production"
       ? { level: "info" }
       : { transport: { target: "pino-pretty", options: { colorize: true } } },
   );
   ```

3. **`lib/actions/with-user.ts`** — wrapper per Q15 contract:
   ```ts
   import { logger } from "@/lib/logger";

   export type ActionResult<T> =
     | { ok: true; data: T }
     | { ok: false; error: { code: string; message: string; field?: string } };

   const SYNTHETIC_USER = {
     id: "00000000-0000-0000-0000-000000000000",
     email: "dev@donezo.local",
   };

   export function withUser<I, O>(
     handler: (
       ctx: { user: { id: string; email: string } },
       input: I,
     ) => Promise<ActionResult<O>>,
   ): (input: I) => Promise<ActionResult<O>> {
     return async (input: I) => {
       const start = performance.now();
       const action = handler.name || "anonymous";
       try {
         const result = await handler({ user: SYNTHETIC_USER }, input);
         logger.info({ action, durationMs: performance.now() - start }, "action complete");
         return result;
       } catch (err) {
         logger.error({ err, action }, "action threw");
         return { ok: false, error: { code: "INTERNAL", message: "Unexpected error" } };
       }
     };
   }
   ```
   **Critical TODO comment** at the top of the file: `// TODO epic 03: replace SYNTHETIC_USER with real Supabase auth user. The all-zeros uuid will collide with gen_random_uuid() inserts.`

4. **`lib/actions/index.ts`** — barrel:
   ```ts
   export { withUser, type ActionResult } from "./with-user";
   ```

5. **`.env.example`** — at project root:
   ```
   # Required
   NODE_ENV=development

   # Wired in epic 02 (Supabase schema)
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=

   # Wired in epic 13 (notifications / email)
   RESEND_API_KEY=

   # Wired in epic 15 (observability)
   SENTRY_DSN=
   ```

6. **Tests** (Vitest format; not yet run by CI — sit until epic 15 wires the runner):
   - `tests/unit/env.test.ts`: stub `process.env`, assert schema accepts a minimal valid env, rejects when `NODE_ENV` invalid. Skip if it requires Vitest itself to be installed; write the test file regardless so epic 15 can pick it up.
   - `tests/unit/with-user.test.ts`: assert synthetic user returned in handler ctx; assert thrown handler maps to `ok: false` with code `INTERNAL`.

7. **Install deps:** `pnpm add zod pino && pnpm add -D pino-pretty`.

### Definition of done

- All four `lib/` files exist with the exact contracts above.
- `pnpm typecheck` green. `pnpm lint` green (the `console.error` in `env.ts` requires the inline `biome-ignore` comment to pass).
- `.env.example` is the **only** env file in git: `git ls-files | grep -E "^\.env"` returns only `.env.example`.
- Test files are valid TypeScript and would pass under Vitest (manual sanity check).

### Escalation triggers

- `verbatimModuleSyntax: true` requires `import type` for Zod-inferred types and Pino's `Logger` type — likely just a `lint:fix`. If `lint:fix` doesn't resolve, escalate.
- Vitest types (`describe`, `it`, `expect`) not available because vitest isn't installed → write tests with TypeScript-safe fallbacks (e.g. `// @ts-expect-error vitest types added in epic 15`) and escalate if the lint refuses.

---

## Slice D — repo skeleton (.gitkeep folders)

**Owner:** epic-executor (sonnet) · **Stage:** 2, parallel-safe · **Branch:** commit on `epic/01-foundation` anytime after A

### Scope

`.gitkeep` files at every directory listed in `00-overview.md` § Repository layout, except those that have or will have other content from other slices in this epic:

```
app/(auth)/sign-in/.gitkeep
app/(auth)/sign-up/.gitkeep
app/(auth)/callback/.gitkeep
app/(app)/w/[workspaceSlug]/settings/.gitkeep
app/(app)/w/[workspaceSlug]/b/[boardId]/table/.gitkeep
app/(app)/w/[workspaceSlug]/b/[boardId]/kanban/.gitkeep
app/(app)/w/[workspaceSlug]/b/[boardId]/calendar/.gitkeep
app/(app)/w/[workspaceSlug]/b/[boardId]/timeline/.gitkeep
app/(app)/w/[workspaceSlug]/b/[boardId]/dashboard/.gitkeep
app/(app)/w/[workspaceSlug]/b/[boardId]/t/[taskId]/.gitkeep
app/(app)/w/[workspaceSlug]/b/[boardId]/settings/.gitkeep
app/api/webhooks/.gitkeep
components/board/table/.gitkeep
components/board/kanban/.gitkeep
components/board/calendar/.gitkeep
components/board/timeline/.gitkeep
components/board/dashboard/.gitkeep
components/cells/text/.gitkeep
components/cells/status/.gitkeep
components/cells/person/.gitkeep
components/cells/date/.gitkeep
components/comments/.gitkeep
components/activity/.gitkeep
components/filters/.gitkeep
components/shared/.gitkeep
lib/supabase/.gitkeep
lib/auth/.gitkeep
lib/authorization/.gitkeep
lib/realtime/.gitkeep
lib/cells/.gitkeep
lib/validations/.gitkeep
hooks/.gitkeep
stores/.gitkeep
emails/.gitkeep
tests/e2e/.gitkeep
tests/policies/.gitkeep
```

**Skip if directory is non-empty at execution time:**
- `components/ui/` — Slice B populates.
- `lib/utils/` — there is **no** `lib/utils/` directory; `lib/utils.ts` (file) from Slice B is the canonical home for utility helpers. Researcher flagged ambiguity in the layout doc; resolution: `lib/utils.ts` only. Do not create `lib/utils/.gitkeep`.
- `tests/unit/` — Slice C populates.

### Forbidden scope

Anything other than `.gitkeep` files. No `package.json` edits, no config changes.

### Dependencies on other slices

Runs in parallel with stage 2 (B/C/E) since file scopes are disjoint with all of them.

### Spec

For each path in the list above:
1. `mkdir -p` the directory.
2. If `find <dir> -type f | grep -q .` is empty, `touch <dir>/.gitkeep`.
3. Otherwise skip (something else owns content there).

Single commit: `chore: scaffold repository directory layout`.

### Definition of done

- Every directory in the list exists in the tree.
- `git ls-files | grep .gitkeep` returns the expected count.
- No directory that another slice populates has a `.gitkeep` left behind (those should be removed when real content lands; not Slice D's job, but Slice D must not create them where content already exists).

### Escalation triggers

- Discovery of additional layout-doc directories not listed here.
- Conflict with a directory another slice has already populated.

---

## Slice E — GitHub Actions CI + CONTRIBUTING.md

**Owner:** epic-executor (sonnet) · **Stage:** 2, position 3 · **Branch:** commit on `epic/01-foundation` after C merges

### Scope

- `/.github/workflows/ci.yml`
- `/CONTRIBUTING.md`

### Forbidden scope

No edits to `package.json` (decision Q12 = bundle analyzer deferred → no `next.config.ts` edits, no analyzer dep). No edits to `next.config.ts`. No legacy.

### Dependencies on other slices

Depends on A (needs `package.json`, lockfile, scripts). Runs after C to keep stage-2 ordering clean even though file scopes are disjoint with C.

### Spec

1. **`.github/workflows/ci.yml`:**
   ```yaml
   name: CI

   on:
     pull_request:
     push:
       branches: [main]

   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true

   jobs:
     lint-typecheck-build:
       name: Lint, typecheck, build
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4

         - name: Enable corepack
           run: corepack enable

         - uses: pnpm/action-setup@v4
           with:
             run_install: false

         - uses: actions/setup-node@v4
           with:
             node-version-file: .nvmrc
             cache: pnpm

         - name: Install
           run: pnpm install --frozen-lockfile

         - name: Lint
           run: pnpm lint

         - name: Typecheck
           run: pnpm typecheck

         - name: Build
           run: pnpm build
           env:
             NEXT_TELEMETRY_DISABLED: "1"
   ```
   Note: pnpm version comes from `package.json#packageManager` via corepack.

2. **`/CONTRIBUTING.md`** — new file. Sections:

   - **Local setup**
     1. `git clone …`
     2. `corepack enable`
     3. `pnpm install`
     4. `cp .env.example .env.local`
     5. `pnpm dev`
   - **Scripts** — table mirroring `package.json` scripts.
   - **Branch naming**
     - Epic work: `epic/<NN>-<kebab>` and `epic/<NN>-<kebab>/<slice-kebab>`.
     - Non-epic: `feat/*`, `fix/*`, `chore/*`.
   - **Commits** — imperative, scope-prefixed when natural. Reference epic number in PR description.
   - **Conventions** — copied from `CLAUDE.md`: pnpm only, RSC-first, Server Actions, TypeScript strict, Tailwind v4 + shadcn, Zod, RLS-as-source-of-truth, uuid v4, `timestamptz`, soft-delete `deleted_at`, no `console.log`.
   - **Storybook** — deferred for now per epic 01 decision Q4. Cell renderers will use Playwright component tests in epic 07 unless Storybook is reconsidered.
   - **Legacy code** — `frontend/` and `backend/` are read-only; no patches, no dependabot fixes, no refactors. They will be deleted at parity. Do not run `pnpm install` from `frontend/` or `backend/` — those use `npm` and have their own lockfiles.
   - **Vercel project setup (manual, one-time, by repo admin)** — bullet-list the steps from `01-foundation.md` § Vercel project setup so a human can execute after epic 01 merges:
     1. `vercel login`
     2. `vercel link` from repo root
     3. Configure build/install commands in Vercel dashboard
     4. Add env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `SENTRY_DSN`) — leave blank for now; epic 02/03/13/15 fill in.
     5. Confirm preview deploy posts on next PR.
   - **Custom domain** — deferred per Q11. Section noted as "TBD; tracked in conversion plan."

### Definition of done

- A test PR triggers CI; the workflow runs install + lint + typecheck + build green.
- `CONTRIBUTING.md` covers local setup, scripts, branch naming, commits, conventions, Storybook decision, legacy notice, Vercel setup checklist.

### Escalation triggers

- `pnpm/action-setup@v4` incompatible with current Node 22 LTS minor.
- `--frozen-lockfile` install fails because B/C lockfile changes need a re-resolve (executor runs `pnpm install` locally and re-commits the lockfile; if it still fails, escalate).

---

## Slice F — health-check page + ping action + error/404 pages

**Owner:** epic-executor (sonnet) · **Stage:** 3 · **Branch:** commit on `epic/01-foundation` after stage 2 merges

### Scope

- `/app/page.tsx` (replace placeholder)
- `/app/_components/ping-button.tsx` (new client component)
- `/app/actions.ts` (new — server actions for the home page)
- `/app/error.tsx` (replace placeholder)
- `/app/not-found.tsx` (replace placeholder)
- `/app/(app)/layout.tsx` (new — pass-through shell)
- `/app/(app)/page.tsx` (new — placeholder)
- `/app/(app)/error.tsx` (new — segment-scoped error boundary)
- `/next.config.ts` — only the SHA capture: read `git rev-parse HEAD` synchronously at config-evaluation time and expose via `env.NEXT_PUBLIC_BUILD_SHA` in `next.config.ts`'s exported config. Wrap in try/catch so a missing `.git` (e.g. Vercel build cache) falls back to `process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown"`.

### Forbidden scope

`lib/`, `components/`, `tsconfig.json`, `biome.json`, `.github/`, `package.json`, `supabase/`, legacy.

### Dependencies on other slices

Depends on A, B, C. Stage 3.

### Spec

1. **`next.config.ts`** — minimal additions:
   ```ts
   import type { NextConfig } from "next";
   import { execSync } from "node:child_process";

   function resolveBuildSha(): string {
     try {
       return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
         .toString()
         .trim();
     } catch {
       return process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown";
     }
   }

   const nextConfig: NextConfig = {
     env: {
       NEXT_PUBLIC_BUILD_SHA: resolveBuildSha(),
     },
   };

   export default nextConfig;
   ```
   Slice A wrote a minimal `next.config.ts` already; Slice F replaces it with the above.

2. **`app/actions.ts`** — server actions colocated with the home page:
   ```ts
   "use server";
   import { withUser, type ActionResult } from "@/lib/actions";

   export const pingAction = withUser(
     async ({ user }): Promise<ActionResult<{ pong: true; userId: string; timestamp: string }>> => {
       return {
         ok: true,
         data: { pong: true, userId: user.id, timestamp: new Date().toISOString() },
       };
     },
   );
   ```

3. **`app/_components/ping-button.tsx`** — `"use client"` component:
   ```tsx
   "use client";
   import { useTransition } from "react";
   import { Button } from "@/components/ui/button";
   import { toast } from "sonner";
   import { pingAction } from "@/app/actions";

   export function PingButton() {
     const [pending, startTransition] = useTransition();
     return (
       <Button
         disabled={pending}
         onClick={() => {
           startTransition(async () => {
             const res = await pingAction(undefined as never);
             if (res.ok) toast.success(`pong @ ${res.data.timestamp}`);
             else toast.error(res.error.message);
           });
         }}
       >
         {pending ? "Pinging…" : "Ping"}
       </Button>
     );
   }
   ```

4. **`app/page.tsx`** — RSC home:
   ```tsx
   import { PingButton } from "./_components/ping-button";

   export default function HomePage() {
     const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? "unknown";
     return (
       <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-6 p-8">
         <h1 className="text-3xl font-semibold">Donezo</h1>
         <p className="text-fg/70">Foundation health-check</p>
         <p className="font-mono text-sm">build: {sha.slice(0, 7)}</p>
         <PingButton />
       </main>
     );
   }
   ```

5. **`app/error.tsx`** — global error boundary (`"use client"`):
   ```tsx
   "use client";
   import { Button } from "@/components/ui/button";

   export default function GlobalError({
     error,
     reset,
   }: {
     error: Error & { digest?: string };
     reset: () => void;
   }) {
     // TODO epic 15: report to Sentry
     // biome-ignore lint/suspicious/noConsoleLog: error boundary fallback before logger wiring
     console.error(error);
     return (
       <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 p-8">
         <h1 className="text-2xl font-semibold">Something went wrong</h1>
         <p className="text-fg/70">{error.message}</p>
         <Button onClick={reset}>Try again</Button>
       </main>
     );
   }
   ```

6. **`app/not-found.tsx`:**
   ```tsx
   import Link from "next/link";

   export default function NotFound() {
     return (
       <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 p-8">
         <h1 className="text-2xl font-semibold">Not found</h1>
         <p className="text-fg/70">The page you’re looking for doesn’t exist.</p>
         <Link href="/" className="underline underline-offset-4">Go home</Link>
       </main>
     );
   }
   ```

7. **`app/(app)/layout.tsx`** — pass-through:
   ```tsx
   export default function AppLayout({ children }: { children: React.ReactNode }) {
     return <>{children}</>;
   }
   ```

8. **`app/(app)/page.tsx`** — placeholder so segment renders:
   ```tsx
   export default function AppHome() {
     return (
       <main className="p-8">
         <p className="text-fg/70">Authed shell placeholder — wired in epic 03.</p>
       </main>
     );
   }
   ```

9. **`app/(app)/error.tsx`** — segment-scoped error boundary, same structure as global but renders the literal string `This area of the app errored` so a future Playwright test can disambiguate.

### Definition of done

- `pnpm dev` shows the home page with title, build SHA (7 chars), and a working ping button that toasts success.
- A thrown error inside the page (manually inserted to test) triggers `app/error.tsx`.
- `/non-existent-route` shows `app/not-found.tsx`.
- `/non-existent` inside `(app)/` segment uses the global `not-found.tsx` (since segment-scoped not-found is not in scope).
- `pnpm build`, `pnpm lint`, `pnpm typecheck` all green.
- Build SHA falls back to `unknown` when `.git` isn't accessible.

### Escalation triggers

- `git rev-parse` not available in the build sandbox AND `VERCEL_GIT_COMMIT_SHA` not set — confirm with reviewer whether `unknown` is acceptable.
- `app/_components/` colocation pattern conflicts with a project preference for `components/shared/` or similar.

---

## Sequential follow-ups

These run on the epic branch after all slices land, before opening the PR.

### F1 — `supabase init`

Single executor runs:
```
pnpm dlx supabase init
```
in repo root. Commits `supabase/config.toml` and any generated `supabase/.gitignore` and `supabase/seed.sql` skeleton. Note: epic 02 owns the actual schema; this just stubs the directory.

If `supabase init` modifies the root `.gitignore`, executor reviews the diff and accepts only entries scoped to `supabase/` outputs.

### F2 — Smoke test

Manual walkthrough (orchestrator runs locally, captures output, attaches to the epic-level review):
- `pnpm install`
- `pnpm dev` — visit `localhost:3000`, click ping, confirm toast.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` all green.
- `git ls-files | grep -E "^\.env"` returns only `.env.example`.
- Push branch; confirm GitHub CI runs and goes green.
- (After PR is opened to `main`) confirm Vercel preview deploy posts and renders the health-check page.

## Risks (carried over from researcher's plan)

- **Lockfile contention** in stage 2 mitigated by serializing B → C → E.
- **Legacy coexistence** — root `.gitignore` append-only; CONTRIBUTING.md explicitly tells contributors not to run `pnpm install` from `frontend/` or `backend/`.
- **`engines.node`** mismatch with legacy `react-scripts` — documented in CONTRIBUTING.md.
- **Tailwind v4 token names** (`bg-bg`, `text-fg`) — Slice B has explicit verification step + escalation trigger.
- **Biome ↔ Next.js compat** — slice specs use lint-fix where possible; escalate on real conflicts rather than disabling rules.
- **`verbatimModuleSyntax: true`** strict — `import type` enforced; `lint:fix` resolves most cases.
- **`withUser` synthetic uuid `00000000-...`** — TODO comment in `lib/actions/with-user.ts`; **epic 03 must replace before any DB write**.
- **No real test runner** in epic 01 — tests in Slice C sit until epic 15. Acceptable per Q8.

## Constraints carried into later epics

- Project root location: **repo root**. Every later epic's "create file at `app/...`" is relative to repo root.
- pnpm workspace deferred — epic 13 (`emails/`) will introduce the workspace file when it lands.
- `lib/env.ts` is the singleton boot validator. Epics 02–04 add their keys to that schema; do not invent new env modules.
- `withUser` contract is the seed for epic 03's auth-aware rewrite.
- `lib/utils.ts` is a file, not a directory.
