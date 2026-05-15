# Epic 17 — Followup Round 1

## Review summary

- Stage reviewed: Stage 0, commit `20046f4` on `epic/17-legacy-cleanup` (Slice 0-A only)
- Verdict: **FOLLOWUP REQUIRED**
- Definition-of-done items met:
  - Inventory file exists at `docs/conversion-plan/_dispatch/epic-17-inventory.md` and is committed.
  - Every grep hit is classified with one of the four valid treatments (`rewrite`, `archive`, `preserve-live-semantic`, `preserve-history-note`).
  - All 14 `preserve-live-semantic` files (slice 4-B forbidden list) are correctly tagged. The inventory also flagged the dispatch plan's "10 files" undercount and supplied the authoritative 14, which is correct.
  - All 17 archive-treatment files inside `docs/audit/`, `docs/pre-planning/`, `docs/conversion-refinements/` are tagged `archive`.
  - Root docs (`CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `CHANGELOG.md`) tagged `rewrite` with slice 2-A noted; `CHANGELOG.md:13` correctly carved out as `preserve-history-note`.
  - `.claude/agents/epic-executor.md` and `epic-researcher.md` tagged `rewrite` with slice 2-B noted.
  - `00-overview.md`, `design-system.md`, `component-system.md` tagged `rewrite` (slice 3-A).
  - `docs/conversion-plan/17-legacy-cleanup.md` tagged `preserve-history-note`. Confirmed against the dispatch plan: no slice's writes list includes this file.
  - Reserved appendix sections for slices 1-A, 4-A, 5-A exist with `(pending)` placeholders.
  - The 13 extra files (54 vs 41 projected) all fit into already-scoped slice treatment categories. Independent re-grep confirms no extra file falls outside the existing slice file scopes.
  - Sentinel-hits section enumerates 10 known-tricky cases; all carry `preserve-live-semantic` (or `preserve-history-note` for #10 CHANGELOG.md:13).
- Definition-of-done items NOT met:
  - **The documented grep methodology contains a path-prefix bug that breaks the exclusion filter.** Stage 5-A is required to "re-run the legacy-reference grep with the same exclusions" and "diff the re-grep against the inventory's Treatment column." Stage 5-A cannot do that reliably if the documented command is broken.
- Other issues found:
  - The headline metric "620 lines" is not reproducible from the documented command.
  - The count-discrepancy table sums to 11, not 13 (cosmetic; explanation is otherwise sound).

## Followup slices

### Followup slice 0-A.1: Fix the inventory methodology section and headline counts

- **Owner:** epic-executor (sonnet)
- **Branch:** commit directly on `epic/17-legacy-cleanup`
- **Writes (exactly one file):** `docs/conversion-plan/_dispatch/epic-17-inventory.md`
- **Forbidden:** every other file. No filesystem operations outside this artifact.

#### Problem 1 — grep exclusion pattern does not match the actual paths

The inventory documents this command (lines 30–41):

```sh
grep -rEni "frontend/src|legacy|MongoDB|\bmongo\b|\bMUI\b|Redux|Socket\.IO|Cloudinary|\bCRA\b|\bExpress\b" \
  --include="*.md" --include="*.ts" --include="*.tsx" --include="*.js" \
  --include="*.json" --include="*.sql" --include="*.yaml" --include="*.yml" \
  --exclude-dir="node_modules" --exclude-dir=".next" --exclude-dir=".git" \
  --exclude-dir=".turbo" --exclude-dir="frontend" --exclude-dir="backend" \
  --exclude="pnpm-lock.yaml" --exclude="tsconfig.tsbuildinfo" \
  . \
| grep -v "^\./docs/conversion-plan/_dispatch/" \
| grep -v "^\./\.claude/worktrees/" \
| sort
```

`grep -r .` (on macOS Darwin 24 and GNU grep) does NOT prepend `./` to the matched paths in its output. The output paths look like `docs/conversion-plan/_dispatch/...`, not `./docs/conversion-plan/_dispatch/...`. Therefore the two `grep -v "^\./..."` filter lines never match anything and the exclusions never fire. Running the documented command verbatim returns **962 lines** (the inventory claims 620 and 54 unique files; the file count is correct but only because elsewhere the executor must have used a different command, or used `cut -d: -f1 | sort -u` after filtering by full path substring).

The fix: change both filter patterns to anchor without the `./` prefix. Either:

```sh
| grep -v "^docs/conversion-plan/_dispatch/" \
| grep -v "^\.claude/worktrees/" \
```

or, more robust, use a single combined exclusion:

```sh
| grep -Ev "^(docs/conversion-plan/_dispatch/|\.claude/worktrees/)"
```

Either form is acceptable; pick one and document it. The corrected command must be reproducible from a clean checkout.

#### Problem 2 — headline line count is wrong

Running the corrected command (with the working exclusions) produces **429 lines across 54 unique files**, not 620 across 54 unique files.

Update line 43 of the inventory ("Total lines: 620 (across 54 unique files)") to the verified line count from the corrected command. **The 54-file figure is correct and should remain unchanged.** Re-verify the line count by actually running the corrected command from the repo root on the current `epic/17-legacy-cleanup` HEAD and recording the result. Note: the inventory file itself now exists at `docs/conversion-plan/_dispatch/epic-17-inventory.md` and is excluded by the corrected filter (it's inside `_dispatch/`), so its presence does not affect the count.

#### Problem 3 — count-discrepancy table arithmetic

The table on line 51 enumerates 1 + 2 + 8 = 11 extra files, but the prose says 13. The actual divergence is 54 − 41 = 13. Update the table to enumerate all 13 extras (the missing two appear to be the `.claude/agents/` pair already listed under category 2, plus one more that needs to be identified by the executor — likely a docs/audit or docs/pre-planning file that the original 41-file projection missed, or the inventory itself counting `docs/conversion-plan/17-legacy-cleanup.md` once where it should have been counted separately from the existing 41). The executor must reconcile the arithmetic exactly so the table sums to 13.

If reconciliation reveals that one or more "extras" actually fall **outside** the slice file scopes defined in the dispatch plan, escalate `needs-direction` — that would mean a new slice is required.

#### Definition of done

- Inventory's "Command run" code block exclusions match the actual `grep -r .` output path format (no `./` prefix).
- Running the corrected command from the repo root on the current `epic/17-legacy-cleanup` HEAD produces the line count and file count documented in the inventory's "Total lines" headline (line 43) and "Headline summary" table (lines 716–721).
- The count-discrepancy table (lines 51–56) enumerates all 13 extra files; arithmetic adds up.
- No other content of the inventory is edited — per-file treatments, per-hit table, sentinel-hits, and reserved appendix sections remain byte-for-byte identical.

#### Escalation triggers

- Any extra file (among the 13) that does not fit an already-scoped slice.
- Re-grep line count divergence from the inventory's current per-hit table after the fix is applied (i.e., the corrected grep finds a hit not classified in the per-hit table). This would mean an inventory miss, not just a methodology bug.
- The corrected line count is wildly different from both 620 and 429 (suggests a third grep variant was used and is now lost).

### Followup slice 0-A.2: not required

No other followup slices needed. The classifications, sentinel coverage, per-file treatments, and reserved appendix sections all check out against the dispatch plan and against an independent re-grep.

## Stage gate

Once followup 0-A.1 merges into `epic/17-legacy-cleanup`, Stages 1–4 are unblocked and may proceed in parallel as planned. The followup is small (single-file edit, no new analysis) and does not need re-review before stages 1–4 dispatch — the orchestrator may dispatch stages 1–4 immediately after the followup commit lands.
