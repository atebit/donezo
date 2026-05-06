# Epic 01 — Project Foundation & Deploy Pipeline

## Goal

Stand up an empty, type-safe, deployable Next.js application connected to Vercel with preview deploys, design tokens, component library, and a working local dev loop. Nothing functional yet — just the substrate that every other epic builds on.

## Why this is its own epic

Every later epic assumes Tailwind + shadcn, generated types, server actions, env management, and Vercel preview deploys exist. Trying to set these up alongside features causes churn and inconsistency. This epic is the only one that creates the project; subsequent ones add to it.

## In scope

- New Next.js 15 project with App Router and TypeScript strict mode.
- Tailwind v4 + shadcn/ui initialized with project design tokens.
- Linting, formatting, type-checking scripts.
- Environment variable strategy and `.env.example`.
- Vercel project linked, preview deploys working from a placeholder home page.
- Repository structure matching [`00-overview.md`](00-overview.md).
- pnpm workspace (single package; no monorepo) and Node version pinning.
- Basic error boundary and 404/500 pages.
- Storybook (optional but recommended — see open questions).

## Out of scope

- Supabase setup ([02](02-supabase-schema.md)).
- Auth ([03](03-auth.md)).
- Any feature work.

## Dependencies

None. This is the first epic.

## Architecture & design choices

### Why Next.js 15 App Router

The legacy app is CRA + Express. The legacy frontend has zero benefit from running as a SPA (deep linking is the only "interactive" load), and the backend is mostly thin CRUD. Next.js with RSC + Server Actions collapses both layers:

- Boards render server-side, including the initial board snapshot, eliminating the loading-spinner-on-first-paint problem.
- Server Actions replace the Express REST surface for ~90% of mutations. They run on the same Vercel function, so latency is one hop instead of two, and they share auth/session naturally via cookies.
- Edge middleware handles auth-cookie refresh and protects routes before the function spins up.

We do **not** plan to use React Server Actions for everything. Long-lived subscriptions (Realtime), file uploads (direct-to-Supabase-Storage signed URLs), and webhooks remain client-driven or use route handlers. See [08](08-realtime-presence.md) and [10](10-attachments.md).

### TypeScript strict, no escape hatches

`tsconfig.json` ships with:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  }
}
```

`any` is banned via lint rule. `unknown` is acceptable at boundaries.

### Tailwind v4 + shadcn/ui

Tailwind v4 uses CSS-native config (no `tailwind.config.ts` for tokens) — design tokens live in `app/globals.css` under `@theme`. shadcn components are copied into `components/ui/` (not installed as a package), giving us full ownership.

Design tokens (initial set, expand as features need them):

```css
@theme {
  --color-bg: oklch(99% 0 0);
  --color-bg-subtle: oklch(97% 0 0);
  --color-fg: oklch(20% 0 0);
  --color-fg-muted: oklch(45% 0 0);
  --color-border: oklch(92% 0 0);
  --color-primary: oklch(58% 0.2 260);
  --color-primary-fg: oklch(99% 0 0);
  --color-danger: oklch(60% 0.22 25);
  --color-success: oklch(62% 0.18 145);
  --color-warning: oklch(75% 0.16 75);

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;

  --font-sans: 'Inter Variable', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;
}
```

Dark mode via `next-themes` ([14](14-mobile-a11y-polish.md)) — tokens get `[data-theme="dark"]` overrides later. Avoid hex literals in components; reference tokens.

### shadcn install set (initial)

`button`, `input`, `textarea`, `label`, `select`, `dropdown-menu`, `popover`, `dialog`, `sheet`, `tooltip`, `command`, `avatar`, `badge`, `separator`, `skeleton`, `toast` (sonner), `tabs`, `scroll-area`, `checkbox`, `switch`, `form` (RHF wrapper). Install on demand, not all at once.

### Linting & formatting

**Biome** for both lint and format. Single-tool replaces ESLint + Prettier; faster, fewer configs, well-supported in Next.js. `next lint` is being deprecated upstream — Biome is the path forward.

Biome config enforces:
- No `console.log` (use the logger).
- No default exports outside of `app/` and `components/`.
- Import order: builtins, third-party, `@/`, relative.
- Unused imports = error.

### Package manager: pnpm

`packageManager` field in `package.json` pins exact pnpm version. `corepack` enables it without global install.

### Node version pinning

`.nvmrc` and `engines.node` pinned to Node 22 LTS. Matches Vercel's default.

### Repository structure

See [`00-overview.md` § Repository layout](00-overview.md). Create the empty folder structure now (`.gitkeep` files where needed) so subsequent PRs land in the right place.

### Environment variables

Three tiers:

| Tier | Visibility | Naming |
|---|---|---|
| Public | Bundled to client | `NEXT_PUBLIC_*` |
| Server | Server runtime only | bare names |
| Build | Used at build time only | `BUILD_*` |

`.env.example` exists in the repo. `.env.local` is gitignored. Vercel mirrors all values per environment (development / preview / production).

A `lib/env.ts` module validates env at boot using Zod:

```ts
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]),
});

export const env = schema.parse(process.env);
```

Any code that reads env imports `env` — never `process.env` directly. Missing envs throw at boot, not at first use.

For epic 01, the only required envs are `NODE_ENV`. Supabase keys land in [02](02-supabase-schema.md).

### Vercel project setup

- Link the GitHub repo. Production branch: `main`. Preview deploys on all other branches.
- Build command: `pnpm build`. Install command: `pnpm install --frozen-lockfile`. Output: default.
- Region: `iad1` (US East) initially. Multi-region deferred.
- **Edge runtime** for middleware only. Keep Server Actions and pages on Node runtime — Supabase JS works in both, but Node has fewer quirks for file uploads and long requests.
- Comments on PRs from Vercel bot enabled.
- Speed Insights and Web Analytics enabled (free tier; switch to paid in [15](15-observability-testing-cicd.md) if needed).

### Server Actions strategy

- Co-locate actions with the route that calls them: `app/(app)/w/[slug]/b/[boardId]/actions.ts`.
- Every server action accepts `formData` or a typed object validated by Zod.
- Every server action returns a discriminated union: `{ ok: true; data } | { ok: false; error: { code; message; field? } }`. Never throw across the action boundary except for unexpected errors.
- Mutations call `revalidateTag` or `revalidatePath` after success. Never both.
- The auth/authorization wrapper (added in [03](03-auth.md)/[04](04-authorization-rls.md)) goes here as a higher-order helper: `withUser(async (ctx, input) => { ... })`.

For epic 01, scaffold the helper signature even though there's no auth yet — placeholder returns a synthetic user for local dev.

### Error and not-found pages

- `app/error.tsx` — global error boundary. Logs to Sentry once 15 lands.
- `app/not-found.tsx` — 404 page.
- `app/(app)/error.tsx` — segment-scoped boundary for the authed shell so a board error doesn't blow up the sidebar.

### Logging

`lib/logger.ts` exports `logger` from `pino`. In dev, `pino-pretty` formats. In production, JSON to stdout (Vercel ingests). Server-side only — no client logger; Sentry handles client errors.

### Scripts

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

`test`, `test:e2e` are stubs in this epic — wired up in [15](15-observability-testing-cicd.md).

### Storybook (optional)

Recommended for cell renderers ([07](07-column-system.md)). If we install it, do it now in epic 01 so the configuration is in place. Storybook 8 with the Vite builder. If we skip, document the decision.

## Tasks

1. **Initialize Next.js project.** `pnpm create next-app@latest` with TypeScript, Tailwind, App Router, Biome (or eslint→biome migration). Confirm Node 22 with `.nvmrc`.
2. **Configure TypeScript strict.** Replace generated `tsconfig.json` with the strict version from this doc.
3. **Set up Tailwind v4 design tokens.** Replace generated `globals.css` with `@theme` block. Verify `bg-bg`, `text-fg`, etc. classes work.
4. **Initialize shadcn/ui.** `pnpm dlx shadcn@latest init`. Install the initial component set listed above.
5. **Configure Biome.** Single `biome.json`. Add the rules listed above. Wire to `lint` script.
6. **Add environment validator.** `lib/env.ts` per spec. Add `.env.example` with stubbed `NEXT_PUBLIC_SUPABASE_URL` etc. — values land in [02](02-supabase-schema.md).
7. **Scaffold repository structure.** Create the empty folder layout from [`00-overview.md`](00-overview.md). `.gitkeep` files in empty folders.
8. **Create error/404 pages.** Global and segment-scoped error boundaries, 404 page, both styled.
9. **Add logger module.** Pino + pino-pretty in dev. Confirm log output.
10. **Add server-action helper stub.** `lib/actions/with-user.ts` returning a synthetic user. Document the contract.
11. **Add health-check page.** `app/page.tsx` renders "Donezo" + a build SHA + a "ping server action" button that hits a stub action and returns ok. Useful for verifying preview deploys end-to-end.
12. **Wire CI minimal.** GitHub Action: install + lint + typecheck + build on every PR. (Tests come in [15](15-observability-testing-cicd.md).)
13. **Link Vercel project.** Production = `main`, preview = all branches. Add a placeholder env value for `NODE_ENV`. Confirm preview deploy on a branch PR.
14. **Add `CONTRIBUTING.md`** — local setup steps, scripts, conventions, branch naming (`feat/*`, `fix/*`, `chore/*`).
15. **(Optional) Storybook.** If keeping, scaffold with one example story for `Button`. If skipping, note in `CONTRIBUTING.md` that visual review happens via preview deploys.

## Definition of done

- `pnpm dev` runs locally, shows the placeholder page.
- `pnpm lint` and `pnpm typecheck` pass.
- `pnpm build` succeeds.
- A PR merged to a non-main branch produces a Vercel preview URL that loads the placeholder page and the "ping server action" button works.
- `main` deploys to the production URL.
- `.env.example` exists and is the only env file in git.
- New contributors can clone, run `pnpm install && pnpm dev`, and have a working dev loop in under 5 minutes.

## Open questions

- **Storybook yes or no?** Adds maintenance. Cell renderer testing in [07](07-column-system.md) benefits a lot from it, but Playwright component tests cover the same ground.
- **Multi-region deploy?** Defer until we know who's using the app. Latency from a single US region is fine for an internal tool.
- **Custom domain?** Set up `donezo.app` (or whatever the chosen name) on Vercel during this epic, or wait? Recommend setting up early so OAuth redirect URIs ([03](03-auth.md)) point at a stable host.
- **Bundle analyzer?** Add `@next/bundle-analyzer` now or in [15](15-observability-testing-cicd.md)? Cheap to add now.
