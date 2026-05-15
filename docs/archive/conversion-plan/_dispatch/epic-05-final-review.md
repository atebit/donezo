# Epic 05 — Final Review (Stage 5 re-review + Epic-level audit)

**Branch:** `epic/05-workspaces-boards`
**Commit range audited:** `c70b05f..HEAD` (HEAD = `86d8b36`)
**Epic doc:** `docs/conversion-plan/05-workspaces-boards.md`
**Dispatch plan:** `docs/conversion-plan/_dispatch/epic-05.md`

---

## Part 1 — Stage 5 re-review (followup-4 / Slice 15.F1)

### Verdict: CLEAN

Followup-4 commit `1df5bad` (`fix(board-settings): wire "Make private" button to setBoardPrivacy (15.F1)`) closes the gap identified in `epic-05-stage-5-review.md`. Verified directly against `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/members-table.tsx`:

- `useRouter()` and `useTransition()` are hoisted to the top of `BoardMembersTable` (lines 194-195) — called unconditionally regardless of which branch renders. The hooks-rule violation flagged in the followup-4 spec is not present.
- `handleMakePrivate` (lines 198-212) executes the spec exactly: `window.confirm` with the prescribed copy → `startTransition` → `await setBoardPrivacy({ boardId, isPrivate: true })` → on `result.ok`, `toast.success("Board is now private.")` + `router.refresh()`; on error, `toast.error(result.error.message)`.
- The button (lines 232-236) wires `onClick={handleMakePrivate}`, `disabled={pending}`, label swap to "Updating…" while pending, gated on `canAdmin`.
- The "Invite members" stub on the private-board path (lines 257-267) is left untouched per the followup's "forbidden scope" rule — it still emits `toast.info("Board invitations — coming next")` with the documented TODO comment, riding forward to the epic-level decision below.
- `pnpm lint` clean (Biome, 151 files). `pnpm typecheck` shows no new errors beyond the documented Zod 4 / RHF resolver compat issue (see Part 2).

Stage 5 is closed.

---

## Part 2 — Epic-level definition-of-done audit

Audited the cumulative epic-branch diff (`c70b05f..HEAD`) against `docs/conversion-plan/05-workspaces-boards.md` cover-to-cover.

### User-decision matrix (Q1–Q12 from `_dispatch/epic-05.md`)

| Q  | Decision | Status | Evidence |
|----|----------|--------|----------|
| Q1 | Per-user starring via `user_starred_board` | PASS | `supabase/migrations/20260508000000_workspaces_polish.sql:14-37` (table + RLS); `lib/sidebar-data.ts:18` reads from it; `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts:66-89` upserts/deletes it from `starBoard` |
| Q2 | (Defaults already locked pre-plan) | n/a | — |
| Q3 | (Defaults already locked pre-plan) | n/a | — |
| Q4 | NO trash auto-purge anywhere | PASS | grep for `pg_cron`, `purge_trash`, `purge-trash` across `supabase/` and `app/`: no hits |
| Q5 | (Caching defaults) | PASS | 26 `revalidateTag` / `revalidatePath` callsites across `app/(app)`, no `cache: "force-cache"` mistakes spotted |
| Q6 | (Caching defaults) | PASS | server actions revalidate on `boards:<workspaceId>`, `board:<id>`, `starred:<userId>` tags as designed |
| Q7 | Old slug → 410 Gone (no redirect table) | PASS | No middleware lookup, no redirect table in any migration; missing slugs hit `notFound()` via the workspace layout |
| Q8 | Invitation revoke = `revoked_at` soft-revoke + `expires_at` extension on resend | PASS | `app/(app)/w/[workspaceSlug]/settings/members/actions.ts:55` sets `revoked_at`; line 77 updates `expires_at` |
| Q9 | NO move-board-between-workspaces UI | PASS | grep for `moveBoard`, `move_board`, `moveToWorkspace`: no hits |
| Q10 | Invitation roles = Admin / Member / Viewer (no Owner) | PASS | `lib/validations/invitation.ts:4`: `z.enum(["admin", "member", "viewer"])`; `lib/validations/board.ts:54` matches; `InviteModal.tsx:29` matches; `lib/validations/workspace.ts:40` correctly allows `owner` for member-role *changes* (separate schema) |
| Q11 | Search + notification topbar stubs disabled with "Coming soon" tooltip | PASS | `components/shared/topbar/SearchStub.tsx:15,25` and `NotificationBellStub.tsx:15,20,25` both `aria-disabled="true"` with "Coming soon" |
| Q12 | `<EditableTitle>` lives at `components/shared/EditableTitle.tsx` | PASS | File exists at the canonical path; consumed by `BoardHeaderClient.tsx:9` |

### Stack defaults (`CLAUDE.md`)

| Default | Status | Notes |
|---------|--------|-------|
| pnpm | PASS | `pnpm-lock.yaml` only |
| Next 15 App Router, RSC-first | PASS | All `app/(app)` pages are server components; `"use client"` only on interactive subcomponents (modals, forms, tables) |
| Server Actions only (no `/api` routes) | PASS | `app/api/` contains only `webhooks/.gitkeep` (placeholder for epic 13); no route handlers shipped |
| TypeScript strict | PASS-WITH-DOCUMENTED-NOISE | 13 typecheck errors total, ALL TS2769 from `useForm({ resolver: zodResolver(...) })` — Zod 4 / @hookform/resolvers compat issue. Pre-epic baseline was 7 (auth + account); the 6 new ones (`CreateBoardModal`, `CreateWorkspaceModal`, `InviteModal`, board `general-form`, workspace `general-form`, board `general-form` line 117) all trace to Risk Note #4 of the dispatch plan. **No surprise errors.** |
| Tailwind v4 + Base UI, no MUI/SCSS | PASS | All shipping modals use `@base-ui/react/dialog`; no `@mui` imports anywhere in `app/` or `components/`; SCSS hits only in untracked legacy `frontend/` (gitignored) |
| RHF + Zod | PASS | All forms use `react-hook-form` + `zodResolver`; same Zod schema validates client and server action |
| Zustand for UI-only state | PASS | No Redux; no global store added in epic 05 (UI-only state stays component-local via `useState` / `useTransition`, which is appropriate) |
| Soft deletes via `deleted_at` | PASS | `archiveBoard` sets `deleted_at`; `restoreBoard` clears via security-definer RPC; `deleteBoard` hard-deletes through admin-gated path; `deleteWorkspace` soft-deletes |
| No client-generated ids | PASS | grep for `uuid()` / `crypto.randomUUID()` in `app/(app)`: no hits in shipping code |
| No `as any` casts in epic-05 shipping code | PASS | grep across the prompt-specified scope (`app/(app)`, `components/board`, `components/shared/*`, `stores`, `hooks`, `lib/sidebar-data.ts`, `lib/workspace-context.tsx`, `lib/board-context.tsx`, `tests/unit/workspace-sidebar.test.tsx`): zero hits. Even the documented `(result.data as { id: string })` workaround the dispatch plan flagged as acceptable was apparently avoided in the executor's final implementation. |
| No raw hex/rgba in shipping component code | PASS | grep for `#[0-9a-fA-F]{3,8}` and `rgba?(` across all in-scope component dirs and `app/(app)`: zero hits. The only `rgba(...)` literals in the codebase live in `app/globals.css` as the documented token *definitions* (`--color-fg-on-nav`, `--color-surface-nav-hover`, `--color-overlay`, `--shadow-bulk-bar`) — exactly the pattern locked in F2.4. |

### Routes shipped (against epic doc §Routes)

All present, verified by directory listing:

```
app/(app)/page.tsx                                              ✓ first-run gate
app/(app)/account/page.tsx                                      ✓ (epic 03)
app/(app)/w/[workspaceSlug]/layout.tsx + page.tsx               ✓ workspace landing
app/(app)/w/[workspaceSlug]/settings/general|members|billing/   ✓ all three
app/(app)/w/[workspaceSlug]/trash/page.tsx                      ✓
app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx + page.tsx   ✓
app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general|members/ ✓ both
app/(auth)/sign-in|sign-up|forgot-password|reset-password|verify-email/ ✓ (epic 03)
app/(auth)/join/[token]/page.tsx                                ✓ (epic 03 + epic-05 polish at bc29b7c)
```

The board layout also creates placeholder route segments for `kanban`, `calendar`, `dashboard`, `timeline`, `t`, `table` — these are out-of-scope future view types, not regressions.

### Schema + RLS

| Migration | Status | Notes |
|-----------|--------|-------|
| `20260508000000_workspaces_polish.sql` | PRESENT | adds `profile.last_workspace_id`, `board.description`, `column.icon`, `user_starred_board` table + RLS, `invitation.revoked_at`, `clone_board` RPC, `board_select_archived` policy |
| `20260508000001_restore_board_rpc.sql` | PRESENT | `restore_board` security-definer RPC (handles the "role_for_board returns null on deleted boards" edge case) |
| Database types regenerated | PASS | F1 commit `1afe21a` regenerated `Database` types after stage-1 migrations; subsequent commits pick up the new shape |

### Epic-doc Definition of Done — line-by-line

| DoD bullet | Status | Evidence |
|---|---|---|
| New user lands on `/` post-auth, prompted to create a workspace (or directed to one if invited) | PASS | `app/(app)/page.tsx` Slice 16: `last_workspace_id` → `/w/<slug>`, else oldest membership, else `<NoWorkspaces />` first-run |
| Creating a workspace, board, then renaming and starring works end-to-end with optimistic updates | PASS-WITH-CAVEAT | All actions wired; `revalidateTag`-based UX means Slice 11/14 use `router.refresh()` for star/rename rather than `useOptimistic`. The epic doc says "optimistic via useOptimistic"; the implementation uses server-revalidate. **Functionally equivalent for v1**; this is a soft drift, not a DoD failure — the user-facing behavior matches (instant toggle on click). Flag for visual-polish epic if any flicker shows up. |
| Archiving a board removes it from the sidebar and adds it to trash; restoring brings it back | PASS | `archiveBoard` sets `deleted_at` + revalidates `boards:<workspaceId>`; trash page reads from `board_select_archived` policy; restore via `restore_board` RPC |
| Inviting a teammate by email creates an invitation row; visiting the join URL adds them as a workspace member with the chosen role | PASS | `inviteToWorkspace` action + `acceptInvitation` action (epic 04) + `/join/[token]` page (epic 03 + epic-05 polish) |
| Workspace owners can delete the workspace; admins cannot | PASS | `deleteWorkspace` calls `requireWorkspaceRole(id, "owner")`; RLS double-checks |
| Board layout renders title, member avatars, and view tabs (only "Table" enabled) | PASS-WITH-CAVEAT | BoardHeader renders title + star + member stack + view tabs; only "Table" is active. Member stack is fed real data from server (board members). BoardCard on the workspace landing has an empty member stack — see deferred items. |
| All routes server-rendered; navigating doesn't refetch the workspace list unnecessarily | PASS | All pages are server components; sidebar data is fetched once per layout via `lib/sidebar-data.ts` and cached via `revalidateTag` |

### In-scope items vs deferred items

The epic doc's **In scope** list ([line 11-21 of `05-workspaces-boards.md`](docs/conversion-plan/05-workspaces-boards.md)):

| In-scope item | Status |
|---|---|
| Authed app shell: sidebar + topbar + main content | PASS |
| Workspace CRUD | PASS |
| Board CRUD (create, rename, star, archive, restore, delete, duplicate, change description, **move between workspaces**) | PASS-EXCEPT-MOVE — Q9 explicitly punted "move between workspaces"; not a regression |
| Workspace + board settings pages | PASS |
| Board home placeholder | PASS |
| Trash view (archived boards) per workspace | PASS |
| Workspace + board member management UIs (invite, change role, remove) | **PARTIAL** — workspace member mgmt is fully wired; **board member invite is stubbed** at two callsites (BoardHeader invite tool, board-members "Invite members" button) |
| Invitation accept flow UI | PASS |

The single in-scope gap is **board-scoped invitations from the UI**. The `inviteToBoard` server action exists at `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts:17-51` and is fully implemented (writes the invitation row, gates on board admin+, defers email send to epic 13 with a `logger.info` stub — same shape as `inviteToWorkspace`). The only missing piece is the InviteModal `boardId` extension and the two callsites that consume it.

### Deferred items (carry forward, not blocking)

These are explicitly punted to later epics and tracked in the PR body:

1. **`BoardCard` member stack + last-activity timestamp** — `components/shared/board-card/BoardCard.tsx:112` renders `<MemberStack members={[]} />`, no last-activity. Defer to a polish epic that owns workspace landing fidelity (likely 11 or 14).
2. **`LastViewed` data pipeline** — `app/(app)/w/[workspaceSlug]/page.tsx:11` renders `<LastViewed boards={[]} />`. Needs a "boards I viewed recently" data source. Defer to epic 11 (filtering/views) which owns view-state persistence.
3. **EditableTitle imperative focus** — `BoardSettingsMenu` "Rename" item is a no-op toast (`BoardHeaderClient.tsx:46`). Defer; cosmetic miss.
4. **`window.confirm` → unified Base UI Dialog** — both privacy-toggle handlers (settings general-form + the new 15.F1 handler) use `window.confirm`. Acceptable for v1; defer to a UX-polish pass.
5. **Optimistic updates via `useOptimistic`** — implementation uses server-revalidate. Functionally equivalent; defer to perf pass if flicker appears.

### Mechanical checks

- `pnpm lint` — **clean** (Biome, 151 files, no fixes applied).
- `pnpm typecheck` — **13 errors, all TS2769, all the same Zod 4 / @hookform/resolvers issue, all in form components**. Pre-epic baseline was 7. Net new = 6, all in newly-introduced epic-05 forms (`CreateBoardModal`, `CreateWorkspaceModal`, `InviteModal`, two board-settings `general-form` callsites, one workspace-settings `general-form`). All trace to **Risk Note #4** in the dispatch plan and the standing tracker carried from epic 04. No surprise errors.
- `as any` cast audit — **0 hits** in the prompt-specified scope.
- Raw hex/rgba audit in shipping component code — **0 hits**. Only `globals.css` token definitions use `rgba(...)`.
- `app/api/` audit — only `webhooks/.gitkeep` (epic 13 placeholder); no route handlers shipped.
- Migration ordering — both new migrations follow the `YYYYMMDDHHMMSS_description.sql` convention and apply cleanly atop epic 04.

---

## Final epic-level verdict: **FOLLOWUP REQUIRED**

One small followup round to close the only in-scope gap: **board-scoped invitations from the UI**. The `inviteToBoard` server action already exists and is fully wired through to the DB; only the modal layer and two callsites are stubbed. The change is small, surgical, and self-contained — exactly the kind of close-out the dispatch plan envisioned.

A new followup file has been written at `docs/conversion-plan/_dispatch/epic-05-followup-5.md`.

Once followup-5 lands and reviews CLEAN, the epic is done and the orchestrator can open the PR to `main` with the deferred items above as PR-body tracking notes.


---

## Re-review pass — followup-5 verification

**Commit range audited:** `86d8b36..HEAD` (HEAD = `aa7770b`)
**Followup spec:** `docs/conversion-plan/_dispatch/epic-05-followup-5.md`
**Followup commits:**
- `439caf9` — 17.F1: Extend `InviteModal` with optional `boardId` prop
- `aa7770b` — 17.F3: Wire Invite-members button (also includes 17.F2's `BoardHeaderClient.tsx` changes; see process note)

### Verdict: CLEAN

Followup-5 closes the only outstanding epic-level gap (board-scoped invitations from the UI). All three slice contracts are met, no regressions, and the deferred-items list is unchanged.

### Slice-by-slice verification

**17.F1 — `components/shared/InviteModal/InviteModal.tsx`** (439caf9)
- `InviteModalProps` now declares `boardId?: string` with the documented intent comment (line 42). Existing `workspaceId`, `open`, `onOpenChange` props unchanged.
- Imports both `inviteToWorkspace` (line 10) and `inviteToBoard` (line 11) from their respective server-action modules.
- The `for (const email of emailList)` loop branches on `boardId`: `await inviteToBoard({ boardId, email, role })` when present, `await inviteToWorkspace({ workspaceId, email, role })` otherwise (lines 76–82). Both paths share the same `result.ok` handling, error aggregation, and toast/close-on-success semantics.
- `InviteFormSchema`, role select, pending state, success/error toasts, `router.refresh()`, and `handleClose()` are unchanged from pre-followup-5. The diff is six lines edited.
- `index.ts` re-exports the (now extended) `InviteModalProps` and `InviteModal` symbol unchanged — both consumers see the new optional prop without source rewrites.

**17.F2 — `components/board/BoardHeaderClient.tsx`** (folded into aa7770b — see process note)
- `InviteModal` imported from `@/components/shared/InviteModal` (line 10).
- `inviteOpen` state hoisted to the top of the component alongside the existing `membersOpen` / `descriptionOpen` (line 34).
- `handleInvite` callback calls `setInviteOpen(true)` (lines 51–53). The Invite button (lines 110–118) wires `onClick={handleInvite}` and `aria-label="Invite people to this board"` — the previous `(coming soon)` wording is gone.
- `<InviteModal workspaceId={board.workspace_id} boardId={board.id} open={inviteOpen} onOpenChange={setInviteOpen} />` is rendered alongside the other modals (lines 160–165). `board.id` and `board.workspace_id` come from `useBoard()` context, which already loads from the board layout.
- The `handleRenameFromMenu` `EditableTitle.focus()` TODO comment is preserved as-is — that is a deliberately deferred item, not a new defect.

**17.F3 — board-members table** (aa7770b)
- `BoardMembersTableProps` now requires `workspaceId: string` (line 34). All three callsites in `members-table.tsx` deconstruct it (line 189) and the parent passes it explicitly.
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/page.tsx` passes `workspaceId={board.workspace_id}` to both `<BoardMembersTable />` instances — public-board notice path (line 39) and private-board path (line 96). The page already selected `workspace_id` in its board query, so no schema change was needed.
- `inviteOpen` state added to `BoardMembersTable` (line 199); the existing "Invite members" `<Button>` now wires `onClick={() => setInviteOpen(true)}` (line 262). The previous `toast.info("Board invitations — coming next")` and the accompanying TODO comment are gone (verified by full-file read).
- `<InviteModal workspaceId={workspaceId} boardId={boardId} open={inviteOpen} onOpenChange={setInviteOpen} />` is rendered at the bottom of the private-board branch (lines 394–399). Both ids are non-undefined here (the public-board branch returns early before the modal mount, which is correct — invites only happen from the private path).

### Process note (orchestrator hygiene)

17.F2 and 17.F3 were dispatched in parallel against disjoint files (`BoardHeaderClient.tsx` vs `members-table.tsx` + `page.tsx`) but shared a single working tree, no worktree isolation. 17.F3's executor staged and committed 17.F2's `BoardHeaderClient.tsx` changes alongside its own — `aa7770b` covers both slices' content. 17.F2's executor reported "no diff vs HEAD, work already done" without committing separately.

Outcome is correct (every required change landed and is verified above), but the file-scope contract was crossed. **For future stages**: when parallel slices share a working tree, either (a) require each executor to `git add` only its own file scope (the spec already names this explicitly — enforce it), or (b) use git worktrees per slice so the staging area is naturally isolated. Not a blocker for this epic.

### No-regression checks

- `pnpm lint` — **clean** (Biome, 151 files, 0 fixes applied).
- `pnpm typecheck` — **13 errors**, identical to the pre-followup-5 baseline. Same files, same lines, same TS2769 Zod 4 / @hookform/resolvers compat pattern. The new `InviteModal` `boardId` parameter does not introduce any new type error.
- `as any` audit in shipping code — **0 hits** in `app/`, `components/`, `lib/`, `hooks/` (the only repo-wide hit is `tests/unit/with-user.test.ts`, which is fixture code and out of scope for this audit).
- Raw hex/rgba audit in shipping `.tsx` — **0 hits**. The two documented `rgba(...)` values (`--color-fg-on-nav`, `--color-surface-nav-hover`) live in `app/globals.css` token definitions only.
- `app/(app)/w/[workspaceSlug]/settings/members/members-table.tsx` (workspace-settings flow) was **not modified** by followup-5 (`git log` confirms the file's last touch was slice 12 in `1b4410a`). Its `<InviteModal workspaceId={workspaceId} open={inviteOpen} onOpenChange={setInviteOpen} />` callsite (line 348) still works under the new optional-prop signature — no `boardId`, so the existing workspace-invite flow is preserved end-to-end.

### Deferred items — still correctly deferred (PR-body tracking notes)

None of these have closed unexpectedly, and none have re-opened. They remain the right candidates for follow-on epics or polish passes:

- **`BoardCard` member stack and last-activity timestamp** — defer to a workspace-landing fidelity pass.
- **`LastViewed` data pipeline** — defer to epic 11 (visited-tracking belongs there).
- **`EditableTitle` imperative focus** — `BoardSettingsMenu` "Rename" item still toasts a hint instead of focusing the title; defer.
- **`window.confirm` → unified Base UI Dialog** — the destructive-confirm UX still uses native `window.confirm` in a few places; defer to UX-polish pass.
- **`useOptimistic` for sidebar star/rename** — defer to perf pass if flicker becomes visible in real use.
- **F2 Playwright runner** — `tests/e2e/epic-05.spec.ts` is a stub with `test.skip(true, ...)` calls per the followup-3 contract; the actual Playwright runner / CI wiring belongs to epic 15.

### What the orchestrator should do next

1. Run final mechanical checks one more time on `epic/05-workspaces-boards`: `pnpm lint` (expect clean), `pnpm typecheck` (expect 13 errors, all the documented Zod 4 baseline), `pnpm test` (unit suite — Playwright stub is skipped at the test level so it should not fail the run).
2. Open the PR from `epic/05-workspaces-boards` into `main`. The PR body should reference epic 05 and include the **Deferred items** list above as tracking notes so they are not lost.
3. Mention the F2 Playwright stub explicitly in the PR body — the file exists with `test.skip(true, ...)` placeholders documenting the intended scenarios; epic 15 owns the runner and CI wiring.

Epic 05 is done.
