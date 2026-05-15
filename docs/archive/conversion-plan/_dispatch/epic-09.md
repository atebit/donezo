# Epic 09 — Comments, Activity Log, and Mentions — Dispatch Plan

**Status:** approved 2026-05-11
**Branch:** `epic/09-comments-activity` off `main`; sub-branches per slice as noted.

## Decisions (locked at planning time)

| Q | Decision |
|---|----------|
| 1. Threading | **No `parent_id`.** Replies are quote-reply only — Tiptap blockquote inserted into the composer body. No DB threading column, no `selectRepliesTo` selector. |
| 2. Soft delete | **Hard delete only.** No `comment.deleted_at`, no `[deleted]` placeholder UI, no soft-delete RLS work. `deleteComment` issues a real DELETE. |
| 3. Pagination state | **Local `useState` + cursor + `useTransition`.** Do NOT add `@tanstack/react-query`. |
| 4. Emoji picker | **`frimousse`.** Lighter than `emoji-picker-react`, supports React 19. |
| 5. Drawer route | **Intercepting routes** (`@modal/(.)t/[taskId]`). Full-page route at `t/[taskId]/page.tsx` mirrors the same `<TaskDrawer />`. Browser back / Esc / outside-click → `router.back()`. |
| 6. Per-board activity | **Ship both** per-task tab and per-board modal. |
| 7. @everyone | **Implement.** Mention popover surfaces an "Everyone on this board" entry pinned above member rows. Inserted as a mention node with sentinel `attrs.id = "everyone"`, `attrs.label = "everyone"`. `extractMentions` returns `{ userIds: string[]; everyone: boolean }`. Fan-out at notify time expands `everyone` to all board members except the actor. |
| 8. Long-text Tiptap reuse | **Build the editor for reuse**, do not retrofit `long_text` cell in this epic. The shared primitive is `<RichTextEditor />`; `<CommentEditor />` is a thin comment-specific wrapper. Long-text cell retrofit deferred to Epic 11/14. |

## Stack reminders (CLAUDE.md, do not drift)

- pnpm only; no npm/yarn.
- Next.js 15 App Router, RSC-first. `"use client"` only when needed.
- Server Actions for mutations. No `/api` route handlers.
- TypeScript strict. Regen Supabase types via `pnpm db:types`.
- Tailwind v4 + shadcn/ui + Base UI primitives.
- Forms: React Hook Form + Zod (Zod v4).
- DnD: dnd-kit. Tables: TanStack Table + Virtual. Rich text: Tiptap (this epic introduces it).
- Realtime: Supabase Realtime via `useBoardRealtime`.
- RLS is the source of truth for auth.
- All ids `uuid v4` from `gen_random_uuid()`. All times `timestamptz`. Activity column is `type` (NOT `action`) — preserved from Epic 02; never "fix" back to `action`.

---

## Stage 1 — five parallel slices

Slice A is the only pre-req for the others. B/C/D/E parallel-safe after A merges. F (Stage 2) waits on all of A–E.

---

### Slice A — Schema, types, server actions, activity vocab, notification helper

**Branch:** `epic/09-comments-activity/a-schema-and-actions`

**Owns (write):**
- `supabase/migrations/<TIMESTAMP>_comment_reactions_and_activity_publication.sql` (new; timestamp > `20260512100000`; suggested `20260513000000`)
- `supabase/migrations/<TIMESTAMP+1>_comment_reaction_rls.sql` (new; suggested `20260513000001`)
- `lib/supabase/types.ts` (regenerate via `pnpm db:reset && pnpm db:types`)
- `lib/validations/comment.ts` (new — Zod schemas)
- `lib/activity.ts` (extend `ActivityType` union only)
- `lib/comments/types.ts` (new — `TiptapDoc`, `TiptapNode`, `MentionAttrs`)
- `lib/comments/mentions.ts` (new — `extractMentions`)
- `lib/notifications/notify.ts` (new — `notifyUsers`)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions.ts` (new)
- `tests/unit/extract-mentions.test.ts` (new)
- `tests/unit/comment-actions.test.ts` (new)
- `tests/policies/comment_reaction_rls.spec.sql` (new — pgTAP)

**Reads (no write):**
- `supabase/migrations/20260506224930_initial_schema.sql` (reference for table style; `set_updated_at` trigger)
- `supabase/migrations/20260507120100_rls_policies.sql` (existing comment policies — do NOT modify)
- `lib/activity.ts` (existing union)
- `lib/supabase/admin.ts` (`adminClient()`)
- `lib/actions/with-user.ts`
- `lib/authorization/board.ts`
- `app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts` (server-action shape reference)

**Forbidden:** Any UI file. Any unrelated migration. No edits to RLS for `task`, `cell`, `column`, `group`, `comment`. No edits to existing `comment` RLS — Q1/Q2 = no schema changes to `comment`.

**Depends on:** none.

**Spec:**

#### A.1 — Migration 1: `comment_reaction` table + activity publication

In `supabase/migrations/20260513000000_comment_reactions_and_activity_publication.sql`.

```sql
-- comment_reaction: one row per (comment, user, emoji); reactions are immutable
-- (toggle = insert/delete). board_id is denormalized for realtime board-scoped filters.
create table public.comment_reaction (
  comment_id uuid not null references public.comment(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  board_id uuid not null references public.board(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);

create index comment_reaction_comment_idx on public.comment_reaction(comment_id);
create index comment_reaction_board_idx on public.comment_reaction(board_id);

-- Defense-in-depth: board_id always matches the parent comment's board_id.
-- Mirrors the cell_board_id_consistency trigger from Epic 08.
create or replace function public.comment_reaction_board_id_consistency()
returns trigger language plpgsql as $$
begin
  new.board_id = (select c.board_id from public.comment c where c.id = new.comment_id);
  return new;
end $$;

create trigger comment_reaction_board_id_consistency
  before insert or update of comment_id on public.comment_reaction
  for each row execute function public.comment_reaction_board_id_consistency();

alter table public.comment_reaction enable row level security;

-- Realtime: publish reactions for board-scoped postgres_changes.
alter publication supabase_realtime add table public.comment_reaction;

-- Activity was NOT added to supabase_realtime in epic 02. Per-task Activity tab
-- needs live updates. Slice C subscribes to this; without the publication entry,
-- subscriptions are silent.
alter publication supabase_realtime add table public.activity;
```

**No changes to `public.comment`** (Q1+Q2 decided no `parent_id`, no `deleted_at`).

#### A.2 — Migration 2: RLS for `comment_reaction`

In `supabase/migrations/20260513000001_comment_reaction_rls.sql`:

```sql
-- SELECT: any board role can see reactions on comments in that board.
create policy "comment_reaction_select" on public.comment_reaction
  for select using (
    public.role_for_board(comment_reaction.board_id, (select auth.uid())) is not null
  );

-- INSERT: user can insert only their own reaction; must be board member or higher.
create policy "comment_reaction_insert" on public.comment_reaction
  for insert with check (
    comment_reaction.user_id = (select auth.uid())
    and public.role_rank(public.role_for_board(comment_reaction.board_id, (select auth.uid())))
        >= public.role_rank('member')
  );

-- DELETE: user can delete only their own reaction.
create policy "comment_reaction_delete" on public.comment_reaction
  for delete using (
    comment_reaction.user_id = (select auth.uid())
  );

-- No UPDATE policy — reactions are immutable. Toggle = insert/delete.
```

#### A.3 — Type regen

Run `pnpm db:reset && pnpm db:types`. Commit the regenerated `lib/supabase/types.ts`. Verify `comment_reaction` table types are present and `activity` is still in the schema.

#### A.4 — Activity vocabulary expansion

Edit `lib/activity.ts`. Append to the `ActivityType` union (do NOT change the function body, imports, or `LogActivityArgs`):

```ts
| "comment.posted"
| "comment.edited"
| "comment.deleted"
| "comment.reacted"
| "comment.unreacted"
```

Document payload shapes as a JSDoc block above the union:

- `comment.posted`: `{ commentId: string; bodyTextPreview: string }` — first 140 chars of plain text.
- `comment.edited`: `{ commentId: string }`
- `comment.deleted`: `{ commentId: string }`
- `comment.reacted`: `{ commentId: string; emoji: string }`
- `comment.unreacted`: `{ commentId: string; emoji: string }`

#### A.5 — Mention types + extraction

Create `lib/comments/types.ts`:

```ts
// Tiptap doc shape — JSON-serializable subset we persist in comment.body.
// The full schema lives in @tiptap/pm; this is the narrow contract.
export type TiptapDoc = {
  type: "doc";
  content?: TiptapNode[];
};

export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

// Mention node attrs.
// id is either a user UUID, or the sentinel "everyone" for board-wide mentions.
export type MentionAttrs = {
  id: string;
  label: string;
};

export const EVERYONE_MENTION_ID = "everyone" as const;
```

Create `lib/comments/mentions.ts`:

```ts
import type { TiptapDoc, TiptapNode } from "./types";
import { EVERYONE_MENTION_ID } from "./types";

export type ExtractedMentions = {
  /** Specific user UUIDs (deduped, sentinel "everyone" stripped out). */
  userIds: string[];
  /** True if the doc contains at least one @everyone mention. */
  everyone: boolean;
};

/**
 * Walks a Tiptap doc and pulls out mentioned users + whether @everyone was used.
 * Returns `{ userIds: [], everyone: false }` for malformed or null input.
 */
export function extractMentions(doc: TiptapDoc | null | undefined): ExtractedMentions {
  const userIds = new Set<string>();
  let everyone = false;
  if (!doc || doc.type !== "doc") return { userIds: [], everyone: false };

  function walk(node: TiptapNode | undefined) {
    if (!node) return;
    if (node.type === "mention" && typeof node.attrs?.id === "string") {
      const id = node.attrs.id;
      if (id === EVERYONE_MENTION_ID) everyone = true;
      else userIds.add(id);
    }
    node.content?.forEach(walk);
  }
  doc.content?.forEach(walk);
  return { userIds: [...userIds], everyone };
}
```

Unit tests in `tests/unit/extract-mentions.test.ts`:
- Empty doc → `{ userIds: [], everyone: false }`.
- Doc with one user mention → `{ userIds: [id], everyone: false }`.
- Doc with `@everyone` only → `{ userIds: [], everyone: true }`.
- Doc with `@everyone` and two user mentions → both flagged.
- Nested mentions inside lists/blockquotes (quote-reply scenario) → collected.
- Duplicate user ids deduped.
- Malformed nodes (no attrs, wrong type) ignored — no throw.
- `null` / `undefined` / wrong-shape input → empty result.

#### A.6 — Notification helper

Create `lib/notifications/notify.ts`:

```ts
import { logger } from "@/lib/logger";
// biome-ignore lint/style/noRestrictedImports: server-only notification fan-out.
import { adminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

export type NotificationInsert = Database["public"]["Tables"]["notification"]["Insert"];

/**
 * Best-effort insert of notification rows. Never throws. Logs warnings on error.
 * Service-role bypasses the per-user notification_select RLS; insert is system-only
 * because the notification table has no INSERT policy.
 */
export async function notifyUsers(rows: NotificationInsert[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    const { error } = await adminClient()
      .from("notification")
      .insert(rows.map((r) => ({ ...r, payload: r.payload as Json })));
    if (error) logger.warn({ err: error, count: rows.length }, "notifyUsers: insert failed");
  } catch (err) {
    logger.warn({ err, count: rows.length }, "notifyUsers: unexpected error");
  }
}
```

#### A.7 — Zod schemas

Create `lib/validations/comment.ts`:

```ts
import { z } from "zod";

const TiptapNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.unknown()).optional(),
    content: z.array(TiptapNodeSchema).optional(),
    marks: z.array(z.object({ type: z.string(), attrs: z.record(z.unknown()).optional() })).optional(),
    text: z.string().optional(),
  }),
);

export const TiptapDocSchema = z.object({
  type: z.literal("doc"),
  content: z.array(TiptapNodeSchema).optional(),
});

export const CreateCommentSchema = z.object({
  taskId: z.string().uuid(),
  body: TiptapDocSchema,
  bodyText: z.string().max(20_000),
});

export const EditCommentSchema = z.object({
  commentId: z.string().uuid(),
  body: TiptapDocSchema,
  bodyText: z.string().max(20_000),
});

export const DeleteCommentSchema = z.object({
  commentId: z.string().uuid(),
});

export const ReactCommentSchema = z.object({
  commentId: z.string().uuid(),
  emoji: z.string().min(1).max(32),
});

export const UnreactCommentSchema = ReactCommentSchema;

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
export type EditCommentInput = z.infer<typeof EditCommentSchema>;
export type DeleteCommentInput = z.infer<typeof DeleteCommentSchema>;
export type ReactCommentInput = z.infer<typeof ReactCommentSchema>;
export type UnreactCommentInput = z.infer<typeof UnreactCommentSchema>;
```

#### A.8 — Server actions

Create `app/(app)/w/[workspaceSlug]/b/[boardId]/comments/actions.ts`. All actions use `withUser`. Writes go through the user-client (RLS-enforced). Activity + notifications are best-effort.

**`createComment`** (full):
1. Parse input via `CreateCommentSchema`.
2. Load `task` to get `board_id`; verify task exists + not deleted (`deleted_at is null`).
3. `requireBoardRole(boardId, "member")`.
4. Insert into `comment` via user-client with `task_id`, `board_id` (explicit per Epic 08 denorm), `author_id = userId`, `body` (cast `as unknown as never` like `setCellValue`), `body_text`.
5. Mention fan-out (best-effort):
   - `extractMentions(input.body)` → `{ userIds, everyone }`.
   - If `everyone`: query `board_member` where `board_id = task.board_id` to get all member user_ids; union into `userIds`.
   - Filter out `userId` (no self-notify).
   - For each remaining target, verify board access via `supabase.rpc("role_for_board", { p_board_id, p_user_id })` ≠ null. Skip non-members. (For `@everyone`-expanded users this is redundant but cheap; keep the per-user check for safety.)
   - Build `NotificationInsert[]` with `kind: "mention"`, `payload: { board_id, task_id, comment_id, actor_id }`.
   - Call `notifyUsers(rows)`.
6. `logActivity({ type: "comment.posted", payload: { commentId, bodyTextPreview: bodyText.slice(0, 140) } })`.
7. Return inserted row.

**`editComment`:**
1. Parse via `EditCommentSchema`.
2. Load existing comment via user-client (RLS gates author-only).
3. Update `body`, `body_text`, `updated_at = now()` — user-client (the existing `comment_update` policy permits author-only).
4. Diff `extractMentions(oldBody)` vs `extractMentions(newBody)`. Notify only NEW mentions (exclude author, expand `everyone` to board members if newly added).
5. `logActivity({ type: "comment.edited", payload: { commentId } })`.

**`deleteComment`:**
1. Parse via `DeleteCommentSchema`.
2. Load comment via user-client; if not author, verify caller is `admin+` for the board via `requireBoardRole(boardId, "admin")`.
3. **If actor is author:** DELETE via user-client (RLS `comment_delete` allows author).
4. **If actor is admin (not author):** DELETE via `adminClient()` because existing `comment_delete` RLS is author-only — admin-delete-of-others bypasses RLS. Document this in a comment in the action.
5. `logActivity({ type: "comment.deleted", payload: { commentId } })`.

**`reactComment`:**
1. Parse via `ReactCommentSchema`.
2. Load comment to get `board_id`; `requireBoardRole(boardId, "member")`.
3. INSERT into `comment_reaction` via user-client. On unique-violation (user already reacted with that emoji), treat as no-op and return `{ ok: true }`.
4. `logActivity({ type: "comment.reacted", payload: { commentId, emoji } })`.

**`unreactComment`:**
1. Parse via `UnreactCommentSchema`.
2. DELETE from `comment_reaction` where `comment_id`, `user_id = userId`, `emoji` — user-client (RLS allows self-only).
3. `logActivity({ type: "comment.unreacted", payload: { commentId, emoji } })`.

All five return `{ ok: true, data }` via the `withUser` wrapper's `ActionResult` shape, or `{ ok: false, error }` on validation/DB failures.

#### A.9 — Tests

`tests/unit/extract-mentions.test.ts`: per A.5.

`tests/unit/comment-actions.test.ts`:
- `createComment` with no mentions inserts the row + calls `logActivity('comment.posted')`.
- `createComment` with two user mentions calls `notifyUsers` with two rows; self-mention filtered.
- `createComment` with `@everyone` expands to all board members (mock `board_member` query); actor filtered.
- `createComment` with `@everyone` + explicit user mention deduplicates (user shouldn't appear twice).
- `createComment` skips non-board-member mentions (mock `role_for_board` returning `null`).
- `editComment` notifies only newly-added mentions (diff against old body).
- `deleteComment` issues DELETE via user-client when actor is author; via `adminClient()` when actor is admin-not-author.
- `reactComment` inserts; unique-violation on duplicate emoji → returns ok no-op.
- `unreactComment` deletes only the (comment, user, emoji) tuple.

`tests/policies/comment_reaction_rls.spec.sql` — pgTAP, mirrors `tests/policies/*` shape:
- Board viewer CAN select reactions.
- Non-member CANNOT select.
- Member CAN insert their own reaction.
- User CANNOT insert with `user_id` set to someone else.
- User CAN delete only their own reaction.
- Reactions DELETE on parent comment delete (FK cascade) — single test that deleting a comment removes its reactions.

#### A.10 — Definition of done

- Both migrations apply cleanly on a fresh DB (`pnpm db:reset`).
- `pnpm db:types` produces `comment_reaction` types; `activity` still present.
- `ActivityType` includes the five new ids.
- `extractMentions` handles every case in A.9.
- Five server actions exported, typed, wrapped in `withUser`.
- `notifyUsers` exported; never throws; logs warnings.
- pgTAP tests pass under `supabase test db`.
- `pnpm typecheck` clean.
- Zero UI file edits.

#### A.11 — Escalation triggers

- If `activity` is already in `supabase_realtime` publication (verify with `select * from pg_publication_tables where pubname='supabase_realtime'`), drop the `alter publication ... add table public.activity` line — adding twice errors.
- If the `comment_delete` RLS policy is not author-only as assumed, surface (admin-delete path may not need `adminClient()`).
- If `board_member` table column for user is named differently than expected (`user_id`), grep + adjust.

---

### Slice B — Tiptap deps + `<RichTextEditor />` + `<CommentEditor />` + `<CommentComposer />` + `<MentionPopover />` + `<ReactionPicker />`

**Branch:** `epic/09-comments-activity/b-editor-and-composer`

**Owns (write):**
- `package.json` (add Tiptap + frimousse deps)
- `pnpm-lock.yaml` (regenerate via `pnpm install`)
- `components/rich-text/RichTextEditor.tsx` (new — generic reusable Tiptap wrapper; the primitive for Q8 future reuse)
- `components/rich-text/extensions.ts` (new — configured extension set)
- `components/rich-text/MentionExtension.ts` (new — custom Tiptap Mention config)
- `components/rich-text/types.ts` (new — `RichTextEditorProps`, JSONContent → TiptapDoc shim)
- `components/comments/CommentEditor.tsx` (new — comment-specific wrapper around `<RichTextEditor />`; sets default placeholder, mention options, quote-reply API)
- `components/comments/CommentComposer.tsx` (new — composer card with Save/Cancel + typing-broadcast)
- `components/comments/MentionPopover.tsx` (new — Command-list popover with "Everyone" entry pinned on top)
- `components/comments/ReactionPicker.tsx` (new — frimousse-powered emoji picker in Base UI Popover)
- `tests/unit/RichTextEditor.test.tsx` (new)
- `tests/unit/MentionPopover.test.tsx` (new)

**Reads (no write):**
- `lib/comments/types.ts` (Slice A — `TiptapDoc`, `MentionAttrs`, `EVERYONE_MENTION_ID`)
- `lib/comments/mentions.ts` (Slice A — `extractMentions`)
- `lib/board-context.tsx` (`useBoard` → `userId`, `boardId`)
- `hooks/use-typing-broadcast.ts` (Epic 08 — first production consumer)
- `components/shared/Avatar.tsx`
- `components/ui/MenuList.tsx` (verify actual path)
- `docs/conversion-plan/design-system.md`, `component-system.md` §3.5, §4.1

**Forbidden:** Server actions, migrations, RLS, types regen, activity feed components, drawer route, board store. The list/item renderers are Slice D's.

**Depends on:** Slice A merged.

**Spec:**

#### B.1 — Dependencies

Add to `package.json` (pin to latest stable compatible with React 19; verify at install):

```
@tiptap/react
@tiptap/pm
@tiptap/starter-kit
@tiptap/extension-mention
@tiptap/extension-link
@tiptap/extension-placeholder
@tiptap/extension-typography
@tiptap/extension-task-list
@tiptap/extension-task-item
@tiptap/suggestion
lowlight
@tiptap/extension-code-block-lowlight
frimousse
```

Run `pnpm install`. Commit `pnpm-lock.yaml`. Verify `pnpm typecheck` clean.

**Escalate** if Tiptap v2 has a hard React 19 incompat or `frimousse` has a peer-dep issue. Do not pin downlevel React.

#### B.2 — `<RichTextEditor />` (generic primitive — Q8)

Reusable rich-text editor. No business logic about comments or mentions in here.

```ts
interface RichTextEditorProps {
  initialDoc?: TiptapDoc | null;
  onChange?: (doc: TiptapDoc, text: string) => void;
  onSubmit?: () => void;  // ⌘/Ctrl+Enter
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
  /** Extra extensions appended after the base set (e.g. MentionExtension). */
  extraExtensions?: Extension[];
  /** Toolbar slot — caller renders their own toolbar buttons via editor instance. */
  toolbar?: (editor: Editor | null) => ReactNode;
}
```

Base extensions (`components/rich-text/extensions.ts`): `StarterKit`, `Link`, `Placeholder`, `Typography`, `TaskList`, `TaskItem`, `CodeBlockLowlight` (with `lowlight` common languages).

Codec: every change → emit `{ doc: editor.getJSON() as unknown as TiptapDoc, text: editor.getText() }`.

Image paste/drop: register a ProseMirror plugin that intercepts file pastes. **Emit `console.warn` in dev and no-op**. Add JSDoc comment pointing to Epic 10. The plugin is the seam Epic 10 wires into.

Visual contract: `prose` text styling, `min-height: 96px` when not readOnly.

#### B.3 — `<CommentEditor />` (comment-specific wrapper)

Thin wrapper around `<RichTextEditor />` that:
- Sets default placeholder ("Write an update…").
- Wires `MentionExtension` with the comment-specific suggestion items.
- Exposes a `quoteReply(srcComment: CommentRow)` imperative method via ref: inserts a blockquote containing the source comment's body at the top of the editor, followed by an empty paragraph below for the reply text. **This is Q1's quote-reply mechanism.** Implementation: `editor.chain().focus().setContent({ type: 'doc', content: [{ type: 'blockquote', content: oldDoc.content ?? [] }, { type: 'paragraph' }] }).run()` then position cursor at the trailing paragraph.

```ts
interface CommentEditorProps {
  initialDoc?: TiptapDoc | null;
  onChange?: (doc: TiptapDoc, text: string) => void;
  onSubmit?: () => void;
  mentionableMembers: Array<{
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  }>;
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
}

interface CommentEditorHandle {
  quoteReply: (srcDoc: TiptapDoc) => void;
  focus: () => void;
  clear: () => void;
}
```

Forward a ref of type `CommentEditorHandle`.

Visual contract (component-system §3.5):
- Container outline `1px solid var(--color-primary)`, radius 4px when used as composer.
- When `readOnly` (used by `<CommentBody />` in Slice D), no outline; inherits parent padding.
- Toolbar (only when not readOnly): bold / italic / code / link / bullet list / ordered list / task list. Use `lucide-react` icons. Buttons `padding: 4px 8px`, hover bg `var(--color-surface-hover)`.

#### B.4 — `MentionExtension.ts`

Configures `@tiptap/extension-mention` with `suggestion: { ... }`. Trigger char `@`. Suggestion items: workspace members + the pinned "Everyone" entry.

On selection, insert a `mention` node with `attrs: { id, label }` where:
- For member: `id = member.id`, `label = displayName ?? email ?? "Unknown"`.
- For everyone: `id = "everyone"`, `label = "everyone"`.

Mention chip render (per component-system):
- bg `var(--color-chip-member)` (`#e5f4ff`).
- For `@everyone`: bg `var(--color-chip-everyone)` if a token exists, else fall back to `var(--color-chip-member)` with a stronger border. Surface if no clear token.
- Border radius 8px, padding `0 6px`, gap 4px. Displays `@${label}`.

#### B.5 — `<MentionPopover />`

Popover that appears on `@`. Renders a Command-list of suggestions filtered by query (case-insensitive on `displayName`, `email`). The first row is **always "Everyone on this board"** (with a small group/users icon), pinned regardless of query — unless the query string makes it match worse than members, in which case it stays first but visually subtle.

Selection inserts the mention node. ↑/↓/Enter/Esc per the `@tiptap/suggestion` protocol.

Visual contract: matches `<MenuList />` (component-system §3.2). Row: avatar 22px + label + email (for members) or icon + "Everyone" + small "Notify all board members" subtitle. Padding `4px 8px`. Active row bg `var(--color-surface-hover)`.

#### B.6 — `<CommentComposer />`

```ts
interface CommentComposerProps {
  taskId: string;
  boardId: string;
  mentionableMembers: MemberOption[];
  onPosted?: (comment: CommentRow) => void;
  /** Imperative handle exposed by parent if it wants to trigger quote-reply. */
  composerRef?: Ref<CommentComposerHandle>;
}

interface CommentComposerHandle {
  quoteReply: (src: CommentRow) => void;
  focus: () => void;
}
```

Behavior:
- Owns the internal `CommentEditor` ref and forwards `quoteReply` through `composerRef`.
- On submit (button click or ⌘/Ctrl+Enter):
  - Validate `text.trim() !== ""`.
  - Generate `temp:<uuid>` id; build optimistic `CommentRow` via `useBoardStore.getState().applyCommentUpsert(optimistic)`.
  - Call `createComment({ taskId, body, bodyText: text })`.
  - On success: `applyCommentUpsertReplaceTemp(tempId, real)`; call `onPosted?.(real)`; `editor.clear()`.
  - On error: `applyCommentDelete(tempId)`; toast error.
- Wire `useTypingBroadcast({ boardId, userId, context: \`comment:${taskId}\` })`. On every `onChange` from editor, call `emit()`. **First production consumer of Epic 08's typing plumbing.**

Visual contract:
- Save: bg `var(--color-primary)`, white text, height 32px, radius 4px, hover `var(--color-primary-hover)`.
- Cancel: white bg, fg text, height 32px, radius 4px. Only shown when editor has content.

Reply variant is just "the composer is non-empty because someone called `quoteReply`" — there's no separate `reply` mode prop. Q1 = no threading, just quote.

#### B.7 — `<ReactionPicker />`

Frimousse-powered popover. Controlled API: `<ReactionPicker onSelect={(emoji) => void} trigger={ReactNode} />`. Rendered in Base UI `Popover`. Cap width 320px, max-height 400px, scrollable.

Slice D's `<CommentReactions />` owns the trigger button; this slice provides the popover content.

#### B.8 — Tests

- `tests/unit/RichTextEditor.test.tsx`: render; typing emits `onChange`; ⌘+Enter calls `onSubmit`; readOnly hides toolbar; placeholder visible when empty.
- `tests/unit/MentionPopover.test.tsx`: filter by query; arrow nav; selection inserts mention; "Everyone" entry always present; selecting Everyone inserts node with `attrs.id = "everyone"`; Esc closes.

`<CommentEditor />` and `<CommentComposer />` integration coverage comes via Slice F's e2e.

#### B.9 — Definition of done

- Tiptap deps + frimousse installed; `pnpm install` clean; `pnpm typecheck` clean.
- `<RichTextEditor />` is a generic primitive with no comment-specific knowledge — can be lifted as-is into a future long-text cell.
- `<CommentEditor />` exposes `quoteReply()` ref method.
- `<CommentComposer />` posts via `createComment`, applies optimistic-then-reconcile, broadcasts typing.
- `<MentionPopover />` pins "Everyone" + lists members.
- `<ReactionPicker />` renders the frimousse picker inside a Base UI popover.
- Mention chip styling matches tokens.
- Image paste in editor logs warn (Epic 10 seam intact).
- Unit tests pass.

#### B.10 — Escalation triggers

- Tiptap or frimousse React 19 incompat → stop.
- `useTypingBroadcast` API change required → stop; do not edit Epic 08 hooks.
- `MenuList` recipe missing or differently-shaped at expected path → grep, adjust, escalate if not present at all.
- No `--color-chip-everyone` design token → use `--color-chip-member` with a border tweak; note the choice in a code comment.

---

### Slice C — Board store extensions + comment/reaction/activity realtime wiring

**Branch:** `epic/09-comments-activity/c-store-and-realtime`

**Owns (write):**
- `stores/board-store.ts` (extend with new slices/actions)
- `stores/types/comments.ts` (new)
- `hooks/use-board-realtime.ts` (single edit — three new `postgres_changes` subscriptions; remove the "deferred to epic 09" comment)
- `tests/unit/board-store-comments.test.ts` (new)
- `tests/unit/use-board-realtime-comments.test.ts` (new)

**Reads (no write):**
- `lib/supabase/types.ts` (Slice A — row types)
- `stores/types/realtime.ts`

**Forbidden:** UI, server actions, migrations, RLS, `useTypingBroadcast`, `useCursorBroadcast`. Do not modify existing `applyXxx` for task/group/cell/column/label. Do not change persisted slices (`collapsedByBoard`, `columnPrefsByBoard`, `outbox`).

**Depends on:** Slice A merged (needs regenerated types).

**Spec:**

#### C.1 — Types

`stores/types/comments.ts`:

```ts
import type { Database } from "@/lib/supabase/types";

export type CommentRow = Database["public"]["Tables"]["comment"]["Row"];
export type CommentReactionRow = Database["public"]["Tables"]["comment_reaction"]["Row"];
export type ActivityRow = Database["public"]["Tables"]["activity"]["Row"];
```

#### C.2 — Store state

Add to `BoardState` in `stores/board-store.ts`, in a banner-commented "Epic 09 — Comments + reactions + activity" section. Transient slices — never persisted:

```ts
commentsByTask: Map<string, CommentRow[]>;             // sorted oldest-first
reactionsByComment: Map<string, CommentReactionRow[]>;
activityByTask: Map<string, ActivityRow[]>;            // newest-first
```

Actions (idempotent — mirror existing `applyXxx` pattern):

```ts
// Comments — idempotency on (id, updated_at). Same row, older updated_at → ignored.
applyCommentUpsert: (comment: CommentRow) => void;
applyCommentUpsertReplaceTemp: (tempId: string, real: CommentRow) => void;
applyCommentDelete: (commentId: string) => void;
hydrateCommentsForTask: (taskId: string, comments: CommentRow[]) => void;

// Reactions — idempotency on PK tuple (comment_id, user_id, emoji). No updated_at.
applyReactionInsert: (reaction: CommentReactionRow) => void;
applyReactionDelete: (commentId: string, userId: string, emoji: string) => void;
hydrateReactionsForComments: (reactions: CommentReactionRow[]) => void;

// Activity — idempotency on id.
applyActivityInsert: (activity: ActivityRow) => void;
hydrateActivityForTask: (taskId: string, events: ActivityRow[]) => void;
```

`reset()` must clear all three maps.

Selectors (exported standalone, mirror `selectPresentUserIds` from Epic 08):

```ts
/** All comments for a task, oldest-first. (Flat — no threading per Q1.) */
export function selectCommentsForTask(state: BoardState, taskId: string): CommentRow[];

/** Grouped reactions for a comment with counts + selfReacted flag. */
export function selectGroupedReactions(
  state: BoardState,
  commentId: string,
  currentUserId: string,
): Array<{ emoji: string; count: number; selfReacted: boolean }>;

/** Activity events for a task, newest-first. */
export function selectTaskActivity(state: BoardState, taskId: string): ActivityRow[];
```

#### C.3 — Realtime hook extension

Edit `hooks/use-board-realtime.ts`. Remove the `// comment postgres_changes deferred to epic 09` comment. Add three subscriptions on the existing board channel:

1. `comment` with `filter: 'board_id=eq.${boardId}'`:
   - INSERT/UPDATE → `applyCommentUpsert(e.new)`. (Soft-delete is gone per Q2; UPDATE only fires on edits.)
   - DELETE → `applyCommentDelete(e.old.id)`.

2. `comment_reaction` with `filter: 'board_id=eq.${boardId}'`:
   - INSERT → `applyReactionInsert(e.new)`.
   - DELETE → `applyReactionDelete(e.old.comment_id, e.old.user_id, e.old.emoji)`.
   - UPDATE → `console.warn` in dev; ignored. Reactions are immutable.

3. `activity` with `filter: 'board_id=eq.${boardId}'`:
   - INSERT → `applyActivityInsert(e.new)`.
   - UPDATE/DELETE → `console.warn` in dev; ignored. Activity is append-only.

#### C.4 — Tests

`tests/unit/board-store-comments.test.ts`:
- `applyCommentUpsert` idempotency: same id + same updated_at → no-op; older updated_at → ignored; newer → replaces.
- `applyCommentUpsertReplaceTemp` swaps temp id with real row in-place.
- `applyCommentDelete` removes from `commentsByTask`.
- `hydrateCommentsForTask` replaces entire list for that task.
- `applyReactionInsert` idempotency on PK tuple.
- `applyReactionDelete` removes only matching tuple.
- `selectGroupedReactions` groups, counts, sets `selfReacted` correctly.
- `selectCommentsForTask` ordered oldest-first.
- `applyActivityInsert` idempotency on id.
- `selectTaskActivity` newest-first.
- `reset()` clears the three new maps.

`tests/unit/use-board-realtime-comments.test.ts`:
- Hook subscribes to `comment` postgres_changes with the correct filter.
- Same for `comment_reaction`.
- Same for `activity`.
- INSERT/UPDATE/DELETE events dispatch to the correct store actions.
- Self-echo on `comment_reaction` (same user inserts then receives their own event) does not double-increment — store is idempotent.

#### C.5 — Definition of done

- Store exposes the new actions + selectors; types compile.
- `useBoardRealtime` subscribes to three new tables and routes correctly.
- `reset()` clears the new maps.
- All unit tests pass.
- `pnpm typecheck` clean.

#### C.6 — Escalation triggers

- If `activity` is not in `supabase_realtime` publication when Slice C reaches integration test, surface — but Slice A is supposed to add it. The Slice C executor must verify and report rather than silently failing.
- If existing realtime hook test harness can't be cleanly extended for three new subscriptions, surface — do not refactor the harness.

---

### Slice D — `<CommentList />`, `<CommentItem />`, `<CommentReactions />`, `<CommentBody />`, `<ActivityList />`, `<ActivityItem />`, renderer registry

**Branch:** `epic/09-comments-activity/d-list-renderers`

**Owns (write):**
- `components/comments/CommentList.tsx` (new)
- `components/comments/CommentItem.tsx` (new — header, body, actions; no threaded children per Q1)
- `components/comments/CommentReactions.tsx` (new)
- `components/comments/CommentBody.tsx` (new — read-only render via `<CommentEditor readOnly />`)
- `components/activity/ActivityList.tsx` (new)
- `components/activity/ActivityItem.tsx` (new)
- `components/activity/renderers/index.ts` (new — registry)
- `components/activity/renderers/task.tsx`, `group.tsx`, `column.tsx`, `cell.tsx`, `comment.tsx`, `label.tsx` (one per action group)
- `components/activity/CellInline.tsx` (new — compact-mode wrapper for `cellRegistry[type].Cell`)
- `tests/unit/CommentItem.test.tsx` (new)
- `tests/unit/CommentReactions.test.tsx` (new)
- `tests/unit/ActivityItem.test.tsx` (new)
- `tests/unit/activity-renderers.test.tsx` (new)

**Reads (no write):**
- `components/comments/CommentEditor.tsx` (Slice B — for readOnly render)
- `lib/cells/registry.ts` (Epic 07 — `cellRegistry`)
- `stores/board-store.ts` (Slice C — selectors)
- `lib/activity.ts` (Slice A — `ActivityType`)
- `components/shared/Avatar.tsx`
- `components/ui/MenuList.tsx`

**Forbidden:** Composer / editor primitives (Slice B), server actions (Slice A), board store (Slice C), drawer route / Activity modal (Slices E/F).

**Depends on:** Slices A, B, C all merged.

**Spec:**

#### D.1 — `<CommentList />`

```ts
interface CommentListProps {
  taskId: string;
  boardId: string;
  currentUserId: string;
  boardRole: Role;
  mentionableMembers: MemberOption[];
  /** Imperative ref to the composer (passed from parent) so Reply can call quoteReply. */
  composerRef?: Ref<CommentComposerHandle>;
}
```

Behavior:
- Read `selectCommentsForTask(state, taskId)`.
- Render `<CommentItem />` per comment. **Flat list — no threading (Q1).**
- Read `?comment=<id>` from `useSearchParams()`. On mount or change, scroll matching item into view + apply 2s highlight wash (`bg-[color:var(--color-primary-selected)]`). Satisfies "URL-linkable comments".
- V1 ships first 50 comments (initial server hydrate). Pagination deferred to a followup.

#### D.2 — `<CommentItem />`

```ts
interface CommentItemProps {
  comment: CommentRow;
  boardId: string;
  currentUserId: string;
  isAuthor: boolean;
  canDelete: boolean;  // isAuthor OR boardRole >= admin
  mentionableMembers: MemberOption[];
  /** Composer ref forwarded from CommentList so Reply can call quoteReply. */
  composerRef?: Ref<CommentComposerHandle>;
}
```

Visual (component-system §4.1):
- Container `1px solid var(--color-border-strong)`, radius 4px, padding 16px, margin-bottom 16px.
- Header: avatar 26px + author display_name (16px in `--color-fg`) + timestamp (`--color-fg-muted`) + "edited" badge if `updated_at > created_at + 5_000ms`.
- Right of header: overflow menu (`MoreHorizontal` 24×24).
- Body: `<CommentBody body={comment.body} />`. Padding `0 16px 16px`, max-width 540px.
- Below body: `<CommentReactions />` + Reply / React buttons.

Overflow menu (Base UI Popover + `<MenuList />`):
- **Edit** (if isAuthor): toggles inline edit mode — replaces `<CommentBody />` with an inline `<CommentEditor />` + Save/Cancel; on save calls `editComment(...)`.
- **Delete** (if canDelete): confirmation prompt → `deleteComment(...)`. Optimistic: store action immediately, server reconciles.
- **Copy link**: copies `<taskUrl>?comment=${id}` to clipboard.

Reply button: calls `composerRef.current?.quoteReply({ srcDoc: comment.body, srcAuthor: ..., srcCreatedAt: ... })` — composer scrolls into view + inserts blockquote + focuses cursor below.

No threaded children rendering (Q1).
No `[deleted]` placeholder (Q2 — hard delete only).

#### D.3 — `<CommentReactions />`

```ts
interface CommentReactionsProps {
  commentId: string;
  currentUserId: string;
}
```

Reads `selectGroupedReactions(state, commentId, currentUserId)`. Renders:
- Each emoji as a chip: emoji + count. Self-reacted: bg `var(--color-primary-selected)` + outline `1px solid var(--color-primary)`. Others: bg `var(--color-surface-hover)`. Padding `2px 6px`, radius 12px.
- "+" trigger button → opens `<ReactionPicker />` (Slice B).
- Click self-reacted chip → `unreactComment`. Click other chip → `reactComment` (toggle on). Picker `onSelect` → `reactComment`.
- All mutations optimistic via `applyReactionInsert` / `applyReactionDelete` before the server call.

#### D.4 — `<CommentBody />`

Wraps `<CommentEditor readOnly initialDoc={body} />`. Mention chips and quoted blockquotes render via the same extensions. No interactive elements except mention chip click (defer; could route to user profile in a later epic — for v1, plain chip).

#### D.5 — `<ActivityList />` and `<ActivityItem />`

```ts
interface ActivityListProps {
  scope: { kind: "task"; taskId: string } | { kind: "board"; boardId: string };
  /** Pre-fetched events. Parent decides where they come from. */
  events: ActivityRow[];
  ctx: ActivityRenderCtx;
}
```

For task scope, the parent (Slice F's ActivityTab) passes `selectTaskActivity(...)`. For board scope, the parent (Slice E's modal) passes the paginated state.

Visual (component-system §4.2):
- Row height 60px, padding `8px 0`, `1px` bottom border `var(--color-shadow-card)`, gap 5%, font-size 16px.
- Avatar 30×30. Time/title column 200px. From/to column 200px.

`<ActivityItem />` looks up renderer by `event.type` in the registry. If missing, falls back to "`[actor] performed [type]`" with payload in a `<details>` block.

#### D.6 — Renderer registry

`components/activity/renderers/index.ts`:

```ts
import type { ReactNode } from "react";
import type { ActivityRow } from "@/stores/types/comments";
import { taskRenderers } from "./task";
import { groupRenderers } from "./group";
import { columnRenderers } from "./column";
import { cellRenderers } from "./cell";
import { commentRenderers } from "./comment";
import { labelRenderers } from "./label";

export type ActivityRenderCtx = {
  columns: Map<string, ColumnRow>;
  labelsByColumn: Map<string, LabelRow[]>;
  profiles: Map<string, ProfileRow>;  // for actor display
};

export type ActivityRenderer = (event: ActivityRow, ctx: ActivityRenderCtx) => ReactNode;

export const activityRenderers: Record<string, ActivityRenderer> = {
  ...taskRenderers,
  ...groupRenderers,
  ...columnRenderers,
  ...cellRenderers,
  ...commentRenderers,
  ...labelRenderers,
};
```

Each renderer file exports a `Record<string, ActivityRenderer>` keyed by the activity type ids it owns. Must cover every type in `lib/activity.ts`. Missing → generic fallback.

`cell.changed` renderer uses `<CellInline />` (D.7) to render from/to values via the cell registry. This is where the "labels render with the same color as the status pill" requirement is satisfied — no reimplementation of chip rendering.

#### D.7 — `<CellInline />`

Compact wrapper that calls `cellRegistry[colType].Cell` in a read-only / no-interaction mode. Pin the prop contract to the current `CellTypeDef.Cell` props (Epic 07); a type-level test in `activity-renderers.test.tsx` ensures compile-time alignment.

#### D.8 — Tests

- `tests/unit/CommentItem.test.tsx`: header/body render; "edited" badge appears at `updated_at > created_at + 5s`; overflow shows Edit only for author; Delete for author or admin; Copy link copies the right URL; Reply calls `composerRef.current.quoteReply` with the correct doc.
- `tests/unit/CommentReactions.test.tsx`: grouping; self-reacted chip styling; click toggles; "+" opens picker (mock); reactionPicker `onSelect` triggers `reactComment`.
- `tests/unit/ActivityItem.test.tsx`: rendered through registry; falls back to generic on unknown type.
- `tests/unit/activity-renderers.test.tsx`: at minimum, one rendered snapshot per renderer in the registry. Specifically: `cell.changed` for a `status` column renders from→to labels with the status color (mock `cellRegistry`). Compile-time guard ensuring `CellInline` props align with `CellTypeDef.Cell`.

#### D.9 — Definition of done

- All components + renderer registry exist; types compile.
- `<CommentList />` reads from store; flat list (Q1).
- Reactions optimistic via store; reconciled on realtime echo (idempotent).
- `<ActivityList scope="task">` renders full history; every `ActivityType` has a renderer.
- `?comment=<id>` scroll + highlight works.
- `pnpm typecheck` clean; tests pass.

#### D.10 — Escalation triggers

- `cellRegistry`'s `Cell` props differ from what `<CellInline />` can pass — surface; don't invent an adapter without approval.
- `MenuList` recipe API differs from `<MenuList><MenuListItem .../></MenuList>` shape — adapt; surface if structurally different.

---

### Slice E — Per-board Activity modal + topbar trigger + filters + pagination

**Branch:** `epic/09-comments-activity/e-board-activity-modal`

**Owns (write):**
- `components/activity/BoardActivityModal.tsx` (new)
- `components/activity/BoardActivityFilters.tsx` (new — actor / action-group / date range)
- `components/activity/BoardActivityTrigger.tsx` (new — topbar button)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/activity/actions.ts` (new — `listBoardActivity`)
- `lib/validations/activity.ts` (new)
- `components/board/BoardHeaderClient.tsx` (single edit — insert `<BoardActivityTrigger />` after `<MemberStack>`)
- `tests/unit/BoardActivityFilters.test.tsx` (new)
- `tests/unit/list-board-activity.test.ts` (new)

**Reads (no write):**
- `components/activity/ActivityList.tsx` (Slice D)
- `components/activity/renderers/index.ts` (Slice D)
- `lib/activity.ts` (Slice A)
- `lib/actions/with-user.ts`
- `lib/authorization/board.ts`

**Forbidden:** Server actions for comments/reactions (Slice A); list/item renderers (Slice D); the task drawer (Slice F); the store (Slice C). Do not modify `BoardHeader.tsx` (server component) — only `BoardHeaderClient.tsx`.

**Depends on:** Slices A and D merged. Parallel-safe with B, C otherwise.

**Spec:**

#### E.1 — Server action `listBoardActivity`

```ts
"use server";
import { withUser } from "@/lib/actions";
import { requireBoardRole } from "@/lib/authorization";
import { ListBoardActivitySchema } from "@/lib/validations/activity";

export const listBoardActivity = withUser(async ({ supabase }, raw) => {
  const input = ListBoardActivitySchema.parse(raw);
  await requireBoardRole(input.boardId, "viewer");

  let q = supabase
    .from("activity")
    .select("*")
    .eq("board_id", input.boardId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(50);

  if (input.cursor) {
    const [ts, id] = input.cursor.split("|");
    q = q.or(`created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${id})`);
  }

  if (input.filters?.actorIds?.length) q = q.in("actor_id", input.filters.actorIds);
  if (input.filters?.actionGroups?.length) {
    const orParts = input.filters.actionGroups.map((g) => `type.like.${g}.%`).join(",");
    q = q.or(orParts);
  }
  if (input.filters?.dateFrom) q = q.gte("created_at", input.filters.dateFrom);
  if (input.filters?.dateTo) q = q.lte("created_at", input.filters.dateTo);

  const { data, error } = await q;
  if (error) throw { code: "DB", message: error.message };

  const events = data ?? [];
  const nextCursor = events.length === 50
    ? `${events[events.length - 1].created_at}|${events[events.length - 1].id}`
    : null;

  return { events, nextCursor };
});
```

`lib/validations/activity.ts`:

```ts
import { z } from "zod";

export const ActivityFilterSchema = z.object({
  actorIds: z.array(z.string().uuid()).optional(),
  actionGroups: z.array(z.enum(["task", "group", "column", "cell", "comment", "label"])).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const ListBoardActivitySchema = z.object({
  boardId: z.string().uuid(),
  filters: ActivityFilterSchema.optional(),
  cursor: z.string().nullable().optional(),
});

export type ActivityFilters = z.infer<typeof ActivityFilterSchema>;
```

#### E.2 — `<BoardActivityModal />`

Centered modal (Base UI Dialog or whatever the existing modal primitive is — verify in Slice E by grepping `components/ui/`). Width ~720px, max-height 80vh.

- Header: "Board activity" + close button.
- `<BoardActivityFilters value={filters} onChange={setFilters} />`.
- `<ActivityList scope={{ kind: "board", boardId }} events={loaded} ctx={...} />`.
- Footer "Load more" button.

State (Q3 = local, no @tanstack/react-query):

```ts
const [events, setEvents] = useState<ActivityRow[]>([]);
const [cursor, setCursor] = useState<string | null>(null);
const [filters, setFilters] = useState<ActivityFilters>({});
const [isPending, startTransition] = useTransition();

// On open / filter change: reset and fetch first page.
// On "Load more": fetch with current cursor, append, update cursor.
```

When `filters` changes, reset `events` to `[]` and `cursor` to `null` and re-fetch.

#### E.3 — `<BoardActivityFilters />`

Three inputs:
- Actor multi-select: list of workspace/board members; multi-select via Base UI Select or a Command picker.
- Action group multi-select: checkboxes for `task | group | column | cell | comment | label`.
- Date range: two date inputs (Base UI or `<input type="date">` v1).

`onChange(filters: ActivityFilters)`.

#### E.4 — `<BoardActivityTrigger />`

Small icon button (Lucide `History` 20px) in the board topbar. Click opens the modal. Reads `boardId` from `useBoard()`.

#### E.5 — `BoardHeaderClient.tsx` edit

Insert `<BoardActivityTrigger />` immediately after the existing `<MemberStack>` line. **Single insertion; no layout refactor.**

#### E.6 — Tests

- `tests/unit/list-board-activity.test.ts`: mocked supabase; verify `eq`, `order`, `limit`, cursor `or`, and filter clauses; cursor return value correct; empty result returns `nextCursor: null`.
- `tests/unit/BoardActivityFilters.test.tsx`: actor multi-select; date inputs; emits correct `ActivityFilters` shape via `onChange`.

#### E.7 — Definition of done

- Topbar shows the trigger.
- Modal opens with first 50 events.
- Filters narrow the list; "Load more" paginates.
- All Slice D renderers fire correctly inside the modal.
- Unit tests pass; `pnpm typecheck` clean.

#### E.8 — Escalation triggers

- `BoardHeaderClient.tsx` layout has changed so single-insertion is awkward — surface.
- Modal primitive not present in `components/ui/` — surface, do not invent.

---

## Stage 2 — sequential follow-up

### Slice F — Intercepting-route drawer + tabs + per-task tab wiring + presence + e2e

**Branch:** `epic/09-comments-activity/f-drawer-and-e2e`

**Owns (write):**
- `app/(app)/w/[workspaceSlug]/b/[boardId]/t/[taskId]/page.tsx` (new — full-page route)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/@modal/(.)t/[taskId]/page.tsx` (new — intercepting route)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/@modal/default.tsx` (new — null fallback for parallel route)
- `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` (edit — accept `@modal` parallel slot)
- `components/board/TaskDrawer.tsx` (new — drawer shell + tabs)
- `components/board/TaskDrawerModalShell.tsx` (new — slide-in animation wrapper for intercepting-route mode; calls `router.back()` on close)
- `components/board/TaskDrawerTabs.tsx` (new — tab strip)
- `components/board/tabs/UpdatesTab.tsx` (new — `<CommentComposer />` + `<CommentList />`)
- `components/board/tabs/ActivityTab.tsx` (new — `<ActivityList scope="task" />`)
- `components/board/tabs/FilesTab.tsx` (new — Epic 10 placeholder)
- `hooks/use-task-drawer-presence.ts` (new — track `viewing: { type: 'task', task_id }` on the board channel)
- `components/board/TaskOverflowMenu.tsx` (edit — confirm "Open task" link points to `/t/[taskId]`; should already from Epic 06; verify)
- `tests/unit/TaskDrawer.test.tsx` (new)
- `tests/unit/use-task-drawer-presence.test.ts` (new)
- `tests/e2e/09-comments-activity.spec.ts` (new — Playwright)
- `CONTRIBUTING.md` (append "Comments & activity" section)

**Reads (no write):** All Slice A–E outputs. `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` (existing). `lib/auth/current-user.ts`.

**Forbidden:** Anything in Slices A–E's owned files. Server-action additions. Migrations.

**Depends on:** **All of A, B, C, D, E merged.**

**Spec:**

#### F.1 — Intercepting-route shape (Q5 = intercepting routes)

Next.js parallel + intercepting routes layout:

```
app/(app)/w/[workspaceSlug]/b/[boardId]/
  layout.tsx                                  -- edited: accept @modal slot
  page.tsx                                    -- (unchanged) renders board table
  @modal/
    default.tsx                               -- returns null
    (.)t/[taskId]/page.tsx                   -- intercepts in-board navigation; renders <TaskDrawerModalShell>
  t/[taskId]/
    page.tsx                                  -- full-page mount on direct nav / refresh; renders <TaskDrawer> in full-page variant
```

Both routes do the same server-side data fetch (F.4) and render the same `<TaskDrawer />`. Only the wrapping differs:
- Intercepting route: wraps in `<TaskDrawerModalShell />` which provides slide-in animation, Esc / outside-click → `router.back()`.
- Full-page route: renders the drawer at fixed position right (or full-screen on narrow viewports — verify with the existing breakpoint conventions).

Browser back / Esc / outside-click in modal mode → `router.back()` returns to the board with the drawer dismissed. Refresh while on `t/[taskId]` URL hits the full-page route. URL is always shareable.

`app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx` edit: change the layout signature to accept `modal` as a parallel slot. Pattern:

```tsx
export default function BoardLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
```

`@modal/default.tsx`: `export default function Default() { return null; }`.

`TaskOverflowMenu.tsx` already links to `/t/[taskId]` per Epic 06; verify it uses `<Link>` (not a hard navigate) so the intercepting route fires.

#### F.2 — `<TaskDrawer />`

```ts
interface TaskDrawerProps {
  taskId: string;
  task: TaskRow;
  comments: CommentRow[];
  reactions: CommentReactionRow[];
  activity: ActivityRow[];
  mentionableMembers: MemberOption[];
  currentUserId: string;
  boardRole: Role;
  /** "modal" = slide-in over board; "full" = standalone page. Affects shell, not internals. */
  variant: "modal" | "full";
}
```

On mount (via `useEffect`):
- `hydrateCommentsForTask(taskId, comments)`
- `hydrateReactionsForComments(reactions)`
- `hydrateActivityForTask(taskId, activity)`
- `useTaskDrawerPresence(taskId)` (F.3)

Tabs:
- **Updates** (default): `<CommentComposer composerRef={composerRef} ... />` on top, `<CommentList composerRef={composerRef} ... />` below. The shared ref enables Reply → quoteReply.
- **Activity**: `<ActivityList scope={{ kind: "task", taskId }} events={selectTaskActivity(state, taskId)} ctx={...} />`.
- **Files**: placeholder "Attachments coming soon (Epic 10)".

Visual contract (component-system §3.5):
- `position: fixed; top: 0; right: 0; height: 100vh; min-width: 570px`.
- Bg white, `border-inline-start: 1px solid #ccc`.
- Header: padding `20px 20px 6px 24px`, height 53px, font-size 18px.
- Tab strip: padding `0 24px`, `1px solid var(--color-border)` bottom; each tab `padding: 8px`, weight 500, font-size 14px; hover bg `var(--color-surface-hover)`, only top corners round (`4px 4px 0 0`); active tab bottom border `2px solid var(--color-primary)`.
- Content area: scroll, scrollbar hidden.

#### F.3 — Drawer presence

`hooks/use-task-drawer-presence.ts`: subscribes to the same `board:<id>` channel (via the existing realtime hook's exposed channel ref — or, if Epic 08 doesn't expose it, surface as an escalation; do not duplicate the channel). On mount, calls `channel.track({ user_id, online_at, viewing: { type: 'task', task_id } })`. On unmount, reverts to `{ viewing: { type: 'board' } }`.

`selectUsersViewingTask` already exists from Epic 08 (forward-compat). Verify: does any component currently render the per-task presence dot? If not, that's a one-line `<TaskPresenceDot />` add to `TaskRow.tsx` (acceptable scope expansion; add to owns if needed). If Epic 08 already shipped the dot, skip.

#### F.4 — Server-side data fetch

Both `t/[taskId]/page.tsx` and `@modal/(.)t/[taskId]/page.tsx` do the same fetch:

```ts
const supabase = await createClient();
const userId = await getCurrentUserId();

const taskRes = await supabase
  .from("task")
  .select("*, group:group_id(id, board_id)")
  .eq("id", taskId)
  .is("deleted_at", null)
  .single();

const boardId = taskRes.data.group.board_id;
const boardRole = await requireBoardRole(boardId, "viewer");

const [commentsRes, activityRes, membersRes] = await Promise.all([
  supabase.from("comment").select("*").eq("task_id", taskId).order("created_at", { ascending: true }).limit(50),
  supabase.from("activity").select("*").eq("task_id", taskId).order("created_at", { ascending: false }).limit(100),
  // Workspace members for mention popover; join with profile for display data.
  supabase
    .from("workspace_member")
    .select("user_id, profile:user_id(display_name, email, avatar_url)")
    .eq("workspace_id", workspaceId),
]);

// Second round-trip for reactions — needs comment ids.
const commentIds = commentsRes.data?.map((c) => c.id) ?? [];
const reactionsRes = commentIds.length
  ? await supabase.from("comment_reaction").select("*").in("comment_id", commentIds)
  : { data: [] };
```

Pass into `<TaskDrawer />` as props.

#### F.5 — Playwright e2e at `tests/e2e/09-comments-activity.spec.ts`

Two browser contexts. Tests:
1. User A opens task drawer from board (intercepting route). URL changes to `/t/<id>`.
2. User A posts a comment. User B (on the table) sees the comment count badge increment (via realtime).
3. User A types `@`, picks user B from mention popover, posts. Direct DB check: `notification` table has a `mention` row for user B with the right `payload`. (In-app bell UI lands Epic 13; just verify the row exists.)
4. User A mentions `@everyone`. Verify notification rows exist for every board member except user A. Verify dedup if user A also mentioned user B explicitly.
5. User B opens the task. User A's drawer-presence dot appears on their task row.
6. User A reacts 👍. User B sees the chip with count 1. User B reacts 👍 → count 2 → toggles off → count 1.
7. User A edits their comment. User B sees "edited" badge appear.
8. User A deletes their comment. Hard delete (Q2). User B sees the row vanish.
9. User A clicks Reply on user B's comment → composer is focused with a blockquote of user B's content. User A types and posts. The new comment renders with the quote at the top + user A's text below.
10. Activity tab on the task shows all the events in order.
11. Per-board Activity modal opens, paginates, filters by actor.
12. Esc / browser back on intercepting drawer returns to board with drawer dismissed. Refresh on `/t/<id>` hits full-page route; same drawer renders.
13. `?comment=<id>` direct URL scrolls to and highlights that comment.

Mirrors Epic 08 e2e pattern. Run via `pnpm test:e2e` (Epic 15 wires CI; this just lands the spec).

#### F.6 — `CONTRIBUTING.md` append

Add a "Comments & activity" section:

> Every mutation server action emits one activity row via `logActivity`. The set of activity types is closed (see `lib/activity.ts`); add new ones in lockstep with the matching renderer in `components/activity/renderers/`. Missing renderers degrade to a generic line — but every new action type should ship with its renderer in the same PR.
>
> Comment writes go through the user-client (RLS-enforced). Notification fan-out goes through the service role (`lib/notifications/notify.ts`). Mention extraction is `lib/comments/mentions.ts`; `@everyone` is the sentinel `attrs.id = "everyone"` and expands to all board members at notify time.
>
> Reactions have no `updated_at` — store idempotency keys on the PK tuple `(comment_id, user_id, emoji)`.
>
> The task drawer uses Next.js intercepting routes (`@modal/(.)t/[taskId]`). Direct URL navigation hits the full-page route at `t/[taskId]`. Both render the same `<TaskDrawer />`; only the shell differs.

#### F.7 — Definition of done

- Opening a task from the board uses the intercepting route; URL updates; refresh hits full-page; both render `<TaskDrawer />`.
- Posting a comment with `@user` creates a comment row + notification row.
- `@everyone` expands to all board members minus the actor.
- Reply opens composer with a blockquote of the source comment.
- Two browsers see comment / reaction / edit / delete events live.
- Activity tab shows full per-task history; per-board modal lists, filters, paginates.
- Drawer slide-in animation matches `--motion-drawer`.
- `?comment=<id>` scroll + highlight works.
- E2E spec passes locally.

#### F.8 — Escalation triggers

- `useBoardRealtime` does not expose a channel ref for `useTaskDrawerPresence` to track on — surface; do not create a second board channel.
- `TaskRow.tsx` already has a presence dot consumer — skip adding one; do not duplicate.
- The reactions `in()` query F.4 has any structural shape issue — surface.
- Intercepting route doesn't fire because `TaskOverflowMenu` uses `router.push` instead of `<Link>` — switch to `<Link>` (single-line edit, acceptable in this slice).

---

## Risk notes (locked from planning)

1. **Activity column is `type`, not `action`.** Migration says `type`; `lib/activity.ts` consumes `type`. All slice specs use `type`. **Executors must not "fix" this back to `action`.**

2. **`activity` is NOT in `supabase_realtime` publication today.** Slice A's first migration adds it. Without this, Slice C's `activity` subscription is silent and tests pass-falsely. Slice A's executor must verify and run that `alter publication` line.

3. **`comment_reaction` has no `updated_at`.** Store idempotency keys on the PK tuple `(comment_id, user_id, emoji)`. Test the self-echo case explicitly (Slice C).

4. **Soft-delete is OUT** (Q2). Realtime UPDATE events on `comment` are edits only. `applyCommentUpsert` just replaces by `(id, updated_at)`.

5. **Admin delete path uses `adminClient()`.** Existing `comment_delete` RLS is author-only. When actor is admin-not-author, Slice A's `deleteComment` uses `adminClient()`. Documented in the action body.

6. **N+1 on reactions in drawer fetch.** F.4's reactions query is a second round-trip via `in("comment_id", commentIds)`. Fine for v1; flag a followup if deep threads hit it.

7. **Mention fan-out for `@everyone`.** Expands to the full board-member list. For small boards (< 50) it's fine. If a future board has thousands of members, switch to a single SQL function. Out of scope for this epic.

8. **Realtime self-echo for comments.** Idempotent via `(id, updated_at)`. Tests cover.

9. **Mention popover member resolution under workspace privacy.** Popover shows workspace members; notification fan-out only fires for users with board access (`role_for_board != null`). A user can mention someone who can't see the board — silently drop their notification, mention chip persists. Documented behavior; do not "fix" by filtering on render.

10. **Type-conversion strictness.** Tiptap's `editor.getJSON()` returns `JSONContent`; we persist as `TiptapDoc`. Narrow `TiptapDoc` + explicit `as unknown as TiptapDoc` cast at the editor boundary preferred over widening the type.

11. **Cell-renderer drift in activity feed.** `<CellInline />` consumes `cellRegistry[type].Cell`. If a future epic changes the cell prop contract, the activity feed breaks silently. Slice D's `activity-renderers.test.tsx` includes a compile-time guard.

12. **Topbar layout for the activity trigger.** Slice E inserts a 32px button into `BoardHeaderClient.tsx`. Existing PresencePile / ConnectionStatus / OutboxBanner / MemberStack layout must have room. Surface if cramped.

13. **Intercepting routes + parallel routes are sensitive to file layout.** A missing `@modal/default.tsx` or a typo in `(.)t/[taskId]` silently breaks the intercept. Slice F's e2e is the gate.

---

## Files referenced (absolute)

- `docs/conversion-plan/09-comments-activity.md`
- `docs/conversion-plan/00-overview.md`
- `docs/conversion-plan/02-supabase-schema.md`
- `docs/conversion-plan/04-authorization-rls.md`
- `docs/conversion-plan/06-groups-tasks-table.md`
- `docs/conversion-plan/07-column-system.md`
- `docs/conversion-plan/08-realtime-presence.md`
- `docs/conversion-plan/component-system.md`
- `docs/conversion-plan/design-system.md`
- `docs/conversion-plan/_dispatch/epic-08.md`
- `docs/conversion-plan/_dispatch/epic-08-followup-1.md`
- `supabase/migrations/20260506224930_initial_schema.sql`
- `supabase/migrations/20260507120100_rls_policies.sql`
- `lib/activity.ts`
- `lib/actions/with-user.ts`
- `lib/supabase/admin.ts`
- `lib/supabase/types.ts`
- `lib/board-context.tsx`
- `stores/board-store.ts`
- `stores/types/realtime.ts`
- `hooks/use-board-realtime.ts`
- `hooks/use-typing-broadcast.ts`
- `hooks/use-typing-indicator.ts`
- `app/(app)/w/[workspaceSlug]/b/[boardId]/page.tsx`
- `app/(app)/w/[workspaceSlug]/b/[boardId]/layout.tsx`
- `app/(app)/w/[workspaceSlug]/b/[boardId]/cells/actions.ts`
- `app/(app)/w/[workspaceSlug]/b/[boardId]/t/[taskId]/` (currently `.gitkeep`)
- `components/board/BoardHeader.tsx`
- `components/board/BoardHeaderClient.tsx`
- `components/comments/` (empty; Slices B + D fill)
- `components/activity/` (empty; Slices D + E fill)
- `components/rich-text/` (empty; Slice B fills)
- `package.json`
