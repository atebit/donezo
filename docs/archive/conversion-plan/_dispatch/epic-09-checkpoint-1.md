# Epic 09 — Execution Checkpoint 1

**Paused:** 2026-05-11 (battery on the dev machine)
**Branch state on origin:** `epic/09-comments-activity` @ `9844010` (Slice A + Slice C merged)

## Where we are

| Slice | Scope | Status | Branch |
|---|---|---|---|
| A | Schema, types, server actions, activity vocab, notification helper | **Done, on epic branch** | merged at `810745a` |
| B | Tiptap deps + `<RichTextEditor />` + `<CommentEditor />` + `<CommentComposer />` + `<MentionPopover />` + `<ReactionPicker />` | **In flight when stopped — work lost** | (was `epic-09b-editor-and-composer`; never pushed) |
| C | Board store extensions + realtime wiring | **Done, on epic branch** | merged at `9844010` |
| D | List/item renderers + activity renderer registry | **In flight when stopped — work lost** | (was `epic-09d-list-renderers`; never pushed) |
| E | Per-board Activity modal + topbar trigger | **In flight when stopped — work lost** | (was `epic-09e-board-activity-modal`; never pushed) |
| F | Intercepting-route drawer + tabs + e2e | **Not started** (depends on all of Stage 1) | — |

### Commits already on `origin/epic/09-comments-activity`

```
9844010 Merge Slice C into epic 09: board store + realtime extensions
f741f5d tests(09-C): unit tests for board-store comments/reactions/activity and realtime wiring
29545f4 realtime(09-C): add comment/reaction/activity postgres_changes subscriptions
53a4ad6 store(09-C): extend board-store with comments/reactions/activity slices
850f78a types(09-C): add CommentRow, CommentReactionRow, ActivityRow store types
810745a tests(09-A): add extract-mentions unit tests, comment-actions unit tests, comment_reaction pgTAP
929ec38 actions(09-A): add five comment server actions
91fc93d lib(09-A): add comments/types, comments/mentions, notifications/notify, validations/comment
c623ef1 activity(09-A): extend ActivityType with five comment event ids
be1f5d8 types(09-A): add comment_reaction table types to lib/supabase/types.ts
eae0ec5 schema(09-A): add comment_reaction table + activity/reaction publications
921f84d docs(dispatch): add approved dispatch plan for epic 09 (comments & activity)
```

## Known issues to address before resuming

These were surfaced by the Slice C executor's typecheck pass against Slice A's code. They are real and need fixing before B/D/E are re-dispatched, because B/D/E will fail typecheck against them too.

1. **`lib/validations/comment.ts` — Zod v4 `z.lazy()` API mismatch.**
   The slice spec used the Zod v3 form. Zod v4 changed the signature. The recursive `TiptapNodeSchema` declaration likely needs the updated `z.lazy()` form (or a different recursive pattern — Zod v4 supports `z.lazy()` but the type-inference shape differs). Verify against the installed Zod version in `package.json` and the actual error message before fixing.

2. **`tests/unit/extract-mentions.test.ts` — also broken** by Zod or test-import shape. Fix in lockstep with item 1.

3. **`hooks/use-board-realtime.test.ts` — stale assertion.**
   Slice C noted a now-incorrect `describe.skip`'d test asserting "does NOT register postgres_changes for comment (deferred to epic 09)". Inside a skip block so it does not run, but should be cleaned up so it doesn't mislead the next reader. Fix when vitest is wired in Epic 15, OR in the Slice C followup if other test edits land there first.

4. **`lib/supabase/types.ts` was hand-edited by Slice A** because the Supabase CLI was not available in the sandbox to run `pnpm db:reset && pnpm db:types`. The types should be regenerated against the linked Supabase project to confirm they match what the migrations actually produce. **Run `pnpm db:reset && pnpm db:types` first thing when resuming**, and if the regen diff is non-trivial, commit it as a Slice A followup.

5. **`@everyone` fan-out for public-board implicit members.**
   Slice A's `createComment` expands `@everyone` by querying `board_member`. Workspace members with implicit access to a *public* board (no explicit `board_member` row) are not in that set, so they will not receive notifications. This may be correct (`@everyone` = "everyone with explicit board access") or wrong (`@everyone` = "everyone who can see the board"). Surface to the user before declaring the epic done — likely needs a small spec amendment.

## What was lost

The three in-flight executors (B, D, E) were killed by `TaskStop` before pushing. Their worktrees and any uncommitted changes died with the processes. **No work survived.** When resuming, B/D/E must be re-dispatched from scratch against the same slice specs.

Quick clues from each executor's last-known activity (gleaned from `TaskStop` summaries):

- **Slice B** was writing `RichTextEditor.test.tsx` when stopped. The Tiptap deps installation and editor primitives may have been in progress but were not committed.
- **Slice D** was investigating a Zod v4 `z.record` TS typing issue, likely while consuming `lib/validations/comment.ts` from Slice A. Once issue #1 above is fixed, this likely resolves automatically.
- **Slice E** was working on a `noThenProperty` lint rule issue in a `vi.fn()` mock chain for the `list-board-activity` test. Likely a Biome rule clash with `.then`-returning mocks; needs the standard `mockReturnThis().mockResolvedValue(...)` pattern.

## Resume protocol

When you come back, run:

```
git fetch origin
git checkout epic/09-comments-activity
git pull --ff-only
pnpm install
pnpm db:reset && pnpm db:types   # regen types properly (see issue 4 above)
pnpm typecheck                    # confirm scope of Slice A issues
```

Then:

1. **Fix Slice A typecheck errors** in `lib/validations/comment.ts` + the extract-mentions test. Commit as `fix(09-A): ...` on the epic branch. Push.
2. **Re-dispatch Slice B, D, E in parallel.** Use the same slice specs from `docs/conversion-plan/_dispatch/epic-09.md`. Same flat-named branches: `epic-09b-editor-and-composer`, `epic-09d-list-renderers`, `epic-09e-board-activity-modal`. Each in an isolated worktree off the updated `origin/epic/09-comments-activity` tip.
3. **Merge each slice's sub-branch back** into the epic branch as it returns done (preserves the per-slice commit history under a merge commit, same as Slice C).
4. **Run the Stage 1 Opus review pass** (`epic-researcher` agent) against the diff `origin/main..origin/epic/09-comments-activity` once all of A/B/C/D/E are merged. Followup loop until `CLEAN`.
5. **Stage 2 — Slice F** (sequential). Drawer route + tabs + presence + Playwright e2e. Follow its slice spec in the dispatch plan.
6. **Epic-level review pass.** Followup loop until `CLEAN`.
7. **Open the PR** `epic/09-comments-activity` → `main` via `gh pr create`. Reference this checkpoint, the dispatch plan, and any followups in the body.

## Branching note for future epics

The CLAUDE.md convention `epic/<NN>-<kebab>/<slice-kebab>` for sub-branches is **structurally incompatible** with having `epic/<NN>-<kebab>` as the local epic branch — git refs can't coexist as both leaf and prefix. The Slice A executor hit this; later slices used the flat form `epic-<NN><letter>-<kebab>` (e.g. `epic-09c-store-and-realtime`) which worked. Recommend updating CLAUDE.md to codify the flat sub-branch convention going forward.

## Decisions still locked from planning

For continuity if anyone reads only this file:

- No threading; reply via Tiptap blockquote (quote-reply).
- Hard delete only.
- Local-state pagination, no `@tanstack/react-query`.
- `frimousse` emoji picker.
- Next.js intercepting routes for the drawer.
- Ship per-task tab AND per-board modal.
- `@everyone` mention via sentinel `attrs.id = "everyone"`, expanded at notify time.
- Shared `<RichTextEditor />` primitive; long-text cell retrofit deferred to Epic 11/14.

Full decision rationale + slice specs are in `docs/conversion-plan/_dispatch/epic-09.md`.
