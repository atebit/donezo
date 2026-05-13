# Epic 14 — Empty-State Inventory

Produced by Slice C. This is the handoff document for downstream slices (D / E / F / G / H) that need to wire `<EmptyState />` into consumer pages/components.

The canonical `<EmptyState />` primitive lives at `components/shared/empty-states/EmptyState.tsx` and is exported from `components/shared/empty-states/index.ts`.

---

## 1. Trash (workspace trash view)

| Field | Value |
|---|---|
| **Consumer file** | `app/(app)/w/[workspaceSlug]/trash/page.tsx` |
| **Current state** | Already renders `<TrashEmpty />` when `archivedBoards.length === 0` (line 74). `TrashEmpty` has been **refactored in Slice C** to compose `<EmptyState />`. |
| **Status** | Done — no downstream work needed. |
| **Recommended props** | `icon={IconArchive}` / `title="Trash is empty"` / `description="Deleted boards will appear here. You can restore or permanently delete them."` |

---

## 2. No boards in a workspace

| Field | Value |
|---|---|
| **Consumer file** | `components/shared/board-card/BoardCardGrid.tsx` |
| **Current state** | Already renders `<NoBoardsInWorkspace />` when `allBoards.length === 0` (line 20). `NoBoardsInWorkspace` has been **refactored in Slice C** to compose `<EmptyState />`. |
| **Status** | Done — no downstream work needed. |
| **Recommended props** | `icon={IconLayout}` / `title="{workspaceName} is ready for its first board"` / `description="or pick a template — coming soon"` / `action={<button>Create board</button>}` |

---

## 3. No tasks in a group

| Field | Value |
|---|---|
| **Consumer file** | `components/board/table/EmptyStates.tsx` (exports `NoTasksInGroupHint`) |
| **Current state** | `NoTasksInGroupHint` is a minimal inline hint ("No tasks yet — add one below.") rendered as a `<div>` at 14px. Does **not** use `<EmptyState />`. The hint is intentionally compact (inline in a table row, not a full-page empty state). |
| **Status** | **Out of Slice C scope** (file is in `components/board/table/` — forbidden scope for this slice). |
| **Recommended action** | A downstream slice should either leave this as-is (the hint is intentionally compact) OR replace it with a small variant of `<EmptyState />` without an icon (just text + optional action). The full `<EmptyState />` is oversized for an inline table row hint. Consider adding a `size="compact"` variant in a later slice if needed. |
| **Recommended full-page props (if promoted)** | `icon={IconLayoutList}` / `title="No tasks yet"` / `description="Add the first task to this group to get started."` |

---

## 4. Favorites empty

| Field | Value |
|---|---|
| **Consumer file** | `components/shared/sidebar/BoardList.tsx` (line 89) |
| **Current state** | Already renders `<FavoritesEmpty />`. `FavoritesEmpty` has been **refactored in Slice C** to compose `<EmptyState />`. |
| **Status** | Done — no downstream work needed. |
| **Recommended props** | `icon={IconStar}` / `title="Easily Access Your Favorite Boards"` / `description="Star a board to pin it here for quick access."` |

---

## 5. Notification center empty

| Field | Value |
|---|---|
| **Consumer file** | `components/notifications/NotificationList.tsx` (lines 48–54) |
| **Current state** | Hardcoded inline: a `<div>` with `<p className="text-sm ...">No notifications</p>`. Does **not** use `<EmptyState />`. |
| **Status** | Needs downstream update (a later polish slice or follow-up). |
| **Recommended props** | `icon={IconBellOff}` / `title="No notifications yet"` / `description="When teammates @mention you or assign you a task, you'll see it here."` |
| **File to edit** | `components/notifications/NotificationList.tsx` — replace the inline empty `<div>` block with `<EmptyState ... />`. |

---

## 6. Search no-results

| Field | Value |
|---|---|
| **Consumer file** | `components/shared/topbar/GlobalSearchPalette.tsx` (lines 285–288) |
| **Current state** | Hardcoded inline: `<p className="px-3 py-4 text-sm ...">No results for "{query}"</p>` and `<p>Type to search boards and tasks</p>`. Does **not** use `<EmptyState />`. |
| **Status** | Needs downstream update. The search palette is a compact modal; a full `<EmptyState />` (icon + title + description) may be too large. A smaller variant or a scoped inline application is appropriate. |
| **Recommended approach** | Apply `<EmptyState />` with `className="py-4"` to keep it compact inside the modal viewport, or inline the `icon` manually at `size={24}` for the constrained layout. |
| **Recommended props (no-results)** | `icon={IconSearch}` / `title='No results for "{query}"'` / (no description — keep it brief) |
| **Recommended props (hint state)** | `icon={IconSearch}` / `title="Type to search"` / `description="Search boards and tasks across your workspace."` |

---

## 7. Board with no groups

| Field | Value |
|---|---|
| **Consumer file** | `components/board/table/BoardTable.tsx` (line 793) — renders `<NoGroupsEmptyState onAddGroup={...} />` |
| **Current state** | `NoGroupsEmptyState` in `components/board/table/EmptyStates.tsx` is an inline component with a bordered card + text + `<Button>Add group</Button>`. Does **not** use `<EmptyState />`. |
| **Status** | **Out of Slice C scope** (file is in `components/board/table/` — forbidden scope for this slice). |
| **Recommended action** | A downstream slice (one that owns board table internals) should replace `NoGroupsEmptyState` with `<EmptyState />`. |
| **Recommended props** | `icon={IconLayers}` / `title="No groups yet"` / `description="Add your first group to start organizing tasks."` / `action={<Button onClick={onAddGroup}>Add group</Button>}` |

---

## Summary table

| Surface | Consumer | Current state | Action needed |
|---|---|---|---|
| Trash | `app/(app)/w/[workspaceSlug]/trash/page.tsx` | Uses `<TrashEmpty />` (now composes EmptyState) | Done |
| No boards in workspace | `components/shared/board-card/BoardCardGrid.tsx` | Uses `<NoBoardsInWorkspace />` (now composes EmptyState) | Done |
| No tasks in group | `components/board/table/EmptyStates.tsx` | Inline compact hint | Downstream (forbidden scope in Slice C) |
| Favorites empty | `components/shared/sidebar/BoardList.tsx` | Uses `<FavoritesEmpty />` (now composes EmptyState) | Done |
| Notification center empty | `components/notifications/NotificationList.tsx` | Hardcoded inline `<p>` | Needs downstream update |
| Search no-results | `components/shared/topbar/GlobalSearchPalette.tsx` | Hardcoded inline `<p>` | Needs downstream update |
| Board with no groups | `components/board/table/BoardTable.tsx` | Uses `<NoGroupsEmptyState />` (not yet composing EmptyState) | Downstream (forbidden scope in Slice C) |
