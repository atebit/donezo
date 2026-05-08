# Epic 05 — Followup Round 5 (Final epic close-out)

## Review summary

- **Stage reviewed:** Cumulative epic-branch diff `c70b05f..HEAD` against `docs/conversion-plan/05-workspaces-boards.md` Definition of Done.
- **Verdict:** FOLLOWUP REQUIRED — single in-scope gap.
- **Definition-of-done items NOT met:**
  1. **Board-scoped invitations from the UI** — the epic doc's In Scope list explicitly includes "workspace and board member management UIs (invite, change role, remove)". Workspace invitation is fully wired; board-scoped invitation is stubbed at two callsites with `toast.info("Board invitations — coming next")`. The `inviteToBoard` server action already exists at `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts:17-51` (writes the invitation row, gates on board admin+, defers email-send to epic 13 with a `logger.info` stub — same shape as `inviteToWorkspace`). The only missing piece is the InviteModal `boardId` prop and the two callsites that consume it.
- **Other issues found:** none that block the epic. Five other items (BoardCard member stack, LastViewed pipeline, EditableTitle imperative focus, `window.confirm` → Dialog, `useOptimistic` for sidebar) are explicitly deferred per the prior reviewers' decisions and the epic-final review (`docs/conversion-plan/_dispatch/epic-05-final-review.md`). Track them in the PR body, not here.

## Followup slices

A single small followup. **Sequenced (not parallel)**: Slice 17.F1 modifies `InviteModal.tsx`; the two callsite-update slices import from it. Run 17.F1 first, then 17.F2 and 17.F3 in parallel.

---

### Slice 17.F1 — Extend `InviteModal` to accept an optional `boardId`

**Owner:** epic-executor (sonnet) · single-file slice · sequenced first

**Files (only):**
- `components/shared/InviteModal/InviteModal.tsx` (modify)

**Forbidden scope:**
- Do NOT modify `inviteToWorkspace` or `inviteToBoard` server actions; both already exist with matching shapes.
- Do NOT modify `components/shared/InviteModal/index.ts` unless the public type signature requires it (the `InviteModalProps` interface is exported transitively via the named export — re-export changes only if necessary).
- Do NOT change the modal's chrome, copy, role list, validation schema, or pending/loading UX. The only behavioral change is "which server action gets called and the per-call payload."

**Spec:**

The current modal accepts `{ workspaceId, open, onOpenChange }` (lines 39-43) and unconditionally calls `inviteToWorkspace({ workspaceId, email, role })` (line 75). Extend it to optionally call `inviteToBoard({ boardId, email, role })` when a `boardId` is provided.

1. **Add an optional `boardId` prop:**
   ```ts
   export interface InviteModalProps {
     workspaceId: string;
     boardId?: string;  // when present, invites are scoped to this board
     open: boolean;
     onOpenChange: (open: boolean) => void;
   }
   ```

2. **Add an `inviteToBoard` import** alongside the existing `inviteToWorkspace` import:
   ```ts
   import { inviteToBoard } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/actions";
   ```

3. **Branch the per-email server-action call** inside the existing `for (const email of emailList)` loop (currently at lines 74-83). Both server actions return the same `{ ok: true, data } | { ok: false, error }` shape (verified at `app/(app)/w/[workspaceSlug]/actions.ts` and `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts:17-51`), so only the call dispatch and payload differ:
   ```ts
   const result = boardId
     ? await inviteToBoard({ boardId, email, role: values.role })
     : await inviteToWorkspace({ workspaceId, email, role: values.role });
   ```

4. **Do NOT change the form schema.** Both server actions accept `{ email, role: "admin" | "member" | "viewer" }`; the role enum is already correct (Q10).

5. **Do NOT change copy or modal title.** The header reads "Invite members" today and that wording works for both flows. (If product wants "Invite to this board" copy on the board path later, that's a polish-pass concern.)

6. **Pending toast copy:** keep the existing "Sending invitations…" / "Invitation sent." / "{N} invitations sent." copy. It reads correctly for both flows.

7. **The Zod 4 / RHF resolver TS2769 noise** at line 55 is the documented compat issue (Risk Note #4). Do NOT introduce an `as any` cast or change the form approach — match the pattern already used elsewhere in the codebase.

**Definition of done:**
- `InviteModal` accepts an optional `boardId?: string` prop.
- When `boardId` is undefined, behavior is unchanged: calls `inviteToWorkspace`.
- When `boardId` is present, calls `inviteToBoard({ boardId, email, role })` per email in the list.
- All other behavior (Dialog chrome, schema, role select, pending state, success/error toasts, `router.refresh()` on success, modal close on success) is unchanged.
- The existing workspace-settings callsite at `app/(app)/w/[workspaceSlug]/settings/members/members-table.tsx:348` (passes `workspaceId` only, no `boardId`) continues to compile and work without modification.
- `pnpm lint` clean. `pnpm typecheck` shows no NEW errors beyond the documented Zod 4 / RHF compat noise.

**Escalation triggers:**
- If `inviteToBoard`'s return shape does NOT match `inviteToWorkspace`'s `{ ok, data } | { ok, error }` discriminated union — verify by reading both action files. (Verified at review time: both wrap `withUser` and return identical shapes.) If the executor finds otherwise, STOP and escalate.
- If `InviteToBoardSchema` (in `lib/validations/invitation.ts`) requires fields the modal doesn't currently collect (it shouldn't — `boardId`, `email`, `role` are all the modal already has), STOP and escalate before adding form fields.

---

### Slice 17.F2 — Wire BoardHeader's "Invite" tool to the extended `InviteModal`

**Owner:** epic-executor (sonnet) · single-file slice · runs after 17.F1 lands

**Files (only):**
- `components/board/BoardHeaderClient.tsx` (modify)

**Forbidden scope:**
- Do NOT modify `InviteModal.tsx` or any server action.
- Do NOT change unrelated tool buttons (Activity, Members, Description, Settings).
- Do NOT touch `BoardHeader.tsx` (the server-side wrapper) — `members` and `createdByName` props already include enough context for the client.

**Spec:**

The current `handleInvite` at lines 49-53 fires a placeholder toast. Replace it with state-driven `InviteModal` open/close, scoped to the current board.

1. **Add an `inviteOpen` state alongside the existing `membersOpen` and `descriptionOpen`** (line 31-32):
   ```ts
   const [inviteOpen, setInviteOpen] = useState(false);
   ```

2. **Import `InviteModal`** alongside the existing `MemberModal` import (line 10):
   ```ts
   import { InviteModal } from "@/components/shared/InviteModal";
   ```

3. **Replace the `handleInvite` callback** (lines 49-53) with a simple opener:
   ```ts
   const handleInvite = useCallback(() => {
     setInviteOpen(true);
   }, []);
   ```
   Or inline: change the button's `onClick` from `handleInvite` to `() => setInviteOpen(true)` and delete the `handleInvite` callback. Either form is fine; pick the one consistent with the surrounding handlers.

4. **Render the modal** inside the existing fragment, alongside `MemberModal` and `BoardDescriptionModal`. The `BoardProvider` exposes `board.workspace_id` and `board.id` via `useBoard()` (already imported), so:
   ```tsx
   <InviteModal
     workspaceId={board.workspace_id}
     boardId={board.id}
     open={inviteOpen}
     onOpenChange={setInviteOpen}
   />
   ```

5. **Remove the TODO comment** at line 109 ("Invite tool — placeholder (InviteModal is workspace-only)") and the obsolete `aria-label="Invite to board (coming soon)"` — change `aria-label` to `"Invite people to this board"`. (Verify the label change matches the existing copy convention used by `MemberModal`/`BoardDescriptionModal`.)

**Definition of done:**
- Clicking the "Invite" tool button in the board header opens the `InviteModal` scoped to the current board.
- Submitting an email + role inserts an `invitation` row with `board_id = <current board>` and `workspace_id = <current workspace>`.
- The "coming soon" aria-label is gone.
- `pnpm lint` clean. `pnpm typecheck` shows no NEW errors.

**Escalation triggers:**
- If `useBoard()` does NOT expose `board.workspace_id` (it should — the BoardProvider passes it), STOP and escalate; do NOT add a new server-side fetch in the BoardHeader chain. The fix should land in `BoardProvider`, not here.

---

### Slice 17.F3 — Wire the private-board members "Invite members" button to the extended `InviteModal`

**Owner:** epic-executor (sonnet) · single-file slice · runs after 17.F1 lands · parallel-safe with 17.F2

**Files (only):**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/members-table.tsx` (modify)

**Forbidden scope:**
- Do NOT modify `InviteModal.tsx` or any server action.
- Do NOT change the public-board notice card (the 15.F1 "Make private" handler is the only thing that lives there, and it's correct).
- Do NOT touch the members table itself, the role-select, or remove-member flow.
- Do NOT alter the pending-invitations table (it's already wired correctly to `revokeInvitation`/`resendInvitation`).

**Spec:**

The current "Invite members" button on the private-board path (lines 257-267) fires `toast.info("Board invitations — coming next")`. Replace with state-driven `InviteModal` open/close, scoped to this board.

1. **Pass `workspaceId` into `BoardMembersTable`.** The component currently receives `boardId` but not `workspaceId`. Add it to the props interface:
   ```ts
   interface BoardMembersTableProps {
     workspaceId: string;
     boardId: string;
     // ...rest unchanged
   }
   ```
   Update the calling page at `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/page.tsx` to pass `workspaceId` (server-side it has the workspace via `getWorkspaceRole(board.workspace_id)` or by re-querying — fetch `board.workspace_id` once and forward). **This is the only file outside `members-table.tsx` that this slice may touch.**

2. **Add `useState` import** (already present via `useTransition` from React; may need to add `useState`).

3. **Add `InviteModal` import** alongside the existing imports:
   ```ts
   import { InviteModal } from "@/components/shared/InviteModal";
   ```

4. **Add `inviteOpen` state** at the top of `BoardMembersTable` (alongside the existing `useRouter` / `useTransition` hoisted in 15.F1):
   ```ts
   const [inviteOpen, setInviteOpen] = useState(false);
   ```

5. **Replace the button's `onClick`** at lines 257-267:
   ```tsx
   <Button size="sm" onClick={() => setInviteOpen(true)}>
     Invite members
   </Button>
   ```
   Remove the TODO comment at line 261.

6. **Render the modal** at the end of the private-board JSX (alongside the closing `</div>` of the outermost flex column, before the return-block close). Since the table is in a "flex flex-col gap-8" container, the modal should be a sibling of the section blocks but rendered after them in the JSX so it overlays correctly:
   ```tsx
   <InviteModal
     workspaceId={workspaceId}
     boardId={boardId}
     open={inviteOpen}
     onOpenChange={setInviteOpen}
   />
   ```

7. **Update `members/page.tsx`** to pass `workspaceId` to `<BoardMembersTable />`. The board fetch already provides `board.workspace_id`; route param `params.workspaceSlug` is also available but resolving the id is preferred. Pick the path that requires no new query: the page already fetches the board, so `board.workspace_id` is in scope.

**Definition of done:**
- Clicking "Invite members" on the private-board members page opens the `InviteModal` scoped to the current board.
- Submitting inserts an `invitation` row with `board_id = <current board>`.
- `members/page.tsx` correctly passes `workspaceId` down. No new server-side queries beyond what already exists.
- `pnpm lint` clean. `pnpm typecheck` shows no NEW errors.

**Escalation triggers:**
- If `members/page.tsx` does NOT already fetch `board.workspace_id` and adding it would require a meaningfully larger change (e.g., a new RLS-gated query), STOP and escalate — there may be a cleaner spot to thread the value through.

---

## Sequencing

```
17.F1 (InviteModal extension)
        │
        ├─► 17.F2 (BoardHeader invite tool)         ── parallel after 17.F1
        └─► 17.F3 (board-members invite button)     ── parallel after 17.F1
```

17.F1 must land first because 17.F2 and 17.F3 import the extended prop shape. Once 17.F1 is in, 17.F2 and 17.F3 can run in parallel — they touch disjoint files (`BoardHeaderClient.tsx` vs `settings/members/members-table.tsx` + `settings/members/page.tsx`).

After all three land and review CLEAN, the epic-final review picks up again and confirms the deferred-items list is the **only** carry-forward into later epics. Then the orchestrator opens the PR to `main`.

## PR-body tracking notes (for the merge to `main`)

When the orchestrator opens the PR, include these as explicit deferred-to-later-epics items:

- **`BoardCard` member stack and last-activity timestamp** — `components/shared/board-card/BoardCard.tsx:112` renders an empty stack. Defer to the workspace-landing fidelity pass (epic 11 or 14).
- **`LastViewed` data pipeline** — `app/(app)/w/[workspaceSlug]/page.tsx:11` renders `<LastViewed boards={[]} />`. Needs a "boards I viewed recently" data source. Defer to epic 11 (filtering/views) which owns view-state persistence.
- **EditableTitle imperative focus** — `BoardSettingsMenu` "Rename" item is a no-op toast (`BoardHeaderClient.tsx:42-47`). Defer.
- **`window.confirm` → unified Base UI Dialog** — both privacy-toggle handlers (`general-form.tsx` PrivacySection and the new `members-table.tsx` "Make private" handler) use `window.confirm`. Acceptable for v1; defer to a UX-polish pass.
- **`useOptimistic` for sidebar star/rename** — implementation uses server-revalidate + `router.refresh()`. Functionally equivalent to optimistic for v1. Defer to a perf pass if flicker becomes visible.
- **F2 Playwright runner** — `tests/e2e/05-workspaces-boards.spec.ts` is a stub gated by `// @ts-expect-error playwright wired in epic 15`. The test plan is fully written; runner config + seed scripts land in epic 15 per the spec's preamble.

