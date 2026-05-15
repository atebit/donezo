# Epic 01 — Followup Round 1

**Status:** approved, ready to dispatch
**Triggered by:** Stage 2 review pass (Slices B, C, D, E)
**Reviewer verdict:** FOLLOWUP REQUIRED
**Branch:** `epic/01-foundation` (continue on existing branch)

## Decisions made by user (locked)

| # | Question | Decision |
|---|---|---|
| 1 | Token-system collision in `app/globals.css` (spec `@theme` vs shadcn's `@theme inline`) | **Defer reconciliation to epic 14.** Document the seam with a comment block (Slice H). |
| 2 | Base UI vs Radix as the canonical primitive library | **Base UI.** `CLAUDE.md` updated to record `@base-ui/react` as the canonical primitive layer. shadcn's `base-nova` style stays. No rewind of Slice B. |
| 3 | Process precedent — Slice B edited `biome.json` (forbidden scope) without escalating | **Tighten the executor rule.** `.claude/agents/epic-executor.md` updated with a hard-stop rule: forbidden-scope edits must escalate first, not be made and reported after. |

## Issues being addressed

From the Stage 2 review:

- **Issue 1 (real bug):** `package.json` lists `shadcn@^4.7.0` under `dependencies` instead of `devDependencies`. The CLI tool ships ~50MB+ of MCP server runtime, babel, dotenvx, etc., to production unnecessarily. Slice G fixes.
- **Issue 8 (real bug):** `tests/unit/env.test.ts` uses dynamic `await import("../../lib/env")` to re-evaluate the module after `process.env` mutation, but lacks `vi.resetModules()` in `beforeEach`. Once vitest lands in epic 15, tests would silently pass for the wrong reason. Slice G fixes.
- **Issues 2 + 5 (deferred):** Theme/token system coexistence + missing `<ThemeProvider>` defer to epic 14, but need explicit seam documentation so nobody assumes the spec radii are live or that `useTheme()` returns a real value. Slice H adds the documentation comments.

## Issues acknowledged but not fixed in this round

- **Issue 4:** Base UI is now canonical. `CLAUDE.md` updated separately (commit on epic branch alongside this spec).
- **Issue 6:** Geist font added by shadcn init in `app/layout.tsx` is benign; no action.
- **Issue 7:** Process tightening applied to `.claude/agents/epic-executor.md` (commit on epic branch alongside this spec).
- **Issue 9, 10:** `tsconfig.json` extra fields and `pnpm test` referencing missing vitest — Slice A scope, already accepted in Stage 1 review.

## Slices

Both slices have **disjoint file scope** and may be dispatched in parallel.

---

## Slice G — shadcn devDeps reclassification + env-test resetModules

**Owner:** epic-executor (sonnet) · **Branch:** commit on `epic/01-foundation`

### Scope (files this slice may touch)

- `/package.json` — move the `shadcn` entry from `dependencies` to `devDependencies`. Touch nothing else in the file.
- `/pnpm-lock.yaml` — regenerated as a side effect of `pnpm install` after the package.json edit. The diff in the lockfile must be limited to moving `shadcn` between the root importer's `dependencies` and `devDependencies` sections.
- `/tests/unit/env.test.ts` — add `vi` to the existing vitest import line; add `vi.resetModules()` as the first statement of `beforeEach`; update the inline NOTE comment.

### Forbidden scope

Everything else. **Hard rule per `.claude/agents/epic-executor.md`:** if you discover a need to edit any file outside this list, stop and return a needs-direction report. Do not touch `app/`, `components/`, `lib/`, `biome.json`, `tsconfig.json`, `next.config.ts`, `.github/`, `CONTRIBUTING.md`, `.env.example`, `supabase/`, legacy `frontend/`/`backend/`, `docs/`, `CLAUDE.md`, `README.md`, `.claude/`. **Do not** modify the `@import "shadcn/tailwind.css"` line in `app/globals.css` — `shadcn/tailwind.css` is consumed via the package's `exports` field, which works at build time regardless of dep classification.

### Dependencies on other slices

None. Independent of Slice H; can run in parallel.

### Spec

1. **Edit `package.json`:**
   - Remove `"shadcn": "^4.7.0"` from `dependencies`.
   - Add `"shadcn": "^4.7.0"` to `devDependencies` with the same caret-range/specifier exactly.
   - All other fields untouched.

2. **Run `pnpm install`** to regenerate the lockfile. Inspect the diff with `git diff pnpm-lock.yaml | head -200` and confirm the changes only move `shadcn` between the root importer's `dependencies` and `devDependencies` sections. If anything else churns, **stop and escalate** before committing — don't paper over an unexpected lockfile delta.

3. **Verify `pnpm install --frozen-lockfile`** succeeds after the regenerated lockfile is committed. (Same command CI runs.)

4. **Verify `pnpm build`** still succeeds — `globals.css`'s `@import "shadcn/tailwind.css"` should still resolve. `devDependencies` are present at build time on both local and Vercel (Vercel installs all deps including `devDependencies` during build).

5. **Edit `tests/unit/env.test.ts`:**
   - Update the vitest import line to add `vi`:
     ```ts
     // @ts-expect-error vitest is wired in epic 15
     import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
     ```
   - In the `beforeEach` block, add `vi.resetModules();` as the first statement (synchronous; the function returns void). The body becomes:
     ```ts
     beforeEach(() => {
       vi.resetModules();
       process.env = { ...originalEnv };
     });
     ```
   - Replace the inline `// NOTE` paragraph that explained the missing `resetModules` with a single line: `// vi.resetModules() ensures each dynamic import re-evaluates lib/env with the current process.env.`

6. **Verify `pnpm typecheck` and `pnpm lint` are still green.** The `// @ts-expect-error` suppression pattern is unchanged. If `vi` triggers an unused-import lint error (because vitest isn't installed and the runner can't see the call site), add `// biome-ignore lint/correctness/noUnusedImports: vitest wired in epic 15` only as a last resort.

### Definition of done

- `package.json` lists `shadcn` only in `devDependencies` (verified by `grep -A2 -B2 '"shadcn"' package.json`).
- `pnpm install --frozen-lockfile` succeeds.
- `pnpm build`, `pnpm typecheck`, `pnpm lint` all green.
- `tests/unit/env.test.ts` imports `vi` and calls `vi.resetModules()` first in `beforeEach`.
- No files modified outside the scope list.

### Escalation triggers

- `pnpm install` produces lockfile churn beyond the `shadcn` reclassification.
- `pnpm build` fails with `Cannot resolve "shadcn/tailwind.css"` after the dep move. (Should not happen, but if it does, escalate; the fallback is to inline the ~1669 bytes of CSS into `globals.css` and drop both the import and the dep — that's an architectural change requiring approval, not a unilateral fix.)
- Any unexpected lint or typecheck failure not covered by the spec workarounds.

### Commits

Logical commits, e.g.:
- `chore: move shadcn to devDependencies`
- `test: add vi.resetModules to env test beforeEach`

Or one combined commit if cleaner. No amend, no force-push.

---

## Slice H — Theme-collision and ThemeProvider seam comments

**Owner:** epic-executor (sonnet) · **Branch:** commit on `epic/01-foundation`

### Scope (files this slice may touch)

- `/app/globals.css` — add a clarifying comment block at the seam between the spec `@theme` block and shadcn's generated `@theme inline` block. Do not modify any CSS values.
- `/components/ui/sonner.tsx` — add a single-line `// TODO epic 14` comment near the `useTheme()` call. Do not modify any logic.

### Forbidden scope

Everything else. **Hard rule per `.claude/agents/epic-executor.md`:** if you discover a need to edit any file outside this list, stop and return a needs-direction report. Do not touch `package.json`, `pnpm-lock.yaml`, `lib/`, `app/layout.tsx`, `app/page.tsx`, `app/error.tsx`, `app/not-found.tsx`, `biome.json`, `tsconfig.json`, `next.config.ts`, `.github/`, `CONTRIBUTING.md`, `.env.example`, `supabase/`, legacy, `docs/`, `CLAUDE.md`, `README.md`, `.claude/`.

### Dependencies on other slices

None. Parallel-safe with Slice G.

### Spec

1. **Edit `app/globals.css`:** locate the line `@theme inline {` (shadcn's generated block, around line 29). Immediately **before** that line, insert the following comment block (do not modify any CSS values; do not move the existing `/* THEME_TOKENS — owned by Slice B */` marker):

   ```css
   /*
    * SHADCN_THEME_BLOCK — generated by shadcn init.
    * Coexists with the spec @theme block above. The two systems share variable
    * names (--color-border, --radius-sm/md/lg) and shadcn's values currently
    * shadow ours. Reconciliation is owned by epic 14 (mobile/a11y/polish), which
    * also wires next-themes and dark mode. Do NOT delete this block in earlier
    * epics — components in components/ui/ depend on the variables it defines.
    */
   ```

2. **Edit `components/ui/sonner.tsx`:** locate the `const { theme } = useTheme();` line (shadcn-generated). Immediately **before** that line, insert one comment line:

   ```tsx
   // TODO epic 14: wire ThemeProvider so useTheme returns a real value (currently falls back to "system").
   ```

3. **Verify `pnpm lint`, `pnpm typecheck`, `pnpm build`** are all still green. (Comments are inert; should be no behavioral change.)

### Definition of done

- The CSS comment block exists immediately before shadcn's `@theme inline {` in `app/globals.css`.
- The TODO comment exists immediately before `const { theme } = useTheme();` in `components/ui/sonner.tsx`.
- No CSS values changed; no JS logic changed.
- `pnpm build`, `pnpm lint`, `pnpm typecheck` all green.

### Escalation triggers

- The exact `useTheme()` line shape differs from what the spec assumes — if so, place the comment in the most semantically equivalent location and document the deviation.
- Anything else that would require touching files outside this slice's scope.

### Commits

Single commit recommended: `docs: add seam comments for deferred theme reconciliation`.

---

## Out of scope for this followup round

- Reconciling the two `@theme` blocks (deferred to epic 14).
- Mounting `<ThemeProvider>` (deferred to epic 14).
- Cleaning up `public/` SVG assets and default favicon (defer to cleanup commit at parity).
- Removing `next-themes` from runtime deps (used by `sonner.tsx` at runtime — must stay in `dependencies`).
- Inlining `shadcn/tailwind.css` into `globals.css` (only if Slice G escalates because the dev-deps move broke build).

## After this round

When both slices return done and the next review pass returns CLEAN, Stage 2 closes. Stage 3 (Slice F — health-check page + ping action + error/404) can be dispatched.
