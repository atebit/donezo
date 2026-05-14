# Epic 17 — Legacy Cleanup — Dispatch Plan (approved)

Source epic doc: [`../17-legacy-cleanup.md`](../17-legacy-cleanup.md)
Approved on: 2026-05-14
Open questions Q1–Q8: **user accepted all researcher recommendations** (see "Resolved decisions" below)

## Resolved decisions

| Q | Decision | Notes |
|---|---|---|
| Q1 | **Delete** local `frontend/` and `backend/` folders from disk | Recovery path: git commit `a5d47c2`. Retire the "keep locally" allowance in CLAUDE.md + CONTRIBUTING.md. |
| Q2 | **Move** `docs/audit/`, `docs/pre-planning/`, `docs/conversion-refinements/` to `docs/archive/` | One `docs/archive/_README.md` umbrella note. Update inbound links in `docs/conversion-plan/00-overview.md`. |
| Q3 | **Keep** the anti-pattern guardrail list, reworded from "in new code" to "this repo uses X, not Y" | Preserves the list as a future-PR steering signal. |
| Q4 | **One umbrella `CHANGELOG.md` entry** for epic 17 | Sub-bullets call out Q1 + Q2 dispositions. |
| Q5 | **Waive** the in-browser smoke pass DoD | Substitute `pnpm build` clean (runtime-boot gate). Zero runtime code changes ship in this epic. |
| Q6 | **Reword** stale provenance pointers in `components/ui/menu-list.tsx` + `lib/icons.ts` to point at `docs/conversion-plan/design-system.md` / `component-system.md` | One-sentence historical note where origin is interesting. |
| Q7 | **Explicit grep exclusion** for `.claude/worktrees/` in the verification slice; no CLAUDE.md change | Worktrees are an agent-runner implementation detail. |
| Q8 | **Three parallel slices** for the conversion-plan rewrite: (3-A) anchors, (3-B) epics 01–08, (3-C) epics 09–16 | File-scope partitioning prevents conflict. |

## Preconditions verified by researcher

- Epic 16 merged into `main`; no open epic branch.
- `docs/conversion-plan/17-legacy-cleanup.md` exists and was reviewed end-to-end.
- Local `frontend/` (12 MB) and `backend/` (20 MB) exist on disk, untracked, `.gitignore`-listed.
- No prior `_dispatch/epic-17-*.md` artifacts exist.
- `docs/audit/` (12 files), `docs/pre-planning/` (6 files), `docs/conversion-refinements/` (1 file) present.
- `docs/runbooks/` has zero legacy-stack hits — slice 4-A collapses to a confirmation pass.
- CI scripts (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`) present.

## Legacy-reference inventory headline

Grep pattern: `frontend/src|legacy|MongoDB|\bmongo\b|\bMUI\b|Redux|Socket\.IO|Cloudinary|\bCRA\b|\bExpress\b` (case-insensitive). Exclusions: `node_modules`, `.next`, `.git`, `.turbo`, `_dispatch/`, `frontend/`, `backend/`, `pnpm-lock.yaml`, `tsconfig.tsbuildinfo`, `.claude/worktrees/`.

**41 files hit. Treatment classes:**

- **Rewrite (8 files):** `docs/conversion-plan/00-overview.md`, `design-system.md`, `component-system.md`, epics 01–16, root docs.
- **Archive (~23 files):** entire `docs/audit/`, `docs/pre-planning/`, `docs/conversion-refinements/` trees.
- **Preserve-live-semantic (10 files):** `components/board/MigrateLegacyColumnPrefs.tsx`, `components/board/BoardDataProvider.tsx`, `components/rich-text/AttachmentImageNode.tsx`, `components/board/dashboard/Dashboard.tsx`, `lib/cells/types.ts`, `lib/board/load-board-snapshot.ts`, `lib/notifications/kinds.ts`, `stores/board-store.ts`, `tests/unit/use-visible-columns.test.ts`, `tests/unit/board-store-views.test.ts`, `tests/unit/AttachmentImageNode.test.tsx`, `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`, `supabase/migrations/20260516000000_notifications_epic13.sql`, `tests/policies/README.md`. **These files MUST NOT be edited by any slice.**
- **Stale provenance, reword (2 files):** `components/ui/menu-list.tsx`, `lib/icons.ts`.

Full file-by-file inventory is produced by Slice 0-A as `_dispatch/epic-17-inventory.md` and is the source of truth subsequent slices read against.

## Stage graph

```
Stage 0 (inventory)
        │
        ▼
Stages 1 + 2 + 3 + 4 (run in parallel)
        │
        ▼
Stage 5 (verification)
```

## Slice specs

### Stage 0 — Inventory (sequential, runs first, blocks everything)

#### Slice 0-A: Build legacy-reference inventory

- **Branch:** commit directly on `epic/17-legacy-cleanup`
- **Writes (exactly one file):** `docs/conversion-plan/_dispatch/epic-17-inventory.md` (new)
- **Reads:** entire repo
- **Forbidden:** any other write
- **Spec:** Run the full legacy-reference grep with the exclusion list above. For each hit, record `file:line:matched-text:proposed-treatment`. Valid treatments: `rewrite`, `archive`, `preserve-live-semantic`, `preserve-history-note`. Cross-reference against the headline classification in this plan. Output is the source of truth for Stages 1–4. An executor on a later slice that encounters a hit not listed in the inventory must escalate `needs-direction`, not make a judgement call.
- **DoD:** Inventory file exists, classifies every grep hit, is committed.
- **Escalation triggers:** any file whose hit doesn't fit the four treatments; hit count divergence >10% from the headline; new code files added since the headline grep was run that contain legacy strings.

### Stage 1 — Disposition execution (parallel, after Stage 0)

#### Slice 1-A: Delete local `frontend/` + `backend/` folders (Q1 = delete)

- **Sub-branch:** `epic/17-legacy-cleanup/slice-1a-local-folders`
- **Filesystem ops:** `rm -rf frontend backend` from repo root
- **Forbidden:** any other write; do NOT edit `.gitignore` (entries stay)
- **Spec:** Confirm both directories are untracked (`git ls-files frontend backend` empty) before delete. Confirm nothing under either directory is staged. Spot-check both directories for any `.env*` files or other files that look like maintainer-personal state before delete — escalate if found. After delete, append a one-line note at the bottom of `_dispatch/epic-17-inventory.md` recording the action.
- **DoD:** `frontend/` and `backend/` no longer on disk. `git status` shows no tracked-file changes (they were untracked).
- **Escalation triggers:** unexpected files under `frontend/`/`backend/` that look like secrets or in-flight maintainer work.

#### Slice 1-B: Archive audit / pre-planning / conversion-refinements (Q2 = move to `docs/archive/`)

- **Sub-branch:** `epic/17-legacy-cleanup/slice-1b-archive-docs`
- **Writes/moves:**
  - `git mv docs/audit docs/archive/audit`
  - `git mv docs/pre-planning docs/archive/pre-planning`
  - `git mv docs/conversion-refinements docs/archive/conversion-refinements`
  - **Create** `docs/archive/_README.md` (new) — one-paragraph umbrella note explaining what's in the archive, pointing at git commit `a5d47c2` for legacy-code archaeology, and noting these subtrees are point-in-time artifacts that are not updated.
- **Forbidden:** any edit to the contents of files inside the moved subtrees; any write under `docs/conversion-plan/`; any write under `docs/runbooks/`.
- **Spec:** Use `git mv` so history follows. The single inbound link from `docs/conversion-plan/00-overview.md` (to `docs/audit/00-index.md` and `docs/audit/11-recommendation-migrate-now.md`) is **not** rewritten by this slice — slice 3-A handles it concurrently using the Q2 decision recorded here.
- **DoD:** Three subtrees moved under `docs/archive/`. `docs/archive/_README.md` created. No edits inside moved files.
- **Escalation triggers:** any inbound link from outside `docs/archive/`'s eventual contents (other than the known one in `00-overview.md`) that would break — flag, do not silently rewrite.

### Stage 2 — Root-doc rewrite (parallel with Stages 3, 4)

#### Slice 2-A: Rewrite root docs

- **Sub-branch:** `epic/17-legacy-cleanup/slice-2a-root-docs`
- **Writes (exactly four files):** `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `CHANGELOG.md`
- **Forbidden:** every other file, including `.claude/agents/*.md` (slice 2-B), every `docs/` file, all tracked code.
- **Spec:**
  - **`CLAUDE.md`:**
    - Rewrite the intro line at line 3 (currently "This repo is mid-rewrite: a CRA + Express + MongoDB app is being rebuilt as a Next.js 15 + Supabase + Vercel app...") to a single sentence describing the repo as a Next.js 15 + Supabase + Vercel application, with a one-sentence historical note pointing at commit `a5d47c2` for legacy archaeology.
    - Rewrite the "Legacy code" section (lines 5–11) per Q1 = delete: the section either shrinks to a single paragraph stating "the legacy CRA + MUI + Redux frontend and Express + MongoDB backend were removed in commit `a5d47c2`; see git history for archaeology" or is removed entirely. The "Do not re-add legacy code to the repo" guardrail stays in some form.
    - Reword the Stack defaults anti-pattern lines per Q3: "No MUI, no SCSS in new code" → "This repo uses Tailwind v4 + shadcn/ui + Base UI, not MUI or SCSS." Same pattern for "No Redux," "No Socket.IO," "No Cloudinary."
    - Workflow section and Branching/commits/PRs section unchanged.
  - **`CONTRIBUTING.md`:**
    - Same anti-pattern rewording for line 77.
    - Rewrite "Legacy code" section (lines 89–95) per Q1 = delete.
  - **`README.md`:**
    - Rewrite the status line (line 7) — drop "Mid-rebuild" framing. New phrasing should describe the current shipping app, with a parenthetical pointing at `CHANGELOG.md` for rebuild history.
    - Line 20 ("no Redux") stays as a stack-table entry.
  - **`CHANGELOG.md`:**
    - Append one umbrella entry dated 2026-05-14 for epic 17 per Q4. Sub-bullets describe Q1 (delete `frontend/`+`backend/`) and Q2 (move audit/pre-planning/conversion-refinements to `docs/archive/`). Do not touch existing entries.
- **DoD:** All four files read coherently for a contributor who has never seen the legacy app. No "mid-rebuild" or "rebuild is in progress" framing remains. Anti-pattern guardrails preserved with new wording.
- **Escalation triggers:** any line whose rewrite would change a non-legacy semantic.

#### Slice 2-B: Rewrite `.claude/agents/` legacy references

- **Sub-branch:** `epic/17-legacy-cleanup/slice-2b-claude-agents`
- **Writes (exactly two files):** `.claude/agents/epic-executor.md`, `.claude/agents/epic-researcher.md`
- **Forbidden:** every other file, including `.claude/commands/*.md`, `.claude/launch.json`, `.claude/skills/`, root docs (slice 2-A).
- **Spec:** Reword the three lines that reference live `frontend/` and `backend/` directories (epic-executor.md line 26; epic-researcher.md lines 82, 129) per Q1 = delete. Replace prohibition language ("Never modify legacy `frontend/` or `backend/`") with a historical note that the legacy code was removed in `a5d47c2` and is no longer on disk. No other edits — the agent workflow contracts are unchanged.
- **DoD:** No references to live `frontend/` or `backend/` directories in either agent doc. Agent contracts unchanged.
- **Escalation triggers:** any other legacy reference in the agent docs not noted in the inventory.

### Stage 3 — Conversion-plan rewrite (parallel with Stages 2, 4)

#### Slice 3-A: Anchors — overview + design-system + component-system

- **Sub-branch:** `epic/17-legacy-cleanup/slice-3a-conversion-plan-anchors`
- **Writes (exactly three files):** `docs/conversion-plan/00-overview.md`, `docs/conversion-plan/design-system.md`, `docs/conversion-plan/component-system.md`
- **Forbidden:** every numbered epic doc (01–17), every `_dispatch/` artifact, every other docs subtree, every root doc, all tracked code.
- **Spec:** This is the heaviest rewrite slice (~99 hits).
  - **`00-overview.md`:** Rewrite the "Visual fidelity is a hard contract" paragraph so the canonical source of truth is `design-system.md` + `component-system.md`, with a one-sentence historical note that the tokens were originally sourced from the legacy SCSS variables in commit `a5d47c2`. Remove the "kept locally per CLAUDE.md" parenthetical. Stack-table UI row: keep "Replace MUI + SCSS" rationale as historical justification, drop forward-looking framing. **Update inbound links from `docs/audit/00-index.md` → `docs/archive/audit/00-index.md` and `docs/audit/11-recommendation-migrate-now.md` → `docs/archive/audit/11-recommendation-migrate-now.md`** per Q2.
  - **`design-system.md`:** Replace live `frontend/src/...` pointers with absolute statements ("the canonical palette is the `@theme` block in `app/globals.css`"). Keep one-sentence historical provenance pointing at commit `a5d47c2` where the origin is interesting.
  - **`component-system.md`:** Same treatment. "match the legacy `frontend/src/cmps/...` component" → "match the locked contract in this doc, §X."
  - **Do NOT bulk-substitute.** "Legacy" appears in semantically-loaded contexts that must stay (e.g. "we are not migrating legacy data shapes"). Each hit gets a judgement; consult the inventory artifact. Escalate `needs-direction` if unsure.
- **DoD:** All three files read as records of current-app design decisions. Provenance preserved as one-sentence notes; live pointers gone. Inbound links to archived audit pages updated. `pnpm build` unaffected.
- **Escalation triggers:** any hit not classified by the inventory; any dropped pointer that would create a dangling link.

#### Slice 3-B: Rewrite numbered epics 01–08

- **Sub-branch:** `epic/17-legacy-cleanup/slice-3b-conversion-plan-01-08`
- **Writes (exactly eight files):** `docs/conversion-plan/01-foundation.md`, `02-supabase-schema.md`, `03-auth.md`, `04-authorization-rls.md`, `05-workspaces-boards.md`, `06-groups-tasks-table.md`, `07-column-system.md`, `08-realtime-presence.md`
- **Forbidden:** every other file. Specifically: 00 / design-system / component-system (slice 3-A), epics 09–17 (slice 3-C / out of scope), every `_dispatch/` artifact, every audit/pre-planning file.
- **Spec:** Apply the rewrite pattern:
  - "match the legacy `frontend/...`" → "match the locked spec in `component-system.md`"
  - Past-tense legacy-comparison descriptions of behavior already shipped → drop the comparison or restate as "the current app does X"
  - Forward-looking "we will rebuild this from `frontend/src/...`" in shipped epics → remove
  - Leave any forward-looking reference that **still drives unshipped work** — flag in the inventory's notes column, do not silently neutralize.
- **DoD:** All eight epic docs read as records of work that has shipped. No live `frontend/src/...` pointers remain. Provenance preserved where origin is interesting.
- **Escalation triggers:** any hit whose rewording would change a still-relevant forward-looking statement; any cross-file link that would break.

#### Slice 3-C: Rewrite numbered epics 09–16

- **Sub-branch:** `epic/17-legacy-cleanup/slice-3c-conversion-plan-09-16`
- **Writes (exactly eight files):** `docs/conversion-plan/09-comments-activity.md`, `10-attachments.md`, `11-filtering-views.md`, `12-alternate-views.md`, `13-notifications.md`, `14-mobile-a11y-polish.md`, `15-observability-testing-cicd.md`, `16-board-remediation.md`
- **Forbidden:** every other file. Specifically excludes `docs/conversion-plan/17-legacy-cleanup.md` — the epic doc does not get rewritten by its own epic.
- **Spec:** Same pattern as slice 3-B. Hit counts are much lower (mostly 1–2 per file); janitorial pass.
- **DoD:** Same as 3-B for epics 09–16. `17-legacy-cleanup.md` is **not** edited.
- **Escalation triggers:** same as 3-B.

### Stage 4 — Runbook spot-check + tracked-code provenance reword (parallel with Stages 2, 3)

#### Slice 4-A: Runbook verification pass

- **Branch:** commit directly on `epic/17-legacy-cleanup` (expected no-op write to `_dispatch/epic-17-inventory.md` only)
- **Reads:** `docs/runbooks/*.md` (9 files)
- **Forbidden:** every other file
- **Spec:** Runbooks are clean per the headline inventory. Re-run the grep against `docs/runbooks/` and append the result to `_dispatch/epic-17-inventory.md` as a "Stage 4-A runbook verification: clean / no edits" note. If the re-grep surfaces an unexpected hit, escalate `needs-direction` (do not silently rewrite — it would expand the file scope mid-stage).
- **DoD:** Inventory artifact records the runbook verification result. Runbook files unchanged.
- **Escalation triggers:** any unexpected legacy hit not classified by Stage 0.

#### Slice 4-B: Reword stale provenance in tracked code (Q6)

- **Sub-branch:** `epic/17-legacy-cleanup/slice-4b-tracked-code`
- **Writes (exactly two files):** `components/ui/menu-list.tsx`, `lib/icons.ts`
- **Forbidden (read-only):** `components/board/MigrateLegacyColumnPrefs.tsx`, `components/board/BoardDataProvider.tsx`, `components/rich-text/AttachmentImageNode.tsx`, `components/board/dashboard/Dashboard.tsx`, `lib/cells/types.ts`, `lib/board/load-board-snapshot.ts`, `lib/notifications/kinds.ts`, `stores/board-store.ts`, `tests/unit/use-visible-columns.test.ts`, `tests/unit/board-store-views.test.ts`, `tests/unit/AttachmentImageNode.test.tsx`, `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`, `supabase/migrations/20260516000000_notifications_epic13.sql`, `tests/policies/README.md`. Every other file outside the two-file allowlist is also forbidden.
- **Spec:**
  - **`components/ui/menu-list.tsx` lines 7–8:** Reword the header comment that currently points at `frontend/src/assets/styles/setup/_mixins.scss:107-132` to point at `docs/conversion-plan/design-system.md` (the section that captured the menu's tokens). Optional one-sentence historical note that the original provenance was the legacy SCSS partial.
  - **`lib/icons.ts` line 5:** The comment already points at the locked spec; the only stale-flavored word is "legacy." Reword "legacy react-icons" → "the original react-icons set" or drop the back-reference entirely.
- **Verification:** `pnpm lint && pnpm typecheck && pnpm test` must pass on the slice branch before it merges.
- **DoD:** Two files reworded. No other tracked-code file modified. Lint/typecheck/test pass.
- **Escalation triggers:** any tracked-code file the executor believes should be edited that is not in the two-file allowlist — escalate, do not edit.

### Stage 5 — Verification (sequential, runs last)

#### Slice 5-A: Re-grep + CI gate

- **Branch:** commit directly on `epic/17-legacy-cleanup`
- **Writes:** `docs/conversion-plan/_dispatch/epic-17-inventory.md` (append verification report)
- **Spec:**
  - Re-run the legacy-reference grep with the same exclusions plus `.claude/worktrees/` per Q7.
  - Diff the re-grep against the inventory's "Treatment" column. Every remaining hit must be classified `preserve-live-semantic` or `preserve-history-note`. Any `rewrite`-treatment hit still present is a regression.
  - Run `pnpm lint && pnpm typecheck && pnpm test` against the epic branch. All must pass.
  - Run `pnpm build` (Q5 runtime-boot gate). Must complete without error.
  - Append a "Stage 5-A verification report" to `_dispatch/epic-17-inventory.md` with: re-grep hit count, classification breakdown, command exit codes, build result.
- **DoD:** Re-grep shows only allowlisted hits; lint/typecheck/test/build all green; verification report committed.
- **Escalation triggers:** any unallowlisted residual hit; any CI command failing.

## Sequential follow-ups

- Stage 5-A is the only sequential follow-up after Stages 1–4.
- Post-Stage-5 epic-researcher review against the epic doc's DoD. Loop on followups until `CLEAN`.

## Risk notes (carried from researcher report)

- **Q1 is irreversible.** Recovery path: git commit `a5d47c2`.
- **Q2's move is link-breaking.** Slice 1-B and slice 3-A run in different stages but concurrently. Slice 3-A's executor computes the new link path from Q2 = move-to-archive (resolved here, not at execution time).
- **"Legacy" is semantically overloaded.** Bulk-substitution would break runtime. Per-slice allowlists neutralize this. The 10 forbidden-edit files in slice 4-B are the explicit guard.
- **`.claude/worktrees/` exclusion** added to the verification re-grep per Q7.
- **`pnpm build` on `main` is assumed clean.** If broken for unrelated reasons, Stage 5 will flag it; the executor escalates rather than fixing runtime in this epic.
- **`17-legacy-cleanup.md` is not edited by its own epic.** Intentional; spec is the spec.
