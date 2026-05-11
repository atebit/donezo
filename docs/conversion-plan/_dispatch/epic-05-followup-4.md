# Epic 05 — Followup Round 4 (Stage 5)

## Review summary
- **Stage reviewed:** Stage 5 — Slice 15 (`15bf1cb`) + Slice 16 (`d29eda9`)
- **Verdict:** FOLLOWUP REQUIRED
- **Definition-of-done items met:** see `epic-05-stage-5-review.md`
- **Definition-of-done items NOT met:**
  1. The "Make private" button on the public-board members-notice card is mislabelled relative to its behavior — it fires `toast.info("Board invitations — coming next")` instead of actually flipping `is_private` to `true`. Either the label or the action is wrong; as-shipped, the button is non-functional and confusing.
- **Other issues found:** none that block this stage. See `epic-05-stage-5-review.md` "Notes for the epic-level review" for the deferred items that ride forward (InviteModal `boardId` extension, BoardCard member stack, LastViewed pipeline, EditableTitle imperative focus, `window.confirm` → Dialog cleanup).

## Followup slices

### Slice 15.F1 — Wire the "Make private" button on the public-board members-notice

**Owner:** epic-executor (sonnet) · single-file slice · parallel-safe with F2 (Playwright stub)

**Files (only):**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/members-table.tsx` (modify)

**Forbidden scope:**
- No server action changes (consume the existing `setBoardPrivacy` only).
- No changes to `general-form.tsx` privacy toggle.
- Do NOT touch the "Invite members" stub on the private-board path — that is the documented deferred InviteModal `boardId` extension; it rides forward to the epic-level review.
- No new Dialog component for the confirm — match the existing `PrivacySection` `window.confirm` pattern in `settings/general/general-form.tsx:182-191` so the epic-level review can do the unified Dialog sweep in one pass.

**Spec:**

The component is already `"use client"`. The bug is at members-table.tsx:213-224, inside the `!isPrivate` early-return branch.

1. Add imports:
   ```ts
   import { setBoardPrivacy } from "@/app/(app)/w/[workspaceSlug]/b/[boardId]/settings/general/actions";
   ```
   (`useRouter` from `next/navigation` and `useTransition` from `react` are likely already imported — if not, add them.)

2. Inside the `!isPrivate` branch, hoist a small handler that mirrors the `PrivacySection` flow:
   - `const router = useRouter();`
   - `const [pending, startTransition] = useTransition();`
   - `function handleMakePrivate() {
       const ok = window.confirm("Making this board private will hide it from workspace members who aren't invited. Continue?");
       if (!ok) return;
       startTransition(async () => {
         const result = await setBoardPrivacy({ boardId, isPrivate: true });
         if (result.ok) {
           toast.success("Board is now private.");
           router.refresh();
         } else {
           toast.error(result.error.message);
         }
       });
     }`

3. Replace the existing button's `onClick` (members-table.tsx:217-219) with `handleMakePrivate`. Keep the label "Make private". While pending, the button should be disabled and the label should swap to "Updating…".

4. Make sure the rule "hooks must be called at the top level of the component, not inside an early-return branch" is satisfied. Hoist `useRouter` / `useTransition` to the top of `BoardMembersTable` so the calls happen unconditionally regardless of which branch renders. The handler can stay near the JSX.

**Definition of done:**
- Clicking the "Make private" button on the public-board notice card calls `setBoardPrivacy({ boardId, isPrivate: true })` after a confirm.
- On success, `router.refresh()` re-renders the page; because `setBoardPrivacy` upserts the caller into `board_member` as owner (verified at `settings/general/actions.ts:32-39`), the next render will see `is_private=true`, the layout's `getBoardRole` will return `"owner"`, and `members/page.tsx` will render the full private-members table.
- On error, a toast surfaces `result.error.message`.
- The "Invite members" stub on the private-board path is unchanged.
- `pnpm lint` is clean; `pnpm typecheck` shows no NEW errors (pre-existing Zod 4 / RHF TS2769 noise stays — see Risk Note #4 / epic-04 final review).

**Escalation triggers:**
- If `setBoardPrivacy` is found to NOT seed the caller into `board_member` when going private (the executor must read `settings/general/actions.ts` to confirm — it currently does at lines 32-39), STOP and escalate. Without the seed, the caller can lose visibility into the board they just toggled private.

## Sequencing

Slice 15.F1 is parallel-safe with F2 (Playwright stub at `tests/e2e/05-workspaces-boards.spec.ts`, dispatch plan line 1775). They touch disjoint files. Either order or parallel.

After 15.F1 lands and reviews `CLEAN`, Stage 5 is done; F2 can proceed (or already be in flight); then the epic-level review picks up the full-epic definition-of-done sweep with the deferred items listed in `epic-05-stage-5-review.md`.

