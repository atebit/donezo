# Epic 17 — Followup Round 2

## Review summary

- **Stage reviewed:** Stages 1–4 combined, commit range `main..epic/17-legacy-cleanup` (15 commits through `d7343fe`).
- **Verdict:** **FOLLOWUP REQUIRED**
- **Definition-of-done items met:**
  - Q1: `frontend/` and `backend/` gone from working tree; `.gitignore` retains both.
  - Q2: `docs/audit/`, `docs/pre-planning/`, `docs/conversion-refinements/` archived to `docs/archive/*` with full file counts (12 + 6 + 1) and `git log --follow` preserves history. `docs/archive/_README.md` present and accurate.
  - Q3: Anti-pattern guardrails in `CLAUDE.md`, `CONTRIBUTING.md`, README.md reworded to "this repo uses X, not Y" form. "Mid-rebuild" / "being rebuilt" framing removed.
  - CHANGELOG.md has one new umbrella entry for epic 17 dated 2026-05-14 covering Q1/Q2/Q3.
  - Slice 3-A: live `frontend/src/...` pointers in `00-overview.md`, `design-system.md`, `component-system.md` rewritten to historical notes. Inbound audit links updated to `docs/archive/audit/`.
  - Slice 3-B / 3-C: all 16 numbered epic docs (01-08, 09-16) have `frontend/src` hit count of 0. `17-legacy-cleanup.md` is unchanged.
  - Slice 4-A: runbook verification appendix in inventory marked CLEAN with no edits to `docs/runbooks/*`.
  - Slice 4-B: `components/ui/menu-list.tsx` and `lib/icons.ts` reworded (anchor `§9.2` in design-system.md exists).
  - **None of the 14 forbidden-edit files** are touched in the diff (verified via `git diff main..HEAD --name-only`).
  - Corrected grep methodology run against working tree returns **323 hits across 44 unique files** (down from baseline 428 / 54 files). Of those, 37 are in `17-legacy-cleanup.md` (correct: preserve-history-note), 175 are in `docs/archive/*` (correct: preserve-history-note), and the rest match `preserve-live-semantic` treatments listed in the inventory.

- **Definition-of-done items NOT met:**
  - `.claude/agents/epic-executor.md` and `epic-researcher.md` still contain three stale live references that survived slice 2-B. These are operational instructions to agents, not historical notes — they will mislead future executors.
  - Two anchors inserted by slice 3-C inbound links into `component-system.md` dangle: `§4.3 update-editor-card` and `§7.2 dashboard-widgets` do not exist in slice 3-A's revised `component-system.md`.

- **Other issues found:** none. Stage 1-A and Stage 5-A appendix sections of the inventory remain `(pending)`, which is the expected state for this review point.

---

## Followup slices

All three issues are surgical edits to docs only. Parallel-safe: each owns a distinct file. Sonnet can dispatch slices 2-Bf and 3-Cf concurrently.

### Slice 2-Bf: agent doc residuals

- **Owner:** epic-executor (sonnet)
- **Scope:** `.claude/agents/epic-executor.md`, `.claude/agents/epic-researcher.md`
- **Forbidden scope:** anything outside `.claude/agents/`
- **Dependencies on other slices:** none.

#### Issues to fix

1. **`.claude/agents/epic-executor.md` line 90** currently reads:
   ```
   - No modifying `frontend/` or `backend/`.
   ```
   This is a live prohibition framed as if the folders still exist. They do not. The inventory's grep pattern (`frontend/src`) missed this bare-`frontend/` form. Rewrite to a historical / post-rebuild rule, for example:
   ```
   - Do not re-add legacy code under `frontend/` or `backend/`. Both folders were removed in commit `a5d47c2` and are now `.gitignore`-listed. See the "Do not re-add legacy code" rule above.
   ```
   The exact wording is the executor's choice as long as it (a) does not imply the folders are live and (b) preserves the underlying don't-touch-legacy intent. Surrounding bullets in the "Hard prohibitions" section must remain unchanged in meaning.

2. **`.claude/agents/epic-researcher.md` line 23** currently reads:
   ```
   5. Relevant audit notes in `docs/audit/` only if they materially affect a decision
   ```
   Slice 1-B moved that path to `docs/archive/audit/`. Update the path. Suggested rewrite:
   ```
   5. Relevant audit notes in `docs/archive/audit/` only if they materially affect a decision (point-in-time, no longer maintained)
   ```
   The "only if they materially affect a decision" qualifier must remain — that is the load-bearing semantic.

#### Definition of done

- After this slice, `grep -nE "\bfrontend\b|\bbackend\b" .claude/agents/*.md` returns **only lines framed as historical notes pointing at commit `a5d47c2`**. No bare prohibitions like "No modifying `frontend/`".
- `grep -n "docs/audit/" .claude/agents/*.md` returns no hits. `grep -n "docs/archive/audit/" .claude/agents/epic-researcher.md` returns line 23 (or whatever line it ends up on).
- No other content in either agent doc is changed.

#### Escalation triggers

- If you find further frontend/backend references in the agent docs beyond the three listed above (and the three historical-note references on lines 26 / 82 / 129 which are correct and should stay), stop and escalate — the inventory may have a wider methodology gap than recorded.

---

### Slice 3-Cf: fix dangling anchors

- **Owner:** epic-executor (sonnet)
- **Scope:** `docs/conversion-plan/09-comments-activity.md`, `docs/conversion-plan/12-alternate-views.md`
- **Forbidden scope:** `docs/conversion-plan/component-system.md` (do not add new sections to component-system.md — that is out of scope for epic 17), any other epic doc, any code file.
- **Dependencies on other slices:** none.

#### Issues to fix

1. **`docs/conversion-plan/09-comments-activity.md` line 264** currently links to `component-system.md#43-update-editor-card`:
   ```
   - **Update editor card** — ... See [§4.3](component-system.md#43-update-editor-card).
   ```
   No `### 4.3` section exists in `component-system.md`. Section 4 only has `4.1 CommentList & CommentItem` and `4.2 ActivityList & ActivityItem`. The "update editor card" pattern is a sub-element of the comment composer, which lives under §4.1. **Fix:** repoint the link to `#41-commentlist--commentitem`:
   ```
   - **Update editor card** — ... See [§4.1](component-system.md#41-commentlist--commentitem) (the editor chrome is part of the CommentList contract).
   ```
   The visual contract sentence ("outline `1px solid --color-primary`, ...") must remain unchanged.

2. **`docs/conversion-plan/12-alternate-views.md` line 214** currently links to `component-system.md#72-dashboard-widgets`:
   ```
   - Dashboard widgets: 2px border ... (see [§7.2](component-system.md#72-dashboard-widgets)). Widget headers separated by `1px solid --color-border-strong`.
   ```
   No `### 7.2` section exists in `component-system.md`. Section 7 only has `7.1 KanbanBoard lanes & cards` — dashboard widgets are not covered in `component-system.md` at all. **Fix:** remove the link and demote the reference to a self-contained spec line. Suggested rewrite:
   ```
   - Dashboard widgets: 2px border `--color-border-strong` with hover border-color `--color-primary`. Widget headers separated by `1px solid --color-border-strong`. (Dashboard widget chrome is not separately specified in `component-system.md`; this line is the contract.)
   ```
   No other bullet in the "Match — Calendar / Timeline / Dashboard / Form" block changes.

#### Definition of done

- `grep -nE "component-system\.md#43|component-system\.md#72" docs/conversion-plan/` returns **zero hits**.
- `grep -nE "component-system\.md#41|component-system\.md#42|component-system\.md#71" docs/conversion-plan/09-comments-activity.md docs/conversion-plan/12-alternate-views.md` shows the still-valid anchors are untouched.
- No edits to `component-system.md`. No new sections added.
- No other content changed in either epic doc.

#### Escalation triggers

- If you discover more dangling `component-system.md#NN-*` anchors elsewhere in `docs/conversion-plan/`, list them in your done report but do not fix them in this slice — stop and escalate so the reviewer can decide whether the scope expands.

---

## Open questions for the user

None. All three issues have a single sensible fix path.

## Stack defaults restated for executors

- pnpm only (not relevant for doc-only edits, but do not introduce package changes).
- Do not modify any code file. Doc-only diff.
- Do not run formatters across unrelated lines. Edit the specific lines noted above and nothing else.
- No `--no-verify`, no force pushes.
