# Epic 17 — Legacy Cleanup

## Goal

The rebuild has carried "mid-rewrite" framing since epic 01. Sixteen epics later, that framing is stale: the new app is the app. This epic does a single sweeping cleanup pass over (a) the untracked legacy code folders that still live on disk, (b) repo-tracked files in the root that still talk about the legacy stack as if the rebuild is hypothetical, and (c) the conversion-plan, audit, and pre-planning docs that reference `frontend/src/...` as a source of truth for tokens, components, or behavior. After this epic, a new contributor cloning the repo should never have to read about a CRA + MUI + Redux frontend or an Express + MongoDB backend in order to understand the current product.

## Why this is its own epic

The legacy references are spread across CLAUDE.md, README.md, CONTRIBUTING.md, `docs/conversion-plan/00-overview.md`, almost every numbered conversion-plan epic doc, the entire `docs/audit/` tree, the entire `docs/pre-planning/` tree, and the untracked-but-on-disk `frontend/` (~12 MB) and `backend/` (~20 MB) folders. Touching them piecemeal during a feature epic would either bloat that epic's diff or leave half-cleaned framing behind. A dedicated cleanup epic also gives reviewers one place to confirm the rebuild's "we're done with the legacy" position, instead of trying to ratify that position through a feature PR.

It is **not** a feature epic and ships no runtime code changes. The bar for "done" is: documentation reads correctly for a post-rebuild world, dead references are gone, and the disposition of the local `frontend/`/`backend/` folders is decided and applied.

## In scope

### Local legacy folders (`frontend/`, `backend/`)

- Decide and execute the disposition of the untracked `frontend/` and `backend/` directories that still sit in the working tree (sized 12 MB and 20 MB respectively). Today CLAUDE.md sanctions keeping them locally "for dev reference only." Options to pick between in the planning round (see Open questions): delete from disk, move outside the repo into a maintainer-owned archive location, or formally retire the "keep locally" allowance and leave deletion to each maintainer.
- Whatever option is chosen, update CLAUDE.md and CONTRIBUTING.md's "Legacy code" sections to reflect the new policy. The `.gitignore` entries for `frontend/` and `backend/` stay — they are cheap insurance against accidental re-add.

### Root-level repo docs

- **README.md** — drop "Mid-rebuild" framing from the Status section. The "original CRA + Express + MongoDB app has been removed from git" sentence becomes a single historical footnote (or moves to `CHANGELOG.md`). The Stack section already reads correctly; just remove the "mid-rebuild" qualifier and any phrasing that implies the new app is partially live.
- **CLAUDE.md** — rewrite the intro line ("This repo is mid-rewrite: a CRA + Express + MongoDB app is being rebuilt…") to describe the repo as a Next.js + Supabase + Vercel app, with a one-sentence historical note pointing at git history before `a5d47c2`. The "Legacy code" section either shrinks to one paragraph or is removed entirely (depends on the Open questions answer). The "Stack — non-negotiable defaults" anti-patterns (`No MUI`, `No SCSS in new code`, `No Redux`, `No Socket.IO`, `No Cloudinary`) can stay — they remain useful guardrails — but reword from "in new code" to "in this repo," since there is no other code.
- **CONTRIBUTING.md** — same treatment: the "Legacy code" section rewrites or shrinks; the "No MUI / no SCSS in new code" phrasing rewords to drop the "in new code" qualifier.
- **CHANGELOG.md** — verify the legacy-removal commit (`a5d47c2`) is already noted; if not, add one historical entry.

### Conversion plan (`docs/conversion-plan/`)

Roughly 154 lines across these files reference `frontend/src/...`, "legacy," MUI, or SCSS as a live source of truth. The cleanup is **not** to rewrite history — these docs are records of how the epic was scoped at the time — but to make them read correctly now. The pattern to apply, file by file:

- **00-overview.md** — the "Visual fidelity is a hard contract" paragraph treats `frontend/` as the canonical source for tokens. The tokens are now locked in `design-system.md` and `component-system.md`; the overview should point at those as the source and demote the `frontend/` SCSS reference to a historical note ("originally sourced from the legacy SCSS variables in commit `a5d47c2`"). Same treatment for the "kept locally per CLAUDE.md" parenthetical.
- **design-system.md** and **component-system.md** — both still reference `frontend/src/assets/styles/setup/_variables.scss` and other legacy paths. Replace with absolute statements ("the canonical palette is the `@theme` block in `app/globals.css`"). Where a token's *origin* is interesting, keep one sentence of provenance; drop the live "see the SCSS partial" pointers.
- **01-foundation.md** through **16-board-remediation.md** — global pass to:
  - Replace "match the legacy `frontend/...`" with "match the locked spec in `component-system.md`".
  - Replace "the legacy app does X" descriptions of behavior we have *already shipped* with "the current app does X" (or drop the legacy-comparison framing entirely if the new behavior is settled).
  - Remove any "we will rebuild this from `frontend/src/...`" forward-looking phrasing in epics that have shipped.
  - Leave forward-looking references that genuinely still drive unshipped epics (if any) — flag them in the slice spec, do not silently neutralize them.
- **_dispatch/** — leave the per-epic dispatch artifacts alone. They are point-in-time execution records, not living documentation.

### Pre-rebuild planning docs

- **`docs/audit/`** (12 files, the inventory of the legacy codebase and the migrate-now decision memo) and **`docs/pre-planning/`** (6 files, the predecessor of `docs/conversion-plan/`) are pre-rebuild artifacts. They served their purpose. They are now load-bearing only as historical context.
- **`docs/conversion-refinements/auth-google-only.md`** is the one stray "refinement" doc that was rolled into epic 03; verify it has no unique content not captured elsewhere, then delete or move to archive.
- Disposition options for `docs/audit/` and `docs/pre-planning/`: keep in place with a top-of-folder `_README.md` flagging them as historical; move under a new `docs/archive/` subtree; or delete (the audit decision memo is preserved in `CHANGELOG.md` and the migrate-now reasoning is captured in `docs/conversion-plan/00-overview.md`). See Open questions.

### Runbooks (`docs/runbooks/`)

- Spot-check each runbook (database-restore, incident-response, purge-user-data, rotate-secrets, etc.) for any "legacy app" or "Express / MongoDB" references. Runbooks are operational documentation for the live app — they must not reference systems that no longer exist.

### Tracked code

- Grep for `legacy`, `CRA`, `MUI`, `Redux`, `MongoDB`/`mongo`, `Socket.IO`, `Cloudinary`, `Express` in tracked source code (excluding the conversion plan, audit, pre-planning, and CHANGELOG). Any remaining references in `app/`, `components/`, `lib/`, `hooks/`, `stores/`, `tests/`, `supabase/`, `scripts/`, or `emails/` are likely dead comments and should be removed. If a reference turns out to encode a real constraint, leave it and note it in the slice spec.
- `.claude/agents/`, `.claude/skills/`, `.github/workflows/` — same grep, same treatment.

## Out of scope

- Any runtime code changes that are not stripping a dead reference. If a file's comment mentions MongoDB but the code is correct, the comment is the only thing that changes.
- Schema, RLS, or migration changes. Nothing in this epic touches `supabase/`.
- Re-running the visual-fidelity audit against the legacy `frontend/` screenshots. The locked specs in `design-system.md` and `component-system.md` are the contract; we are not reopening them here.
- Renaming, moving, or restructuring files inside `app/`, `components/`, `lib/`, `hooks/`, `stores/`. Cleanup of *content* only, not layout.
- Touching `node_modules/`, `.next/`, `.turbo/`, `.vercel/`, `pnpm-lock.yaml`, or any generated file.

## Approach

1. **Inventory first.** Before any edits, produce a single inventory file (`docs/conversion-plan/_dispatch/epic-17-inventory.md`) listing every file with a legacy reference and the proposed treatment per file. This is the slice spec's source of truth and keeps the executor from making judgement calls in the dark.
2. **Disposition decisions in planning.** The two Open questions (local folder fate, audit/pre-planning fate) are resolved during `/plan-epic 17`, not by the executor.
3. **One slice per surface, all parallel-safe**: root docs, conversion-plan docs (this slice is the heaviest — may need to subdivide by file group), audit/pre-planning, runbooks, tracked code grep. Each slice only touches files in its surface; no slice rewrites another slice's files.
4. **Verify by re-grep.** After the slices land, re-run the legacy-reference grep against the merged epic branch. The reviewer's done bar is "no unexpected hits remain."
5. **No CI breakage.** The cleanup is mostly markdown, but the tracked-code grep slice may delete comments inside `.ts`/`.tsx`. `pnpm lint && pnpm typecheck && pnpm test` must pass on the epic branch before merge.

## Tasks

1. **Build the inventory** — grep every file with a legacy reference, capture file + line + proposed treatment, write to `_dispatch/epic-17-inventory.md`.
2. **Resolve disposition for local `frontend/` and `backend/` folders** (planning-round decision); update `.gitignore` if needed and apply the chosen action.
3. **Rewrite the "Legacy code" sections in CLAUDE.md and CONTRIBUTING.md** per the resolved disposition.
4. **Update README.md status line** — drop "mid-rebuild" framing.
5. **Reword anti-pattern lists** in CLAUDE.md and CONTRIBUTING.md ("No MUI… in new code" → "No MUI… in this repo").
6. **Conversion-plan pass — `00-overview.md`, `design-system.md`, `component-system.md`.** Demote `frontend/`-as-source references; keep one-sentence provenance lines where the origin is interesting.
7. **Conversion-plan pass — numbered epics `01`…`16`.** Apply the rewrite pattern from the In Scope section. Subdivide into 2–3 parallel slices if needed for review-ability.
8. **Resolve disposition for `docs/audit/`, `docs/pre-planning/`, `docs/conversion-refinements/`** (planning-round decision); apply the chosen action.
9. **Runbook grep** — fix any legacy references in `docs/runbooks/`.
10. **Tracked-code grep** — remove dead legacy comments from `app/`, `components/`, `lib/`, `hooks/`, `stores/`, `tests/`, `supabase/`, `scripts/`, `emails/`, `.claude/`, `.github/`.
11. **Verify** — `pnpm lint && pnpm typecheck && pnpm test` clean; re-run the legacy-reference grep and confirm only expected hits remain (i.e. historical notes that were deliberately kept).
12. **Update CHANGELOG.md** with one entry for the cleanup epic, including the local-folder and audit-folder disposition decisions for future-archaeology purposes.

## Definition of done

- Reading the README, CLAUDE.md, and CONTRIBUTING.md cold gives a contributor a coherent picture of *the current app*. Nothing implies the rebuild is in progress or that the legacy app coexists.
- The "Legacy code" sections in CLAUDE.md and CONTRIBUTING.md either describe the new (post-cleanup) policy or are removed.
- The local `frontend/` and `backend/` folders' fate is decided, applied, and noted in CHANGELOG.md.
- The `docs/audit/`, `docs/pre-planning/`, and `docs/conversion-refinements/` folders' fate is decided, applied, and noted in CHANGELOG.md.
- `docs/conversion-plan/00-overview.md`, `design-system.md`, and `component-system.md` no longer point at `frontend/src/...` paths as live sources of truth. Provenance is preserved where it matters; live pointers are gone.
- The numbered conversion-plan epics (01–16) read as records of work that has shipped, not as forward-looking plans against a legacy reference.
- Runbooks contain no references to the legacy stack.
- `grep -rni "frontend/src\|MongoDB\|MUI\|Socket\.IO\|Cloudinary\|CRA\b" .` (excluding `node_modules`, `.next`, `.git`, `pnpm-lock.yaml`, and `_dispatch/`) returns only an explicitly-allowlisted set of historical-note hits, captured in `_dispatch/epic-17-inventory.md`.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` all pass on the epic branch.
- No runtime behavior changes. Diff is documentation + dead-comment removal only.

## Open questions

- **Local `frontend/` and `backend/` folders.** Delete from disk, move to a maintainer-owned archive outside the repo, or retire the "keep locally" allowance and leave deletion to each maintainer? Recommend: **retire the allowance, delete from disk in this epic, and rely on git history before `a5d47c2`** — the design tokens have been locked in `design-system.md`/`component-system.md` since epic 01's planning round, so the folders' "reference value" has expired.
- **`docs/audit/` and `docs/pre-planning/`.** Keep in place with a `_README.md` historical note, move to `docs/archive/`, or delete? Recommend: **move to `docs/archive/`** — these documents have non-zero archaeological value (the migrate-now decision memo, the feature inventory matrix) but they should not appear alongside live conversion-plan docs.
- **Anti-pattern guardrails wording.** Keep the explicit `No MUI / No Redux / No Socket.IO / No Cloudinary / No MongoDB` list in CLAUDE.md? Recommend: **yes, keep the list, reworded as "this repo uses X, not Y" rather than "no Y in new code"** — the list still steers future dependency choices.
- **CHANGELOG entry granularity.** One umbrella entry, or one per surface (root docs / conversion plan / audit-archive / local folders)? Recommend: **one umbrella entry** referencing this epic doc.
- **In-browser smoke pass.** Epics 16+ require an in-browser smoke pass as part of DoD. This epic ships zero runtime changes, so a smoke pass is theatre. Recommend: **explicitly waive** the in-browser smoke pass and substitute "`pnpm build && pnpm start` boots cleanly" as the runtime gate.

## References

- [`00-overview.md`](00-overview.md) — the visual-fidelity contract whose wording this epic updates.
- [`design-system.md`](design-system.md), [`component-system.md`](component-system.md) — the locked specs that replace `frontend/src/...` as the source of truth.
- [`CLAUDE.md`](../../CLAUDE.md) and [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — the two files whose "Legacy code" sections this epic rewrites.
- Git commit `a5d47c2` — the legacy-removal commit, preserved in history as the archaeological pointer for anyone who needs to read the original codebase.
