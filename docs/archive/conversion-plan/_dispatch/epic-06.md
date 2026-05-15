# Epic 06: Groups & Tasks (Table View) — Dispatch Plan

**Status:** APPROVED — ready to dispatch
**Source epic doc:** `docs/conversion-plan/06-groups-tasks-table.md`
**Branch:** `epic/06-groups-tasks-table` off `main`

## Resolved decisions (user-answered open questions)

- **Q1: (a)** — `EditableTitle` blockquote for both task and group titles. Add deferred imperative `focus()` ref API + a11y polish inside the primitive (Slice S14 stays in scope).
- **Q2: (a)** — Render the table at `b/[boardId]/page.tsx` (board root). No `/table/` subroute.
- **Q3: (d)** — No undo UI in epic 06. Soft delete is the safety net.
- **Q4: (a)** — Keyboard navigation IS in scope. Arrow up/down moves row focus; Enter opens edit on focused title cell; Esc cancels; Tab cycles through interactive controls in the focused row. New dedicated slice **S18** added in Stage 5; coordinates with S10 (virtualization) and S8 (row primitives) via a focus-controller hook.
- **Q5: (a) + localStorage persist** — Group collapse/expand lives in Zustand. Use `persist` middleware backed by `localStorage`, keyed by `boardId`. SSR-safe via `createJSONStorage(() => (typeof window === "undefined" ? noopStorage : localStorage))`. No `toggleGroupCollapse` server action; no migration.
- **Q6: (a)** — Activity writes via `adminClient()` in `lib/activity.ts`. Best-effort, never fail the parent action.
- **Q7: (b)** — Bulk action toolbar shows Duplicate, Delete, Move to group, Clear selection PLUS a disabled "Apply column value" button with tooltip "Coming in epic 07".
- **Q8: (a)** — `<AddColumnButton />` rendered at the right edge of the table column-header row, disabled, "Coming soon" tooltip.
- **Q9: (a)** — Manual perf smoke. Slice S17 ships `tests/perf/seed-board.ts`; executor runs the dev server, measures FPS in DevTools, documents result. Best-effort DoD line, no CI gate.
- **Q10: (a)** — Cross-group drag is optimistic with rollback on server failure.

---

## 1. Preconditions verified

Confirmed by reading the actual repo state on `main` / `epic/05-workspaces-boards`:

**Schema & RLS (epics 02 & 04 + epic-05 polish, all merged into types):**
- `public."group"`: `id`, `board_id`, `name` (NOT `title`), `position numeric`, `color text default '#c4c4c4'`, `created_at`, `updated_at`, `deleted_at`. Index: `group_board_pos_idx (board_id, position) where deleted_at is null`. Trigger: `set_updated_at`. Soft-delete cascade group → tasks.
- `public.task`: `id`, `group_id`, `board_id` (denormalized, kept consistent by `task_board_id_consistency` BEFORE INSERT/UPDATE OF group_id trigger), `title text not null default ''`, `position numeric`, `created_by`, `updated_by`, `created_at`, `updated_at`, `deleted_at`. Indexes: `task_group_pos_idx (group_id, position)` and `task_board_idx (board_id)`, both partial on live rows.
- `public."column"` exists (board_id, name, type, position, settings) — epic 06 must NOT mutate columns; epic 07 owns column CRUD.
- `public.cell` PK is `(task_id, column_id)`; polymorphic value columns; `cell_one_value_check` ensures at most one value column non-null. Epic 06 only writes the title onto `task.title`, NOT into a cell — title is a first-class task column, not a polymorphic cell.
- `public.activity` exists with `(id, board_id, task_id, actor_id, type, payload, created_at)`. **No insert policy** — service-role-only writes (per epic 04 risk-note 8). The activity table column is `type`, NOT `action`. The epic doc's helper signature uses `action: string` — must map to `type` in the insert statement.
- RLS policies for `group`, `task`, `cell`: SELECT requires board access, INSERT/UPDATE/DELETE require `>= member`. `cell` uses `for all using` (one combined modify policy). All policies live in `20260507120100_rls_policies.sql`.
- Realtime publication includes `task`, `cell`, `"group"`, `"column"`, `comment`, `notification` (per `20260506224930_initial_schema.sql:450-455`). Epic 06 MUST NOT add or remove publication tables (epic 08 owns Realtime wiring).

**TypeScript types:**
- `lib/supabase/types.ts` is regenerated and includes `user_starred_board`, `clone_board`, `restore_board`, `board.description`, etc. Group, task, cell row shapes match the migration schema.
- The reserved-word `"group"` table is exposed in generated types as `Database['public']['Tables']['group']` (key string `"group"`); `supabase.from("group")` is the correct accessor (`from("\"group\"")` is wrong — Supabase JS handles the quoting itself).

**Auth, contexts, primitives present:**
- `BoardProvider` exposes `{ board: { id, name, description, is_private, workspace_id, created_by, deleted_at }, role, isStarred }` to any client subtree under `app/(app)/w/[workspaceSlug]/b/[boardId]/**`. `hooks/use-board.ts` exports `useBoard()` / `useBoardMaybe()`.
- `WorkspaceProvider` is similarly available.
- `BoardHeader` (server) + `BoardHeaderClient` (client) own the sticky board header; `BoardViewTabs` is a sibling.
- `lib/authorization`: `getBoardRole`, `requireBoardRole`, `getWorkspaceRole`, `requireWorkspaceRole`, `Role`, `ROLE_RANK`. Roles file is split client-safe (`roles.ts`) vs server-only.
- `lib/actions/with-user.ts` returns `ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code; message; field? } }`. Catches `ZodError` → `VALIDATION`. Throws of `{ code, message }` are passed through. Pattern is the contract every epic-06 server action must follow.
- `lib/supabase/admin.ts` provides `adminClient()` (lazy) — the only RLS-bypass path. Used **only** by activity logger in this epic. Biome `noRestrictedImports` blocks it from client code; per-callsite `biome-ignore` documents server-only intent.
- `EditableTitle` exists at `components/shared/EditableTitle.tsx` — a `<blockquote contentEditable>` primitive (the legacy "blockquote pattern"). **Conflicts with epic 06's "use a real `<input>`" prescription for task titles** — see open question Q1.
- `MemberStack`, `Avatar`, `MenuList` (Base UI menu wrapper at `components/ui/menu-list.tsx`), `Button`, `Input`, sonner toaster all available.
- `BoardSettingsMenu` already uses Base UI `Menu` directly (not `MenuList`). The component-system spec says `<MenuList />` recipe — epic-06 group/task overflow menus should use `MenuList` (or document the deviation as in epic 05).

**Tokens (`app/globals.css`):**
- `--color-group-1` … `--color-group-12` defined.
- `--size-cell-h: 36px`, `--size-cell-w: 140px`, `--size-cell-w-task: 336px`, `--size-cell-w-checkbox: 32px`, `--size-cell-w-conversation: 65px` — all present.
- `--shadow-bulk-bar: 0px 15px 50px rgba(0, 0, 0, 0.3)` — present.
- `--motion-instant/fast/base/medium/slow/drawer`, `--ease-standard/emphasized/out` — present.
- `--color-surface-active: #cce5ff` (the "on-typing" wash) — present.
- `--z-sticky: 2` — present (used for sticky group/task headers).

**Routes:**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` exists (RSC, wraps `BoardProvider` + `BoardHeader` + `BoardViewTabs`).
- `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` is the placeholder this epic replaces.
- `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts` exists with epic-05 board CRUD actions; epic 06 **must not modify it** — group/task actions belong in their own files.
- `app/(app)/w/[workspaceSlug]/b/[boardId]/table/.gitkeep` is a directory placeholder — epic 06 may either render the table directly under `page.tsx` (simpler) or in `table/page.tsx`. The existing `BoardViewTabs` treats Table as `segment: null` (board root). Decision: **render the table at the board root (`page.tsx`)**, leaving `table/.gitkeep` as a noop placeholder for the dispatch list (orchestrator can sweep later). See open question Q2.

**Deps NOT yet installed (must install in slice 01):**
- `@tanstack/react-table`
- `@tanstack/react-virtual`
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@dnd-kit/utilities`
- (Vitest + RTL infra is still absent; tests will follow the existing `describe.skip` / `@ts-expect-error vitest is wired in epic 15` precedent. Playwright similarly stubbed for epic 15.)

**Existing scaffolds for this epic:**
- `lib/cells/.gitkeep` and `components/cells/{text,status,person,date}/.gitkeep` exist as placeholders. Cell-type registry is **not** yet scaffolded — epic 07 owns it. Epic 06 should NOT scaffold the registry; the title cell is rendered by a dedicated `<TaskTitleCell />` that does not go through any registry.
- `stores/sidebar-store.ts` exists; `stores/board-store.ts` does NOT. Epic 06 creates it.
- `lib/positions.ts` does NOT exist. Epic 06 creates it.
- `lib/activity.ts` does NOT exist. Epic 06 creates it.
- `lib/realtime/` is empty (epic 08 owns).

**Epic 05 deferred items relevant to epic 06:**
- `EditableTitle` imperative focus API was deferred "to epic 06 (groups/tasks) where the primitive sees more callsites" — see open question Q1.
- `window.confirm` → unified Dialog cleanup deferred to a UX pass; epic 06's destructive group/task actions must follow the same pattern as epic 05 (Base UI Dialog, NOT `window.confirm` for new code; `window.confirm` is only acceptable on epic-05 inherited paths). Bake into guardrails.

---


## 2. Guardrails from prior epics

Distilled from every dispatch diary in `_dispatch/` (epics 01–05 and all followups). These are bake-into-every-slice rules.

**Token & visual fidelity**
1. **Zero raw hex/rgba in `.tsx`/`.ts` shipping code.** Token definitions in `app/globals.css` only. Even fallbacks in `var(--color-x, #abc)` count as raw hex (epic 05 F3.2 precedent: undefined-var-with-hex-fallback rendered hex as live source of truth).
2. **No `var(--color-X, ...)` references to undefined tokens.** Verify the token exists in `app/globals.css` before consuming it. If you need a new token, add it in a single dedicated diff with rationale (epic 05 F2.4 precedent for `--color-fg-on-nav`).
3. **No raw Tailwind color-scale classes** (`bg-red-600`, `text-amber-400`, `text-emerald-500`, etc.). Use `--color-destructive`, `--color-label-yellow`, `--color-label-green`, etc. via Tailwind utility (e.g. `bg-destructive`, `text-destructive`, `fill-[color:var(--color-label-yellow)]`).
4. **Group accent colors come from `--color-group-1` … `--color-group-12`.** The 6px left stripe on every task row uses the parent group's accent. The `<ColorPalette />` popover offers exactly these 12 swatches.

**Component & primitive selection**
5. **Use Base UI primitives, not raw HTML.** `Dialog`, `Menu`, `Tooltip`, `Popover`, `Checkbox` — all from `@base-ui/react`. Use the `<MenuList />` recipe from `components/ui/menu-list.tsx` for any menu (group menu, task menu, add-group); only deviate to direct `Menu` if you can articulate why.
6. **Reuse, don't reinvent.** `EditableTitle`, `MemberStack`, `Avatar`, `Button`, `Input` already exist. New cell types or row primitives extend the cell skeleton (140px × 36px, 1px border `--color-border-strong`).
7. **Cells are referenced by short string id (`text`, `status`, `person`, …) per CLAUDE.md.** Title is NOT a cell type — it's `task.title`, rendered by `<TaskTitleCell />`. Do not invent a `"title"` cell-type id.
8. **No `window.confirm` in new code.** Use a Base UI `Dialog`-based confirm with a typed-name pattern for destructive actions (delete group, delete task, bulk-delete). The epic-05 `BoardDeleteConfirmModal` is the reference pattern.

**Mutation & state contracts**
9. **All mutations go through Server Actions wrapped in `withUser`.** Each action calls `requireBoardRole(boardId, "member")` first (or higher where the spec demands), parses input via Zod, returns the updated row(s) for client reconciliation. No `/api` route handlers.
10. **One Zod schema validates client and server.** Live in `lib/validations/group.ts` and `lib/validations/task.ts`. RHF on the client uses `zodResolver(schema)`; the server action calls `Schema.parse(raw)`. Same schema. (Track the standing Zod 4 / `@hookform/resolvers` typecheck baseline noise — do not introduce new TS2769 errors elsewhere.)
11. **No client-generated ids.** Postgres `gen_random_uuid()` only. Optimistic rows that need a temp id use a `tempId: string` field that is replaced on server reconciliation; never insert with a client-supplied `id`.
12. **`router.refresh()` after mutations that change RSC-rendered data.** The Zustand store applies optimistic updates; `revalidateTag` on the server side re-renders the layout when the next navigation happens. For in-place UX inside the table, the Zustand store IS the source of truth — `router.refresh()` is only needed when leaving the route or when board-header data changes.
13. **Soft-delete only.** `deleteGroup` and `deleteTask` set `deleted_at`. Hard delete is forbidden (no admin path is in scope this epic).
14. **Server actions return updated rows or a minimal diff.** Per the epic doc — the client uses this to reconcile after Realtime echoes (epic 08).
15. **No `as any` casts.** No narrow-but-wrong casts (epic 05 F2.3 precedent: `as 37.4 | 26 | 30 | 24 | 22` on a value that wasn't in the union). If the generated type is wrong, escalate — do not paper over.

**RLS & authorization**
16. **RLS is the source of truth.** `requireBoardRole` is a friendly-error layer; the DB rejects unauthorized writes regardless. Never call `adminClient()` from action paths except for `logActivity` (per Q6).
17. **Role gating must match the spec exactly.** Group and task CRUD: `>= member`. Bulk actions: `>= member` (one role check at the action entry, not per-row). Activity reads: any board role.
18. **Don't conflate board-owner with workspace-owner.** Epic 05 F3.3 fixed exactly this in `BoardSettingsMenu`. No epic-06 surface gates on workspace-owner — group/task management is `>= member`.

**Schema & migration hygiene**
19. **Reserved words `"group"` and `"column"` are always double-quoted in raw SQL.** In Supabase JS client, `supabase.from("group")` is correct (the client handles quoting); same for `"column"`.
20. **The `task.board_id` denormalization is maintained by a trigger (`task_board_id_consistency`) on INSERT and UPDATE OF `group_id`.** Do not write `board_id` explicitly when moving a task across groups — set `group_id` only; the trigger fixes `board_id`. Confirmed in epic 02.
21. **Migration filenames follow `YYYYMMDDHHMMSS_description.sql`** and are strictly monotonically increasing. Epic 06 likely needs zero new migrations (group/task/cell tables are already there). If a migration IS added (e.g. for a `groups_collapsed` column under Q5(b)), it slots in after epic-05's last migration.
22. **`pnpm db:types` runs after every migration.** `lib/supabase/types.ts` is generator-output only; never hand-edit (epic 02 followup precedent — hand-edits leak and trigger followups). If you have to add a new RPC or column, run db:push then db:types in the same slice as the migration.

**Hook & RSC discipline**
23. **`"use client"` only when interactivity demands it.** Server data fetching for the board page lives in `page.tsx` (RSC). The `<BoardTable />` shell is `"use client"` (it owns Zustand + dnd-kit + virtualization + selection). Cells and rows are client components. Server actions are imported into client components per the App Router contract.
24. **Hooks at the top level of components, never inside conditional branches.** Epic 05 followup-4 fixed exactly this in the members table. If a component has multiple render branches, hoist `useRouter`/`useTransition`/`useState` to the top.
25. **No callsite stubs for in-scope features.** A "coming soon" toast is acceptable only for cross-epic placeholders explicitly named in the epic doc (e.g. `<AddColumnButton />` deferred to epic 07). Every server action listed in the epic-06 task list must be fully wired; no `toast.info("Coming next")` stubs (epic 05 followup-5 precedent).

**Scope discipline**
26. **File-scope boundaries are non-negotiable.** Two parallel slices may not edit the same file. The epic-05 process note (final review §"Process note") flags exactly the cross-slice commit pollution this guardrail prevents.
27. **No edits to legacy `frontend/` or `backend/`.** Both are gitignored; reading them as visual reference is fine, copying code is not.
28. **`pnpm` only.** Never `npm` or `yarn`. Never `--legacy-peer-deps` etc.

---

## 3. Slice plan

The epic decomposes into four stages. Each stage's slices are parallel-safe by file scope; the followup loop runs after each stage.

```
Stage 1 — foundations (parallel: 4 slices):
  S1. deps + lib/positions.ts + tests
  S2. lib/validations/group.ts + lib/validations/task.ts
  S3. lib/activity.ts (service-role activity logger)
  S4. stores/board-store.ts (Zustand) + tests
        ↓ stage 1 review

Stage 2 — server actions (parallel: 2 slices):
  S5. app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions.ts (group CRUD)
  S6. app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions.ts  (task CRUD + bulk)
        ↓ stage 2 review

Stage 3 — table shell + title editing (sequential within shared files; 3 slices):
  S7. components/board/table/BoardTable.tsx + RSC data load in page.tsx
  S8. components/board/table/{GroupSection,TaskRow,TaskTitleCell}.tsx
  S9. components/board/table/{AddTaskFooter,AddGroupFooter}.tsx + EmptyStates
        ↓ stage 3 review

Stage 4 — virtualization, drag, bulk (parallel: 4 slices, disjoint files):
  S10. components/board/table/{TableVirtualizer,StickyHeader,StickyFirstColumn}.tsx
  S11. components/board/table/{DndProviders,GroupDragHandle,TaskDragHandle}.tsx
  S12. components/board/table/{BulkSelectCheckbox,BulkActionBar}.tsx
  S13. components/board/table/{GroupOverflowMenu,TaskOverflowMenu,ColorPalette,AddColumnButton}.tsx
        ↓ stage 4 review

Stage 5 — wiring, EditableTitle imperative API, perf smoke, tests (sequential):
  S14. components/shared/EditableTitle.tsx (imperative ref API + a11y polish — only if Q1 = (a))
  S15. tests/unit/{positions,board-store,group-actions,task-actions}.test.ts (describe.skip pattern)
  S16. tests/e2e/06-board-table.spec.ts (test.skip stubs per epic-15)
  S17. tests/perf/seed-board.ts (manual perf smoke, per Q9(a))
        ↓ epic-level review → PR
```

---

### Slice S1 — Deps + position helpers + tests

**Owner:** epic-executor (sonnet) · **Stage 1, parallel-safe**

**Files (only):**
- `package.json` (modify — add 5 deps)
- `pnpm-lock.yaml` (regenerated)
- `lib/positions.ts` (create)
- `tests/unit/positions.test.ts` (create — `describe.skip` per the epic-04/05 precedent)

**Forbidden scope:** any other file. Do not touch existing tests, types, components, or schemas.

**Spec:**

1. Run: `pnpm add @tanstack/react-table @tanstack/react-virtual @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`. Use exact-version output that pnpm resolves to. Commit the lockfile.
2. Create `lib/positions.ts` with the function:
   ```ts
   export function positionBetween(prev: number | null, next: number | null): number {
     if (prev === null && next === null) return 1;
     if (prev === null) return next! - 1;
     if (next === null) return prev + 1;
     return (prev + next) / 2;
   }
   ```
   Document the algorithm + the precision-decay risk (epic doc lines 109–118). Add a `MIN_POSITION_DELTA = 1e-6` constant; if `Math.abs(next - prev) < MIN_POSITION_DELTA`, throw `{ code: "POSITION_PRECISION_EXHAUSTED", message: "Positions need compaction" }`. (The compacting Edge Function lands in epic 15; this throw is the "trigger" signal. Server actions catch it and surface a friendly error — epic 06 DoD permits this.)
3. Write `tests/unit/positions.test.ts` (Vitest) with the following cases (use `describe.skip` + `// @ts-expect-error vitest is wired in epic 15`):
   - both null → 1
   - prev null, next=10 → 9
   - prev=10, next null → 11
   - prev=1, next=2 → 1.5
   - prev=0, next=1 → 0.5
   - precision exhaustion: prev = next = 0.0000001 → throws

**Definition of done:**
- `pnpm install` succeeds; lockfile committed; `pnpm typecheck` and `pnpm lint` clean.
- `lib/positions.ts` exports `positionBetween` and `MIN_POSITION_DELTA`.
- Test file exists with the six cases under `describe.skip`. Inside skip, the test bodies must be syntactically valid with `expect(...).toBe(...)` calls — they will run when the test runner lands.
- Zero changes to any other file.

**Escalation triggers:**
- If `pnpm add` triggers a peer-dep conflict (React 19, Next 15.5), STOP — do not bypass with `--force` or `--legacy-peer-deps`. Escalate.
- If `MIN_POSITION_DELTA = 1e-6` proves wrong for the algorithm (extremely unlikely), escalate before changing.

**Guardrails applied:** #28 (pnpm), #15 (no as any), #11 (no client-gen ids — n/a here but `MIN_POSITION_DELTA` keeps numeric precision sane).

---

### Slice S2 — Group + Task Zod schemas

**Owner:** epic-executor (sonnet) · **Stage 1, parallel-safe**

**Files (only):**
- `lib/validations/group.ts` (create)
- `lib/validations/task.ts` (create)

**Forbidden scope:** any other file. Do not touch `lib/validations/board.ts` or other validation files.

**Spec:**

Create the schemas the server actions and forms will share:

`lib/validations/group.ts`:
```ts
import { z } from "zod";

export const CreateGroupSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),     // restrict to 12-color palette server-side too (see actions slice)
  position: z.number(),
});
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;

export const RenameGroupSchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().min(1).max(120),
});

export const RecolorGroupSchema = z.object({
  groupId: z.string().uuid(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export const ReorderGroupSchema = z.object({
  groupId: z.string().uuid(),
  position: z.number(),
});

export const DuplicateGroupSchema = z.object({ groupId: z.string().uuid() });

export const DeleteGroupSchema = z.object({ groupId: z.string().uuid() });

// inferred input types follow…
```

`lib/validations/task.ts`:
```ts
import { z } from "zod";

export const CreateTaskSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().max(500).default(""),         // empty allowed (legacy schema permits)
  position: z.number(),
});

export const RenameTaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().max(500),
});

export const DuplicateTaskSchema = z.object({ taskId: z.string().uuid() });

export const DeleteTaskSchema = z.object({ taskId: z.string().uuid() });

export const MoveTaskSchema = z.object({
  taskId: z.string().uuid(),
  groupId: z.string().uuid(),
  position: z.number(),
});

export const BulkDeleteTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(500),
});

export const BulkDuplicateTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(500),
});

export const BulkMoveTasksToGroupSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(500),
  groupId: z.string().uuid(),
});
// inferred input types follow…
```

Hex regex: server-side schema rejects free-form hex; the action layer additionally checks the value is in the 12-swatch palette (`['#a25ddc', ...]`) — see slice S5.

**Definition of done:**
- Both files exist and export the schemas + inferred types named above.
- `pnpm typecheck` and `pnpm lint` clean.
- Bulk schemas cap array length at 500.

**Escalation triggers:**
- None expected.

**Guardrails applied:** #10 (one Zod schema), #15 (no `as any`).

---

### Slice S3 — Activity logger (service-role)

**Owner:** epic-executor (sonnet) · **Stage 1, parallel-safe**

**Files (only):**
- `lib/activity.ts` (create)
- `tests/unit/activity.test.ts` (create — `describe.skip` stubs)

**Forbidden scope:** any other file. Do not modify `lib/supabase/admin.ts`, `lib/supabase/types.ts`, or any action file.

**Spec:**

Per Q6 decision (assumed (a) — service-role).

```ts
// lib/activity.ts
// Server-only. Uses the service-role admin client because public.activity has
// no INSERT policy (epic 04 risk-note 8). Writes are best-effort and never
// fail the parent action — wrapped callers must catch and log.
import { adminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export type ActivityType =
  | "group.created" | "group.renamed" | "group.recolored"
  | "group.reordered" | "group.duplicated" | "group.deleted"
  | "task.created" | "task.renamed" | "task.duplicated"
  | "task.deleted" | "task.moved"
  | "task.bulk_deleted" | "task.bulk_duplicated" | "task.bulk_moved";

export type LogActivityArgs = {
  boardId: string;
  actorId: string;
  type: ActivityType;
  taskId?: string | null;
  payload?: Record<string, unknown>;
};

export async function logActivity(args: LogActivityArgs): Promise<void> {
  try {
    const { error } = await adminClient()
      .from("activity")
      .insert({
        board_id: args.boardId,
        actor_id: args.actorId,
        type: args.type,
        task_id: args.taskId ?? null,
        payload: args.payload ?? {},
      });
    if (error) {
      logger.warn({ err: error, type: args.type, boardId: args.boardId }, "activity log failed");
    }
  } catch (err) {
    logger.warn({ err, type: args.type, boardId: args.boardId }, "activity log threw");
  }
}
```

**Critical detail:** the schema column is `type`, NOT `action`. Confirmed against `20260506224930_initial_schema.sql:266-274` — the epic doc's helper signature uses `action` but the actual column is `type`. Use `type` everywhere.

**Critical detail:** the schema does NOT have `group_id` or `column_id` columns on `activity` (only `task_id`). The epic doc's helper signature lists `groupId?: string` and `columnId?: string` — these go into `payload` if needed, NOT into top-level columns. Do not invent new columns.

Tests (`describe.skip`):
- Successful insert: `logActivity({ boardId, actorId, type: 'task.created' })` → mock `adminClient` returns `{ error: null }`; logger.warn not called.
- Insert error: returns `{ error: ... }` → logger.warn called with the error; function does not throw.
- Throw inside admin: `adminClient()` throws → caught; logger.warn called; function does not throw.

**Definition of done:**
- `lib/activity.ts` exports `logActivity` and `ActivityType`.
- The function never throws (catches both error-return and exception paths).
- Test file exists with three cases under `describe.skip`.
- `pnpm typecheck` clean.

**Escalation triggers:**
- If the generated `Database['public']['Tables']['activity']['Insert']` type does not have `type` (or has `action` instead), the migration is wrong — escalate. Do not work around with `as any`.

**Guardrails applied:** #16 (RLS source of truth — only service-role for activity per epic 04 decision), #19 (reserved words n/a here), #15 (no as any).

---

### Slice S4 — Zustand board store

**Owner:** epic-executor (sonnet) · **Stage 1, parallel-safe**

**Files (only):**
- `stores/board-store.ts` (create)
- `tests/unit/board-store.test.ts` (create — `describe.skip`)

**Forbidden scope:** any other file. Do not modify `stores/sidebar-store.ts` or any component.

**Spec:**

Per the epic doc lines 86–106, but adjusted for actual schema. Zustand v5 (already installed). Store is per-board: a single store keyed by `boardId` with a `setBoard` action that resets transient state on navigation. Use the **single-store-with-reset** pattern (simpler; matches the existing `sidebar-store.ts` shape).

**Per Q5(a) + localStorage clarification:** group collapse state must survive reload. Use Zustand's `persist` middleware backed by `localStorage`, scoped per-board. SSR-safe: `createJSONStorage(() => (typeof window === "undefined" ? noopStorage : localStorage))`. The persisted slice is **only** `collapsedGroupIds` — never persist `groups`, `tasks`, `cells`, `selection`, drag, or edit state. Storage key: `donezo:board-collapsed:v1` (versioned for future shape changes). The `partialize` option restricts what gets serialized; the persisted shape is `Record<boardId, string[]>` (not `Set` — JSON-serializable). On hydration, the matching `boardId` entry is read back into the in-memory `collapsedGroupIds: Set<string>`.

```ts
// stores/board-store.ts
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Database } from "@/lib/supabase/types";

type Group = Database["public"]["Tables"]["group"]["Row"];
type Task  = Database["public"]["Tables"]["task"]["Row"];
type Cell  = Database["public"]["Tables"]["cell"]["Row"];

type BoardState = {
  boardId: string | null;
  groups: Group[];
  tasks: Task[];
  cells: Map<string, Cell>;          // key: `${task_id}:${column_id}`
  selection: Set<string>;            // task ids
  draggingTaskId: string | null;
  draggingGroupId: string | null;
  collapsedGroupIds: Set<string>;    // per Q5(a) — persisted to localStorage per-board
  collapsedByBoard: Record<string, string[]>;  // serialized form for persist
  editingTaskId: string | null;      // for inline title edit
  tempIdMap: Map<string, string>;    // tempId → realId, populated on server reconciliation

  // hydration (called once when the page mounts)
  hydrate: (args: { boardId: string; groups: Group[]; tasks: Task[]; cells: Cell[] }) => void;
  reset: () => void;

  // structural — IDEMPOTENT (apply same row twice = no-op)
  applyGroupUpsert: (group: Group) => void;
  applyGroupDelete: (groupId: string) => void;
  applyTaskUpsert: (task: Task) => void;
  applyTaskUpsertReplaceTemp: (tempId: string, real: Task) => void;  // optimistic temp → real swap
  applyTaskDelete: (taskId: string) => void;
  applyCellUpsert: (cell: Cell) => void;

  // UI
  toggleGroupCollapse: (groupId: string) => void;
  setSelection: (next: Set<string>) => void;
  toggleSelection: (taskId: string) => void;
  selectGroup: (groupId: string, checked: boolean) => void;     // tri-state in UI
  selectAll: (checked: boolean) => void;
  clearSelection: () => void;
  setDraggingTask: (taskId: string | null) => void;
  setDraggingGroup: (groupId: string | null) => void;
  setEditingTask: (taskId: string | null) => void;
};

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({ /* ... */ }),
    {
      name: "donezo:board-collapsed:v1",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : localStorage
      ),
      // ONLY persist the per-board collapse map. Never persist live data.
      partialize: (state) => ({ collapsedByBoard: state.collapsedByBoard }),
      // On rehydration, re-derive collapsedGroupIds for the active board (if any).
      onRehydrateStorage: () => (state) => {
        if (!state || !state.boardId) return;
        const ids = state.collapsedByBoard[state.boardId] ?? [];
        state.collapsedGroupIds = new Set(ids);
      },
    }
  )
);
```

**`toggleGroupCollapse` implementation must keep both `collapsedGroupIds` (in-memory Set) and `collapsedByBoard[boardId]` (serialized array) in sync** — toggling updates both, which triggers `persist` to write to localStorage.

**No `toggleGroupCollapse` server action exists.** Collapse state is purely client-side; do NOT add it to any actions file.

**Idempotency contract** (critical for epic 08 Realtime echoes):
- `applyTaskUpsert(task)` — replaces the existing task by id, or inserts. Same `updated_at` → no-op (compare by `updated_at` to skip stale writes).
- `applyGroupUpsert(group)` — same pattern.
- `applyCellUpsert(cell)` — keyed by `${task_id}:${column_id}` in the Map; replace or insert.
- `applyTaskDelete(taskId)` — removes from `tasks`, removes any cell entries with that task_id, removes from `selection` if present.
- `applyGroupDelete(groupId)` — removes the group AND all tasks belonging to it (cascading client-side; the DB cascade handles it server-side too).
- `applyTaskUpsertReplaceTemp(tempId, real)` — replaces the optimistic task that was inserted with the temp id; preserves position in the `tasks` array. Records `tempId → real.id` in `tempIdMap` so any in-flight optimistic edits keyed by `tempId` reconcile correctly. Used by S9's chain-add and S6's `createTask` reconciliation. (Mitigates Risk #2 — temp-id collision.)

Test cases (`describe.skip`):
- hydrate sets all three collections + boardId; preserves persisted collapse state for the board
- applyTaskUpsert inserts then updates (idempotent)
- applyTaskUpsertReplaceTemp swaps temp → real, preserves position, records mapping
- applyTaskDelete removes task + its cells + clears it from selection
- applyGroupDelete cascades to its tasks
- toggleSelection adds/removes
- selectGroup tri-state (sets all tasks of that group)
- toggleGroupCollapse toggles in-memory Set AND `collapsedByBoard[boardId]` (mock localStorage to verify write)
- reset returns to initial state but PRESERVES `collapsedByBoard` (persisted slice survives reset)
- SSR safety: importing the module under `typeof window === "undefined"` does not throw

**Definition of done:**
- `stores/board-store.ts` exports `useBoardStore` with the full type.
- All `apply*` functions are idempotent.
- `applyTaskUpsertReplaceTemp` preserves the optimistic row's position in the array.
- Persist middleware writes only `collapsedByBoard` to localStorage under key `donezo:board-collapsed:v1`.
- SSR-safe — no `window` access at module-load time.
- Test file with the cases under `describe.skip`.
- `pnpm typecheck` clean.

**Escalation triggers:**
- If the generated types don't expose `Database["public"]["Tables"]["group"]["Row"]` cleanly (PostgREST sometimes treats reserved-word table keys oddly), STOP and escalate.
- If `zustand/middleware`'s `persist` API has changed in v5 in a way that breaks the `createJSONStorage` + `partialize` pattern above, STOP and escalate (do NOT downgrade the dep).

**Guardrails applied:** #11 (no client-gen ids — `tempId` is a separate field, never sent as `id` to server), #15 (no `as any`), #23 (RSC vs client — store is client-only state, top-of-file `"use client"`).

---

### Slice S5 — Group server actions

**Owner:** epic-executor (sonnet) · **Stage 2, parallel-safe with S6**

**Files (only):**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions.ts` (create — note the new `groups/` subdirectory under the board route)
- `tests/unit/group-actions.test.ts` (create — `describe.skip`)

**Forbidden scope:**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts` (board CRUD; epic 05 owns)
- Anything under `app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/` (S6 owns)
- Any component under `components/board/` (Stage 3+ owns)

**Spec:**

File starts with `"use server"`. Each action wraps `withUser`, calls `requireBoardRole(boardId, "member")`, parses input via the slice S2 Zod schema, performs the DB operation under the user's authed client, then fires `logActivity(...)` (best-effort, ignores errors). Returns the updated row(s).

Actions:
1. `createGroup({ boardId, name, color, position })` → INSERT `"group"`, return the new row. Activity: `group.created` with `payload: { name, color, position }`.
2. `renameGroup({ groupId, name })` → load group to get `board_id`, then UPDATE name, return updated row. Activity: `group.renamed` with `payload: { from, to }`.
3. `recolorGroup({ groupId, color })` — same shape. Activity: `group.recolored`.
4. `reorderGroup({ groupId, position })` — same shape. Activity: `group.reordered`.
5. `duplicateGroup({ groupId })` — load source group + its live tasks + their cells, then in a single transaction insert the new group + cloned tasks (with new positions) + cloned cells. **Use a Postgres function `clone_group(p_group_id uuid)` for atomicity** — pattern matches `clone_board` from epic 05. **DECISION POINT:** this slice CANNOT ship a new migration in parallel with itself. Two sub-options:
   - (a) Ship the migration in slice S5 itself — adds one new migration `YYYYMMDDHHMMSS_clone_group_rpc.sql`. Then S5 also runs `pnpm db:push && pnpm db:types`.
   - (b) Ship `duplicateGroup` as a multi-statement client-side loop (insert group, then for each task insert task, then for each cell insert cell). Not atomic; risk of partial duplicates on failure. Acceptable for v1; a future polish slice can replace with an RPC.
   - **Recommendation:** (b) for this stage. Keep S5 schema-free. Atomicity is a polish concern; partial duplicates are recoverable by re-running.
6. `deleteGroup({ groupId })` — soft delete: `UPDATE "group" SET deleted_at = now()`. The `cascade_soft_delete_to_tasks` trigger soft-deletes the group's tasks. Activity: `group.deleted`.

**Color whitelist enforcement:** the action must reject colors outside the 12-swatch palette. Define the palette as a const in `lib/positions.ts`? No — better in a new `lib/colors.ts`:

   ```ts
   // lib/colors.ts (create as part of this slice if absent)
   export const GROUP_PALETTE = [
     "#a25ddc", "#fbbc04", "#f1e4de", "#fdcfe8",
     "#f28b82", "#fff475", "#ccff90", "#cbf0f8",
     "#a7ffeb", "#d7aefb", "#e6c9a8", "#e8eaed",
   ] as const;
   export type GroupColor = (typeof GROUP_PALETTE)[number];
   export function isValidGroupColor(c: string): c is GroupColor {
     return (GROUP_PALETTE as readonly string[]).includes(c.toLowerCase());
   }
   ```

   Wait — `lib/colors.ts` is shared with task-color (none in this epic) and the `<ColorPalette />` component (slice S13). To avoid file-scope conflict with S13, **put the palette in `lib/group-palette.ts` instead**, owned by S5, and let S13 import it read-only.

   Actions reject invalid colors with `{ code: "VALIDATION", message: "Invalid color", field: "color" }`.

**Test cases (`describe.skip`):**
- createGroup: rejects unauthorized (mock `requireBoardRole` to throw), rejects invalid color, succeeds and inserts row + logs activity.
- renameGroup: rejects when name empty (Zod), succeeds.
- duplicateGroup: copies tasks count = source (mock the chained from/insert/select calls).
- deleteGroup: sets `deleted_at`; cascade is DB-side, not asserted.

**Definition of done:**
- All six actions exist with the contracts above.
- Each starts with `"use server"`, wraps `withUser`, calls `requireBoardRole` first, parses input, calls `logActivity` after success.
- `lib/group-palette.ts` exists and is consumed by `createGroup` and `recolorGroup` for color validation.
- `pnpm typecheck` and `pnpm lint` clean.
- Test file exists with the four sketch cases under `describe.skip`.
- ZERO `as any` casts.

**Escalation triggers:**
- If the generated types don't allow `supabase.from("group")` at all (PostgREST quoting issue), escalate before adding any cast workaround.
- If `cascade_soft_delete_to_tasks` trigger doesn't fire as expected (verifiable in pgTAP later, not in this slice), flag in the done report — DO NOT add a manual cascade in the action.
- If duplicateGroup partial-failure recovery is required as in-scope (orchestrator decision), escalate to upgrade to RPC path.

**Guardrails applied:** #1, #9, #10, #15, #16, #17, #19 (table name quoting in raw SQL — n/a here, all via PostgREST), #20 (don't write task.board_id explicitly — n/a, no task writes here), #25 (no callsite stubs).

---

### Slice S6 — Task server actions (single + bulk)

**Owner:** epic-executor (sonnet) · **Stage 2, parallel-safe with S5**

**Files (only):**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/tasks/actions.ts` (create)
- `tests/unit/task-actions.test.ts` (create — `describe.skip`)

**Forbidden scope:**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts`
- `app/(app)/w/[workspaceSlug]/b/[boardId]/groups/actions.ts` (S5 owns)
- `lib/group-palette.ts` (S5 owns)
- Any component file

**Spec:**

Same shape as S5. Each action wraps `withUser`, calls `requireBoardRole(boardId, "member")` (resolve `boardId` from the task or group as needed), parses Zod input, mutates, logs activity, returns updated row(s).

Actions:
1. `createTask({ groupId, title, position })` — load group to get `board_id`, INSERT task with `board_id` set explicitly **only as a fallback**; in practice the `task_board_id_consistency` BEFORE INSERT trigger fixes it from `group_id`. Per guardrail #20, set `group_id` only and let the trigger handle `board_id`. Return inserted row. Activity: `task.created`.
2. `renameTask({ taskId, title })` — load task to get `board_id`, UPDATE, return. Activity: `task.renamed` with `payload: { from, to }`.
3. `duplicateTask({ taskId })` — load source task + cells; INSERT new task at position = `positionBetween(source.position, nextSiblingPosition)`; INSERT cloned cells. Multi-statement client-side (per S5 pattern — non-atomic, acceptable for v1). Return new task. Activity: `task.duplicated`.
4. `deleteTask({ taskId })` — soft delete. Activity: `task.deleted`.
5. `moveTask({ taskId, groupId, position })` — UPDATE `group_id` and `position` (NOT `board_id` — trigger handles). If `groupId` differs from current, log `task.moved` with `payload: { fromGroupId, toGroupId }`; otherwise log `task.reordered`. Wait — the activity-type enum needs `task.reordered`. Add it to S3's `ActivityType` union? Cross-slice. **Resolution:** S3's `ActivityType` already includes `task.moved` only; epic doc § Activity hooks line 204 lists `task.moved` covering both cases. Reuse `task.moved` for both reorder-within-group and move-across-group; differentiate via `payload`.
6. `bulkDeleteTasks({ taskIds })` — soft delete in one statement: `UPDATE task SET deleted_at = now() WHERE id IN (...) AND deleted_at IS NULL`. Resolve `boardId` from the first task fetched, ensure all tasks belong to the same board (security check: reject if mixed boards detected — `{ code: "VALIDATION", message: "Tasks span multiple boards" }`). Activity: `task.bulk_deleted` with `payload: { count, taskIds }`.
7. `bulkDuplicateTasks({ taskIds })` — loop the single `duplicateTask` logic per task (or one INSERT … SELECT statement; both acceptable). Activity: `task.bulk_duplicated`.
8. `bulkMoveTasksToGroup({ taskIds, groupId })` — UPDATE `group_id = $1, position = (each task's new position computed sequentially)` for all in-scope tasks. Same single-board safety check. Activity: `task.bulk_moved`.

**Bulk safety:** every bulk action loads the affected tasks first to confirm board membership, then runs `requireBoardRole` once for that single resolved board. Reject if `taskIds.length > 500` (already capped in Zod).

**Position math:** `bulkMoveTasksToGroup` puts the moved tasks at the END of the destination group: load destination's max position, then `position = max + i + 1` for each moved task. Simpler than fractional math for bulk.

Test cases (`describe.skip`):
- createTask: succeeds, sets only `group_id` (not `board_id`); trigger fires (asserted by mocking the return shape with the trigger-set `board_id`).
- moveTask: cross-group → `payload.fromGroupId !== payload.toGroupId`; within-group → equal.
- bulkDeleteTasks: rejects mixed-board input.
- bulkMoveTasksToGroup: positions are sequential from `max(destination) + 1`.

**Definition of done:**
- All eight actions exist with the contracts above.
- Each calls `requireBoardRole(boardId, "member")` exactly once (single ID resolved before the check).
- Bulk actions reject mixed-board task arrays.
- ZERO `as any` casts. ZERO writes to `task.board_id` (let the trigger handle it).
- `pnpm typecheck` and `pnpm lint` clean.
- Test file exists with the four sketch cases under `describe.skip`.

**Escalation triggers:**
- If the trigger doesn't actually fire on INSERT without `board_id` set (verify by reading the migration — it should, per epic 02), escalate.
- If `INSERT … SELECT` for bulk duplicate hits a Supabase JS limitation, fall back to a per-task loop and document in the done report.

**Guardrails applied:** #1, #9, #10, #15, #16, #17, #20, #25.

---

### Slice S7 — Board page RSC data load + `<BoardTable />` shell

**Owner:** epic-executor (sonnet) · **Stage 3, sequential after Stage 2**

**Files (only):**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` (rewrite — replaces the current placeholder)
- `components/board/table/BoardTable.tsx` (create)
- `components/board/table/types.ts` (create — shared row/group/cell types for the table layer)

**Forbidden scope:**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` (epic 05 owns)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/actions.ts` (epic 05)
- Group / task / cell components that don't yet exist (S8, S9 own)

**Spec:**

`page.tsx` (RSC):
1. Read `params: Promise<{ boardId: string }>`.
2. `const supabase = await createClient();` then run the four data queries in parallel (groups, tasks, cells, columns). The cells query depends on task ids — issue tasks first, then cells (acceptable two-round-trip per epic doc). Filter all by `is("deleted_at", null)` where applicable.
3. Pass the result bag to `<BoardTable boardId={boardId} initial={{ groups, tasks, cells, columns }} />`.
4. RLS handles authorization; no extra check needed at the page level (the layout already enforces board access).

`BoardTable.tsx`:
1. `"use client"` directive.
2. `useEffect` on mount calls `useBoardStore.getState().hydrate({ boardId, groups, tasks, cells })` ONCE. Use a ref to guard against double-hydration in StrictMode dev.
3. `useEffect` cleanup calls `useBoardStore.getState().reset()` when boardId changes or component unmounts.
4. Renders **no** virtualization, **no** drag-drop, **no** selection in this slice — only a static rendered list of groups → tasks → title cells. This slice's purpose is to wire data flow end-to-end.
5. Uses placeholder child components from S8 (which lands after this) — for this slice, render `<div>{group.name}</div><div>{task.title}</div>` inline. **DECISION:** S7 ships with inline JSX placeholders; S8 replaces them with real components.

`types.ts`:
- Re-exports the Group, Task, Cell types from `lib/supabase/types.ts` for convenience.
- Defines `TableData = { groups: Group[]; tasks: Task[]; cells: Cell[]; columns: Column[] }`.
- Defines `TitleColumnId = string` — the title column is found in `columns` where `type === 'text'` AND `name === 'Name'` (legacy convention) OR via a `is_primary` flag. **DECISION POINT:** the schema does NOT have an `is_primary` flag on `column`. The legacy app convention was the first column. **Resolution:** for epic 06, the title is `task.title` (a row-level column on the task table itself), NOT a `cell` row. The `column` rows are for additional cells only (text, status, etc.) and epic 06 renders ONLY `task.title` — no cells from the `cell` table. The `columns` query is loaded for completeness (epic 07 consumes), but `<BoardTable />` only renders the title column for now. **The cells query can be deferred** — but the doc says load it. Keep the query for epic 08 Realtime hookup; just don't render any cells.

**Definition of done:**
- `page.tsx` is RSC, loads four queries in parallel via `Promise.all` (cells query is the second round-trip), passes to `<BoardTable />`.
- `<BoardTable />` is `"use client"`, hydrates the Zustand store on mount, resets on unmount.
- A signed-in member sees their groups + tasks rendered in a static list (no styling, no drag, no virtualization yet — that's the next slices).
- `pnpm typecheck` and `pnpm lint` clean.
- ZERO `as any` casts. The store hydration types must match the generated `Row` types exactly.

**Escalation triggers:**
- If the `Promise.all` shape mismatches generated types (e.g. cells query needs a different filter), escalate before casting.
- If StrictMode double-hydration causes flicker, the ref guard pattern is the answer; if it doesn't work, escalate.

**Guardrails applied:** #15 (no as any), #23 (RSC vs client — RSC fetches, client owns interactivity), #5 (Base UI — n/a here, no primitives yet), #1 (no raw hex — visual styling minimal in this slice).

---

### Slice S8 — `<GroupSection />`, `<TaskRow />`, `<TaskTitleCell />`

**Owner:** epic-executor (sonnet) · **Stage 3, sequential after S7**

**Files (only):**
- `components/board/table/GroupSection.tsx` (create)
- `components/board/table/TaskRow.tsx` (create)
- `components/board/table/TaskTitleCell.tsx` (create)

**Forbidden scope:**
- `components/board/table/BoardTable.tsx` (S7 owns; this slice updates it via the existing inline placeholders being swapped)
- Wait — that's a file scope conflict. **Resolution:** S8 must edit `BoardTable.tsx` to swap inline placeholders for the new components. Either (a) S7 ships with explicit `import { GroupSection } from "./GroupSection"` placeholder imports that don't yet resolve (S8 creates them) — but that breaks S7's typecheck; or (b) sequence S8 strictly after S7 and let S8 edit `BoardTable.tsx` as part of its scope.
- **Final decision:** S8's file scope INCLUDES `components/board/table/BoardTable.tsx` for the placeholder swap. S7 ships with inline placeholders; S8 swaps them for real components and adds the imports.

Adjusted forbidden scope:
- `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` (S7 owns)
- All other Stage-4 components

**Spec:**

`GroupSection.tsx` (`"use client"`):
- Props: `{ group: Group; tasks: Task[] }` (filter happens in parent or here from store).
- Render a `<GroupHeader />` chrome inline (no separate file — the doc references `<GroupHeader />` but it's small enough to inline here for v1; if it grows, extract in a polish pass). Per `component-system.md §2.2`:
  - Sticky `top: 182px` (narrow+) / `149px` (mobile). For v1 use `top: 0` inside a scroll container; the `182px` math is for the BoardHeader+ViewTabs offset which is sticky-managed by the layout. **DECISION:** use `sticky top-0` within the table's scroll container; the BoardHeader/ViewTabs above are also sticky, so the actual stack is correct without manual pixel math. Verify visually.
  - Title: `EditableTitle variant="h4"`, color = `var(--color-group-N)` derived from `group.color`. Use a small util `colorToToken(hex: string): string` that maps the 12 palette hexes back to `--color-group-N` (`lib/group-palette.ts` from S5 owns this).
  - Task count chip — opacity 0 → 1 on hover over `--motion-base`.
  - Overflow menu glyph: hidden until hover. Wires to `<GroupOverflowMenu />` from S13 — for THIS slice, render a placeholder `<button aria-label="Group menu (wired in S13)">⋯</button>`.
  - Collapse arrow on the left — wires to `useBoardStore.collapsedGroupIds` from S4.
- Renders `tasks.map(t => <TaskRow key={t.id} task={t} group={group} />)`, plus `<AddTaskFooter group={group} />` placeholder (S9 wires).

`TaskRow.tsx` (`"use client"`):
- Props: `{ task: Task; group: Group }`.
- Visual contract per `component-system.md §2.3`:
  - 36px tall.
  - Sticky-div on the left with `border-left: 6px solid <group-accent>` (the locked group color stripe). Stripe color from `group.color` via Tailwind arbitrary-value `border-l-[6px] border-l-[color:var(--color-group-N)]` (resolve via `colorToToken`).
  - Drag handle (placeholder; S11 wires).
  - Bulk-select checkbox (placeholder; S12 wires).
  - `<TaskTitleCell task={task} />` (336px wide).
  - Comment count badge: `14×13` circle, bg `--color-primary`. For v1, render only when `task.comment_count > 0` — but the schema doesn't denormalize comment count. **DECISION:** render no badge in epic 06 (epic 09 owns comments and can add the count later via an aggregate or a denormalized column).
  - Row hover reveals drag handle + Open expand affordance + comment-add icon over `--motion-base`. For v1, render the affordances always-visible behind a hover-opacity Tailwind state.

`TaskTitleCell.tsx` (`"use client"`):
- Props: `{ task: Task }`.
- **Per Q1 decision:**
  - **If Q1 = (a):** use `<EditableTitle initialValue={task.title} variant="body" onCommit={handleCommit} ariaLabel="Task title" />`. The handler calls `renameTask({ taskId, title })` via `useTransition`. The "on-typing" wash (`bg: --color-surface-active`) hooks via `EditableTitle`'s `onEditingChange` callback applying a class on the row. Optimistic update: call `useBoardStore.getState().applyTaskUpsert({ ...task, title: next })` BEFORE the server call; on `result.ok === false`, revert with `applyTaskUpsert(task)` and `toast.error(result.error.message)`.
  - **If Q1 = (b) or (c):** swap to a `<button>` displaying the title that opens an `<input>` on click, with Enter/Esc/blur semantics per the epic doc. Same optimistic logic.
- Empty title: render `<span className="text-[color:var(--color-fg-muted)]">Untitled</span>`.

**Definition of done:**
- All three files exist; `BoardTable.tsx` imports and renders `<GroupSection />` instead of inline placeholders.
- Group color stripe (6px left border) renders for every task row, color matched to its parent group.
- Inline title edit works: click → edit → Enter saves → row reflects new title; Esc cancels.
- Optimistic update path verified: on a forced server-action error, the title reverts and a toast appears.
- ZERO raw hex/rgba in the three files. Group accent is consumed via `var(--color-group-N)` token only (mapped from `group.color` via `lib/group-palette.ts`).
- ZERO `as any` casts. ZERO `bg-red-*`/`bg-amber-*` raw Tailwind colors.
- ZERO callsite stubs for in-scope behavior. The overflow menu placeholder button is a S13 cross-slice handoff — its `aria-label` documents the intent; it does NOT toast "coming soon."
- `pnpm typecheck` and `pnpm lint` clean.

**Escalation triggers:**
- If `EditableTitle`'s lack of imperative focus blocks group-rename via overflow menu (S13), defer to S14. Do not add a focus API in this slice.
- If the sticky-`top-0` group header overlaps the BoardHeader visually, escalate before introducing pixel-math overrides.

**Guardrails applied:** #1, #2, #3, #4 (group color stripe), #5 (Base UI), #6 (reuse EditableTitle), #7 (title is NOT a cell type), #11 (no client ids), #15, #25 (no callsite stubs for in-scope behavior).

---

### Slice S9 — `<AddTaskFooter />`, `<AddGroupFooter />`, empty states

**Owner:** epic-executor (sonnet) · **Stage 3, sequential after S8**

**Files (only):**
- `components/board/table/AddTaskFooter.tsx` (create)
- `components/board/table/AddGroupFooter.tsx` (create)
- `components/board/table/EmptyStates.tsx` (create — exports `<NoGroupsEmptyState />` and `<NoTasksInGroupHint />`)

This slice ALSO updates:
- `components/board/table/BoardTable.tsx` (mount `<AddGroupFooter />` and the empty state)
- `components/board/table/GroupSection.tsx` (mount `<AddTaskFooter />` and the empty hint)

To keep file-scope clean, **S9 owns these edits**. S8's "forbidden scope" already excluded other Stage-4 components but allowed editing `BoardTable.tsx`. To prevent S9 vs S8 conflict, sequence S9 strictly after S8 (per the stage-3 sequential ordering above).

**Forbidden scope:**
- All Stage-4 components
- `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx`

**Spec:**

`AddTaskFooter.tsx`:
- Props: `{ group: Group }`.
- Renders a footer row inside the group section: `+ Add task` button → on click, becomes an inline `<input>` autofocus with placeholder "Task name". Enter creates the task (calls `createTask({ groupId: group.id, title, position })` where `position = positionBetween(lastTask.position, null)`). After creation, optimistically inserts via `useBoardStore.getState().applyTaskUpsert(<temp>)` and reconciles with the returned row. **Chain-add:** after Enter, the input stays open and clears for the next task. Esc dismisses.
- Use the temp-id pattern: optimistic insert with `id: \`temp-\${Date.now()}\`` then on server success, swap with the server's row (delete temp, insert real). Keep the optimistic flicker minimal.
- Keyboard contract: Enter saves + chain, Esc dismisses, blur saves + dismisses (no chain).

`AddGroupFooter.tsx`:
- Renders `+ Add new group` button at the board footer. On click, opens an inline group-header input with default color (first palette swatch) and pre-selected name "New Group". Enter creates via `createGroup({ boardId, name, color, position })`.

`EmptyStates.tsx`:
- `<NoGroupsEmptyState />` — centered card "Add your first group to start organizing tasks." with a primary button that opens `<AddGroupFooter />` (or directly opens its input). For simplicity, render the card with a button that triggers the same handler as AddGroupFooter via a small shared callback prop.
- `<NoTasksInGroupHint />` — lighter inline message under the group header: "No tasks yet — add one below." Always rendered when `tasks.length === 0` (the AddTaskFooter remains rendered too).

**Definition of done:**
- Adding a task via the footer renders it immediately in the UI (optimistic) and persists to the DB.
- Chain-add works: pressing Enter twice in succession creates two tasks.
- Adding a group via the footer renders it and persists.
- The empty state for "no groups" renders when the board is empty; clicking its CTA opens the group-add input.
- The empty hint for "no tasks in group" renders below each empty group header.
- ZERO raw hex; ZERO callsite stubs; ZERO `as any` casts.
- `pnpm typecheck` and `pnpm lint` clean.

**Escalation triggers:**
- If the optimistic temp-id pattern collides with the store's idempotent upsert (replace-by-id semantics will keep the temp around alongside the real one), escalate. The fix is to add an `applyTaskUpsertReplaceTemp(tempId, realRow)` action in the store — that requires modifying `stores/board-store.ts`, which is OUT OF SCOPE for this slice. Coordinate with a S4 follow-up if needed.

**Guardrails applied:** #1, #5, #6, #11 (temp ids are explicit and never written to DB), #15, #23 (client interactivity), #25.

---

### Slice S10 — Virtualization + sticky chrome

**Owner:** epic-executor (sonnet) · **Stage 4, parallel-safe with S11/S12/S13**

**Files (only):**
- `components/board/table/TableVirtualizer.tsx` (create — wraps `<BoardTable />` body in `useVirtualizer`)
- `components/board/table/StickyHeader.tsx` (create — the table column-header row)
- `components/board/table/StickyFirstColumn.tsx` (create — wrapper applying `position: sticky; left: 0`)

S10 ALSO updates `BoardTable.tsx` to wrap the group/task list in `<TableVirtualizer />`. To avoid Stage-4 file-scope collision on `BoardTable.tsx`, ALL Stage-4 slices that need to edit `BoardTable.tsx` go through this rule: **S10 owns edits to `BoardTable.tsx` for Stage 4.** S11/S12/S13 must compose into existing slots/contexts S10 has set up — they cannot edit `BoardTable.tsx` directly.

To make S11/S12/S13 truly parallel-safe, S10 first ships a "harness" version of `BoardTable.tsx` with explicit slot props or context providers for drag, selection, and overflow. Each later slice plugs into its slot.

**Resolution to make Stage 4 parallel-safe:**
- S10 lands BoardTable.tsx changes in its dispatch.
- S11 (DnD) wraps the table externally via `<DndProviders>` that S10's BoardTable renders (so S10 imports `<DndProviders>` from a path S11 will create — this IS a file-scope dependency: S10 references `./DndProviders` which doesn't exist until S11 ships).
- Same for S12 (`<BulkActionBar>` rendered inside BoardTable) and S13 (overflow menus consumed by S8's TaskRow placeholder buttons).

**Cleanest fix:** SEQUENCE Stage 4 to land S10 first, then S11/S12/S13 in parallel with each other (but all after S10 lands).

Updated stage diagram:
```
Stage 4a — S10 (one slice)
            ↓
Stage 4b — S11 + S12 + S13 (three parallel slices)
```

S11/S12/S13 each edit ONLY the files they create plus the specific component file they wire into (S11 → `TaskRow.tsx`, `GroupSection.tsx`; S12 → `TaskRow.tsx` and a new BulkActionBar mount in BoardTable; S13 → `TaskRow.tsx` and `GroupSection.tsx`). This RE-INTRODUCES file-scope conflicts.

**Final resolution:** sequence Stage 4 entirely. S10 → S11 → S12 → S13. Stage 4 has no parallel slices.

Updated stage diagram:
```
Stage 4 — sequential: S10 → S11 → S12 → S13
```

This is slower but eliminates the file-scope risk that bit epic-05 stage 5.

**Spec for S10:**

`TableVirtualizer.tsx`:
- Props: `{ rows: Array<{ kind: "group-header"; group: Group } | { kind: "task"; task: Task; group: Group } | { kind: "add-task-footer"; group: Group } | { kind: "add-group-footer" }>; rowHeight: (i: number) => number }`.
- Uses `useVirtualizer` from `@tanstack/react-virtual`. `count = rows.length`, `getScrollElement = () => scrollRef.current`, `estimateSize = i => rowHeight(i)`, `overscan = 10`.
- Renders virtualized children: `virtualizer.getVirtualItems().map(vi => <div data-index={vi.index} style={{ position: 'absolute', top: vi.start, height: vi.size, width: '100%' }}>{rows[vi.index]}</div>)`.
- Outer container: `position: relative; overflow: auto; height: 100%`.
- Inner spacer: `style={{ height: virtualizer.getTotalSize() }}`.

`<BoardTable />` flattens groups+tasks into a single rows array (group header at top of each, tasks under, add-task footer at bottom; add-group footer at the very end) and passes to `<TableVirtualizer>`. Collapsed groups skip their tasks (read from `useBoardStore.collapsedGroupIds`).

`StickyHeader.tsx`:
- Renders the table's column header row (currently only "Name" + AddColumnButton placeholder for S13).
- `position: sticky; top: 0; z-index: var(--z-sticky)` (= 2).
- Background `--color-surface`.

`StickyFirstColumn.tsx`:
- Utility wrapper applying `position: sticky; left: 0; z-index: var(--z-sticky)` to its children.
- Used by `<TaskRow>` and `<GroupSection>` (existing components consume this wrapper).

**Definition of done:**
- 1,000 rendered rows do not blow up the DOM (virtualizer drops off-screen rows). Verify via React DevTools (manual smoke).
- Sticky header stays visible while scrolling tasks.
- Sticky-left first column stays visible while scrolling horizontally (note: epic 06 only has one column so horizontal scroll is rare; the sticky-left wrapper future-proofs for epic 07).
- ZERO raw hex; ZERO `as any`; `pnpm typecheck` and `pnpm lint` clean.

**Escalation triggers:**
- If virtualization fights with `display: table` semantics (it does — virtualizer wants block layout), escalate. The expected solution is to drop semantic `<table>` and use ARIA roles (`role="table"`, `role="row"`, `role="cell"`) on `<div>`s — common pattern with TanStack Virtual. Document the deviation.
- If the sticky header z-index collides with the BoardHeader (`var(--z-board-header) = 30`), use a lower z (`var(--z-sticky) = 2`); BoardHeader is sticky-top of the layout, table sticky-top is inside the table's own scroll container — they should not conflict.

**Guardrails applied:** #1, #2, #15, #23, #5 (no Base UI primitives needed for virtualization).

---

### Slice S11 — DnD with dnd-kit (groups + tasks, within and across groups)

**Owner:** epic-executor (sonnet) · **Stage 4, sequential after S10**

**Files (only):**
- `components/board/table/DndProviders.tsx` (create — `<DndContext>` + sensors)
- `components/board/table/GroupDragHandle.tsx` (create — the drag handle inside `<GroupSection>`'s header)
- `components/board/table/TaskDragHandle.tsx` (create — the drag handle inside `<TaskRow>`)
- `components/board/table/GroupSection.tsx` (modify — wrap with `useSortable`, mount `<GroupDragHandle>` and the tasks `<SortableContext>`)
- `components/board/table/TaskRow.tsx` (modify — wrap with `useSortable`, mount `<TaskDragHandle>`)
- `components/board/table/BoardTable.tsx` (modify — wrap with `<DndProviders>`)

**Forbidden scope:**
- Bulk selection (S12), overflow menus (S13), `app/...page.tsx`, `app/(app)/.../actions.ts`.

**Spec:**

`DndProviders.tsx`:
- `"use client"`; props `{ children: ReactNode; onGroupReorder: (groupId: string, newIndex: number) => void; onTaskReorder: (taskId: string, newGroupId: string, newIndex: number) => void }`.
- Renders `<DndContext sensors={[PointerSensor, KeyboardSensor]} collisionDetection={closestCenter} onDragStart={...} onDragEnd={...}>{children}</DndContext>`.
- `onDragEnd` decides: if `active.data.current.kind === "group"` → call `onGroupReorder`; if `"task"` → `onTaskReorder` (with destination group resolved from `over.data.current.groupId`).

`<BoardTable>` provides the handlers to `<DndProviders>`. Each handler:
1. Computes new position via `positionBetween(prev, next)` from neighbor positions in the destination group.
2. Calls `useBoardStore.getState().applyTaskUpsert({ ...task, group_id: newGroupId, position: newPos })` (or `applyGroupUpsert` for groups) — optimistic.
3. Calls `moveTask({ taskId, groupId: newGroupId, position: newPos })` (or `reorderGroup({ groupId, position: newPos })`).
4. On `result.ok === false`, revert by calling `applyTaskUpsert(originalTask)` and `toast.error(result.error.message)`.

`GroupSection.tsx` modifications:
- Wrap content with `useSortable({ id: group.id, data: { kind: "group" } })`.
- Inside the group, wrap tasks with `<SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>`.
- Apply `transform`/`transition` styles from `useSortable` to the section's outer `<div>`.

`TaskRow.tsx` modifications:
- Wrap with `useSortable({ id: task.id, data: { kind: "task", groupId: group.id } })`.
- Drop zone: the `<TaskRow>` and its containing `<SortableContext>` together handle within-group reorder; cross-group drops use the destination group's `<SortableContext>` (dnd-kit handles this with nested contexts).

**Cross-group safety:** when `onTaskReorder` resolves `newGroupId !== originalGroupId`, the action MUST update only `group_id` and `position` — the `task_board_id_consistency` trigger fixes `board_id` server-side (per guardrail #20).

**Touch & keyboard:** dnd-kit's `KeyboardSensor` enables Space-to-pick-up + arrow-to-move + Space-to-drop. Verify keyboard reorder works for both groups and tasks.

**Definition of done:**
- Mouse-drag a group up or down → optimistic reorder → server commit → no flicker on success.
- Mouse-drag a task within a group → reorder works.
- Mouse-drag a task to a different group's drop zone → cross-group move works.
- Space + arrows + Space (keyboard) → group reorder works.
- Space + arrows + Space → task reorder works (within group at minimum; cross-group keyboard is a stretch — flag in done report if not working).
- On a forced server error, the optimistic move reverts.
- ZERO raw hex; ZERO `as any`; `pnpm typecheck` and `pnpm lint` clean.

**Escalation triggers:**
- If virtualization (S10) interferes with dnd-kit's drop-zone detection (it can — virtualized rows that are off-screen don't exist in DOM, so cross-group drops to far-away groups break), escalate. The expected solution: enable `SortableContext` strategy `verticalListSortingStrategy` and increase virtualizer overscan; if that's insufficient, document a limitation in the done report.
- If keyboard cross-group move is genuinely impossible without significant work, ship within-group keyboard only and document.

**Guardrails applied:** #1, #11 (no client ids — drag uses existing task/group ids), #15, #20 (no explicit task.board_id writes), #23.

---

### Slice S12 — Bulk selection + `<BulkActionBar />`

**Owner:** epic-executor (sonnet) · **Stage 4, sequential after S11**

**Files (only):**
- `components/board/table/BulkSelectCheckbox.tsx` (create — single-task checkbox)
- `components/board/table/BulkActionBar.tsx` (create — floating action bar)
- `components/board/table/TaskRow.tsx` (modify — mount `<BulkSelectCheckbox>`)
- `components/board/table/GroupSection.tsx` (modify — mount tri-state group checkbox in the header)
- `components/board/table/StickyHeader.tsx` (modify — mount tri-state board-level checkbox)
- `components/board/table/BoardTable.tsx` (modify — mount `<BulkActionBar>` at the bottom of the scroll container)

**Forbidden scope:**
- Overflow menus (S13), DnD providers (S11 owns), server action files.

**Spec:**

`BulkSelectCheckbox.tsx`:
- Props: `{ taskId: string }`.
- Reads `useBoardStore(s => s.selection.has(taskId))` and `s.toggleSelection`.
- Renders Base UI `<Checkbox.Root>` per `component-system.md` cell-checkbox spec (33px wide cell, 1px border `--color-border-strong`).

Tri-state checkboxes (group + board): use Base UI `<Checkbox.Root>` with `indeterminate` prop bound to `selectedInGroup > 0 && selectedInGroup < totalInGroup`.

`BulkActionBar.tsx` (per `component-system.md §3.9`):
- `"use client"`; renders only when `selection.size > 0`.
- Floating fixed-bottom bar; slides in over `--motion-fast` (150ms) using a CSS transition on `transform: translateY(100% → 0)` or `opacity` + `bottom` shift.
- Bg white; `border-radius: 5px`; `box-shadow: var(--shadow-bulk-bar)`.
- Count tile on the left: 63px wide, bg `--color-primary`, white text "{N} tasks selected" (or "1 task selected" — handle pluralization).
- Body padding `0 20px`. Action buttons icon-on-top with 18px glyph + 12px label. Hover glyph color `--color-primary`.
- Buttons (per Q7 = (b) — assumed): Duplicate, Delete, Move to group ▾, Apply column value ▾ (disabled with "Coming soon" tooltip per epic 07 hook), Clear selection.
- Each button calls the corresponding bulk server action with `Array.from(selection)`. After server response, clears selection.
- "Move to group ▾" opens a Base UI `<Popover>` listing groups on the board (read from store) — click → `bulkMoveTasksToGroup({ taskIds, groupId })`.
- Delete button shows a confirm dialog (Base UI `<Dialog>` — NOT `window.confirm`) with the count.

**Optimistic UX for bulk:**
- Bulk delete: optimistically `applyTaskDelete` per task → fire `bulkDeleteTasks` → on server failure, re-insert all tasks (rare; verify by storing the snapshot before the apply loop).
- Bulk move: optimistically reposition + reparent; revert on failure.
- Bulk duplicate: pessimistic (wait for server, then apply each returned new task) — duplicating doesn't have a great optimistic story without temp-ids per task.

**Definition of done:**
- Selecting checkboxes updates the store.
- Group header checkbox toggles all tasks in that group; tri-state correctly reflects partial selection.
- Board-level checkbox toggles all tasks; tri-state correctly reflects.
- Bulk action bar slides in when selection > 0; slides out when cleared.
- Each of the four enabled buttons calls its server action and updates the UI.
- "Apply column value" is disabled with a Base UI tooltip "Coming in epic 07."
- Delete uses a Base UI Dialog confirm with the typed-name pattern adapted (or just a simple Yes/Cancel given the count is shown — see open question? No, simpler: count + Yes/Cancel is fine for bulk. Save typed-name for irreversible single-resource deletes).
- ZERO `window.confirm`. ZERO raw hex. ZERO `as any`. `pnpm typecheck` and `pnpm lint` clean.

**Escalation triggers:**
- If Base UI `<Checkbox>` doesn't expose an `indeterminate` API (it does, but verify), escalate before falling back to a custom div.
- If the bulk-delete optimistic snapshot pattern produces visible flicker on success (it shouldn't — store is the source of truth), escalate.

**Guardrails applied:** #1, #5 (Base UI Checkbox, Dialog, Popover, Tooltip), #8 (no window.confirm), #15, #25.

---

### Slice S13 — Overflow menus + ColorPalette + AddColumnButton placeholder

**Owner:** epic-executor (sonnet) · **Stage 4, sequential after S12**

**Files (only):**
- `components/board/table/GroupOverflowMenu.tsx` (create)
- `components/board/table/TaskOverflowMenu.tsx` (create)
- `components/board/table/ColorPalette.tsx` (create)
- `components/board/table/AddColumnButton.tsx` (create)
- `components/board/table/GroupSection.tsx` (modify — swap S8's overflow placeholder for `<GroupOverflowMenu>`)
- `components/board/table/TaskRow.tsx` (modify — add `<TaskOverflowMenu>` to the row's hover-revealed slot)
- `components/board/table/StickyHeader.tsx` (modify — append `<AddColumnButton>` at the right edge of the column-header row)

**Forbidden scope:**
- DnD (S11), bulk (S12), `BoardTable.tsx`, server action files.

**Spec:**

`GroupOverflowMenu.tsx` (use `<MenuList />` recipe — `components/ui/menu-list.tsx`):
- Items: Rename, Recolor (opens `<ColorPalette>` popover), Duplicate, Delete (opens Base UI Dialog confirm — typed-name NOT required since soft delete is reversible by re-creating).
- Wires to `renameGroup`, `recolorGroup`, `duplicateGroup`, `deleteGroup`. Optimistic for rename and recolor; pessimistic for duplicate (wait for server, append new group); optimistic for delete (apply `applyGroupDelete` immediately, revert if fails).
- "Rename" requires the imperative focus API on `EditableTitle` — see Q1 / S14. If Q1 = (a), the menu calls a ref-exposed `focusEditor()` on the GroupSection's title. If Q1 = (b)/(c) (input-based), the menu sets a `setEditingGroupId(groupId)` flag in the store. **DECISION (per Q1 recommendation = (a)):** S14 adds the imperative API; this slice consumes it via a ref forwarded down from `<GroupSection>`. If the orchestrator picks Q1=(b)/(c), this slice instead uses a store flag.

`TaskOverflowMenu.tsx`:
- Items: Rename, Duplicate, Delete (Dialog confirm), Open task drawer (placeholder — epic 09).
- "Open task drawer" navigates to `/w/<slug>/b/<id>/t/<taskId>` — that route is a `.gitkeep` placeholder; navigation will 404 in epic 06. Acceptable: the drawer route is owned by epic 09. Render the menu item as ENABLED (it's not a stub — the route exists, just empty); when epic 09 lands, the destination renders. Document this in the done report.

`ColorPalette.tsx` (per `component-system.md §3.3`):
- Base UI `<Popover>`. 142px wide grid of 12 swatches from `--color-group-1` through `--color-group-12`.
- Props: `{ value: string; onChange: (color: string) => void; trigger: ReactNode }`.
- Each swatch: 22px square, `border-radius: 4px`, click sets the color.
- Selected swatch shows a check glyph or a 2px ring in `--color-primary`.

`AddColumnButton.tsx` (per Q8 = (a) — assumed):
- Disabled `<button>` at the right edge of the table column header. Tooltip "Coming in epic 07" (Base UI Tooltip).
- `aria-disabled="true"`; matches the `BoardViewTabs` disabled-tab pattern.

**Definition of done:**
- Group overflow menu opens and all four actions work end-to-end (Rename, Recolor, Duplicate, Delete).
- Task overflow menu opens; Rename, Duplicate, Delete work. "Open task drawer" navigates (target page is empty per epic 09).
- Color palette renders 12 swatches and persists the selection via `recolorGroup`.
- AddColumnButton is disabled with tooltip; not a `toast.info` callsite stub.
- ZERO raw hex (palette consumed via `var(--color-group-N)`). ZERO `window.confirm`. ZERO `as any`. ZERO `bg-red-*`. `pnpm typecheck` and `pnpm lint` clean.

**Escalation triggers:**
- If S14 doesn't ship the imperative focus API in time (Q1 = (a)), fall back to a store flag pattern (`editingGroupId`) and document.
- If `<Dialog>` confirm for delete-group conflicts with the bulk-bar dialog from S12 (z-index), use `--z-modal` (51) and verify only one dialog is open at a time.

**Guardrails applied:** #1, #4 (group palette tokens), #5 (MenuList, Dialog, Popover, Tooltip), #8 (no window.confirm), #15, #25.

---

### Slice S14 — `EditableTitle` imperative focus API + a11y polish

**Owner:** epic-executor (sonnet) · **Stage 5, sequential after Stage 4**

**Skip this slice entirely if Q1 ≠ (a).**

**Files (only):**
- `components/shared/EditableTitle.tsx` (modify — add `forwardRef` + imperative `focus()` method)
- `tests/unit/EditableTitle.test.tsx` (modify — add focus-via-ref test case)

**Forbidden scope:** any other file.

**Spec:**

Convert `EditableTitle` to use `forwardRef`. Expose an imperative handle via `useImperativeHandle`:
```ts
export type EditableTitleHandle = { focus: () => void };
const EditableTitle = forwardRef<EditableTitleHandle, EditableTitleProps>((props, ref) => {
  // existing logic
  useImperativeHandle(ref, () => ({
    focus: () => {
      setEditing(true);
      setTimeout(() => elementRef.current?.focus(), 0);
    },
  }));
  // ...
});
```

For Q1 = (a), also add ARIA improvements to address the screen-reader concern in epic doc lines 138–141:
- When in display mode: `role="textbox"` + `aria-readonly="true"` + `aria-label` (already there).
- When in edit mode: keep the `<blockquote contentEditable>` but add `role="textbox"` + `aria-multiline="false"` + `aria-label`.
- Maintain focus visibly: ensure the `:focus-visible` outline is `1px solid --color-primary` per spec.

**Definition of done:**
- `EditableTitle` exports an `EditableTitleHandle` ref type; `forwardRef` wired.
- Calling `ref.current.focus()` from a parent enters edit mode and focuses the element.
- ARIA attributes added for both display and edit modes.
- Existing callsites (board title, group title, task title) continue to work without changes (the ref is optional).
- `pnpm typecheck` and `pnpm lint` clean.
- The new `BoardSettingsMenu`'s `Rename` item (currently a no-op toast in epic 05) now calls the focus API. **WAIT — that touches `components/board/BoardSettingsMenu.tsx`, which is OUT OF SCOPE for this slice.** Resolution: leave the BoardSettingsMenu untouched in this slice; document the deferred BoardSettingsMenu fix as a one-line follow-up that any later polish slice can pick up. Epic 06's group-overflow `Rename` (S13) consumes the new API; the board's `Rename` stays as-is.

**Escalation triggers:**
- If `forwardRef` + `useImperativeHandle` breaks any existing callsite typecheck (it shouldn't — the ref is optional), escalate.

**Guardrails applied:** #6 (extend the existing primitive), #15.

---

### Slice S15 — Unit tests for store + actions

**Owner:** epic-executor (sonnet) · **Stage 5, parallel-safe with S14/S16/S17**

**Files (only):**
- `tests/unit/positions.test.ts` (modify — only if S1 didn't ship full coverage; otherwise no-op)
- `tests/unit/board-store.test.ts` (modify — fill in any sketch cases)
- `tests/unit/group-actions.test.ts` (modify — fill in any sketch cases)
- `tests/unit/task-actions.test.ts` (modify — fill in any sketch cases)
- `tests/unit/activity.test.ts` (modify — fill in any sketch cases)

**Forbidden scope:** any non-test file. Any other test file.

**Spec:** ensure each test file has fully-written `describe.skip` blocks with ≥3 cases each, matching the precedent of `tests/unit/board-actions.test.ts` and `tests/unit/workspace-actions.test.ts` from epic 05. Use `// @ts-expect-error vitest is wired in epic 15` per the established pattern.

**Definition of done:**
- Five test files exist with `describe.skip` blocks containing fully-written test bodies.
- `pnpm test` succeeds (it short-circuits on `--passWithNoTests` and `describe.skip` is allowed).

**Escalation triggers:**
- If `vitest` IS suddenly available (epic 15 landed early), de-skip and run. Verify pass before commit.

**Guardrails applied:** #28.

---

### Slice S16 — Playwright E2E stub

**Owner:** epic-executor (sonnet) · **Stage 5, parallel-safe with S14/S15/S17**

**Files (only):**
- `tests/e2e/06-board-table.spec.ts` (create — `test.skip` stubs per epic-15)

**Forbidden scope:** any other file.

**Spec:** mirror the precedent of `tests/e2e/05-workspaces-boards.spec.ts` (a similar stub from epic 05). Cover the epic doc DoD scenario (line 341):
- create group → add 5 tasks → reorder them → cross-group drag → bulk select → bulk delete → reload → state persists.

Each step is a `test.skip("description", async ({ page }) => { /* TODO: epic 15 */ })`.

**Definition of done:**
- File exists with the documented scenario as `test.skip`.
- `@ts-expect-error` on the `@playwright/test` import per precedent.

**Escalation triggers:** none.

**Guardrails applied:** #28.

---

### Slice S17 — Performance smoke-test seed script

**Owner:** epic-executor (sonnet) · **Stage 5, parallel-safe with S14/S15/S16**

**Skip this slice if Q9 ≠ (a).**

**Files (only):**
- `tests/perf/seed-board.ts` (create)
- `tests/perf/README.md` (create — documents how to run + what to look for)

**Forbidden scope:** any other file.

**Spec:**

A standalone Node script that:
1. Reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from env (validate via existing `lib/env.ts` if possible).
2. Creates the admin client.
3. Accepts CLI args `--board <uuid> --tasks 5000 --groups 20`.
4. Inserts 20 groups and 5,000 tasks evenly distributed across them (250 per group), with positions `[1, 2, 3, ...]`.
5. Logs a summary at the end.

`tests/perf/README.md` documents:
- How to run: `pnpm tsx tests/perf/seed-board.ts --board <id> --tasks 5000 --groups 20`.
- How to verify: open the board in dev (`pnpm dev`), open Chrome DevTools Performance tab, scroll for 5s, confirm consistent 60fps.
- What to do with the result (paste into the slice done report).

**Definition of done:**
- Script exists; runs without error against a real Supabase project.
- README documents the manual smoke procedure.

**Escalation triggers:**
- If `pnpm tsx` is not available (`tsx` not installed), use `node --loader ts-node/esm` or escalate to add `tsx` as a devDep.

**Guardrails applied:** #28, #16 (service-role usage; this is the second new service-role surface this epic — first is `lib/activity.ts`).

---

### Slice S18 — Keyboard navigation controller (Q4=(a))

**Owner:** epic-executor (sonnet) · **Stage 5, parallel-safe with S15/S16/S17 — but file-conflicts with S8/S10/S11/S12 outputs from earlier stages, so MUST run after Stage 4 review is clean**

**Files (only):**
- `hooks/use-table-keyboard-nav.ts` (create — focus controller hook)
- `components/board/table/BoardTable.tsx` (modify — mount the controller, attach the keydown handler to the scroll container)
- `components/board/table/TaskRow.tsx` (modify — add `data-row-index`, `tabIndex`, `aria-rowindex` attributes; consume `focusedRowId` from the controller)
- `components/board/table/TaskTitleCell.tsx` (modify — accept a `focused: boolean` prop, enter edit mode when `focused && Enter` is pressed; exit on Esc)
- `tests/unit/use-table-keyboard-nav.test.ts` (create — `describe.skip`)

**Forbidden scope:**
- Any other file. Do NOT modify `useBoardStore` (the focused-row state is local to the hook, NOT in the global store — keyboard focus is per-table-instance and resets on remount).
- Do NOT add roving-tabindex to non-row interactive controls (checkboxes, drag handles, overflow menu trigger). Tab still cycles through them naturally inside the focused row.
- Do NOT change the dnd-kit handlers or virtualization config. The hook reads `data-row-index` from rendered rows; it does not know about the virtualizer.

**Spec:**

Per Q4(a), epic 06 ships keyboard navigation across the table:
- **ArrowUp / ArrowDown** — moves focus to the previous/next visible task row (skips collapsed groups). Wraps at top/bottom (configurable; default = no wrap).
- **Enter** on a focused title cell — enters edit mode (calls `EditableTitle`'s imperative `focus()` API from S14).
- **Esc** in edit mode — exits edit, returns focus to the row.
- **Tab** — default browser behavior; cycles through interactive controls in the focused row (checkbox → drag handle → title → overflow menu → next row's checkbox). The hook does NOT intercept Tab.
- **Home / End** — first / last task row in the visible (non-collapsed) set. Optional; ship if cheap.

**Implementation approach (focus controller hook, NOT roving tabindex on rows):**

The hook owns a single `focusedRowId: string | null` state. On ArrowUp/Down, it computes the next id from the rendered task list (passed in as a prop) filtered by visible groups (i.e. `tasks.filter(t => !collapsedGroupIds.has(t.group_id))`). It writes `focusedRowId` to local state, then calls `el.focus()` on the row whose `data-row-index` matches.

Rows render with `tabIndex={focused ? 0 : -1}` so only the focused row is in the natural Tab order; other rows are programmatically focusable but not tabbable. This is the **roving tabindex pattern** but managed by the controller, not by per-row state.

**Virtualization handling (Risk #2 of this slice):** when the focused row scrolls off-screen, TanStack Virtual unmounts it. The hook detects this in a `useLayoutEffect` keyed by `focusedRowId` — if the DOM node is gone, it calls `virtualizer.scrollToIndex(rowIndex, { align: "center" })` (the virtualizer instance is exposed by S10's `<TableVirtualizer />` via context or a forwarded ref). Once the row remounts, the hook re-applies focus. **Sequencing:** S10 must export the virtualizer ref or expose a `scrollToTaskId(taskId)` method on the table's imperative handle. Coordinate with whatever S10 produced.

**Edit mode handoff:**
- The hook tracks `editingRowId: string | null`. On Enter, it sets `editingRowId = focusedRowId` and reads from a `titleCellRefs: Map<string, EditableTitleHandle>` (passed in as a prop) to call `.focus()` on the matching cell.
- The cell's `EditableTitle` `onBlur` or Esc handler clears `editingRowId` via a callback prop.
- While `editingRowId !== null`, ArrowUp/Down do NOT navigate (they are handled by the editor for caret movement).

**Hook API:**

```ts
// hooks/use-table-keyboard-nav.ts
"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export type EditableTitleHandle = { focus: () => void };

export type UseTableKeyboardNavArgs = {
  containerRef: RefObject<HTMLElement>;
  visibleTaskIds: string[];                              // tasks.filter(visible).map(t => t.id) in render order
  titleCellRefs: RefObject<Map<string, EditableTitleHandle>>;
  scrollToTaskId: (taskId: string) => void;              // from S10's table imperative handle
  wrap?: boolean;                                        // default false
};

export type UseTableKeyboardNavReturn = {
  focusedRowId: string | null;
  editingRowId: string | null;
  setFocusedRow: (taskId: string | null) => void;
  beginEdit: (taskId: string) => void;
  endEdit: () => void;
};

export function useTableKeyboardNav(args: UseTableKeyboardNavArgs): UseTableKeyboardNavReturn { /* ... */ }
```

`BoardTable.tsx` mounts the hook once, passes the return value down to rows via context (`TableKeyboardContext`) so cells can read `focused`/`editing` without prop-drilling.

`TaskRow.tsx` reads `focused` from context, sets `tabIndex={focused ? 0 : -1}`, sets `data-row-index={renderIndex}`, sets `aria-rowindex={renderIndex + 1}`. On focus event, calls `setFocusedRow(task.id)` so click-to-focus also updates the controller state.

`TaskTitleCell.tsx` reads `editing` from context. When `editing && task.id === editingRowId`, it renders `EditableTitle` in edit mode and calls `editableTitleRef.focus()` via the imperative API from S14. When the user presses Esc or blurs, it calls `endEdit()`.

**Test cases (`describe.skip`):**
- ArrowDown moves `focusedRowId` to the next visible task
- ArrowUp at top with `wrap=false` is a no-op
- ArrowDown skips tasks in collapsed groups
- Enter sets `editingRowId` to the focused row
- Esc clears `editingRowId`
- Setting `editingRowId` causes ArrowUp/Down to be ignored (focus stays on the row in edit mode)
- `scrollToTaskId` is called when `focusedRowId` is not in `visibleTaskIds` after a state change (simulates virtualizer unmount)

**Definition of done:**
- `hooks/use-table-keyboard-nav.ts` exports `useTableKeyboardNav` with the API above.
- `BoardTable.tsx` mounts the hook and provides `TableKeyboardContext`.
- Manual smoke (document in done report): on a board with 50+ tasks across 5+ groups, ArrowDown from the first row navigates row by row; collapsing a group makes ArrowDown skip its tasks; Enter on a focused row opens the title editor; Esc exits; the focused row scrolls into view if virtualization unmounted it.
- All interactive controls (checkbox, drag handle, overflow menu trigger) remain reachable by Tab inside the focused row.
- `aria-rowindex` set on every rendered task row for screen-reader row-position announcements.
- `pnpm typecheck` and `pnpm lint` clean.

**Escalation triggers:**
- If S10 did NOT expose a `scrollToTaskId` (or equivalent imperative scroll-to-index method) on the table's handle, STOP and escalate. Do NOT reach into the virtualizer's internal API. The fix is a small additive change to S10's already-merged file scope, which the orchestrator will route as a sequenced followup.
- If S14 did NOT ship the imperative `focus()` ref API on `EditableTitle` (Q1=(a) decision), STOP and escalate — this slice depends on it.

**Guardrails applied:** #5 (Base UI primitives — `EditableTitle` is the title primitive, do not bypass it with raw input), #15 (no `as any`), #23 (`"use client"` on the hook), #24 (hooks at top level — no conditional `useEffect`), #25 (no callsite stubs for the in-scope keyboard nav).

---

## 4. Sequencing diagram

```
Stage 1 (parallel-safe, 4 slices, all create new files only):
  S1 deps + positions  ─┐
  S2 group/task Zod    ─┤
  S3 activity logger   ─┤
  S4 board store       ─┘
                         ↓ stage 1 review (epic-researcher)

Stage 2 (parallel-safe, 2 slices, disjoint action files):
  S5 group actions    ─┐
  S6 task actions     ─┘
                         ↓ stage 2 review

Stage 3 (sequential — shared file scope on BoardTable.tsx):
  S7 RSC page + BoardTable shell
   ↓
  S8 GroupSection + TaskRow + TaskTitleCell  (also edits BoardTable.tsx)
   ↓
  S9 AddTaskFooter + AddGroupFooter + EmptyStates  (also edits BoardTable.tsx + GroupSection.tsx)
                         ↓ stage 3 review

Stage 4 (sequential — file-scope conflicts on TaskRow/GroupSection/BoardTable):
  S10 virtualization + sticky chrome
   ↓
  S11 dnd-kit
   ↓
  S12 bulk selection + BulkActionBar
   ↓
  S13 overflow menus + ColorPalette + AddColumnButton
                         ↓ stage 4 review

Stage 5 (mostly parallel; S18 has soft sequencing on S14):
  S14 EditableTitle ref API   ─┬─→ S18 keyboard nav controller (Q4=(a))
  S15 unit tests fill-in       ─┤
  S16 Playwright stub          ─┤
  S17 perf seed script          ─┘
                         ↓ epic-level review → PR
```

**Sequencing notes:**
- S18 (keyboard nav) reads `EditableTitle`'s imperative `focus()` API. **S18 must run after S14 has landed.** S15/S16/S17 can run in parallel with S14 + S18.
- S18 also depends on S10 having exposed a `scrollToTaskId` (or equivalent) imperative method on the table — Stage 4 review must verify this before Stage 5 dispatches; if missing, S10 needs a small additive followup before S18 can proceed.

**Total: 18 slices.** Stages 3 and 4 are dominantly sequential because the table components share files heavily — the alternative (parallel slices over disjoint files like one component per slice) creates a "everyone built their half, nothing wires it together" risk that bit epic 05.

---

## 5. Risk notes

**1. dnd-kit + virtualization interaction.** S10 + S11 are the highest-risk pair. Virtualized rows that scroll off-screen disappear from the DOM, breaking dnd-kit's drop-zone detection. Mitigation: `overscan = 10–20` rows, document a stretch limitation if cross-screen drops are flaky.

**2. Optimistic temp-id collision.** S9's chain-add pattern creates temp tasks. The store's idempotent upsert (replace-by-id) keeps the temp around when the real row arrives. The fix is an `applyTaskUpsertReplaceTemp(tempId, realRow)` action — baked into S4's spec.

**3. Activity logger cross-epic dependency.** Epic 04's risk note 8 says service-role-only writes to `activity` are fine; epic 06 is the first epic to actually write activity rows. If a column-name mismatch surfaces (e.g. `type` vs `action`), the migration is the bug, not the activity logger — escalate, do not paper over with `as any`.

**4. Realtime echoes (epic 08 hand-off).** The store's `apply*` functions are designed to be idempotent by `(id, updated_at)`. Epic 08 will subscribe to Supabase Realtime and call these methods on every payload. Epic 06 must NOT subscribe to Realtime; if a slice tries (because the doc mentions "subscriptions plug in cleanly"), escalate.

**5. Bulk action server-side atomicity.** `bulkDeleteTasks` runs as a single SQL statement. If it partially succeeds (impossible with a single UPDATE under a transaction-by-default Supabase), the optimistic UI is wrong. Mitigation: trust the single-statement model; if it ever returns a partial-success result, escalate.

**6. The `task.board_id` denormalization trigger.** It runs BEFORE INSERT and BEFORE UPDATE OF `group_id`. Slice S6's `moveTask` and `bulkMoveTasksToGroup` MUST set ONLY `group_id` (not `board_id`). Guardrail #20 says this; bake into S6's done report verification.

**7. Group `name` vs `title` schema drift.** The schema column is `name` (epic 02), but the epic-06 doc and component-system §2.2 both say "title." Use `name` everywhere in code; "title" is the user-facing label. Bake into S5 + S8 done report verification.

**8. The "header" sticky offset (`top: 182px` / `149px`).** `component-system.md §2.2` specifies absolute pixel values that depend on the BoardHeader + ViewTabs heights. These may not match the current implementation (epic 05 changed BoardHeader chrome). Use `sticky top-0` inside the table's scroll container and verify the visual stack works. Document any deviation.

**9. Zod 4 / `@hookform/resolvers` typecheck baseline.** Currently 13 errors all in form components. Epic 06's `<AddTaskFooter>` and `<AddGroupFooter>` use plain `<input>` elements (not RHF), so they should NOT add to this baseline. If a slice adds a new TS2769 in this category, that's a regression — flag it.

**10. The `tests/perf/` directory is new.** It will not be picked up by `pnpm test` (Vitest's default glob is `tests/unit/**`); confirm this in S17 to avoid breaking CI later.

**11. Cross-stage file-scope cleanup of `.gitkeep` files.** `components/board/table/.gitkeep`, `components/cells/text/.gitkeep`, etc. Once the table directory has real files, `.gitkeep` is dead. No followup needed — sweep in any later slice that touches the directory.

**12. Keyboard nav + virtualization (S18).** Per Q4=(a), arrow-key row navigation must work even when the focused row is unmounted by the virtualizer. S18 depends on S10 exposing a `scrollToTaskId` (or equivalent) imperative handle; if S10's exposed API is insufficient, S18 stops and the orchestrator routes a small additive followup. Do NOT have S18 reach into TanStack Virtual's internals.

**13. Persisted localStorage shape (S4).** Persisted key is `donezo:board-collapsed:v1`; only `collapsedByBoard: Record<string, string[]>` is serialized. Future schema changes bump the `:v1` suffix and a one-time migration drops stale `:v0` keys. If S4's executor is tempted to also persist `selection` or `editingTaskId`, STOP — those are session-scoped on purpose.

**14. EditableTitle imperative API (S14 → S18).** S18 reads the imperative `focus()` ref from S14's updated `EditableTitle`. If S14 ships a different API surface (e.g. `editorRef.current.beginEdit()` instead of `.focus()`), S18 must adapt — but the ref API contract should match exactly what's listed in S14's DoD: `{ focus: () => void }`. Coordinate via the slice spec, not via guesswork.

**Reference paths (for executors):**
- `docs/conversion-plan/06-groups-tasks-table.md`
- `docs/conversion-plan/component-system.md` (§2.1, §2.2, §2.3, §3.3, §3.9)
- `docs/conversion-plan/design-system.md`
- `supabase/migrations/20260506224930_initial_schema.sql` (group/task/cell/activity table shapes + triggers + Realtime publication)
- `supabase/migrations/20260507120100_rls_policies.sql` (group/task/cell policies; activity is select-only)
- `lib/supabase/types.ts` (includes `group`, `task`, `cell`, `activity`, `column` rows; `clone_board`, `restore_board`, `user_starred_board`)
- `lib/actions/with-user.ts` (action wrapper contract)
- `lib/authorization/board.ts` (`requireBoardRole`)
- `lib/board-context.tsx` + `hooks/use-board.ts`
- `components/shared/EditableTitle.tsx` (S14 modifies; S18 reads its imperative ref)
- `components/board/BoardHeader.tsx` + `BoardViewTabs.tsx` (epic 05 chrome that wraps the table)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx` (the placeholder S7 replaces)
- `app/globals.css` (all required tokens — group accents, motion, sizes, z-layers — present)
- `components/ui/menu-list.tsx` (the `<MenuList />` recipe S13 must use)
- `package.json` (deps to add in S1)