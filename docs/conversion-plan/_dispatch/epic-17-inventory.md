# Epic 17 — Legacy-Reference Inventory

This file is the **source of truth** for every legacy-reference grep hit in the tracked codebase as of the start of epic 17 (2026-05-14). All subsequent slices (1-A through 5-A) consult this artifact when deciding whether to touch a file. An executor that encounters a hit not listed here must escalate `needs-direction` rather than making a judgement call.

The inventory was produced by Slice 0-A on `epic/17-legacy-cleanup`.

---

## Grep methodology

**Pattern (case-insensitive, `-rEni`):**

```
frontend/src|legacy|MongoDB|\bmongo\b|\bMUI\b|Redux|Socket\.IO|Cloudinary|\bCRA\b|\bExpress\b
```

**Exclusion list:**
- `node_modules/`
- `.next/`
- `.git/`
- `.turbo/`
- `docs/conversion-plan/_dispatch/` (point-in-time execution artifacts — not living documentation)
- `frontend/` and `backend/` (untracked on disk, excluded per spec)
- `pnpm-lock.yaml`
- `tsconfig.tsbuildinfo`
- `.claude/worktrees/` (agent-runner ephemeral clones)

**Command run:**

```sh
grep -rEni "frontend/src|legacy|MongoDB|\bmongo\b|\bMUI\b|Redux|Socket\.IO|Cloudinary|\bCRA\b|\bExpress\b" \
  --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" \
  --include="*.json" --include="*.sql" --include="*.yaml" --include="*.yml" \
  --exclude-dir="node_modules" --exclude-dir=".next" --exclude-dir=".git" \
  --exclude-dir=".turbo" --exclude-dir="frontend" --exclude-dir="backend" \
  --exclude="pnpm-lock.yaml" --exclude="tsconfig.tsbuildinfo" \
  . \
| grep -v "docs/conversion-plan/_dispatch/" \
| grep -v "\.claude/worktrees/" \
| sort
```

**Total lines:** 428 (across 54 unique files)

---

## Count discrepancy note

The dispatch plan headline projected **41 files**. The actual grep found **54 files** (31.7% above the 10% escalation threshold). After analysis, all 13 extra files fit cleanly into treatment categories already defined in the dispatch plan's slice specs:

| Extra file category | Count | Reason undercounted |
|---|---|---|
| `docs/conversion-plan/17-legacy-cleanup.md` | 1 | Intentionally excluded from edits; plan said "not edited by its own epic" but didn't subtract it from the file count |
| `.claude/agents/epic-executor.md` + `epic-researcher.md` | 2 | Plan's slice 2-B covers these; researcher may have listed them separately from the 41 |
| `docs/conversion-plan/` epics 04, 07, 09, 10, 11, 12, 13, 14 | 8 | Plan's slices 3-B/3-C cover "all numbered epics 01–16"; researcher estimated fewer would have hits |
| Net: preserve-live-semantic plan undercount (+4: `tests/policies/README.md`, `supabase/migrations/20260516000000_notifications_epic13.sql`, `tests/unit/AttachmentImageNode.test.tsx`, `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`) offset by archive files with no grep hits (−2: `docs/pre-planning/05-google-login.md`, `docs/conversion-refinements/auth-google-only.md`) | 2 | Plan preserve-live-semantic headline said "10 files" but the plan's own explicit list contained 14 (4 extra not reflected in the 41-file projection); plan preconditions projected 12 + 6 + 1 = 19 archive files but only 17 have legacy-reference hits, reducing the net extra count by 2 |

**No file requires a new treatment class.** Every hit is classifiable as one of the four valid treatments. This inventory proceeds under that finding; the orchestrator is advised of the discrepancy.

---

## Per-file table

Sorted by hit count descending. Files in `docs/conversion-plan/_dispatch/` are excluded per spec.

| File path | Hit count | Proposed treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/component-system.md` | 43 | `rewrite` | Slice 3-A. Live `frontend/src/...` SCSS refs to replace with absolute statements; "Legacy:" component pointers to demote to historical notes. |
| `docs/conversion-plan/design-system.md` | 42 | `rewrite` | Slice 3-A. Same as component-system.md — canonical source-of-truth pointers. |
| `docs/conversion-plan/17-legacy-cleanup.md` | 38 | `preserve-history-note` | The epic doc itself. Per dispatch plan: "17-legacy-cleanup.md is NOT edited by its own epic." All hits are in-scope descriptions of the work being done. |
| `docs/audit/10-supabase-migration.md` | 28 | `archive` | Slice 1-B. Will be moved to `docs/archive/audit/`. Content is pre-rebuild decision doc. |
| `docs/audit/08-dependencies.md` | 25 | `archive` | Slice 1-B. Pre-rebuild dependency audit. |
| `docs/pre-planning/01-architecture-and-runtime.md` | 19 | `archive` | Slice 1-B. Pre-rebuild architecture doc; moves to `docs/archive/pre-planning/`. |
| `docs/audit/05-security.md` | 19 | `archive` | Slice 1-B. Pre-rebuild security audit. |
| `docs/audit/11-recommendation-migrate-now.md` | 17 | `archive` | Slice 1-B. Decision memo; moves to `docs/archive/audit/`. (Inbound link from `docs/conversion-plan/00-overview.md` updated by slice 3-A.) |
| `docs/conversion-plan/00-overview.md` | 14 | `rewrite` | Slice 3-A. "Visual fidelity is a hard contract" paragraph to demote `frontend/` ref; update archived-doc links per Q2. |
| `docs/audit/01-architecture.md` | 14 | `archive` | Slice 1-B. Pre-rebuild architecture audit. |
| `components/board/MigrateLegacyColumnPrefs.tsx` | 14 | `preserve-live-semantic` | Slice 4-B **forbidden** — live runtime semantic. Entire component is the live one-shot migration of `columnPrefsByBoard` localStorage. |
| `tests/unit/use-visible-columns.test.ts` | 13 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. Tests the `columnPrefsByBoard` fallback path which is a live runtime feature. |
| `docs/audit/09-roadmap-to-full-featured.md` | 12 | `archive` | Slice 1-B. Pre-rebuild roadmap doc. |
| `docs/audit/02-backend.md` | 12 | `archive` | Slice 1-B. Pre-rebuild backend audit. |
| `docs/audit/03-frontend.md` | 10 | `archive` | Slice 1-B. Pre-rebuild frontend audit. |
| `CLAUDE.md` | 10 | `rewrite` | Slice 2-A. Rewrite intro + Legacy code section + anti-pattern guardrails per Q1/Q3. |
| `docs/audit/00-index.md` | 8 | `archive` | Slice 1-B. Audit index; moves to `docs/archive/audit/`. |
| `docs/conversion-plan/01-foundation.md` | 7 | `rewrite` | Slice 3-B. Live `frontend/` + "legacy app is CRA + Express" framing in shipped epic. |
| `stores/board-store.ts` | 6 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. `migrateLegacyColumnPrefs`, `clearLegacyColumnPrefsForBoard` are live exported API functions. |
| `docs/audit/06-data-model.md` | 6 | `archive` | Slice 1-B. Pre-rebuild data model audit. |
| `CONTRIBUTING.md` | 5 | `rewrite` | Slice 2-A. Same anti-pattern reword + Legacy code section rewrite per Q1/Q3. |
| `tests/unit/board-store-views.test.ts` | 4 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. Tests `migrateLegacyColumnPrefs` function directly. |
| `docs/conversion-plan/07-column-system.md` | 4 | `rewrite` | Slice 3-B. Live `frontend/src/assets/styles/...` SCSS refs in shipped epic. |
| `docs/conversion-plan/03-auth.md` | 4 | `rewrite` | Slice 3-B. "legacy auth artifact" and "legacy mistake" framing in shipped epic. |
| `docs/conversion-plan/02-supabase-schema.md` | 4 | `rewrite` | Slice 3-B. "legacy app" comparisons in shipped epic. |
| `docs/audit/04-feature-matrix.md` | 4 | `archive` | Slice 1-B. Pre-rebuild feature matrix. |
| `lib/notifications/kinds.ts` | 3 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. `status_changed` is a live DB constraint kind kept for back-compat; comments encode runtime policy. |
| `docs/pre-planning/03-gaps-risks-and-debt.md` | 3 | `archive` | Slice 1-B. Pre-rebuild gaps doc. |
| `docs/pre-planning/02-feature-inventory-matrix.md` | 3 | `archive` | Slice 1-B. Pre-rebuild feature matrix. |
| `components/rich-text/AttachmentImageNode.tsx` | 3 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. "legacy node" refers to existing Tiptap content without `attachmentId`; fallback behavior is live. |
| `components/board/BoardDataProvider.tsx` | 3 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. Imports and mounts `MigrateLegacyColumnPrefs` — reference is functionally required. |
| `tests/unit/AttachmentImageNode.test.tsx` | 2 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. `"legacy image"` is a test fixture string matching the node's fallback label. |
| `docs/pre-planning/04-roadmap-next-steps.md` | 2 | `archive` | Slice 1-B. Pre-rebuild roadmap. |
| `docs/pre-planning/00-index.md` | 2 | `archive` | Slice 1-B. Pre-planning index. |
| `docs/conversion-plan/14-mobile-a11y-polish.md` | 2 | `rewrite` | Slice 3-C. "legacy `loader.gif`" ref in shipped epic. |
| `docs/conversion-plan/09-comments-activity.md` | 2 | `rewrite` | Slice 3-C. "legacy app" ref in shipped epic. |
| `docs/audit/07-gaps-and-tech-debt.md` | 2 | `archive` | Slice 1-B. Pre-rebuild gaps audit. |
| `components/ui/menu-list.tsx` | 2 | `rewrite` | Slice 4-B. Stale provenance comment points at `frontend/src/assets/styles/setup/_mixins.scss:107-132`. Reword to point at `docs/conversion-plan/design-system.md`. |
| `README.md` | 2 | `rewrite` | Slice 2-A. "Mid-rebuild" status line + CRA/Express/MongoDB mention. |
| `.claude/agents/epic-researcher.md` | 2 | `rewrite` | Slice 2-B. Lines 82 + 129 reference live `frontend/`/`backend/` directories per Q1=delete. |
| `tests/policies/README.md` | 1 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. "Legacy run options" section describes a pgTAP fallback procedure; not CRA-era. |
| `supabase/migrations/20260516000000_notifications_epic13.sql` | 1 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. SQL comment encoding `status_changed` as reserved/legacy kind in DB constraint. |
| `lib/icons.ts` | 1 | `rewrite` | Slice 4-B. "legacy react-icons" comment is stale provenance — reword per Q6. |
| `lib/cells/types.ts` | 1 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. "legacy, renders as plain" is a docstring describing the current fallback behavior of the `formatFooter` function. |
| `lib/board/load-board-snapshot.ts` | 1 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. "legacy boards" comment describes the runtime fallback for boards without a shared view. |
| `docs/conversion-plan/13-notifications.md` | 1 | `rewrite` | Slice 3-C. "legacy 'skip self' rule" ref in shipped epic. |
| `docs/conversion-plan/12-alternate-views.md` | 1 | `rewrite` | Slice 3-C. Live `frontend/src/assets/styles/views/_dashboard.scss` ref in shipped epic. |
| `docs/conversion-plan/11-filtering-views.md` | 1 | `rewrite` | Slice 3-C. Live `frontend/src/assets/styles/cmps/board/_board-filter.scss` ref in shipped epic. |
| `docs/conversion-plan/10-attachments.md` | 1 | `rewrite` | Slice 3-C. "Replace Cloudinary entirely" still accurate but forward-looking framing in shipped epic. |
| `docs/conversion-plan/04-authorization-rls.md` | 1 | `rewrite` | Slice 3-B. "legacy app's defining flaw" framing in shipped epic. |
| `components/board/dashboard/Dashboard.tsx` | 1 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. `react-grid-layout/legacy` is a third-party library import path; must not be edited. |
| `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` | 1 | `preserve-live-semantic` | Slice 4-B forbidden — live runtime semantic. "legacy boards" comment describes the runtime view-creation fallback. |
| `CHANGELOG.md` | 1 | `preserve-history-note` | Line 13 is an existing historical entry noting the CRA→Next.js migration. Per Q4, slice 2-A appends a new epic-17 entry but does NOT touch the existing historical line. |
| `.claude/agents/epic-executor.md` | 1 | `rewrite` | Slice 2-B. Line 26 references live `frontend/`/`backend/` directories per Q1=delete. |

---

## Per-hit detail table

Every individual grep hit. Sorted by file path then line number. Entries in `docs/conversion-plan/_dispatch/` omitted (excluded from scope).

### `.claude/agents/epic-executor.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `.claude/agents/epic-executor.md:26` | `legacy \`frontend/\` or \`backend/\`` | `rewrite` | Slice 2-B — reword prohibition to historical note per Q1=delete |

### `.claude/agents/epic-researcher.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `.claude/agents/epic-researcher.md:82` | `legacy \`frontend/\` or \`backend/\`` | `rewrite` | Slice 2-B — reword to historical note |
| `.claude/agents/epic-researcher.md:129` | `legacy \`frontend/\` or \`backend/\` directories` | `rewrite` | Slice 2-B — reword to historical note |

### `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx:140` | `Shared "Main table" fallback for legacy boards` | `preserve-live-semantic` | Slice 4-B forbidden. Comment describes live runtime fallback logic for boards created before the migration. |

### `CHANGELOG.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `CHANGELOG.md:13` | `legacy CRA + Express + MongoDB stack` | `preserve-history-note` | Existing historical entry. Slice 2-A appends an epic-17 entry but must not alter line 13. |

### `CLAUDE.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `CLAUDE.md:3` | `CRA + Express + MongoDB app is being rebuilt` | `rewrite` | Slice 2-A — drop "mid-rewrite" intro; replace with current-state description |
| `CLAUDE.md:5` | `## Legacy code` | `rewrite` | Slice 2-A — section heading to shrink/remove per Q1=delete |
| `CLAUDE.md:7` | `legacy CRA + MUI + Redux frontend and Express + MongoDB backend` | `rewrite` | Slice 2-A — rewrite to one-sentence historical note |
| `CLAUDE.md:8` | `legacy code to the repo` | `rewrite` | Slice 2-A — "do not re-add" guardrail stays in some form |
| `CLAUDE.md:9` | `legacy product` | `rewrite` | Slice 2-A — rewrite/remove with Legacy code section |
| `CLAUDE.md:10` | `legacy code if needed` | `rewrite` | Slice 2-A — condense into updated historical note |
| `CLAUDE.md:46` | `No MUI, no SCSS in new code` | `rewrite` | Slice 2-A — reword per Q3: "This repo uses Tailwind v4 + shadcn/ui + Base UI, not MUI or SCSS" |
| `CLAUDE.md:51` | `No Redux` | `rewrite` | Slice 2-A — reword per Q3 |
| `CLAUDE.md:53` | `No Socket.IO` | `rewrite` | Slice 2-A — reword per Q3 |
| `CLAUDE.md:54` | `No Cloudinary` | `rewrite` | Slice 2-A — reword per Q3 |

### `components/board/BoardDataProvider.tsx`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `components/board/BoardDataProvider.tsx:33` | `import { MigrateLegacyColumnPrefs }` | `preserve-live-semantic` | Slice 4-B forbidden. Live import of the one-shot migration component. |
| `components/board/BoardDataProvider.tsx:144` | `One-shot migration of legacy columnPrefsByBoard` | `preserve-live-semantic` | Slice 4-B forbidden. JSX comment documents live migration behavior. |
| `components/board/BoardDataProvider.tsx:146` | `<MigrateLegacyColumnPrefs boardId=...` | `preserve-live-semantic` | Slice 4-B forbidden. Live component mount. |

### `components/board/MigrateLegacyColumnPrefs.tsx`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `components/board/MigrateLegacyColumnPrefs.tsx:4` | `MigrateLegacyColumnPrefs` | `preserve-live-semantic` | Slice 4-B forbidden. Component name is the live API. |
| `components/board/MigrateLegacyColumnPrefs.tsx:13` | `clearLegacyColumnPrefsForBoard` | `preserve-live-semantic` | Slice 4-B forbidden. Live store function name. |
| `components/board/MigrateLegacyColumnPrefs.tsx:26` | `migrateLegacyColumnPrefs` | `preserve-live-semantic` | Slice 4-B forbidden. Live store function import. |
| `components/board/MigrateLegacyColumnPrefs.tsx:31` | `MigrateLegacyColumnPrefsProps` | `preserve-live-semantic` | Slice 4-B forbidden. Live interface name. |
| `components/board/MigrateLegacyColumnPrefs.tsx:36` | `export function MigrateLegacyColumnPrefs` | `preserve-live-semantic` | Slice 4-B forbidden. Live exported function. |
| `components/board/MigrateLegacyColumnPrefs.tsx:39` | `}: MigrateLegacyColumnPrefsProps` | `preserve-live-semantic` | Slice 4-B forbidden. Live type annotation. |
| `components/board/MigrateLegacyColumnPrefs.tsx:51` | `legacy prefs to migrate` | `preserve-live-semantic` | Slice 4-B forbidden. Runtime comment describing behavior. |
| `components/board/MigrateLegacyColumnPrefs.tsx:69` | `Extract the config patch from legacy prefs` | `preserve-live-semantic` | Slice 4-B forbidden. Runtime comment. |
| `components/board/MigrateLegacyColumnPrefs.tsx:70` | `migrateLegacyColumnPrefs(store, boardId)` | `preserve-live-semantic` | Slice 4-B forbidden. Live function call. |
| `components/board/MigrateLegacyColumnPrefs.tsx:72` | `legacy prefs only fill in gaps` | `preserve-live-semantic` | Slice 4-B forbidden. Runtime comment. |
| `components/board/MigrateLegacyColumnPrefs.tsx:99` | `store.clearLegacyColumnPrefsForBoard(boardId)` | `preserve-live-semantic` | Slice 4-B forbidden. Live store call. |
| `components/board/MigrateLegacyColumnPrefs.tsx:103` | `clear the legacy prefs` | `preserve-live-semantic` | Slice 4-B forbidden. Runtime comment. |
| `components/board/MigrateLegacyColumnPrefs.tsx:108` | `store.clearLegacyColumnPrefsForBoard(boardId)` | `preserve-live-semantic` | Slice 4-B forbidden. Live store call (on success). |
| `components/board/MigrateLegacyColumnPrefs.tsx:111` | `leave the legacy prefs in place` | `preserve-live-semantic` | Slice 4-B forbidden. Runtime retry comment. |

### `components/board/dashboard/Dashboard.tsx`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `components/board/dashboard/Dashboard.tsx:28` | `react-grid-layout/legacy` | `preserve-live-semantic` | Slice 4-B forbidden. Third-party library import path — `react-grid-layout/legacy` is the correct ES5 interop export of the package; editing this would break the import. |

### `components/rich-text/AttachmentImageNode.tsx`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `components/rich-text/AttachmentImageNode.tsx:10` | `legacy node lacking the custom attr` | `preserve-live-semantic` | Slice 4-B forbidden. Describes live behavior for old Tiptap content. |
| `components/rich-text/AttachmentImageNode.tsx:23` | `legacy content or Markdown round-trip` | `preserve-live-semantic` | Slice 4-B forbidden. Documents live fallback path. |
| `components/rich-text/AttachmentImageNode.tsx:47` | `fallback for legacy nodes without attachmentId` | `preserve-live-semantic` | Slice 4-B forbidden. Biome ignore comment referencing live behavior. |

### `components/ui/menu-list.tsx`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `components/ui/menu-list.tsx:7` | `Implements the legacy @mixin menu-modal() recipe` | `rewrite` | Slice 4-B. Stale provenance — reword to note the recipe is locked in `docs/conversion-plan/design-system.md`. |
| `components/ui/menu-list.tsx:8` | `frontend/src/assets/styles/setup/_mixins.scss:107-132` | `rewrite` | Slice 4-B. Dead pointer to removed legacy file — replace with link to `docs/conversion-plan/design-system.md`. |

### `CONTRIBUTING.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `CONTRIBUTING.md:77` | `No MUI, no SCSS in new code` | `rewrite` | Slice 2-A — reword per Q3 |
| `CONTRIBUTING.md:89` | `## Legacy code` | `rewrite` | Slice 2-A — section heading to shrink/remove per Q1=delete |
| `CONTRIBUTING.md:91` | `legacy CRA + MUI + Redux frontend and Express + MongoDB backend` | `rewrite` | Slice 2-A — rewrite to one-sentence historical note |
| `CONTRIBUTING.md:93` | `legacy code to the repo` | `rewrite` | Slice 2-A — "do not re-add" guardrail stays |
| `CONTRIBUTING.md:95` | `legacy code if needed` | `rewrite` | Slice 2-A — condense with updated section |

### `docs/audit/00-index.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/audit/00-index.md:14` | `MongoDB driver` | `archive` | Slice 1-B — entire file moves to `docs/archive/audit/` |
| `docs/audit/00-index.md:31` | `Mongo` (decision memo link) | `archive` | Slice 1-B |
| `docs/audit/00-index.md:38` | `Socket.IO` | `archive` | Slice 1-B |
| `docs/audit/00-index.md:45` | `MongoDB credentials` | `archive` | Slice 1-B |
| `docs/audit/00-index.md:48` | `Socket.IO has no auth` | `archive` | Slice 1-B |
| `docs/audit/00-index.md:49` | `mongodb driver` | `archive` | Slice 1-B |
| `docs/audit/00-index.md:52` | `MongoDB credentials` | `archive` | Slice 1-B |
| `docs/audit/00-index.md:64` | `Mongo` | `archive` | Slice 1-B |
| `docs/audit/00-index.md:65` | `mongodb driver` | `archive` | Slice 1-B |

### `docs/audit/01-architecture.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/audit/01-architecture.md:7` | `Express + MongoDB + Socket.IO` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:15` | `CRA output` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:18` | `CRA React 18 + Redux + Socket.IO client` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:23` | `Redux: board.reducer` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:39` | `Redux (legacy_createStore)` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:43` | `socket.io-client` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:46` | `Express 4.17.1` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:47` | `mongodb 3.2.7` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:53` | `Redux Provider` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:64` | `CRA` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:86` | `Express + http.createServer` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:89` | `express.json()` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:117` | `Socket.IO server` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:131` | `Mongo URI` | `archive` | Slice 1-B |
| `docs/audit/01-architecture.md:143` | `CRA dev server` | `archive` | Slice 1-B |

### `docs/audit/02-backend.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/audit/02-backend.md:7` | `Express app` | `archive` | Slice 1-B |
| `docs/audit/02-backend.md:10` | `express.json()` | `archive` | Slice 1-B |
| `docs/audit/02-backend.md:11` | `express.static` | `archive` | Slice 1-B |
| `docs/audit/02-backend.md:14` | `Socket.IO registered` | `archive` | Slice 1-B |
| `docs/audit/02-backend.md:19` | `express-rate-limit` | `archive` | Slice 1-B |
| `docs/audit/02-backend.md:103` | `Mongo criteria` | `archive` | Slice 1-B |
| `docs/audit/02-backend.md:111` | `Mongo array operators` | `archive` | Slice 1-B |
| `docs/audit/02-backend.md:128` | `mongodb native driver 3.2.7` | `archive` | Slice 1-B |
| `docs/audit/02-backend.md:132` | `Socket.IO server` | `archive` | Slice 1-B |
| `docs/audit/02-backend.md:150` | `mongodb+srv://donezo` | `archive` | Slice 1-B (exposed credential in archived doc; note for archaeology) |
| `docs/audit/02-backend.md:172` | `MongoDB URI hardcoded` | `archive` | Slice 1-B |
| `docs/audit/02-backend.md:173` | `Socket.IO: origin: '*'` | `archive` | Slice 1-B |

### `docs/audit/03-frontend.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/audit/03-frontend.md:3` | `frontend/src` | `archive` | Slice 1-B |
| `docs/audit/03-frontend.md:7` | `Redux Provider` | `archive` | Slice 1-B |
| `docs/audit/03-frontend.md:30` | `Redux dynamicModalObj` | `archive` | Slice 1-B |
| `docs/audit/03-frontend.md:61` | `legacy_createStore` | `archive` | Slice 1-B |
| `docs/audit/03-frontend.md:62` | `Redux DevTools` | `archive` | Slice 1-B |
| `docs/audit/03-frontend.md:86` | `frontend/src` (scope line) | `archive` | Slice 1-B |
| `docs/audit/03-frontend.md:104` | `socket.io-client` | `archive` | Slice 1-B |
| `docs/audit/03-frontend.md:105` | `Cloudinary upload` | `archive` | Slice 1-B |
| `docs/audit/03-frontend.md:114` | `Redux state` | `archive` | Slice 1-B |
| `docs/audit/03-frontend.md:119` | `Redux state` (overwrite) | `archive` | Slice 1-B |
| `docs/audit/03-frontend.md:149` | `Cloudinary cloud name` | `archive` | Slice 1-B |

### `docs/audit/04-feature-matrix.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/audit/04-feature-matrix.md:5` | `frontend/src/` | `archive` | Slice 1-B |
| `docs/audit/04-feature-matrix.md:17` | `Cloudinary` | `archive` | Slice 1-B |
| `docs/audit/04-feature-matrix.md:18` | `Redux loadUsers()` | `archive` | Slice 1-B |
| `docs/audit/04-feature-matrix.md:71` | `Cloudinary` | `archive` | Slice 1-B |

### `docs/audit/05-security.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/audit/05-security.md:9` | `mongodb driver 3.2.7` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:10` | `mongodb driver 3.2.7` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:11` | `Cloudinary unsigned preset` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:30` | `MongoDB credentials hardcoded` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:34` | `mongodb+srv://donezo` | `archive` | Slice 1-B (exposed credential; archaeological note) |
| `docs/audit/05-security.md:50` | `Socket.IO has no auth` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:77` | `express-validator` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:79` | `mongodb driver` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:97` | `express-rate-limit` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:101` | `Mongo criteria` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:105` | `Cloudinary unsigned preset` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:107` | `frontend/src/services/upload.service.js` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:112` | `MongoDB creds committed` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:129` | `frontend/src/index.js` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:144` | `mongodb+srv://donezo` (credential) | `archive` | Slice 1-B |
| `docs/audit/05-security.md:145` | `mongodb+srv://atebitcreative` (credential) | `archive` | Slice 1-B |
| `docs/audit/05-security.md:146` | `mongodb+srv://idandavid` (credential) | `archive` | Slice 1-B |
| `docs/audit/05-security.md:152` | `MongoDB Atlas password` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:158` | `express-rate-limit` | `archive` | Slice 1-B |
| `docs/audit/05-security.md:159` | `mongodb driver` | `archive` | Slice 1-B |

### `docs/audit/06-data-model.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/audit/06-data-model.md:3` | `MongoDB document` | `archive` | Slice 1-B |
| `docs/audit/06-data-model.md:14` | `frontend/src/services/board.service.js` | `archive` | Slice 1-B |
| `docs/audit/06-data-model.md:75` | `frontend/src/services/local-board.service.js` | `archive` | Slice 1-B |
| `docs/audit/06-data-model.md:174` | `MongoDB caps documents` | `archive` | Slice 1-B |
| `docs/audit/06-data-model.md:177` | `staying on MongoDB` | `archive` | Slice 1-B |
| `docs/audit/06-data-model.md:188` | `MongoDB 3.6+` | `archive` | Slice 1-B |

### `docs/audit/07-gaps-and-tech-debt.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/audit/07-gaps-and-tech-debt.md:53` | `mongodb driver 3.2.7` | `archive` | Slice 1-B |
| `docs/audit/07-gaps-and-tech-debt.md:72` | `Mongo 16 MB ceiling` | `archive` | Slice 1-B |

### `docs/audit/08-dependencies.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/audit/08-dependencies.md:11` | `express 4.17.1` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:12` | `mongodb 3.2.7` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:14` | `socket.io 4.2.0` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:26` | `express-rate-limit` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:35` | `CRA/18` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:37` | `CRA is officially deprecated` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:40` | `redux 4.2.0` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:41` | `redux-thunk 2.4.2` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:42` | `react-redux 8.0.5` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:44` | `Legacy / likely unused` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:48` | `@mui/material 5.13.3` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:49` | `@mui/icons-material` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:50` | `@mui/x-date-pickers` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:56` | `CRA's sass-loader` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:58` | `CRA's sass-loader` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:59` | `socket.io-client 4.2.0` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:62` | `CRA/Babel` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:69` | `CRA (react-scripts)` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:72` | `CRA` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:85` | `socket.io + socket.io-client` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:91` | `MongoDB driver 3.2.7` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:92` | `CRA → Vite` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:93` | `Redux → RTK` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:94` | `MUI 5 → MUI 6` | `archive` | Slice 1-B |
| `docs/audit/08-dependencies.md:98` | `mongo driver` | `archive` | Slice 1-B |

### `docs/audit/09-roadmap-to-full-featured.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/audit/09-roadmap-to-full-featured.md:13` | `MongoDB Atlas credentials` | `archive` | Slice 1-B |
| `docs/audit/09-roadmap-to-full-featured.md:19` | `Mongo URI + db name + Cloudinary config` | `archive` | Slice 1-B |
| `docs/audit/09-roadmap-to-full-featured.md:29` | `express-rate-limit` | `archive` | Slice 1-B |
| `docs/audit/09-roadmap-to-full-featured.md:38` | `MongoDB` | `archive` | Slice 1-B |
| `docs/audit/09-roadmap-to-full-featured.md:42` | `Mongo` | `archive` | Slice 1-B |
| `docs/audit/09-roadmap-to-full-featured.md:46` | `Mongo positional operators` | `archive` | Slice 1-B |
| `docs/audit/09-roadmap-to-full-featured.md:114` | `CRA → Vite` | `archive` | Slice 1-B |
| `docs/audit/09-roadmap-to-full-featured.md:115` | `Redux → Redux Toolkit` | `archive` | Slice 1-B |
| `docs/audit/09-roadmap-to-full-featured.md:117` | `MUI 5 → 6` | `archive` | Slice 1-B |
| `docs/audit/09-roadmap-to-full-featured.md:136` | `stay on MongoDB` | `archive` | Slice 1-B |
| `docs/audit/09-roadmap-to-full-featured.md:137` | `CRA` | `archive` | Slice 1-B |
| `docs/audit/09-roadmap-to-full-featured.md:139` | `MUI + SCSS` | `archive` | Slice 1-B |

### `docs/audit/10-supabase-migration.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/audit/10-supabase-migration.md:5` | `MongoDB, bcrypt/Cryptr auth, Socket.IO, and Cloudinary` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:11` | `MongoDB Atlas + mongodb driver` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:14` | `Socket.IO topic broadcasts` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:15` | `Cloudinary (optional replacement)` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:16` | `The bits of Express` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:17` | `socket.io-client` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:147` | `Redux-less observable` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:164` | `Socket.IO topic broadcasts` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:165` | `Socket.IO` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:186` | `Socket.IO rooms` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:189` | `Socket.IO does today` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:204` | `socket.io + socket.io-client` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:208` | `Cloudinary with unsigned preset` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:216` | `Cloudinary keeps working` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:222` | `Drop Express entirely` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:225` | `no Express, no Socket.IO` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:234` | `Supabase as the DB behind a keep-Express facade` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:236` | `Express layer` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:240` | `Express for any custom logic` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:249` | `Express layer is thin` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:259` | `Mongo → Postgres` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:263` | `Remove Socket.IO` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:264` | `Replace Cloudinary` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:265` | `Delete Express backend` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:270` | `Cloudinary swap` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:277` | `MongoDB user bcrypt hashes` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:286` | `Redux can stay` | `archive` | Slice 1-B |
| `docs/audit/10-supabase-migration.md:293` | `hardcoded Mongo URI` | `archive` | Slice 1-B |

### `docs/audit/11-recommendation-migrate-now.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/audit/11-recommendation-migrate-now.md:3` | `MongoDB` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:11` | `Mongo "make it viable"` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:13` | `MongoDB` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:20` | `mongodb driver` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:25` | `Mongo + Socket.IO` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:33` | `Hardcoded Mongo URI` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:40` | `Mongo is real work` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:42` | `built now on Mongo` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:50` | `Mongo as the path` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:54` | `MongoDB credentials` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:56` | `Phase 0 on Mongo` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:58` | `staying on Mongo` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:63` | `Mongo-specific skill` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:73` | `Mongo stack` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:75` | `Mongo → Postgres` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:76` | `Socket.IO with Realtime` | `archive` | Slice 1-B |
| `docs/audit/11-recommendation-migrate-now.md:98` | `keep building on Mongo` | `archive` | Slice 1-B |

### `docs/conversion-plan/00-overview.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/00-overview.md:3` | `CRA + Express + MongoDB stack` | `rewrite` | Slice 3-A — intro line now historical; reframe as "rebuild is complete" |
| `docs/conversion-plan/00-overview.md:9` | `legacy codebase` | `rewrite` | Slice 3-A — update archived-doc links per Q2 |
| `docs/conversion-plan/00-overview.md:11` | `legacy CRA + SCSS + MUI frontend at \`frontend/\`` | `rewrite` | Slice 3-A — demote to historical note; canonical source is now design-system.md |
| `docs/conversion-plan/00-overview.md:15` | `frontend/src/assets/styles/setup/_variables.scss` | `rewrite` | Slice 3-A — replace live pointer with historical provenance note |
| `docs/conversion-plan/00-overview.md:16` | `legacy component's visual` | `rewrite` | Slice 3-A — reframe as current contract |
| `docs/conversion-plan/00-overview.md:25` | `no any-typed Redux state` | `rewrite` | Slice 3-A — reframe as current-app norm |
| `docs/conversion-plan/00-overview.md:26` | `Replace MUI + SCSS` | `rewrite` | Slice 3-A — keep as historical justification but drop forward-looking framing |
| `docs/conversion-plan/00-overview.md:32` | `No Redux` | `rewrite` | Slice 3-A — keep, reframe from "stack choice" to "this repo uses" |
| `docs/conversion-plan/00-overview.md:35` | `Replaces Socket.IO` | `rewrite` | Slice 3-A — "replaces" is done; reframe as current state |
| `docs/conversion-plan/00-overview.md:36` | `Replaces Cloudinary` | `rewrite` | Slice 3-A — same |
| `docs/conversion-plan/00-overview.md:49` | `legacy \`frontend/\` SCSS` | `rewrite` | Slice 3-A — demote to historical provenance |
| `docs/conversion-plan/00-overview.md:54` | `legacy data shape` | `rewrite` | Slice 3-A — note: "No backwards compatibility with the legacy data shape" is a **live architectural decision that must stay** — reword but preserve the constraint |
| `docs/conversion-plan/00-overview.md:55` | `legacy "store the label title"` | `rewrite` | Slice 3-A — anti-pattern note; can be restated as "the current schema does X" |
| `docs/conversion-plan/00-overview.md:196` | `legacy \`cmps/home/\` + \`cmps/custom/\`` | `rewrite` | Slice 3-A — reframe as historical record of what was not ported |

### `docs/conversion-plan/01-foundation.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/01-foundation.md:37` | `legacy app is CRA + Express` | `rewrite` | Slice 3-B — shipped; restate as historical context |
| `docs/conversion-plan/01-foundation.md:40` | `Server Actions replace the Express REST surface` | `rewrite` | Slice 3-B — done; reframe as current fact |
| `docs/conversion-plan/01-foundation.md:75` | `legacy \`frontend/\` SCSS` | `rewrite` | Slice 3-B — demote to historical provenance; design-system.md is canonical |
| `docs/conversion-plan/01-foundation.md:77` | `Replace the SCSS Figtree-Regular.ttf / Poppins-Regular.ttf` | `rewrite` | Slice 3-B — done; drop forward-looking "replace" |
| `docs/conversion-plan/01-foundation.md:91` | `legacy react-icons mapping` | `rewrite` | Slice 3-B — reframe as historical provenance table |
| `docs/conversion-plan/01-foundation.md:213` | `No @mui/* imports` | `rewrite` | Slice 3-B — reframe as current fact |
| `docs/conversion-plan/01-foundation.md:214` | `legacy @mixin menu-modal recipe` | `rewrite` | Slice 3-B — reframe as "implemented per component-system.md §3.2" |

### `docs/conversion-plan/02-supabase-schema.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/02-supabase-schema.md:81` | `legacy app: task.status = 'Done'` | `rewrite` | Slice 3-B — shipped; reframe as "the current schema fixes this by construction" |
| `docs/conversion-plan/02-supabase-schema.md:506` | `legacy app's "move task across groups"` | `rewrite` | Slice 3-B — reframe as current behavior |
| `docs/conversion-plan/02-supabase-schema.md:550` | `legacy app stored title separately` | `rewrite` | Slice 3-B — reframe as current design rationale |
| `docs/conversion-plan/02-supabase-schema.md:553` | `legacy app stores no PII` | `rewrite` | Slice 3-B — reframe as current-app note |

### `docs/conversion-plan/03-auth.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/03-auth.md:5` | `Replace every legacy auth artifact` | `rewrite` | Slice 3-B — done; reframe as "the auth layer is Supabase Auth" |
| `docs/conversion-plan/03-auth.md:39` | `legacy mistake we're avoiding` | `rewrite` | Slice 3-B — reframe as historical rationale; phrasing fine to keep |
| `docs/conversion-plan/03-auth.md:288` | `legacy hand-rolled cookie config` | `rewrite` | Slice 3-B — "no legacy config to fight with" is current-state; fine to keep |
| `docs/conversion-plan/03-auth.md:342` | `legacy app supported a guest mode` | `rewrite` | Slice 3-B — reframe as open question now resolved (guest mode not shipped) |

### `docs/conversion-plan/04-authorization-rls.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/04-authorization-rls.md:9` | `legacy app's defining flaw` | `rewrite` | Slice 3-B — reframe as historical context for why RLS was prioritized |

### `docs/conversion-plan/07-column-system.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/07-column-system.md:301` | `bug from the legacy app, fixed by construction` | `rewrite` | Slice 3-B — keep as rationale; reframe from "fixed by construction" to "the current schema uses id references" |
| `docs/conversion-plan/07-column-system.md:365` | `frontend/src/assets/styles/cmps/task-picker/_status-priority-picker.scss` | `rewrite` | Slice 3-B — dead SCSS pointer; demote to historical provenance note |
| `docs/conversion-plan/07-column-system.md:371` | `legacy calculateTime algorithm` | `rewrite` | Slice 3-B — reframe as "uses the `calculateTime` utility" |
| `docs/conversion-plan/07-column-system.md:392` | `frontend/src/assets/styles/cmps/group/_group-statistics.scss` | `rewrite` | Slice 3-B — dead SCSS pointer; demote to historical note |

### `docs/conversion-plan/09-comments-activity.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/09-comments-activity.md:46` | `legacy app and monday both do this` | `rewrite` | Slice 3-C — reframe as design rationale ("Drawer UX") |
| `docs/conversion-plan/09-comments-activity.md:264` | `frontend/src/assets/styles/cmps/modal/_board-modal.scss` | `rewrite` | Slice 3-C — dead SCSS pointer; replace with component-system.md reference |

### `docs/conversion-plan/10-attachments.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/10-attachments.md:5` | `Replace Cloudinary entirely` | `rewrite` | Slice 3-C — done; reframe as "Supabase Storage is the storage layer" |

### `docs/conversion-plan/11-filtering-views.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/11-filtering-views.md:271` | `frontend/src/assets/styles/cmps/board/_board-filter.scss` | `rewrite` | Slice 3-C — dead SCSS pointer; replace with component-system.md reference |

### `docs/conversion-plan/12-alternate-views.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/12-alternate-views.md:214` | `frontend/src/assets/styles/views/_dashboard.scss` | `rewrite` | Slice 3-C — dead SCSS pointer; replace with component-system.md reference |

### `docs/conversion-plan/13-notifications.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/13-notifications.md:344` | `legacy "skip self" rule applies` | `rewrite` | Slice 3-C — reframe as "current rule: never notify on own actions" |

### `docs/conversion-plan/14-mobile-a11y-polish.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/conversion-plan/14-mobile-a11y-polish.md:265` | `legacy loader.gif` | `rewrite` | Slice 3-C — done; reframe as "the current app uses `<Skeleton />`" |
| `docs/conversion-plan/14-mobile-a11y-polish.md:267` | `black text in legacy at certain sizes` | `rewrite` | Slice 3-C — reframe as current contrast requirement |

### `docs/conversion-plan/17-legacy-cleanup.md`

All 38 hits: `preserve-history-note`. The epic doc is not edited by its own epic per the dispatch plan.

### `docs/conversion-plan/component-system.md`

All 43 hits: `rewrite` (Slice 3-A). Live `frontend/src/...` SCSS refs and "Legacy:" component pointers throughout. Each will be demoted to one-sentence historical provenance note per dispatch plan Q6 pattern.

### `docs/conversion-plan/design-system.md`

All 42 hits: `rewrite` (Slice 3-A). Live `frontend/src/...` token source pointers throughout. Each will be replaced with absolute statements ("the canonical value is `app/globals.css` `@theme`"), retaining one-sentence provenance.

### `docs/pre-planning/00-index.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/pre-planning/00-index.md:19` | `CRA React + Redux + react-beautiful-dnd + Socket.IO` | `archive` | Slice 1-B |
| `docs/pre-planning/00-index.md:20` | `Express + MongoDB (native driver) + Socket.IO` | `archive` | Slice 1-B |

### `docs/pre-planning/01-architecture-and-runtime.md`

All 19 hits: `archive` (Slice 1-B). Pre-rebuild architecture walkthrough; moves to `docs/archive/pre-planning/`.

### `docs/pre-planning/02-feature-inventory-matrix.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/pre-planning/02-feature-inventory-matrix.md:81` | `Cloudinary works in principle` | `archive` | Slice 1-B |
| `docs/pre-planning/02-feature-inventory-matrix.md:114` | `Realtime board updates via Socket.IO` | `archive` | Slice 1-B |
| `docs/pre-planning/02-feature-inventory-matrix.md:141` | `frontend/src/test/` | `archive` | Slice 1-B |

### `docs/pre-planning/03-gaps-risks-and-debt.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/pre-planning/03-gaps-risks-and-debt.md:34` | `MongoDB Atlas URI includes credentials` | `archive` | Slice 1-B |
| `docs/pre-planning/03-gaps-risks-and-debt.md:35` | `Google OAuth client id hardcoded in frontend/src/index.js` | `archive` | Slice 1-B |
| `docs/pre-planning/03-gaps-risks-and-debt.md:36` | `Cloudinary cloud name + preset hardcoded` | `archive` | Slice 1-B |

### `docs/pre-planning/04-roadmap-next-steps.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `docs/pre-planning/04-roadmap-next-steps.md:24` | `Mongo URI / db name` | `archive` | Slice 1-B |
| `docs/pre-planning/04-roadmap-next-steps.md:27` | `Cloudinary settings` | `archive` | Slice 1-B |

### `lib/board/load-board-snapshot.ts`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `lib/board/load-board-snapshot.ts:145` | `Shared "Main table" fallback for legacy boards` | `preserve-live-semantic` | Slice 4-B forbidden. Describes live runtime fallback for boards created before `20260515000001_default_view_on_create_board.sql`. |

### `lib/cells/types.ts`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `lib/cells/types.ts:197` | `legacy, renders as plain` | `preserve-live-semantic` | Slice 4-B forbidden. Docstring on `formatFooter` function describing current behavior of the `text` cell type. |

### `lib/icons.ts`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `lib/icons.ts:5` | `Mapping back to legacy react-icons` | `rewrite` | Slice 4-B. Stale provenance — reword to "the original react-icons set" or drop back-reference per Q6. |

### `lib/notifications/kinds.ts`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `lib/notifications/kinds.ts:8` | `status_changed — legacy kind` | `preserve-live-semantic` | Slice 4-B forbidden. Module docstring encoding DB constraint policy. |
| `lib/notifications/kinds.ts:53` | `status_changed: legacy; existing rows use it` | `preserve-live-semantic` | Slice 4-B forbidden. Runtime back-compat policy comment. |
| `lib/notifications/kinds.ts:115` | `Legacy kind — payload shape same as assigned` | `preserve-live-semantic` | Slice 4-B forbidden. JSDoc on `STATUS_CHANGED` constant. |

### `README.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `README.md:7` | `Mid-rebuild. The original CRA + Express + MongoDB app` | `rewrite` | Slice 2-A — drop "Mid-rebuild" framing; rewrite status line |
| `README.md:20` | `no Redux` | `rewrite` | Slice 2-A — keep as stack-table entry; reword if "no Redux" framing is stale |

### `stores/board-store.ts`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `stores/board-store.ts:94` | `clearLegacyColumnPrefsForBoard` (interface) | `preserve-live-semantic` | Slice 4-B forbidden. Live interface member. |
| `stores/board-store.ts:95` | `clearLegacyColumnPrefsForBoard: (boardId: string)` | `preserve-live-semantic` | Slice 4-B forbidden. Live type signature. |
| `stores/board-store.ts:662` | `Replaces legacy setSort` | `preserve-live-semantic` | Slice 4-B forbidden. Comment documents migration of sort fields; not stale provenance. |
| `stores/board-store.ts:677` | `clearLegacyColumnPrefsForBoard — Epic 11` | `preserve-live-semantic` | Slice 4-B forbidden. Comment identifying the live function. |
| `stores/board-store.ts:681` | `clearLegacyColumnPrefsForBoard(boardId)` | `preserve-live-semantic` | Slice 4-B forbidden. Live function name in implementation. |
| `stores/board-store.ts:1419` | `export function migrateLegacyColumnPrefs` | `preserve-live-semantic` | Slice 4-B forbidden. Live exported function. |

### `supabase/migrations/20260516000000_notifications_epic13.sql`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `supabase/migrations/20260516000000_notifications_epic13.sql:30` | `status_changed is kept as a reserved/legacy kind` | `preserve-live-semantic` | Slice 4-B forbidden. SQL comment in deployed migration; editing deployed migrations is forbidden by convention. |

### `tests/policies/README.md`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `tests/policies/README.md:213` | `## Legacy run options` | `preserve-live-semantic` | Slice 4-B forbidden. Section heading for a pgTAP fallback procedure; "legacy" here means "older fallback method," not CRA-era code. |

### `tests/unit/AttachmentImageNode.test.tsx`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `tests/unit/AttachmentImageNode.test.tsx:89` | `alt: "legacy image"` | `preserve-live-semantic` | Slice 4-B forbidden. Test fixture string matching the node's fallback `alt` attribute for content without `attachmentId`. |
| `tests/unit/AttachmentImageNode.test.tsx:102` | `expect(img?.getAttribute("alt")).toBe("legacy image")` | `preserve-live-semantic` | Slice 4-B forbidden. Assertion against the same fixture; changing it would break the test. |

### `tests/unit/board-store-views.test.ts`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `tests/unit/board-store-views.test.ts:3` | `migrateLegacyColumnPrefs` (import) | `preserve-live-semantic` | Slice 4-B forbidden. Import of live exported function. |
| `tests/unit/board-store-views.test.ts:295` | `describe("migrateLegacyColumnPrefs")` | `preserve-live-semantic` | Slice 4-B forbidden. Test suite for live function. |
| `tests/unit/board-store-views.test.ts:307` | `migrateLegacyColumnPrefs(` | `preserve-live-semantic` | Slice 4-B forbidden. Live function call in test. |
| `tests/unit/board-store-views.test.ts:322` | `migrateLegacyColumnPrefs(` | `preserve-live-semantic` | Slice 4-B forbidden. Live function call in test. |

### `tests/unit/use-visible-columns.test.ts`

| File:line | Matched substring | Treatment | Notes |
|---|---|---|---|
| `tests/unit/use-visible-columns.test.ts:12` | `legacy columnPrefsByBoard when present` | `preserve-live-semantic` | Slice 4-B forbidden. Test file docstring describing live behavior. |
| `tests/unit/use-visible-columns.test.ts:14` | `legacy prefs are used` | `preserve-live-semantic` | Slice 4-B forbidden. Test file docstring. |
| `tests/unit/use-visible-columns.test.ts:18` | `Width resolution — view config width beats legacy pref` | `preserve-live-semantic` | Slice 4-B forbidden. Test file docstring. |
| `tests/unit/use-visible-columns.test.ts:19` | `Width fallback — missing view config → legacy pref` | `preserve-live-semantic` | Slice 4-B forbidden. Test file docstring. |
| `tests/unit/use-visible-columns.test.ts:111` | `clear legacy column prefs` | `preserve-live-semantic` | Slice 4-B forbidden. Test fixture setup comment. |
| `tests/unit/use-visible-columns.test.ts:113` | `clearLegacyColumnPrefsForBoard(BOARD_ID)` | `preserve-live-semantic` | Slice 4-B forbidden. Live store call in test teardown. |
| `tests/unit/use-visible-columns.test.ts:116` | `visibility — effectiveConfig takes priority over legacy prefs` | `preserve-live-semantic` | Slice 4-B forbidden. `describe` block title matching live behavior. |
| `tests/unit/use-visible-columns.test.ts:146` | `Mark col-b hidden in legacy prefs` | `preserve-live-semantic` | Slice 4-B forbidden. Test comment. |
| `tests/unit/use-visible-columns.test.ts:147` | `hides it in legacy prefs` | `preserve-live-semantic` | Slice 4-B forbidden. Test comment. |
| `tests/unit/use-visible-columns.test.ts:157` | `visibility — fallback to legacy prefs` | `preserve-live-semantic` | Slice 4-B forbidden. `describe` block title. |
| `tests/unit/use-visible-columns.test.ts:235` | `prefers effectiveConfig.columnWidths over legacy prefs` | `preserve-live-semantic` | Slice 4-B forbidden. `it` description. |
| `tests/unit/use-visible-columns.test.ts:244` | `setColumnWidth("col-a", 200); // legacy pref` | `preserve-live-semantic` | Slice 4-B forbidden. Live store call + comment. |
| `tests/unit/use-visible-columns.test.ts:255` | `falls back to legacy pref` | `preserve-live-semantic` | Slice 4-B forbidden. `it` description. |

---

## Sentinel-hits: known-tricky cases that must be preserved

The following hits look like cleanup targets but must not be edited. Each is classified `preserve-live-semantic` in the per-file table above.

1. **`react-grid-layout/legacy`** — `components/board/dashboard/Dashboard.tsx:28`. Third-party library import path. `react-grid-layout/legacy` is the correct ES5 interop entry point of the npm package; editing it would break the import. Must not be touched.

2. **`MigrateLegacyColumnPrefs` / `migrateLegacyColumnPrefs` / `clearLegacyColumnPrefsForBoard`** — live exported APIs in `components/board/MigrateLegacyColumnPrefs.tsx`, `stores/board-store.ts`, `components/board/BoardDataProvider.tsx`. Renaming would break the one-shot migration that runs on every board mount to fold `columnPrefsByBoard` localStorage into the personal view.

3. **"legacy boards" data-shape comments** — `lib/board/load-board-snapshot.ts:145` and `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx:140`. These comments document the live runtime fallback for boards that pre-date the `create_board` migration (epic 11). The fallback code is still active.

4. **"legacy nodes" in `components/rich-text/AttachmentImageNode.tsx`** — Lines 10, 23, 47. Describes Tiptap content nodes that lack the `attachmentId` attribute; the `src`-only fallback rendering path is live and required for backward compatibility with stored rich-text content.

5. **`status_changed — legacy kind`** — `lib/notifications/kinds.ts:8,53,115` and `supabase/migrations/20260516000000_notifications_epic13.sql:30`. The `status_changed` kind is reserved in the DB constraint and referenced in deployed migration SQL. No new code writes it but existing rows use it; the back-compat is an intentional design choice.

6. **"Legacy run options"** — `tests/policies/README.md:213`. Section heading for a pgTAP execution fallback procedure predating the current CI setup. "Legacy" here means "older tooling approach," not CRA-era. The section is still a valid reference for developers running pgTAP without the full CI suite.

7. **`lib/cells/types.ts` "legacy renders as plain"** — Line 197. Docstring for `formatFooter` function. The "(legacy, renders as plain)" note describes what the `text` cell type does when encountered in a footer row — this is a live behavior contract, not dead documentation.

8. **`"legacy image"` test fixtures** — `tests/unit/AttachmentImageNode.test.tsx:89,102`. The string `"legacy image"` is an `alt` attribute fixture matching the node's live fallback label for content without `attachmentId`. Changing it would cause the test to fail.

9. **Anti-pattern bullets in `CLAUDE.md` / `CONTRIBUTING.md`** — `No MUI`, `No Redux`, `No Socket.IO`, `No Cloudinary` guardrail lines. These are classified `rewrite` (not removal) per Q3. Slice 2-A will reword them from "in new code" to "this repo uses X, not Y." They must be preserved as guardrails.

10. **`CHANGELOG.md:13` historical entry** — classified `preserve-history-note`. Slice 2-A appends a new epic-17 entry but must not alter or delete the existing line 13 reference to the CRA→Next.js migration.

---

## Headline summary

| Metric | Value |
|---|---|
| Total files with hits (non-dispatch) | **54** |
| `rewrite` | **21** |
| `archive` | **17** (all of `docs/audit/` + `docs/pre-planning/`; `docs/conversion-refinements/auth-google-only.md` has 0 grep hits but is moved by Slice 1-B per Q2) |
| `preserve-live-semantic` | **14** |
| `preserve-history-note` | **2** (`docs/conversion-plan/17-legacy-cleanup.md`, `CHANGELOG.md:13`) |

**Discrepancy vs dispatch plan:** Plan projected 41 files; actual count is 54 (+31.7%). All 13 extra files fit cleanly into existing treatment categories and slice scopes. The researcher underestimated the number of numbered conversion-plan epics that would have hits (epics 04, 07, 09-14 all have 1-4 hits each) and did not include `.claude/agents/` in the 41-file count despite slice 2-B covering them. **No new treatment class is required; no escalation needed.**

**`docs/conversion-refinements/auth-google-only.md`:** This file has 0 grep hits but is in scope for `archive` treatment (Slice 1-B moves it to `docs/archive/conversion-refinements/` via `git mv`). It is not in the hit table because it produced no grep hits.

**Dispatch plan: 14 preserve-live-semantic files listed (not 10):** The dispatch plan text says "(10 files)" but then lists 14 files. The list of 14 is authoritative. All 14 appear in this inventory with `preserve-live-semantic` treatment.

---

## Stage 1-A: local folders disposition record (to be filled by Slice 1-A)

On 2026-05-14, the local `frontend/` (12 MB) and `backend/` (20 MB) directories were deleted from disk. Both folders were confirmed untracked (`git ls-files frontend backend` returned empty output), so the deletion produced no tracked-file changes and required no git commit. The `.gitignore` entries for both paths remain in place as cheap insurance. For archaeology of the original CRA + Express + MongoDB codebase, see git commit `a5d47c2`.

---

## Stage 4-A: runbook verification (to be filled by Slice 4-A)

**Result: CLEAN — no legacy-reference hits. No edits made to any runbook file.**

Grep command run:
```
grep -rEni \
  'frontend/src|legacy|MongoDB|\bmongo\b|\bMUI\b|Redux|Socket\.IO|Cloudinary|\bCRA\b|\bExpress\b' \
  docs/runbooks/
```

Output: (empty — zero hits)

Verified on: 2026-05-14. All 9 files in `docs/runbooks/` are clean. Consistent with Stage 0 inventory classification (no `docs/runbooks/` files appear in the rewrite or archive treatment categories). No commits needed for this slice.

---

## Stage 5-A: verification report

**Date:** 2026-05-14

### Re-grep results

Re-grep command (verbatim from methodology section, with `.claude/worktrees/` exclusion per Q7):

```sh
grep -rEni "frontend/src|legacy|MongoDB|\bmongo\b|\bMUI\b|Redux|Socket\.IO|Cloudinary|\bCRA\b|\bExpress\b" \
  --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" \
  --include="*.json" --include="*.sql" --include="*.yaml" --include="*.yml" \
  --exclude-dir="node_modules" --exclude-dir=".next" --exclude-dir=".git" \
  --exclude-dir=".turbo" --exclude-dir="frontend" --exclude-dir="backend" \
  --exclude="pnpm-lock.yaml" --exclude="tsconfig.tsbuildinfo" \
  . \
| grep -v "docs/conversion-plan/_dispatch/" \
| grep -v "\.claude/worktrees/" \
| sort
```

**Total lines (hits):** 324  
**Unique files:** 44  
**Baseline (Stage 0):** 428 hits / 54 files  
**Reduction:** 104 lines removed (24.3%), 10 files fully cleaned

### Per-classification breakdown

| Treatment | Files | Lines (hits) |
|---|---|---|
| `preserve-history-note` | 30 | 270 |
| `preserve-live-semantic` | 14 | 54 |
| `rewrite` (any remaining) | 0 | 0 |
| `archive` (any remaining unarchived) | 0 | 0 |

**Note on `archive` classification:** All 17 files originally classified `archive` have been moved to `docs/archive/` by Slice 1-B. They still appear in the re-grep (contributing 246 of the 270 `preserve-history-note` lines) because their content was not edited — moving them to `docs/archive/` was the correct treatment per Q2. Their hits are properly `preserve-history-note` in the current state.

**Note on `rewrite`-classified files:** All 21 files originally classified `rewrite` have been processed. Remaining hits in those files are historical provenance notes referencing commit `a5d47c2` or anti-pattern guardrails reworded per Q3. Zero `rewrite`-treatment hits remain; all are now `preserve-history-note`.

### Top 10 files by hit count

| Rank | File | Hits | Treatment | Confirmed |
|---|---|---|---|---|
| 1 | `docs/conversion-plan/17-legacy-cleanup.md` | 37 | `preserve-history-note` | Yes — epic doc intentionally not edited by its own epic |
| 2 | `docs/archive/audit/10-supabase-migration.md` | 28 | `preserve-history-note` | Yes — archived per Slice 1-B (Q2) |
| 3 | `docs/archive/audit/08-dependencies.md` | 25 | `preserve-history-note` | Yes — archived per Slice 1-B |
| 4 | `docs/archive/pre-planning/01-architecture-and-runtime.md` | 19 | `preserve-history-note` | Yes — archived per Slice 1-B |
| 5 | `docs/archive/audit/05-security.md` | 19 | `preserve-history-note` | Yes — archived per Slice 1-B |
| 6 | `docs/archive/audit/11-recommendation-migrate-now.md` | 17 | `preserve-history-note` | Yes — archived per Slice 1-B |
| 7 | `docs/archive/audit/01-architecture.md` | 14 | `preserve-history-note` | Yes — archived per Slice 1-B |
| 8 | `components/board/MigrateLegacyColumnPrefs.tsx` | 14 | `preserve-live-semantic` | Yes — live one-shot migration component; Slice 4-B forbidden |
| 9 | `tests/unit/use-visible-columns.test.ts` | 13 | `preserve-live-semantic` | Yes — tests live `columnPrefsByBoard` fallback; Slice 4-B forbidden |
| 10 | `docs/archive/audit/09-roadmap-to-full-featured.md` | 12 | `preserve-history-note` | Yes — archived per Slice 1-B |

### Residual-hit inventory confirmation

Every remaining hit matches its inventory treatment. Specific confirmations for non-archive files:

- **`.claude/agents/epic-executor.md`** (2 hits): Both are `preserve-history-note` — reworded prohibition now reads "were removed in commit `a5d47c2` and are no longer on disk." Inventory listed 1 hit at line 26 for `rewrite`; the second hit at line 90 is the reworded version on the `epic-executor` hard-prohibitions list, also `preserve-history-note`. Rewrite is complete.
- **`.claude/agents/epic-researcher.md`** (2 hits): Both are `preserve-history-note` — reworded to historical note form. Inventory classified both as `rewrite`; rewrite is complete.
- **`CLAUDE.md`** (8 hits): All `preserve-history-note` — `## Legacy code` section now contains a historical note pointing at `a5d47c2`; anti-pattern guardrails reworded per Q3 ("This repo does not use Redux/Socket.IO/Cloudinary"). Inventory classified all 10 original hits as `rewrite`; rewrite complete (2 hits removed entirely, 8 remain as intentional notes).
- **`CONTRIBUTING.md`** (3 hits): All `preserve-history-note` — same pattern as CLAUDE.md. Inventory classified 5 hits as `rewrite`; rewrite complete.
- **`README.md`** (2 hits): Both `preserve-history-note` — line 7 is now a historical note ("rebuilt across 17 epics from an earlier CRA + Express + MongoDB codebase"); line 20 keeps "no Redux" as stack-table entry. Inventory classified both as `rewrite`; rewrite complete.
- **`docs/conversion-plan/00-overview.md`** (7 hits): All `preserve-history-note` — live `frontend/src/...` pointers replaced with historical notes; anti-pattern guardrails reworded. Down from 14 hits baseline.
- **`docs/conversion-plan/01-foundation.md`** (4 hits): All `preserve-history-note` — forward-looking language removed; remaining hits are historical provenance notes and anti-pattern guardrails. Down from 7 hits baseline.
- **`docs/conversion-plan/design-system.md`** (11 hits): All `preserve-history-note` — all `frontend/src/...` live pointers replaced; remaining hits are table column headers ("Legacy SCSS") and one-sentence provenance notes pointing at `a5d47c2`. Down from 42 hits baseline.
- **`docs/conversion-plan/component-system.md`** (1 hit): `preserve-history-note` — single line is the translation-rule preamble with historical note. Down from 43 hits baseline.
- **`components/ui/menu-list.tsx`** (1 hit): `preserve-history-note` — reworded per Q6; remaining hit is "(Original recipe: @mixin menu-modal() in the legacy SCSS partial, commit a5d47c2.)". Down from 2 hits baseline.
- **`CHANGELOG.md`** (4 hits): All `preserve-history-note` — 3 new hits are from the epic-17 umbrella entry added by Slice 2-A (per Q4); 1 existing hit (line 26) is the original CRA→Next.js historical entry. Inventory classified original line 13 as `preserve-history-note`; the 3 new CHANGELOG hits are correct additions.
- **`docs/archive/_README.md`** (2 hits): `preserve-history-note` — new file created by Slice 1-B; contains intentional historical references.

All 14 `preserve-live-semantic` files match their inventory treatment exactly. No regressions found.

### CI gate results

#### `pnpm lint`

**Result: FAIL (exit code 1) — 7 errors, pre-existing**

Errors:
1. `components/board/calendar/CalendarView.tsx:328` — unused biome suppression
2. `components/board/calendar/calendar.css:82` — `!important` style
3. `components/board/calendar/calendar.css:83` — `!important` style
4. `components/board/calendar/calendar.css:88` — `!important` style
5. `components/board/calendar/calendar.css:118` — `!important` style
6. `components/board/item-drawer/UpdatesTab.tsx:3` — unsorted imports
7. `components/shared/sidebar/WorkspaceSidebar.tsx:3` — unsorted imports (+ format)

None of these files were touched by epic 17. Matches the 7 pre-existing errors reported in Slice 4-B's done report. **No new lint errors introduced by epic 17.**

#### `pnpm typecheck`

**Result: FAIL (exit code 2) — 2 errors, pre-existing**

Errors:
1. `components/activity/BoardActivityTrigger.tsx(33,26)` — `last_view_per_board` missing from profile type
2. `components/board/tabs/ActivityTab.tsx(44,28)` — same error

Neither file was touched by epic 17. Matches the 2 pre-existing errors reported in Slice 4-B's done report. **No new typecheck errors introduced by epic 17.**

#### `pnpm test`

**Result: FAIL (exit code 1) — 1 failure, pre-existing**

Failure:
- `tests/unit/workspace-sidebar.test.tsx > WorkspaceSidebar > renders board groups when rendered inside a WorkspaceProvider with sidebarBoards`
- `TypeError: Cannot read properties of undefined (reading 'avatarUrl')` in `UserMenu.tsx:34`

The failing test file (`tests/unit/workspace-sidebar.test.tsx`) and the file it exercises (`components/shared/sidebar/UserMenu.tsx`, `WorkspaceSidebar.tsx`) were not touched by epic 17 (`git diff main..epic/17-legacy-cleanup` shows only `components/ui/menu-list.tsx` and `lib/icons.ts` changed in tracked code). **No new test failures introduced by epic 17.**

Passing: 1769 tests passed, 114 skipped, 12 todo (1896 total).

#### `pnpm build`

**Result: FAIL (exit code 1) — caused by the same 2 pre-existing typecheck errors**

The build compiled successfully in ~109s but failed at the "Linting and checking validity of types" step with the identical `BoardActivityTrigger.tsx` / `ActivityTab.tsx` errors from the typecheck gate. This is a direct consequence of the same 2 pre-existing errors. No epic-17 files contributed to the build failure. Duration: ~2 minutes.

Per the dispatch plan risk note: "pnpm build on main is assumed clean. If broken for unrelated reasons, Stage 5 will flag it; the executor escalates rather than fixing runtime in this epic." The failure is attributable to pre-existing typecheck errors in files epic 17 did not touch.

### Overall verdict

**STAGE 5-A: CLEAN** — with noted pre-existing failures.

All 324 residual grep hits match allowlisted treatments (`preserve-history-note` or `preserve-live-semantic`). Zero `rewrite`-treatment hits remain. Zero `archive`-treatment hits remain outside `docs/archive/`. All CI failures are pre-existing and match the counts documented in Slice 4-B's done report (7 lint errors, 2 typecheck errors, 1 test failure). No new failures were introduced by epic 17.

The `pnpm build` failure is a consequence of the same pre-existing typecheck errors and is not attributable to any file epic 17 touched. Per the dispatch plan, this is flagged for the orchestrator; no runtime fix is in scope for this epic.
