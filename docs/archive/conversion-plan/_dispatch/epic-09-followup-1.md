# Epic 09 — Followup Round 1

## Review summary

- **Stage reviewed:** Stage 1 (Slices A–E), diff range `origin/main..origin/epic/09-comments-activity` at HEAD `3472e9f`.
- **Verdict:** `FOLLOWUP REQUIRED`.

### Definition-of-done items met

Cross-checked against `docs/conversion-plan/09-comments-activity.md` "Definition of done" and the per-slice DoDs in `docs/conversion-plan/_dispatch/epic-09.md` (A.10, B.9, C.5, D.9, E.7):

- Schema: `comment_reaction` migration applies, has RLS + the `board_id` consistency trigger mirroring Epic 08. Activity is in `supabase_realtime` publication. (Risk note 2 addressed.)
- `ActivityType` union extended with the five `comment.*` ids; JSDoc payload table present (lib/activity.ts L43–L57).
- `extractMentions` returns `{ userIds, everyone }`, handles the sentinel `attrs.id = "everyone"`, dedupes user ids, walks nested nodes, treats malformed/null input safely.
- Five server actions (`createComment`, `editComment`, `deleteComment`, `reactComment`, `unreactComment`) exist, wrapped in `withUser`, parse via Zod, route through user-client with admin-delete fallback documented.
- `notifyUsers` is best-effort + admin-client-only + never throws.
- pgTAP spec asserts the six required reaction RLS cases incl. cascade.
- Board store has `commentsByTask`, `reactionsByComment`, `activityByTask` Maps with idempotent applyXxx + hydrate + the three selectors (`selectCommentsForTask`, `selectGroupedReactions`, `selectTaskActivity`); `reset()` clears them; persisted slices unchanged.
- `useBoardRealtime` subscribes to `comment`, `comment_reaction`, `activity` with `board_id=eq.${boardId}` filters and routes events to store actions; reactions UPDATE and activity UPDATE/DELETE are warn-and-ignore.
- Tiptap deps installed (`@tiptap/*@3.23.1`, `frimousse@0.3.0`, `lowlight@3.3.0`); `<RichTextEditor />` is a generic primitive with the Epic 10 image-paste plugin seam in place.
- `<CommentEditor />` exposes `quoteReply()` via ref and implements the blockquote insertion per Q1.
- `<CommentComposer />` does optimistic-insert → reconcile-or-rollback through the store; consumes `useTypingBroadcast` (first production consumer).
- `<MentionPopover />` pins "Everyone on this board" first; supports arrow-nav and Esc.
- `<ReactionPicker />` is frimousse-in-Base-UI-Popover.
- `<CommentList />`, `<CommentItem />`, `<CommentReactions />`, `<CommentBody />` exist; "edited" badge at >5s delta; `?comment=<id>` scroll/highlight present; reactions optimistic via store.
- `<ActivityList />`, `<ActivityItem />`, `<CellInline />`, renderer registry exist; every `ActivityType` id has a registered renderer (verified by diff between `lib/activity.ts` types and the keys across `components/activity/renderers/*.tsx`).
- `listBoardActivity` server action: cursor-based pagination on `(created_at desc, id desc)`, filter clauses for actor / actionGroups / date range, viewer-or-higher gate.
- `<BoardActivityModal />`, `<BoardActivityFilters />`, `<BoardActivityTrigger />` are wired into `BoardHeaderClient.tsx`.

### Definition-of-done items NOT met

1. **Slice E.7 — "All Slice D renderers fire correctly inside the modal" — not met.** `BoardActivityTrigger` constructs `EMPTY_CTX = { columns: new Map(), labelsByColumn: new Map(), profiles: new Map() }` and passes an empty `members` array into the modal. With no `columns` / `labelsByColumn`, the `cell.changed` renderer can't resolve column metadata and falls through to `JSON.stringify(from/to)` instead of rendering the colored pill. With no `profiles`, every actor renders as "Someone". With no `members`, the actor filter section is suppressed entirely (`{members.length > 0 && (...)}` in `BoardActivityFilters.tsx`). This is a real spec gap, not a future-tense placeholder — Slice E owned both the trigger and the modal and was responsible for threading these in.

### Other issues found

2. **Three Slice D files still use `require()` + try/catch as the inter-slice import seam** to load Slice B's `CommentEditor` and `ReactionPicker`. Both slices are now merged so the seams should become static ESM imports and the inline duplicate type definitions should be replaced with imports from the Slice B sources of truth.
   - `components/comments/CommentItem.tsx` L348–L362 (`tryGetCommentEditor`, `_EditorCached`, local `CommentEditorProps` and `MemberOption` re-declarations at L37–L50 / L338–L346)
   - `components/comments/CommentBody.tsx` L21–L54 (`getCommentEditor`, local `CommentEditorProps` at L25–L38)
   - `components/comments/CommentReactions.tsx` L37–L58 (`tryGetReactionPicker`, local `ReactionPickerProps` at L39–L42)

3. **Orphan "Activity feed (coming soon)" disabled button** at `components/board/BoardHeaderClient.tsx` L97–L106 alongside the new `<BoardActivityTrigger />` at L150 — the topbar now has two "Activity" controls, one disabled and one functional.

4. **`@everyone` fan-out misses workspace members with implicit access to public boards.** `app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions.ts` L323–L341 expands `@everyone` by querying `board_member` only. On a non-private board, workspace members who have implicit `role_for_board != null` access have no `board_member` row and are silently skipped. The comment at L338–L341 acknowledges this and defers to the per-target `role_for_board` filter — but the filter only runs against already-collected `targetIds`, so implicit-access users are never collected in the first place. **This is decision-dependent — surface as an open question; the user owns the semantics of `@everyone` on public boards.**

5. **Edit-time mention dedup ignores the `everyone` flag.** Same file, L294–L348. `_fanOutMentions` receives `previousMentionIds: string[]` (user ids only) for the edit-diff path. If the prior comment body contained `@everyone` and the edited body still contains `@everyone`, all board members get re-notified on every edit because the old "everyone" expansion isn't recorded as a previous mention. Carry `previousEveryone: boolean` into the helper and skip the expansion when it was already present.

6. **Hand-edited `lib/supabase/types.ts` for the `comment_reaction` table** (checkpoint issue 1). I read the hand-added types against the migration: the shape (Row / Insert / Update / Relationships) matches what `supabase gen types typescript` would emit for this table. Not a blocker; flag a one-line followup to regen on a CLI-enabled host and commit any drift as a separate `types: regen after Epic 09 Slice A` commit.

### Items explicitly NOT in scope for this followup

- Slice F (drawer + tabs + e2e + presence + intercepting routes) — Stage 2, intentionally not started.
- `--color-chip-everyone` design token (checkpoint issue 6) — already documented in code comments as Epic 14 polish.
- The stale `describe.skip`'d "does NOT register postgres_changes for comment" assertion mentioned in checkpoint issue 3 — Slice C's executor handled it; not re-flagged here.
- The pre-Epic-15 `describe.skip` + `@ts-expect-error vitest` test pattern across new specs — this is the established repo norm (40+ existing test files follow it). Epic 15 will unskip.

---

## Followup slices

Three small slices. **All three are parallel-safe** (disjoint owned-file sets). All target the merged epic branch `epic/09-comments-activity` directly (sub-branches encouraged; the flat naming form `epic-09f1-*` per the checkpoint's branching note).

---

### Slice F1.1 — Thread real `ctx` and `members` into `<BoardActivityTrigger />` / `<BoardActivityModal />`

**Branch:** `epic-09f1-board-activity-ctx-wiring`

**Owns (write):**
- `components/activity/BoardActivityTrigger.tsx`
- `components/board/BoardHeaderClient.tsx`

**Forbidden:** Any other file. Do not touch `BoardActivityModal.tsx`, `BoardActivityFilters.tsx`, the renderer registry, or `BoardHeader.tsx` (server). Do not refactor the modal's `useEffect` open-trigger behavior. Do not introduce new server-side data fetching — the data needed is already in `BoardHeaderClient`'s props and the board store.

**Depends on:** none (Slice E already merged).

**Spec:**

`<BoardActivityTrigger />` currently constructs `EMPTY_CTX` with empty Maps and passes an empty `members` array to `<BoardActivityModal />`, which causes Slice E DoD item "All Slice D renderers fire correctly inside the modal" to fail (cell.changed payloads fall through to `JSON.stringify`, actors render as "Someone", actor filter is hidden).

#### F1.1.A — Extend `BoardActivityTrigger` props

Update `BoardActivityTrigger.tsx` to accept `members` as a prop and to build the renderer `ctx` at render-time from the board store. Drop `EMPTY_CTX`.

New prop shape:

```ts
interface BoardActivityTriggerProps {
  members: Array<{
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  }>;
}
```

Inside the component (it is already `"use client"` so it can use Zustand hooks directly):

```ts
import { useBoardStore } from "@/stores/board-store";
import type {
  ActivityRenderCtx,
  ColumnRow,
  LabelRow,
  ProfileRow,
} from "@/components/activity/renderers";

// inside the component body:
const columnsArr = useBoardStore((s) => s.columns);
const labelsByColumn = useBoardStore((s) => s.labelsByColumn);

const ctx: ActivityRenderCtx = useMemo(() => {
  const columns = new Map<string, ColumnRow>();
  for (const c of columnsArr) columns.set(c.id, c);

  // Build a partial ProfileRow per known member (sufficient for resolveActor +
  // ActivityItem avatar). Unknown fields default to null / synthetic values to
  // satisfy ProfileRow's required shape without inventing data.
  const profiles = new Map<string, ProfileRow>();
  for (const m of members) {
    profiles.set(m.id, {
      id: m.id,
      display_name: m.displayName,
      email: m.email,
      avatar_url: m.avatarUrl,
      // Required-by-type but unused in renderers — safe synthetic values.
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
      last_workspace_id: null,
    });
  }

  return { columns, labelsByColumn, profiles };
}, [columnsArr, labelsByColumn, members]);
```

Pass `ctx` and `members` (mapped to `<BoardActivityModal>`'s `Member = { id, displayName, email }` shape — the modal does not need `avatarUrl`) into the modal:

```tsx
<BoardActivityModal
  open={open}
  onOpenChange={setOpen}
  ctx={ctx}
  members={members.map((m) => ({ id: m.id, displayName: m.displayName, email: m.email }))}
/>
```

Remove the `EMPTY_CTX` constant and the `void board.id;` no-op line.

The `void board.id;` line is dead — remove it.

#### F1.1.B — `BoardHeaderClient.tsx` edit

The component already has `members: Member[]` in its props. Pass them through:

```tsx
<BoardActivityTrigger members={members} />
```

at the existing insertion site (L150). `BoardHeaderClient`'s `Member` type already matches the prop shape required by the trigger (`id`, `displayName`, `email`, `avatarUrl`) — `role` is an extra field that the trigger ignores. No remapping needed beyond what's already there.

#### F1.1.C — Type imports

`ColumnRow`, `LabelRow`, `ProfileRow`, and `ActivityRenderCtx` are exported from `components/activity/renderers/index.ts` — import them from there, not from `@/lib/supabase/types`. Keep the registry as the canonical source.

#### F1.1.D — Definition of done

- `EMPTY_CTX` no longer exists in the codebase.
- Opening the board activity modal renders `cell.changed` payloads through `<CellInline />` (the cell registry resolves columns from the store).
- Actor avatars and names resolve to the real board members (when the actor is a board member).
- The actor filter checkbox column is visible in `<BoardActivityFilters />`.
- `pnpm typecheck` passes.
- `pnpm lint` passes.

#### F1.1.E — Escalation triggers

- If `ProfileRow` has additional required columns the store does not have data for, stop and surface; do not invent values beyond the documented safe-synthetic set (`created_at = epoch`, `updated_at = epoch`, `last_workspace_id = null`).
- If the existing `Member` type in `BoardHeaderClient.tsx` is structurally incompatible with what the trigger needs, stop and surface — do not add a parallel server fetch.

---

### Slice F1.2 — Replace `require()` import seams with static imports; remove duplicate type defs

**Branch:** `epic-09f1-static-import-seams`

**Owns (write):**
- `components/comments/CommentItem.tsx`
- `components/comments/CommentBody.tsx`
- `components/comments/CommentReactions.tsx`

**Forbidden:** Any other file. Do not change `CommentEditor.tsx` or `ReactionPicker.tsx` exports (the contract is fine; only the consumer-side seam is changing). Do not change any of the existing tests for these three files. Do not modify component behavior or visual output — this is a refactor pass only.

**Depends on:** none (Slice B + Slice D both merged).

**Spec:**

Slice D was authored before Slice B merged, so it used a `require()` + try/catch dynamic-load pattern to consume Slice B's components. Now that both are on the epic branch, those seams must become ordinary static imports.

For each of the three files:

1. **Delete the dynamic-load helper.** Remove `_EditorCached` / `_ReactionPickerCached` module-scope state and the corresponding `tryGetXxx()` / `getXxx()` functions.
2. **Delete the local duplicate type re-declarations.** Replace with named imports from the canonical Slice B source.
3. **Replace the conditional render branch.** The "fallback when Slice B hasn't landed yet" branches (`<textarea>` placeholder in `CommentItem`, plain-text preview in `CommentBody`, naked `addButton` without a picker in `CommentReactions`) are dead and should be removed entirely.
4. **Re-export `CommentComposerHandle` from `CommentComposer.tsx`, not from `CommentItem.tsx`.** `CommentItem.tsx` currently re-defines `CommentComposerHandle` locally; the canonical definition is in `components/comments/CommentComposer.tsx`. `CommentItem` and `CommentList` should both import it from there. (`CommentList` already does the right thing by importing from `./CommentItem` — switch that import to `./CommentComposer` once the type is re-exported.) `MemberOption` similarly should be imported from `CommentEditor.tsx` rather than re-declared.

#### F1.2.A — `CommentItem.tsx`

Replace lines 17–28 imports block. Add:

```ts
import { CommentEditor, type CommentEditorHandle, type MemberOption } from "./CommentEditor";
import type { CommentComposerHandle } from "./CommentComposer";
```

Remove the local `interface CommentComposerHandle`, the local `interface MemberOption`, and the local `interface CommentEditorProps` (L37–L50, L338–L346). Re-export the type for back-compat consumers:

```ts
export type { CommentComposerHandle, MemberOption };
```

Delete `_EditorCached`, `tryGetCommentEditor`, and the `CommentEditor ? <CommentEditor .../> : <textarea .../>` branch in `InlineEditForm`. The textarea fallback comes out entirely; use `<CommentEditor ... />` unconditionally.

#### F1.2.B — `CommentBody.tsx`

Replace the dynamic-load block with:

```ts
import { CommentEditor } from "./CommentEditor";
```

Delete `_CommentEditor`, `getCommentEditor`, the local `interface CommentEditorProps`, and the plain-text fallback branch (L86–L102). The component becomes a 30-line render that always uses `<CommentEditor readOnly initialDoc={doc} mentionableMembers={[]} />`.

#### F1.2.C — `CommentReactions.tsx`

Replace the dynamic-load block with:

```ts
import { ReactionPicker } from "./ReactionPicker";
```

Delete `_ReactionPickerCached`, `tryGetReactionPicker`, and the local `interface ReactionPickerProps`. The `ReactionPicker ? <ReactionPicker .../> : addButton` branch becomes `<ReactionPicker onSelect={handleReact} trigger={addButton} />` unconditionally.

#### F1.2.D — Definition of done

- No `require()` calls remain in any `components/comments/*` file (verify with `rg "require\(" components/comments/`).
- No `tryGet*` / `_*Cached` module-scope helpers remain.
- `CommentComposerHandle` is exported only from `CommentComposer.tsx`.
- `MemberOption` is exported only from `CommentEditor.tsx`.
- `CommentList.tsx` imports `CommentComposerHandle` from `./CommentComposer` (not `./CommentItem`).
- `pnpm typecheck` passes.
- `pnpm lint` passes.

#### F1.2.E — Escalation triggers

- If removing the local re-declaration of `CommentEditorProps` causes a type mismatch (i.e. the actual `CommentEditorProps` exported by `CommentEditor.tsx` is narrower than what `CommentBody` was calling with), stop and surface — do not loosen the canonical type. The fix is likely on the call-site (drop `readOnly` / `mentionableMembers={[]}` as defaults if they're already optional in the canonical type).

---

### Slice F1.3 — Remove orphan "Activity feed (coming soon)" button; fix `@everyone` edit re-notify

**Branch:** `epic-09f1-everyone-and-orphan-button`

**Owns (write):**
- `components/board/BoardHeaderClient.tsx`
- `app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions.ts`

**Forbidden:** Any other file. Do not touch the migration files, the Zod schemas, the activity vocab, or the notification helper. Do not change the @everyone expansion source (that's Q-A1 below — out of scope for this slice). Do not modify `BoardActivityTrigger`.

**Depends on:** none. **Parallel-safe with F1.1 in spite of both touching `BoardHeaderClient.tsx`** — F1.1 inserts a `members` prop at L150, F1.3 deletes the dead button at L97–L106. The line ranges do not overlap. Coordinate via the orchestrator if both are dispatched simultaneously; otherwise serialize them.

If the executor sees a `BoardActivityTrigger members={members}` already in the file when starting, they should leave that line alone and only remove the orphan button.

**Spec:**

#### F1.3.A — Remove orphan button

In `components/board/BoardHeaderClient.tsx`, delete lines 97–106 (the disabled "Activity feed (coming soon)" `<button>` inside the tool row). The functional `<BoardActivityTrigger />` at L150 stays.

Verify the surrounding `<div className="flex items-center gap-1">` tool row still has at least one child after the removal (Members, Invite, Description remain).

#### F1.3.B — Fix `@everyone` edit re-notify

In `app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions.ts`:

Change the `_fanOutMentions` signature to accept `previousEveryone: boolean` alongside `previousMentionIds: string[]`. Update the body:

```ts
async function _fanOutMentions({
  doc,
  boardId,
  taskId,
  commentId,
  actorId,
  supabase,
  previousMentionIds,
  previousEveryone,   // NEW
}: {
  // ...existing fields
  previousMentionIds: string[];
  previousEveryone: boolean;   // NEW
}): Promise<void> {
  try {
    const { userIds: rawUserIds, everyone } = extractMentions(doc);

    let targetIds = new Set<string>(rawUserIds);

    // Only expand @everyone when it's newly added.
    // If it was present on the previous version too, the prior createComment /
    // editComment already fanned out to every board member; re-expanding would
    // re-notify them on every subsequent edit.
    if (everyone && !previousEveryone) {
      const { data: members } = await supabase
        .from("board_member")
        .select("user_id")
        .eq("board_id", boardId);
      if (members) for (const m of members) targetIds.add(m.user_id);
    }

    targetIds.delete(actorId);

    const previousSet = new Set(previousMentionIds);
    targetIds = new Set([...targetIds].filter((id) => !previousSet.has(id)));

    // ...rest unchanged
  } catch {
    /* best-effort */
  }
}
```

Update both call sites:

- `createComment` (L75): pass `previousMentionIds: [], previousEveryone: false`.
- `editComment` (L129–L138): compute `const oldExtraction = extractMentions(existing.body as unknown as TiptapDoc);` once, then pass `previousMentionIds: oldExtraction.userIds, previousEveryone: oldExtraction.everyone`. (Currently `oldMentions` already exists with the user-id list; just also forward `everyone`.)

Drop the now-misleading comment on L338–L341 (the `// Also include workspace members who have implicit board access. // For simplicity and correctness, we rely on role_for_board check below ...` block) — its premise (that the role check below would catch implicit-access users) is incorrect because users not in `targetIds` are never checked. **Replace** with a single-line note: `// NOTE: For public boards, workspace members with implicit access are NOT expanded here. See followup Q-A1.`

#### F1.3.C — Definition of done

- `BoardHeaderClient.tsx` shows exactly one Activity-named control in the topbar (the working `<BoardActivityTrigger />`).
- `_fanOutMentions` accepts a `previousEveryone` boolean and only expands `@everyone` to board members on first appearance.
- Editing a comment whose old + new body both contain `@everyone` results in zero new notifications (assuming no additional explicit mentions were added).
- `pnpm typecheck` passes.
- `pnpm lint` passes.

#### F1.3.D — Escalation triggers

- If `BoardHeaderClient.tsx` has been restructured by F1.1 such that the line numbers no longer match, locate the orphan button by its `aria-label="Activity feed (coming soon)"` attribute — that's a stable identifier.
- If adding the `previousEveryone` parameter breaks the existing `comment-actions.test.ts` mocks, **do not modify the test** — it is `describe.skip`'d pre-Epic-15. The shape change is forward-compatible; Epic 15 will adapt.

---

## Open questions for the user

### Q-A1 (decision-blocking for `@everyone` semantics on public boards)

The current `createComment` implementation expands `@everyone` by querying `board_member` only. On a **non-private** board, workspace members have implicit `role_for_board != null` access without any `board_member` row, so `@everyone` does **not** notify them.

Slice A's spec (and Q7 in the dispatch decisions table) said: "everyone with explicit board access". The current behavior implements that literal reading. The user should confirm which is intended:

- **Option A — current behavior is correct.** `@everyone` = "everyone with an explicit `board_member` row". On a public board, only the rows that exist are notified; workspace members with implicit access are silently skipped. Document this in `CONTRIBUTING.md` when Slice F lands and ship as-is. **No code change.**
- **Option B — `@everyone` should follow the access model.** Expand to: (rows in `board_member` for the board) ∪ (rows in `workspace_member` for the board's workspace, when the board is public). De-dupe; filter actor; cap at a reasonable threshold (the dispatch plan flagged the >50-member case as out of scope). This is a one-query addition: when `board.is_private` is false, additionally `select user_id from workspace_member where workspace_id = (select workspace_id from board where id = boardId)`. **Requires a new followup slice if chosen.**

If Option B is chosen, the new followup slice would touch:
- `app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions.ts` only (the `_fanOutMentions` helper).
- A new test case in `tests/unit/comment-actions.test.ts` for the public-board path (still under `describe.skip` pre-Epic-15).

The slice would be small (~30 LOC) and parallel-safe with F1.1 and F1.2; it is not pre-written here because it depends on the user's answer.

### Q-A2 (informational, not blocking)

The hand-edited `lib/supabase/types.ts` `comment_reaction` block has been read against the migration and matches what `supabase gen types typescript` would emit. Do you want a "types: regen against linked project" slice queued for after this followup round to confirm-by-replay on a CLI-capable host, or are you comfortable deferring that to the next sprint where regen happens for some other reason? Either is defensible.

---

## Files referenced (absolute)

- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/docs/conversion-plan/09-comments-activity.md`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/docs/conversion-plan/_dispatch/epic-09.md`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/docs/conversion-plan/_dispatch/epic-09-checkpoint-1.md`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions.ts`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/activity/BoardActivityTrigger.tsx`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/activity/BoardActivityModal.tsx`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/activity/BoardActivityFilters.tsx`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/activity/renderers/index.ts`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/board/BoardHeader.tsx`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/board/BoardHeaderClient.tsx`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/comments/CommentBody.tsx`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/comments/CommentComposer.tsx`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/comments/CommentEditor.tsx`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/comments/CommentItem.tsx`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/comments/CommentList.tsx`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/comments/CommentReactions.tsx`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/components/comments/ReactionPicker.tsx`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/lib/activity.ts`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/lib/supabase/types.ts`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/stores/board-store.ts`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/supabase/migrations/20260513000000_comment_reactions_and_activity_publication.sql`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/supabase/migrations/20260513000001_comment_reaction_rls.sql`
- `/Volumes/SSD512-1/Dev/donezo/.claude/worktrees/serene-hawking-6b45c5/supabase/migrations/20260507120000_authz_helpers.sql`
