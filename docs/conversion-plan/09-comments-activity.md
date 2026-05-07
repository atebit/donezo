# Epic 09 — Comments, Activity Log, and Mentions

## Goal

Each task gets a discussion thread (rich-text comments with @mentions and threaded replies) and a per-task and per-board activity feed. Mentions surface as in-app notifications and emails ([13](13-notifications.md)). The activity log records every meaningful change with structured payloads that can be rendered back into human-readable diffs using the cell type registry from [07](07-column-system.md).

## Why this is its own epic

Comments and activity share a sidebar surface, share Realtime infrastructure, share rendering primitives, and share the @mention parsing/pipeline. Building them together avoids three half-built feeds. Notifications are split out because they have a substantial fan-out / digest / preferences surface of their own.

## In scope

- Task drawer / detail view: tabs for "Updates" (comments), "Activity," and "Files" ([10](10-attachments.md)).
- Threaded comments with Tiptap rich-text editor, @mentions, emoji reactions.
- Comment edit / delete (own only; admins can delete others'), with "edited" timestamp.
- @Mention pipeline: parse mentions on save, write `notification` rows, send email ([13](13-notifications.md)).
- Activity feed:
  - Per-task feed in the task drawer.
  - Per-board feed accessed from the board topbar.
  - Filterable by actor, action type, date range.
- Activity event renderers per `action` type (uses [07](07-column-system.md) cell registry to render before/after).
- Pagination of activity (cursor-based on `created_at` desc).
- Comment Realtime via the channel from [08](08-realtime-presence.md).
- Server actions: `createComment`, `editComment`, `deleteComment`, `reactComment`.

## Out of scope

- Email delivery (the `notification` write happens here; the email send is in [13](13-notifications.md)).
- Activity export (CSV/JSON dumps) — defer.
- Activity retention policy (TTL) — operational concern in [15](15-observability-testing-cicd.md).
- Long-text cell rich editing — same Tiptap setup, but lives in [07](07-column-system.md).

## Dependencies

[02](02-supabase-schema.md), [04](04-authorization-rls.md), [06](06-groups-tasks-table.md), [07](07-column-system.md), [08](08-realtime-presence.md).

## Architecture & design choices

### Task detail drawer vs route

Two options:

1. **Modal/drawer over the table**, route-driven (`/.../t/<taskId>`).
2. **Full page**.

Drawer is better for "context next to the row" UX — the legacy app and monday both do this. We keep the route so links work.

`app/(app)/w/[slug]/b/[boardId]/t/[taskId]/page.tsx` renders into a `@modal` slot or via parallel routes. Implementation: Next.js intercepting routes (`(.)t/[taskId]`) so navigating from the table opens the drawer in place; refreshing the URL hits the same route directly and shows a full-page version.

The drawer has three tabs:
- **Updates** (default): comments thread.
- **Activity**: chronological diff log.
- **Files**: attachments ([10](10-attachments.md)).

### Tiptap

`@tiptap/react` + `@tiptap/pm` + extensions:

- StarterKit (paragraph, bold, italic, code, lists, etc.).
- Mention (custom config — see below).
- Link (with rel="noopener noreferrer" and href validation).
- Placeholder.
- Typography (smart quotes, em-dashes).
- TaskList + TaskItem.
- Image (paste/drag image → uploads via [10](10-attachments.md) attachments endpoint, inserts `<img>` with the resulting URL).
- Code block (lowlight for syntax highlighting).
- A custom `<Reaction>` decoration (UI only, not part of the document).

The editor saves both the JSON (`comment.body`) and a derived plain-text (`comment.body_text`) for search, mention extraction, and notification email rendering.

### Mention extension

Custom Tiptap Mention configured to:

- Trigger on `@`.
- Suggest workspace members via a Popover + Command list (debounced search by name/email).
- Insert a `mention` node with `attrs: { id: userId, label: fullName }` rendered as a chip.

On save, we walk the document, collect mention `id`s, and dedupe. Each becomes a `notification` row of kind `mention`. Skip self-mentions (don't notify yourself).

```ts
// lib/comments/mentions.ts
export function extractMentions(doc: TiptapDoc): string[] {
  const ids = new Set<string>();
  function walk(node: any) {
    if (node.type === "mention" && node.attrs?.id) ids.add(node.attrs.id);
    node.content?.forEach(walk);
  }
  walk(doc);
  return [...ids];
}
```

### Comment storage

`comment` table (already in [02](02-supabase-schema.md)). Fields:

- `body jsonb` — Tiptap doc.
- `body_text text` — plain text from `editor.getText()`.
- `parent_id uuid` — for threaded replies (one level of nesting; UI flattens deeper replies to the parent).

Editing a comment writes the new body and sets `updated_at`. The UI shows "edited" if `updated_at > created_at + 5 seconds` (small grace window).

### Reactions

Lightweight: a `comment_reaction` table.

```sql
create table public.comment_reaction (
  comment_id uuid not null references public.comment(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);

alter publication supabase_realtime add table public.comment_reaction;
alter table public.comment_reaction enable row level security;

create policy "comment_reaction_select" on public.comment_reaction for select using (
  exists (
    select 1 from public.comment c
    join public.task t on t.id = c.task_id
    where c.id = comment_reaction.comment_id
      and role_for_board(t.board_id, auth.uid()) is not null
  )
);
create policy "comment_reaction_modify" on public.comment_reaction for all using (
  user_id = auth.uid()
);
```

UI: emoji-picker popover from a "react" button on each comment; aggregated count + active-self indicator below the comment.

### Comments Realtime

Subscribed via the channel from [08](08-realtime-presence.md) (`comment` table changes filtered by `board_id`). Reactions: same channel, additional table subscription.

### Comment ordering

Top-level comments oldest-first (chronological reading). Replies oldest-first beneath the parent. Pagination: load 50 most recent, with "Load earlier" button for older.

### Activity log architecture

The `activity` table is written **only** from server actions (no DB triggers). Every mutation writes a row via the activity logger from [06](06-groups-tasks-table.md). The set of action ids is closed and documented:

```
board.created, board.renamed, board.archived, board.restored, board.deleted,
  board.privacy_changed, board.duplicated
group.created, group.renamed, group.recolored, group.reordered, group.duplicated,
  group.deleted
column.created, column.renamed, column.reordered, column.duplicated, column.deleted,
  column.type_changed, column.config_changed
label.created, label.renamed, label.recolored, label.deleted
task.created, task.renamed, task.duplicated, task.moved, task.deleted, task.restored
task.cell_changed
comment.posted, comment.edited, comment.deleted, comment.reacted
attachment.uploaded, attachment.deleted
member.added, member.removed, member.role_changed
```

Each carries a structured `payload jsonb`:

```json
{
  "from": { "title": "Old title" },
  "to":   { "title": "New title" }
}
```

For `task.cell_changed`:

```json
{
  "columnId": "...",
  "columnType": "status",
  "from": { "labelId": "..." },
  "to":   { "labelId": "..." }
}
```

### Activity renderer registry

A renderer per action id, in `components/activity/renderers/`:

```ts
export type ActivityRenderer = (event: ActivityRow, ctx: ActivityRenderCtx) => ReactNode;

const renderers: Record<string, ActivityRenderer> = {
  "task.cell_changed": (event, ctx) => {
    const col = ctx.columns.get(event.column_id);
    if (!col) return null;
    const def = cellRegistry[col.type];
    return (
      <ActivityLine actor={event.actor}>
        changed {col.title}
        from <CellInline def={def} value={event.payload.from} />
        to <CellInline def={def} value={event.payload.to} />
      </ActivityLine>
    );
  },
  // ...
};
```

`<CellInline />` is a tiny wrapper that calls the cell type's renderer with a compact-mode flag. The activity feed thus stays consistent with the table rendering — labels show the same color, dates the same format.

Missing renderers fall back to a generic line: "[actor] performed [action]" with the payload in a debug expandable.

### Activity feeds

Two feeds:

- **Per-task** in the task drawer's Activity tab. Filters: only events with `task_id = currentTask`. Limit: 100 most recent, with "Load earlier."
- **Per-board** accessible via the board topbar (icon button). Filters: actor (workspace members), action types (groups: structural / content / comments / files / members), date range. Limit: 50 per page; cursor-based pagination on `created_at desc`.

Both feeds are server-rendered with infinite scroll powered by `useInfiniteQuery` ([TanStack Query](https://tanstack.com/query) — light dependency, used only here for pagination state).

### Mention notifications

Mentions must reach the user even if they're offline. Pipeline:

1. `createComment` server action saves the comment.
2. Extracts mentions via `extractMentions(body)`.
3. For each mentioned user (excluding the author):
   - Verify they have access to the board (`role_for_board != null`). Skip if not.
   - Insert a `notification` row of kind `mention` with payload `{ board_id, task_id, comment_id, actor_id }`.
4. [13](13-notifications.md) listens for new `mention` notifications via Realtime and triggers an email if user preferences allow.

Inserting `notification` requires the service-role client (RLS denies cross-user inserts). Wrap in a helper:

```ts
// lib/notifications/notify.ts
import { admin } from "@/lib/supabase/admin";
export async function notifyUsers(rows: NotificationInsert[]) {
  if (!rows.length) return;
  await admin.from("notification").insert(rows);
}
```

### Activity for notifications

Some non-mention actions also produce notifications: assignment (person column → user added), status change on a task you follow, comment reply, due date soon. The activity logger does not write notifications by itself — that's a separate side effect handled in the server action that produced the activity.

The cleanest pattern: every server action emits `(activity, [notifications])` together; both go through dedicated helpers.

### Edit & delete behaviors

- **Edit**: only the author. RLS enforces it. UI shows the editor inline with Save/Cancel.
- **Delete**: author or board admin+. Soft-deletes the comment (`deleted_at`). The UI shows "[deleted]" placeholder so threads keep their structure. After 30 days, a scheduled function hard-deletes ([15](15-observability-testing-cicd.md)).
- Reactions don't have edit/delete — clicking a reaction toggles it; one row per (user, comment, emoji).

### URL-linkable comments

Each comment has an id; the task drawer URL accepts `?comment=<id>` to scroll-to and highlight. Useful for email links from notifications.

## Visual fidelity requirements

This epic ships the right-side **task drawer** (the third "monday-feel" surface after the sidebar and the table), the comment thread, and the activity feed. Specs in [`component-system.md`](component-system.md), tokens in [`design-system.md`](design-system.md).

Must-match:

- **`<TaskDrawer />`** — fixed right-side drawer, `min-width: 570px` desktop / 100vw mobile. Slide-in `transform: translateX(100% → 0)` over `--motion-drawer` (`.6s`); drawer shadow `--shadow-drawer`. Header at 53px tall, font 18px. Tab strip with `1px solid --color-border` bottom and active tab indicated by `2px solid --color-primary` underline. Content scrolls 85vh with hidden scrollbar. See [§3.5](component-system.md#35-taskdrawer-right-slide-modal).
- **Update editor card** — outline `1px solid --color-primary`, radius 4px, height 145px. Save button bg `--color-primary`, white text, height 32px, radius 4px. See [_board-modal.scss:84-129](../../frontend/src/assets/styles/cmps/modal/_board-modal.scss).
- **`<CommentItem />`** — `1px solid --color-border-strong` border, radius 4px, padding 16px, margin-bottom 16px. Header avatar 26px, name 16px in `--color-fg`, timestamp/menu glyph row in `--color-fg-muted`. Body padding `0 16px 16px`. See [§4.1](component-system.md#41-commentlist--commentitem).
- **`<ActivityItem />`** — 60px row, padding `8px 0`, `1px` bottom border `--color-shadow-card`, font 16px (mobile 12px). Activity labels render with the cell's status-color bg + white text + 4px radius (matching the status pill chrome). See [§4.2](component-system.md#42-activitylist--activityitem).
- **Inline editable description** for board description — uses the [§2.1 blockquote pattern](component-system.md#21-inline-editable-title-blockquote-pattern).
- **Mention chips** in the editor — should follow the chip pattern: bg `--color-chip-member` (`#e5f4ff`), radius 8px, gap 8px.

Activity payload renderers consume the cell registry from [07](07-column-system.md), so status/priority changes render with the same colored pill as the cell — this is part of the visual contract, not just a code-reuse choice.

## Tasks

1. **Add `comment_reaction` table** in a migration. RLS + publication.
2. **Set up Tiptap** with the extension list above. Custom Mention extension.
3. **Build `<CommentEditor />`** (Tiptap wrapper) with mention popover + emoji + image paste hook (image upload defers to [10](10-attachments.md)).
4. **Build `<CommentList />`** with threaded rendering (one level of replies).
5. **Build `<CommentItem />`** with edit, delete, react, reply actions.
6. **Build `<CommentReactions />`** with grouped emoji + counts.
7. **Server actions**: `createComment`, `editComment`, `deleteComment`, `reactComment`, `unreactComment`.
8. **Mention pipeline**: extract → notify on `createComment`.
9. **Realtime wiring**: subscribe to `comment` and `comment_reaction` changes via the existing board channel; idempotent applies in store.
10. **Build the task drawer shell** with three tabs (Updates / Activity / Files).
11. **Activity feed components**: `<ActivityList />`, `<ActivityItem />`, renderer registry.
12. **Implement renderers** for every `action` id. Reuse `cellRegistry` from [07](07-column-system.md) for `task.cell_changed`.
13. **Per-task Activity tab** loads activity filtered by `task_id`.
14. **Per-board Activity modal** with filters (actor, action group, date range) and infinite scroll.
15. **URL-linkable comments**: scroll-to and highlight on `?comment=<id>`.
16. **Tests**:
    - Unit: mention extraction; activity payload renderers.
    - Integration: create comment with mention → notification row exists for mentioned user.
    - Integration: two clients, one posts a comment → other sees it via Realtime.
    - E2E: open task → post comment → react → edit → delete → activity log shows all four actions.

## Definition of done

- A user can open a task, post a rich-text comment, mention a teammate, react with an emoji.
- The mentioned user gets an in-app notification immediately (email send is [13](13-notifications.md)).
- Two browsers see comment posts in real time.
- Editing a comment shows "edited"; deleting leaves a "[deleted]" placeholder in-thread.
- The Activity tab on a task shows every cell change with proper rendering for status pills, dates, etc.
- The board-level activity modal supports filter by actor/action/date and paginates.
- Activity payloads are structured; missing renderers degrade gracefully.

## Open questions

- **Comment depth**: one-level replies (current plan) vs full nesting. One level matches Slack threads; full nesting matches GitHub. Recommend one level.
- **Markdown vs Tiptap-only.** Tiptap can also parse markdown on paste. Skip explicit Markdown mode for v1.
- **Activity retention**: keep forever vs 90/180/365 days. Internal tool: keep forever. Add a partition by month if growth becomes a concern.
- **Activity for column hides per user.** Per-user UI state (column visibility) shouldn't appear in shared activity. Do not log it.
- **Reaction picker library**: `emoji-picker-react` is heavy. `frimousse` is lighter. Pick one.
- **Mentioning the entire board / @everyone.** Useful but spammy. Skip for v1.
- **Notification on assignment**: when a user is added to a person column, notify them. Implement here as part of the "every action emits notifications" pattern, since the assignment server action lives in [07](07-column-system.md). Worth specifying clearly in [13](13-notifications.md).
