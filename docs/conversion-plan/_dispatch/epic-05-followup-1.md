# Epic 05 — Followup Round 1

## Review summary

- **Stage reviewed:** Stage 2 — server actions + invite/accept polish (slices 5, 6, 7).
  Commit range: `7f1bbca..HEAD` on `epic/05-workspaces-boards` (commits `9123cde`, `bc29b7c`, `ce7bbdf`).
- **Verdict:** FOLLOWUP REQUIRED.

### Definition-of-done items met
**Slice 5 — Workspace actions**
- `setLastWorkspace`, `renameWorkspace`, `updateWorkspaceSlug`, `deleteWorkspace`, `setWorkspaceMemberRole`, `removeWorkspaceMember`, `revokeInvitation`, `resendInvitation` all exist with the expected signatures, role gates, and error codes.
- All four action files start with `"use server"`.
- All inputs are parsed via the Slice 2 Zod schemas.
- `requireWorkspaceRole` / `requireBoardRole` is invoked in each action; the `revokeInvitation` / `resendInvitation` branching on `inv.board_id` matches the spec.
- `setWorkspaceMemberRole` correctly gates `role === 'owner'` behind a second `requireWorkspaceRole(_, 'owner')` check.
- `updateWorkspaceSlug` handles `23505` as a `VALIDATION` error with `field: "slug"` and redirects to the new slug after success.
- `deleteWorkspace` strict-matches `confirmName` and redirects to `/`.
- `tests/unit/workspace-actions.test.ts` exists with `describe.skip`.
- `pnpm typecheck` is clean for Stage-2 files. The pre-existing Zod 4 / RHF resolver errors in epic-03/04 form components are unchanged (per epic-04 final review tracker; risk note 4 in dispatch plan).

**Slice 6 — Board actions**
- `renameBoard`, `starBoard`, `archiveBoard`, `restoreBoard`, `deleteBoard`, `duplicateBoard` exist in `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts`.
- `starBoard` upserts on starred=true and deletes on starred=false against `user_starred_board`, with the correct `onConflict: "user_id,board_id"` and self-only RLS path.
- `archiveBoard` sets `deleted_at = now()` after fetching `workspace_id` for revalidation.
- `restoreBoard` calls `supabase.rpc("restore_board", { p_board_id })` and maps `P0001` / `P0002` / `42501` to `VALIDATION` / `NOT_FOUND` / `FORBIDDEN`.
- `deleteBoard` loads the board, gates on `requireWorkspaceRole(_, 'owner')`, strict-matches `confirmName`, and hard-deletes.
- `duplicateBoard` calls `supabase.rpc("clone_board", { p_board_id })`, returns `{ boardId }`, and revalidates `boards:<workspaceId>`.
- `updateBoardDescription` and `setBoardPrivacy` live in `settings/general/actions.ts`. `setBoardPrivacy(true)` correctly upserts `board_member { role: 'owner' }` for the caller.
- `setBoardMemberRole` and `removeBoardMember` live in `settings/members/actions.ts`.
- `supabase/migrations/20260508000001_restore_board_rpc.sql` defines `restore_board(uuid)` as `security definer`, asserts workspace admin+ via `role_rank(workspace_member.role) >= role_rank('admin')`, refuses non-archived boards (`P0001`), and grants execute to `authenticated`.
- Migration filenames sort correctly: `20260508000000_workspaces_polish.sql` then `20260508000001_restore_board_rpc.sql`.
- `tests/unit/board-actions.test.ts` exists with `describe.skip`.

**Slice 7 — Invitation accept page**
- Page is RSC; no `"use client"` directive.
- All four invalid-state branches render with distinct copy: not-found, already-accepted, revoked, expired.
- Email-mismatch branch renders with a "sign out and switch account" form.
- Active-state UI uses `WorkspaceLogoTile` from Slice 3, names the workspace + role, and shows the board name when present.
- `accept()` server action wrapper calls the existing `acceptInvitation` action — no reimplementation.
- No raw hex literals; all colors use `var(--color-*)` tokens from epic 01.
- `pnpm lint` and `pnpm typecheck` are clean for this file.

### Definition-of-done items NOT met
1. **F1 was not executed before Stage 2.** The dispatch plan (line 1773) is explicit: "All Stage 2+ slices block on F1 because they read the new schema fields via the generated types." Stage 2 ran without F1, and three workarounds entered the codebase as a result. F1 must run now to retire those workarounds before Stage 3.
2. **`lib/supabase/types.ts` was hand-edited in Slice 5** (commit `9123cde`) to add `revoked_at` and `last_workspace_id`. The file is generator-owned (`pnpm db:types`); the manual edits are correct as far as they go but **incomplete** — they do not include `board.description`, `column.icon`, the `user_starred_board` table, the `clone_board` RPC, the `restore_board` RPC, or the `board_select_archived` policy reference. Subsequent slices and Stage-3 callers will continue to need `as any` casts until F1 regenerates the file.
3. **Slice 6 ships two `noExplicitAny` lint warnings** at:
   - `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts:72` — `const sb = supabase as any` for the `user_starred_board` table.
   - `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/actions.ts:13` — `(supabase as any).from("board").update({ description })`.
   Both are intentional workarounds for the missing types (correctly commented "types updated in F1") but the dispatch plan's resolution path is F1, not biome-ignore.
4. **Slice 7 issues a redundant second query** at `app/(auth)/join/[token]/page.tsx:69-73` to fetch `revoked_at` separately because the executor did not realize Slice 5's commit had already added `revoked_at` to `invitation` in the manually-patched types file. This is two DB round-trips for one row.

### Other issues found
5. **Slice 7 dead form input.** `app/(auth)/join/[token]/page.tsx:229` includes `<input type="hidden" name="token" value={token} />` inside the accept form, but the `accept()` server action takes no parameters and reads `token` from the closure scope. The hidden input is never consumed. Cosmetic only.
6. **`renameWorkspace` is missing `revalidatePath`.** Spec line 1042 specifies both `revalidateTag('workspace:'+id)` and `revalidatePath('/w/'+slug)`. Only the tag call is present. Pages downstream that don't tag their fetches will need a manual reload after rename. Minor — confirmed via Stage 3/4 reviewers, but flagging here so the orchestrator can decide whether to fix in this round or defer.

### Cross-slice consistency
- No action file imports from a sibling slice's actions. Shared dependencies (`@/lib/actions`, `@/lib/authorization`, `@/lib/validations/*`, `@/lib/utils/invitation-token`, `@/lib/logger`) are common-good imports only.
- Stage 2 did not modify `frontend/` or `backend/` legacy paths.
- Migration ordering is correct: `20260508000000_workspaces_polish.sql` precedes `20260508000001_restore_board_rpc.sql`.

---

## Followup slices

These slices fix the gaps the review identified. F1.1 must run first; F1.2 and F1.3 are parallel-safe after F1.1 lands.

### Slice F1.1 — Run F1 (db:push + db:types regen)

**Owner:** epic-executor (sonnet) · **Sequential — must precede F1.2 and F1.3**
**Depends on:** Stage 1 migrations (`20260508000000_workspaces_polish.sql`, `20260508000001_restore_board_rpc.sql`) being on the branch — they are.

#### Files
- `lib/supabase/types.ts` (regenerated — full file rewrite by `pnpm db:types`)

#### Spec

Apply the Stage-1 migrations to the linked cloud Supabase project, then regenerate the TypeScript schema types from the cloud schema. The two new migrations are already committed on the branch but have not been pushed.

Steps:
1. Verify the supabase CLI is linked: `pnpm db:lint` should succeed against the linked project (no auth or link issues). If not linked, escalate — do not attempt `supabase link` without the project ref from the user.
2. Run `pnpm db:push` to apply the two new migrations (`20260508000000_workspaces_polish.sql`, `20260508000001_restore_board_rpc.sql`) to cloud.
3. Run `pnpm db:types` to regenerate `lib/supabase/types.ts` from the cloud schema. This will overwrite the file. The regenerated file should contain:
   - `profile.last_workspace_id: string | null` (Row/Insert/Update)
   - `board.description: string` with a default of empty string (Row), and `description?: string` (Insert/Update)
   - `column.icon: string | null` (Row/Insert/Update)
   - `invitation.revoked_at: string | null` (Row/Insert/Update)
   - A new `user_starred_board` table entry with `user_id`, `board_id`, `starred_at` and the FK relationships.
   - A new `Functions.clone_board` entry with `Args: { p_board_id: string }; Returns: <board row shape>`.
   - A new `Functions.restore_board` entry with `Args: { p_board_id: string }; Returns: <board row shape>`.
4. Commit the regenerated types in **a single dedicated commit**: `chore(types): regenerate Database after epic-05 stage-1 migrations (F1)`.
5. Do **not** modify any other file in this commit. The cleanup of `as any` casts and the redundant Slice 7 query happen in the parallel followup slices F1.2 and F1.3.

#### Definition of done
- `lib/supabase/types.ts` reflects the cloud schema after both new migrations are applied. The file passes `tsc --noEmit` (no Stage-2 file should regress; the pre-existing Zod 4 / RHF resolver errors in form components are unchanged).
- The diff in this commit is **only** `lib/supabase/types.ts`. No other file changes.
- The new types include `user_starred_board`, `clone_board`, `restore_board`, `column.icon`, `board.description`, `profile.last_workspace_id`, and `invitation.revoked_at` (this is the verification checklist; if any are missing, the migration didn't apply correctly — escalate).

#### Forbidden scope
- Does not modify any action file, page, component, schema, or test.
- Does not author migrations or edit migration files.
- Does not edit `lib/supabase/types.ts` by hand — only the generator output is acceptable. If the generator output is missing a field, escalate (the underlying migration is at fault, not the types).

#### Escalation triggers
- If `pnpm db:push` fails because the migrations conflict with the cloud schema state — escalate (do not run `db:reset`).
- If the regenerated types file lacks one of the expected fields — escalate; the underlying migration is the real bug.
- If supabase CLI is not linked to a project, escalate.

---

### Slice F1.2 — Retire Slice 6's `as any` workarounds and the manual types diff

**Owner:** epic-executor (sonnet) · **Parallel-safe with F1.3** · **Depends on F1.1**

#### Files
- `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts` (modify — remove `as any` casts, remove the local `SupabaseWithRpc` types)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/actions.ts` (modify — remove `as any`)

#### Spec

After F1.1 lands, the regenerated `types.ts` provides full typing for `user_starred_board`, `board.description`, `clone_board`, and `restore_board`. The Stage-2 workarounds in Slice 6 should be removed.

Concrete edits:

**`app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts`**
- In `starBoard`: delete the `eslint-disable-next-line` comment, the `// user_starred_board is not in generated types yet` comment, and the `const sb = supabase as any;` line. Replace `sb` with `supabase` in both the upsert and delete branches. The `error.message` reads should resolve as typed `string`, so the `(error as { message: string }).message` narrowings can be simplified to `error.message`.
- In `restoreBoard`: delete the `// types updated in F1 (supabase gen types)` comment and the entire local `type SupabaseWithRpc = { ... }` declaration. Call `supabase.rpc("restore_board", { p_board_id: input.boardId })` directly. The error mapping (`P0001`, `P0002`, `42501`) and `data` return are unchanged. Cast `data` only if the regenerated `Returns` type is incompatible with the action's return type — verify against the regenerated file before casting.
- In `duplicateBoard`: delete the `// clone_board RPC — types updated in F1` comment and the local `type SupabaseWithRpc` declaration. Call `supabase.rpc("clone_board", { p_board_id: input.boardId })` directly. The cast `data as { id: string; workspace_id: string }` may now be replaceable with a typed result; verify against the regenerated `Returns` type. If the regenerated `Returns` type is the full board row, narrow accordingly. Do not change the action's return shape (`{ boardId: newBoard.id }`).

**`app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/actions.ts`**
- In `updateBoardDescription`: delete the `// board.description added in workspaces_polish migration; not in generated types yet` comment, the `eslint-disable-next-line`, and the `(supabase as any)` cast. Use `supabase.from("board").update({ description, updated_at }).eq("id", input.boardId)` directly.

#### Definition of done
- Zero `as any` and zero `eslint-disable-next-line @typescript-eslint/no-explicit-any` (or `biome-ignore`) lines in the two files.
- `pnpm lint` reports zero `noExplicitAny` warnings for these two files (the previous two warnings should be gone; no new ones introduced).
- `pnpm typecheck` is clean for these two files.
- All actions retain their existing signatures, role gates, error codes, and revalidation calls. The behavior is identical — only the types shrink-wrap.
- The local `SupabaseWithRpc` type aliases are removed from both `restoreBoard` and `duplicateBoard`.

#### Forbidden scope
- Does not modify `lib/supabase/types.ts` (F1.1 owns it).
- Does not modify any other action file, page, component, schema, or test.
- Does not change action behavior, role checks, error mappings, or revalidation tags.
- Does not modify migrations.

#### Escalation triggers
- If the regenerated `Returns` type for `clone_board` or `restore_board` is `null` or `unknown` (instead of a board row), escalate. The migration may need a `returns public.board` adjustment, which is out of this slice's scope.
- If removing the `as any` cast in `updateBoardDescription` causes a typecheck error (e.g., `description` is missing from the typed `Update` shape), the regenerated types are wrong and F1.1 should be re-verified before this slice finishes. Escalate rather than re-introducing `as any`.

---

### Slice F1.3 — Slice 7 cleanup: collapse the double query and remove dead form input

**Owner:** epic-executor (sonnet) · **Parallel-safe with F1.2** · **Depends on F1.1**

#### Files
- `app/(auth)/join/[token]/page.tsx` (modify only)

#### Spec

After F1.1 lands, `revoked_at` is in the generated types, so the redundant second query can collapse into the main `.select(...)`. While in the file, also remove the dead `<input type="hidden" name="token">` line.

Concrete edits:
1. **Merge the two queries.** Lines 52-66 and 69-73 currently issue two separate `.from("invitation").select(...)` calls against the same row. Merge them: add `revoked_at` to the comma-list inside the main `select` template-literal string (line 53). Delete the second query block (lines 68-73) entirely. Update the revoked-state branch (line 115) to read `inv.revoked_at` instead of `invExtra?.revoked_at`. Delete the `// Fetch revoked_at separately — not yet in generated types; types updated in F1.` comment.
2. **Remove the dead form input.** Delete line 229 (`<input type="hidden" name="token" value={token} />`). The `accept()` server action reads `token` via closure capture; the hidden input is never read.
3. **Update the relation-shape comment on lines 189-191.** The comment says `// Cast relation shapes — generated types don't model joined relations. types updated in F1`. After F1.1, the generated types still won't model joined relations as nested objects — that's a separate Supabase limitation, not an F1 concern. Trim the `types updated in F1` line from the comment but keep the rest of the explanation; the `as { id: string; name: string; ... } | null` casts on lines 191-192 should remain.

#### Definition of done
- Exactly one `.from("invitation").select(...)` call in the file. The select string contains `revoked_at` between `expires_at` and `email` (preserving alphabetical order is not required; readability is).
- The revoked-state branch reads from `inv.revoked_at` directly. The `invExtra` symbol no longer appears in the file.
- The `<input type="hidden" name="token">` element is removed.
- `pnpm lint` and `pnpm typecheck` are clean for this file.
- All five state branches (not-found, accepted, revoked, expired, email-mismatch) and the active state still render with their existing copy and styling.
- The page is still RSC (no `"use client"`).

#### Forbidden scope
- Does not modify `acceptInvitation`, `signOut`, or any other server action.
- Does not modify the auth layout, `WorkspaceLogoTile`, or any other component.
- Does not modify Stage 2 actions or migrations.
- Does not change the page's copy, structure, or styling — only the data-fetch and the dead input.
- Does not change the `accept()` or `handleSignOut()` wrapper functions.

#### Escalation triggers
- If `inv.revoked_at` typecheck-fails after F1.1, F1.1 didn't land cleanly — escalate.
- If the joined relation casts (lines 191-192) suddenly typecheck-fail, escalate; that's an unrelated regression.

---

## Sequential follow-ups (after F1.1/F1.2/F1.3 land)

None. After this round, Stage 2 should be CLEAN. The orchestrator should re-dispatch the reviewer one more time on the followup commits to confirm before unblocking Stage 3.

## Risk notes

- **`renameWorkspace` missing `revalidatePath`** is intentionally NOT in this followup. The action does call `revalidateTag('workspace:'+id)`, which will cover any RSC fetch that uses `next: { tags: [...] }`. Stage 4's workspace pages will be the first callers; if those pages don't tag-fetch the workspace name, Stage 4 review will catch it and add the tag (or add `revalidatePath` to the action). Surfacing it here would prematurely couple Stage-2 actions to Stage-4 page implementation choices.
- **F1.1 mutates cloud state.** `pnpm db:push` runs against the linked cloud Supabase project. The two migrations being pushed are pure additive (new columns, new table, new functions, new policy) — no destructive changes — but the executor must still confirm the link is correct before pushing. If the orchestrator wants a dry-run, run `supabase db diff --linked` (`pnpm db:diff`) first to confirm the planned changes.
- **No new pgTAP tests in this round.** `tests/policies/05_clone_board.sql` already landed in Slice 1; it will run when the pgTAP runner is wired (epic 15). The Stage 2 followup does not need additional policy tests — F1.2 and F1.3 are pure type-cleanup with no behavioral change.

## Open questions for the user

None. The path is unambiguous — F1 is the documented unblock and the followup slices apply it cleanly.
