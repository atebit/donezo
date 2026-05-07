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

**Tokens are not "initial — expand as needed."** The full token set is locked in [`design-system.md`](design-system.md), sourced verbatim from the legacy `frontend/` SCSS (see CLAUDE.md). The `@theme` block in `app/globals.css` MUST be the canonical block from [design-system.md §1.2](design-system.md#12-appglobalscss-block-canonical) — Monday-derived blue/navy/yellow/green palette plus brand-violet marketing gradients, plus the bake-out of SCSS `darken()` calls. Do not invent tokens or use a generic "neutral" palette.

Fonts: load **Figtree** (body) and **Poppins** (display) via `next/font/google` per [design-system.md §2.1.1](design-system.md#211-loader-nextjs-in-applayouttsx). Replace the SCSS `Figtree-Regular.ttf` / `Poppins-Regular.ttf` shipped in legacy with the variable subsets; do not use the legacy single-weight TTFs.

Scrollbar styles, overlay color, z-index layers, motion duration tokens, and radii are also locked in [design-system.md](design-system.md). Lift them all into `globals.css` in this epic.

Dark mode via `next-themes` ([14](14-mobile-a11y-polish.md)) — tokens get `[data-theme="dark"]` overrides later. Avoid hex literals in components; reference tokens.

### shadcn install set (initial)

`button`, `input`, `textarea`, `label`, `select`, `dropdown-menu`, `popover`, `dialog`, `sheet`, `tooltip`, `command`, `avatar`, `badge`, `separator`, `skeleton`, `toast` (sonner), `tabs`, `scroll-area`, `checkbox`, `switch`, `form` (RHF wrapper). Install on demand, not all at once.

Each shadcn primitive lands **already wired to the locked tokens**. The default `button.tsx` shipped by shadcn uses generic `bg-primary` etc. — we keep those class names, but the `--color-primary` value is the Monday `#0073ea`. Re-skin none, restyle none unless [`component-system.md`](component-system.md) calls for a deviation.

### Icon library

Single source: **Lucide React** (`lucide-react`). Establish `lib/icons.ts` re-exporting the named subset we use, with the legacy `react-icons` mapping documented in [design-system.md §9.2](design-system.md#92-mapping-table). No imports from `@mui/icons-material` or `react-icons` in new code.

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

## Visual fidelity requirements

This epic owns the design-system foundation. Every token, font, scrollbar style, overlay color, z-index, and icon library that downstream epics will reference must land here. Source: [`design-system.md`](design-system.md), [`component-system.md`](component-system.md).

Must-match items (any drift breaks every later epic):

- The **canonical `@theme` block** from [design-system.md §1.2](design-system.md#12-appglobalscss-block-canonical), including Monday primary `#0073ea`, sidebar navy `#292f4c`, label palette (`#00c875`, `#ffcb00`, `#579bfc`, `#c4c4c4`, `#FDAB3D`, `#E2445C`, `#A25DDC`, `#333333`), 12-color group accents, and brand-violet marketing gradients (`#5034FF → #B4B4FF`).
- **Figtree** body + **Poppins** display via `next/font/google`, weights 400/500/600/700.
- Custom **scrollbar** styles per [design-system.md §10](design-system.md#10-scrollbar) (8px, `#A6A5A5` thumb on `#D9D9D9` track).
- **z-index layer** custom properties (`--z-base/sticky/rail/board-header/overlay/modal/drawer/popover`) per [§7](design-system.md#7-z-index-layers).
- **Motion duration** tokens (`--motion-instant/fast/base/medium/slow/drawer`) per [§8.1](design-system.md#81-duration-tokens).
- **Lucide React** wired in `lib/icons.ts`. No `@mui/*` or `react-icons` imports anywhere in the repo.
- **`<MenuList />` primitive** matching the legacy `@mixin menu-modal` recipe — see [component-system.md §3.2](component-system.md#32-menumodal-recipe-mixin).
- **`<Logo />`** matching [component-system.md §6.2](component-system.md#62-logo) (PNG fallback acceptable; SVG preferred).

If the executor wants to swap a hex/value for a different one, they must escalate via `epic-researcher` — these are not negotiable in slice work.

## Tasks

1. **Initialize Next.js project.** `pnpm create next-app@latest` with TypeScript, Tailwind, App Router, Biome (or eslint→biome migration). Confirm Node 22 with `.nvmrc`.
2. **Configure TypeScript strict.** Replace generated `tsconfig.json` with the strict version from this doc.
3. **Set up Tailwind v4 design tokens.** Replace generated `globals.css` with the canonical `@theme` block from [design-system.md §1.2](design-system.md#12-appglobalscss-block-canonical). Add the scrollbar styles from §10. Verify `bg-surface`, `text-fg`, `bg-primary`, `bg-surface-nav` etc. classes work.
4. **Initialize shadcn/ui.** `pnpm dlx shadcn@latest init`. Install the initial component set listed above. Verify the default `<Button variant="default">` renders with `--color-primary` (`#0073ea`).
5. **Configure Biome.** Single `biome.json`. Add the rules listed above. Wire to `lint` script.
6. **Add environment validator.** `lib/env.ts` per spec. Add `.env.example` with stubbed `NEXT_PUBLIC_SUPABASE_URL` etc. — values land in [02](02-supabase-schema.md).
7. **Scaffold repository structure.** Create the empty folder layout from [`00-overview.md`](00-overview.md). `.gitkeep` files in empty folders.
7a. **Wire fonts.** Add `next/font/google` loaders for Figtree (body) and Poppins (display) per [design-system.md §2.1.1](design-system.md#211-loader-nextjs-in-applayouttsx). Apply `--font-display` to `h1`–`h6` in `globals.css`.
7b. **Add icon module.** `pnpm add lucide-react`. Create `lib/icons.ts` re-exporting the names from [design-system.md §9.2](design-system.md#92-mapping-table). Forbid raw `lucide-react` imports outside this module via Biome rule.
7c. **Add `<MenuList />` primitive.** Implement the `@mixin menu-modal` recipe from [component-system.md §3.2](component-system.md#32-menumodal-recipe-mixin) as `components/ui/menu-list.tsx`. Used by every dropdown across the app.
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
