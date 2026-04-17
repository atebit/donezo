# Dependencies

Audit of `backend/package.json` and `frontend/package.json`. Highlighting outdated, abandoned, unused, or risky packages.

Versions below are from lockfiles as pinned; "latest" is as of audit date (2026-04).

## Backend — `backend/package.json`

| Package | Installed | Latest | Status | Notes |
|---------|-----------|--------|--------|-------|
| `express` | 4.17.1 | 4.21.x (v5 GA) | ⚠️ Behind | Patch updates include middleware-chain fixes. Safe upgrade within 4.x. |
| `mongodb` | 3.2.7 | 6.x | 🔴 Ancient | Released 2018. `useNewUrlParser`/`useUnifiedTopology` are no-ops now. Upgrading to v5/v6 is breaking (collection API, result shapes). |
| `mongoose` | 8.9.6 | 8.x (current) | 💤 Unused | Declared but never imported anywhere. Either adopt it (recommended — schema validation) or drop it. |
| `socket.io` | 4.2.0 | 4.8.x | ⚠️ Behind | DoS fixes and perf improvements since. Minor version bump. |
| `bcrypt` | 5.0.0 | 5.x current | ✅ Fine | Safe. |
| `cryptr` | 6.0.3 | current | ⚠️ Consider JWT | Works, but lacks authenticated encryption. For sessions, `jsonwebtoken` is the more standard choice. |
| `cookie-parser` | 1.4.6 | current | ✅ Fine | |
| `cors` | 2.8.5 | current | ✅ Fine | |
| `dotenv` | 16.4.7 | current | ✅ Fine | |
| `google-auth-library` | 9.15.1 | 9.x | ✅ Fine | |
| `@react-oauth/google` | 0.8.0 | 0.12.x | ⚠️ Behind | **Also a frontend-intended package pulled into the backend** — not used server-side. Remove from backend deps. |
| `nodemon` (dev) | 3.1.9 | current | ✅ Fine | |

**Missing that should be added**
- `zod` or `joi` — input validation
- `express-rate-limit` — auth throttling
- `helmet` — security headers
- `compression` — gzip
- A logger (pino or winston) to replace the homegrown `logger.service.js`

## Frontend — `frontend/package.json`

| Package | Installed | Latest | Status | Notes |
|---------|-----------|--------|--------|-------|
| `react` | 18.2.0 | 19.x | ⚠️ Behind major | React 19 is out. Upgrading from CRA/18 is non-trivial; see "Build tooling" below. |
| `react-dom` | 18.2.0 | 19.x | ⚠️ Behind major | |
| `react-scripts` | 5.0.1 | — | 🔴 End-of-life | CRA is officially deprecated by the React team. All new apps point to Vite or a framework (Next, Remix/React Router). Keep working but every upgrade is painful. |
| `react-beautiful-dnd` | 13.1.1 | — | 🔴 Abandoned | Maintainer recommends migration. Drop-in fork: `@hello-pangea/dnd`. Larger rewrite: `dnd-kit`. |
| `react-router-dom` | 6.6.1 | 6.x/7.x | ⚠️ Behind | Plenty of 6.x patches since; v7 GA'd. |
| `redux` | 4.2.0 | 5.x | ⚠️ Behind major | Consider migrating to `@reduxjs/toolkit` to drop the boilerplate and get RTK Query for HTTP. |
| `redux-thunk` | 2.4.2 | 3.x | ⚠️ Behind major | Trivial upgrade; RTK includes it. |
| `react-redux` | 8.0.5 | 9.x | ⚠️ Behind major | |
| `axios` | 1.7.9 | 1.13+ | ⚠️ Behind | Has had security patches. |
| `moment` | 2.29.4 | 2.30.x | 💤 Legacy / likely unused | Project already ships `date-fns` and `dayjs`. `moment` is in maintenance mode. Grep confirms light usage; consolidate on `dayjs`. |
| `date-fns` | 2.29.3 | 4.x | ⚠️ Behind major | |
| `dayjs` | 1.11.7 | 1.11.x | ✅ Fine | |
| `lodash` | 4.17.21 | current | ✅ Fine | |
| `@mui/material` | 5.13.3 | 6.x | ⚠️ Behind major | MUI 6 requires emotion 11.12+. Upgrade with care. |
| `@mui/icons-material` | 5.11.16 | 6.x | ⚠️ Behind major | |
| `@mui/x-date-pickers` | 5.0.15 | 7.x | ⚠️ Behind majors | |
| `@emotion/react` | 11.11.0 | 11.x | ✅ Fine | |
| `@emotion/styled` | 11.11.0 | 11.x | ✅ Fine | |
| `@react-oauth/google` | 0.6.1 | 0.12.x | ⚠️ Behind | |
| `gapi-script` | 1.2.0 | — | 💤 Unused? | Google's new ID Token flow uses `@react-oauth/google`. `gapi-script` is from the old API. Grep to confirm and remove. |
| `react-chartjs-2` | 5.2.0 | 5.x | ✅ Fine | |
| `react-datepicker` | 4.8.0 | 7.x | ⚠️ Behind majors | If `@mui/x-date-pickers` also ships, pick one. |
| `react-icons` | 4.7.1 | 5.x | ⚠️ Behind major | |
| `sass` | 1.50.0 | 1.8x | ⚠️ Behind | CRA's sass-loader pins an older version. |
| `socket.io-client` | 4.2.0 | 4.8.x | ⚠️ Behind | Match backend. |
| `uuid` | 11.0.5 | current | ✅ Fine | |
| `@ungap/structured-clone` | 1.3.0 | current | ✅ Fine | `structuredClone` is native in all supported browsers — consider dropping the polyfill. |
| `core-js` | 3.30.1 | 3.x | ✅ Fine | Pulled in by CRA/Babel. |
| `workbox-*` | 6.5.4 | 7.x | ⚠️ Behind major | |
| `web-vitals` | 2.1.4 | 4.x | ⚠️ Behind majors | |
| `@testing-library/*` | v5-era | v14+ for `jest-dom` | ⚠️ Very behind | |

## Build tooling

- CRA (`react-scripts`) is deprecated. Long-term, migrate the frontend to Vite. Practical migration path:
  1. `npm create vite@latest donezo-frontend -- --template react` (or pnpm)
  2. Move `src/` over; switch `REACT_APP_*` env vars to `VITE_*`.
  3. Replace `react-scripts` build with `vite build`; delete CRA service-worker boilerplate or swap for `vite-plugin-pwa`.
- Webpack warnings in `react-scripts` 5 about Node ≥18 are cosmetic but accumulating.

## Suggested dependency cleanup (low-risk wins)

Before any feature work:
- Drop `backend/@react-oauth/google` — wrong tree.
- Drop `mongoose` OR migrate to it (don't keep both).
- Drop `frontend/moment` if unused after grep.
- Drop `frontend/gapi-script` once confirmed unused.
- Drop `frontend/@ungap/structured-clone` (native everywhere).
- Run `npm audit fix` in both trees and record the delta.
- Migrate `react-beautiful-dnd` → `@hello-pangea/dnd` (one-line import change, API is identical).
- Upgrade `socket.io` + `socket.io-client` to matching recent 4.x.

These are mechanical and meaningfully reduce bundle size and attack surface.

## Higher-effort upgrades

- MongoDB driver 3.2.7 → 6.x (or adopt Mongoose schemas). This touches `db.service.js` and every call site. Pair with the input-validation work.
- CRA → Vite. Pair with React 18 → 19 migration.
- Redux → RTK (+ RTK Query) to collapse `http.service.js` + thunks + cache.
- MUI 5 → MUI 6.

## What `npm audit` will likely say

Run `npm audit` in both trees to get concrete CVE counts. Given the pinned versions above, expect moderate-to-high CVE counts primarily from `react-scripts` transitive deps and the aged MongoDB driver. Most will be noise; the mongo driver and axios are the two worth acting on immediately.
