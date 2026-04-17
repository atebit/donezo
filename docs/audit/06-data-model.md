# Data Model & API Contracts

The current schema is **document-embedded**: a board is one MongoDB document that owns its groups, tasks, members, labels, activities, and column configuration. This section documents the shapes, the API surface, and the concurrency implications.

## Collections

- `board`
- `user`

No `workspace`, no `comment`, no `activity`, no `attachment`, no `membership` collection. Everything about a board lives inside the board document.

## Board document shape

From `frontend/src/services/board.service.js` `getEmptyBoard()`:

```js
{
  _id: ObjectId,
  title: string,
  isStarred: boolean,
  description: string,
  members: [ { _id, fullname, imgUrl } ],
  statusLabels: [ { id, title, color } ],
  priorityLabels: [ { id, title, color } ],
  cmpsOrder: [ string | { id, type } ],         // column order
  cmpsOption: [ string ],                       // available column types
  groups: [ Group ],
  activities: [ Activity ],  // capped at 30 most recent in addActivity
}
```

Notes:
- The column system accepts both string entries (`"status-picker"`) and object entries (`{id, type}`). `TaskPreview.DynamicCmp` handles both (`task-preview.jsx:126`). `cmpsOption` is string-only.
- `statusLabels` vs `priorityLabels` are now separated. The earlier upstream used a single `labels` array shared by both pickers — worth double-checking existing DB documents weren't created before the split.

## Group shape

```js
{
  id: string,        // client-generated (makeId), not ObjectId
  title: string,
  color: string,     // hex
  tasks: [ Task ],
}
```

No `createdAt`, no `createdBy`, no `archived` flag.

## Task shape

From `board.service.getEmptyTask()`:

```js
{
  id: string,              // client-generated
  title: string,
  status: string,          // label title (not id) — brittle
  priority: string,        // label title
  memberIds: [ string ],
  dueDate: number,         // epoch ms
  number: number | '',
  checkbox: boolean,
  file: string,            // single URL
  comments: [ Comment ],
  updatedBy: { imgUrl: string, date: number },
}
```

Concerns:
- `status` / `priority` store the label **title** rather than id. If you rename a label, the reducer has to cascade-rewrite every task (`board.reducer.js` does this). This is what the loose `==` bug on ~line 56 is trying to handle.
- `file` is a single URL string, not an array.
- No `createdAt`, no `createdBy`, no `position` (order is implicit in array index).
- `comments` and `activities` are both embedded — growing boards grow the document unboundedly.

`frontend/src/services/local-board.service.js` defines a different `getEmptyTask` with a different field set. That file is **unused** but creates documentation drift and a trap if someone wires it back in.

## Comment shape

```js
{
  id: string,
  by: { _id, fullname, imgUrl },
  txt: string,
  createdAt: number,
  style: object,   // CSS style object applied in CommentPreview
}
```

`style` is passed directly to React `style=` — user-controlled CSS. Low XSS risk since React rejects string `style` values, but sanitizing the object keys is still prudent.

## Activity shape

From `board.service.getEmptyActivity()`:

```js
{
  id: string,
  action: string,                      // e.g. 'status changed'
  createdAt: number,
  byMember: { _id, fullname, imgUrl },
  task: { id, title },
  from: any,
  to: any,
}
```

`activities` is capped at 30 in `addActivity`. Older entries are lost. No pagination.

## User document shape

From `backend/api/user/user.service.js` and `auth.service.signup`:

```js
{
  _id: ObjectId,
  username: string,       // for Google users this is set to email
  password: string | null,  // bcrypt hash, or null for Google-only accounts
  fullname: string,
  imgUrl: string,
  email: string,          // present on Google accounts
  googleId: string,       // present on Google accounts
  isAdmin?: boolean,      // not set by signup, must be edited in DB
  score?: number,         // referenced by `query(minBalance)` filter but never written
}
```

No `createdAt` (though `query()` computes it from `ObjectId.getTimestamp()`).
No `updatedAt`, no `lastLoginAt`, no `disabled` flag, no email verification state.

## API surface

### Board

| Method | Path | Payload | Returns |
|--------|------|---------|---------|
| GET | `/api/board` | `?title=&isStarred=` | `Board[]` |
| GET | `/api/board/:boardId` | — | `Board` (missing `await` bug; see [02-backend.md](02-backend.md)) |
| POST | `/api/board` | `Board` | `Board` (with `_id`) |
| PUT | `/api/board/:boardId` | full `Board` | `Board` |
| PUT | `/api/board/:boardId/:groupId` | `Group` | `Board` |
| PUT | `/api/board/:boardId/:groupId/:taskId` | `Task` | `Board` |
| DELETE | `/api/board/:boardId` | — | `boardId` |

All PUT endpoints do **read-modify-write on the whole document**. No array operators. No optimistic concurrency.

### User / auth

| Method | Path | Payload | Notes |
|--------|------|---------|-------|
| GET | `/api/user` | `?txt=&minBalance=` | No auth |
| GET | `/api/user/:id` | — | No auth |
| PUT | `/api/user/:id` | user | `requireAuth`; password overwrite bug |
| DELETE | `/api/user/:id` | — | `requireAuth` + `requireAdmin` |
| POST | `/api/auth/signup` | `{username, password, fullname, imgUrl}` | Hashes password |
| POST | `/api/auth/login` | `{username, password}` | **Password ignored** |
| POST | `/api/auth/google` | `{credential}` | Verifies ID token |
| POST | `/api/auth/logout` | — | Clears cookie |

### Socket events

| Direction | Event | Payload | Notes |
|-----------|-------|---------|-------|
| C→S | `chat-set-topic` | string | Joins room (no ACL) |
| C→S | `set-user-socket` | userId | Unverified |
| C→S | `unset-user-socket` | — | |
| C→S | `chat-send-msg` | comment | Broadcast to current topic |
| S→C | `chat-add-msg` | comment | |
| C→S | `board-send-update` | `{filteredBoard, board}` | Broadcast to current topic |
| S→C | `board-add-update` | `{filteredBoard, board}` | Unreserved — peer pushes full board state |

## Concurrency implications of the embedded-document model

- **Lost updates**: user A and user B both fetch board (state N), each edits a different task, each PUT-replaces the whole board. Whoever writes second overwrites the other's change. No `updatedAt`/`version` check.
- **Unbounded growth**: every comment, activity, task, and group is inside the same document. MongoDB caps documents at 16 MB; a very active board will hit that eventually.
- **Heavy writes**: every tiny UI change (rename a label, toggle a checkbox) rewrites the entire document over the wire and on disk.

### Quick remediation (if staying on MongoDB)

- Add `updatedAt: Date` to boards. Include it in the PUT payload and in the `updateOne` filter (`{ _id, updatedAt }`). If no doc matched, return 409 Conflict.
- Replace `updateTask` / `updateGroup` read-modify-write with positional array operators:
  ```js
  collection.updateOne(
    { _id, 'groups.id': groupId, 'groups.tasks.id': taskId },
    { $set: { 'groups.$[g].tasks.$[t]': saveTask, updatedAt: new Date() } },
    { arrayFilters: [{ 'g.id': groupId }, { 't.id': taskId }] }
  )
  ```
  (Requires MongoDB 3.6+ and driver 3.6+; current driver 3.2.7 is borderline.)
- Move `comments` and `activities` to separate collections when growth becomes a problem.

### Structural remediation (if migrating to a relational store)

See [10-supabase-migration.md](10-supabase-migration.md) for a full Supabase/Postgres migration analysis.
