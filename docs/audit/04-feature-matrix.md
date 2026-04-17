# Feature Completeness Matrix

Legend — **E2E**: implemented end-to-end (UI + API + persistence). **Partial**: some parts exist but incomplete or brittle. **Missing**: not present.

Evidence cites file paths in `frontend/src/` or `backend/`.

## Auth & users

| Feature | State | Evidence / gap |
|---------|-------|----------------|
| Email/password signup | Partial | Backend signup works (`auth.service.js:28-39`). **Frontend has no form** — `pages/login-signup.jsx` only renders `GoogleLogin`. |
| Email/password login | Partial | UI missing + **backend doesn't verify password** (`auth.service.js:18-25`). Critical bug. |
| Google login | E2E | `login-signup.jsx` → `userService.googleLogin` → `POST /api/auth/google` → `verifyIdToken` + `upsertGoogleUser`. Landed in recent commit. |
| Logout | E2E | `user.actions.logout()` → `POST /api/auth/logout` clears cookie; frontend clears `sessionStorage`. |
| Session persistence via cookie | Partial | Cookie is set server-side, but the frontend relies on `sessionStorage` for the `user` slice — hard refresh with cleared session storage looks logged out. No `/api/auth/me` endpoint to rehydrate. |
| User profile edit | Partial | Backend `PUT /api/user/:id` exists (with `requireAuth`). **No frontend page**. Also has the raw-password-overwrite bug. |
| Avatar upload | Partial | `ImgUploader` component exists and uses Cloudinary; only wired into the unfinished login flow. No post-auth profile editor. |
| User list / directory | E2E | `GET /api/user` → Redux `loadUsers()`. Consumed by `ModalMemberInvite`. No dedicated page. |

## Boards

| Feature | State | Evidence / gap |
|---------|-------|----------------|
| List boards | E2E | `GET /api/board` + `boardService.query`. |
| Create board | E2E | `POST /api/board` via `saveBoard`. `CreateBoard` modal. |
| Rename board | E2E | contenteditable title in `board-header.jsx` → `saveBoard`. |
| Delete board | E2E | `removeBoard` → `DELETE /api/board/:id`. |
| Duplicate board | Missing | No action, no endpoint, no UI. |
| Star / unstar | E2E | `toggleStarred` flips flag + reloads list. |
| Board description | E2E | `BoardDescription` + `board.description` field. |
| Board members (add/remove) | E2E | `ModalMemberInvite` manipulates `board.members` via `saveBoard`. No actual invite email, but in-app membership persists. |
| Board permissions / access control | Missing | No role system. Every authenticated (or guest) user can read/edit every board. |
| Workspaces (multi-tenant) | Missing | `WorkspaceSidebar` is cosmetic — every board is global in the DB. |

## Groups

| Feature | State | Evidence / gap |
|---------|-------|----------------|
| Add group | E2E | `addGroup` thunk unshifts a new group and saves. |
| Rename group | E2E | `updateGroupAction` → `PUT /api/board/:boardId/:groupId`. |
| Delete group | E2E | `updateGroups` filters by id + saves. |
| Duplicate group | E2E | `duplicateGroup` clones with new id. |
| Reorder (DnD) | E2E | `handleOnDragEnd` with `type: 'group'` reorders the array. |
| Group color picker | E2E | `ColorPalette` writes `group.color`. |
| Collapse / expand | Missing | No state, no UI. |

## Tasks

| Feature | State | Evidence / gap |
|---------|-------|----------------|
| Add task | E2E | `addTask` / `addTaskOnFirstGroup`. |
| Rename task | E2E | contenteditable title → `updateTaskAction`. |
| Delete task | E2E | Via `TaskMenuModal`. |
| Duplicate task | E2E | `duplicateTask` appends `(copy)`. |
| Reorder within group | E2E | `handleOnDragEnd` with `type: 'task'`. |
| Move across groups | E2E | Same handler, detects cross-group drag. |
| Bulk selection + actions | Missing | Checkbox exists in `TaskPreview`; no bulk-action menu or batch endpoint. |
| Task modal via route | E2E | `/board/:boardId/:groupId/:taskId` → `BoardModal` → `TaskModal`. |
| Comments | E2E | `task.comments[]`, add/edit/delete via `CommentPreview`, socket fan-out. |
| Attachments | Partial | Single `task.file`. No multi-file UI. No activity log entry when a file is uploaded. |

## Columns (`cmpsOrder` dynamic pickers)

| Feature | State | Evidence / gap |
|---------|-------|----------------|
| Status column | E2E | `StatusPicker` reads `board.statusLabels`. |
| Priority column | E2E | `PriorityPicker` reads `board.priorityLabels`. Labels are editable via `ModalStatusPriority`. (Note: original codebase used a single `labels` list — separation has landed since.) |
| Person column | E2E | `MemberPicker` multi-select. |
| Date column | E2E | `DueDate` picker writes `task.dueDate`. |
| Number column | E2E | `NumberPicker` writes `task.number`. |
| File column | Partial | `FilePicker` uploads to Cloudinary; single file only. No activity log entry. |
| Checkbox column | E2E | `CheckboxPicker` wired in `TaskPreview.DynamicCmp` (verified at `task-preview.jsx:143-144`). |
| Updated-by column | E2E | `UpdatedPicker` shows `task.updatedBy.date` written on most updates. |
| Text column | Missing | Referenced in seed but no picker. |
| Timeline column | Missing | |
| Rating column | Missing | |
| Add column | E2E | `AddColumnModal` pushes to `cmpsOrder`. |
| Remove column | Partial | `RemoveColumnModal` exists; top-of-file TODO mentions rename should be bundled in. |
| Rename column | Missing | |
| Reorder column | Partial | `updatePickerCmpsOrder` exists; no DnD UI affordance. |

## Filtering / sorting / search

| Feature | State | Evidence / gap |
|---------|-------|----------------|
| Search by task title | E2E | `BoardFilter` + `getFilteredBoard`. |
| Filter by member | E2E | `BoardFilter` + member modal. |
| Filter by status / priority / date | Missing | No UI filter. |
| Sort tasks | Missing | No sort controls. |
| Global search across boards | Missing | |

## Activity log

| Feature | State | Evidence / gap |
|---------|-------|----------------|
| Task status change | E2E | `StatusPicker` passes `activity` to `updateTask`. |
| Task add | Partial | Activity is created in `addTask`. |
| Task rename | Partial | `onUpdateTaskTitle` calls `updateTaskAction` without an activity arg. |
| Task delete / duplicate / move | Missing | No activity emitted. |
| Group rename / color change / add / delete | Missing | |
| Column add / remove / reorder | Missing | |
| File upload | Missing | |
| Member add / remove | Missing | |
| Board activity modal | E2E | `BoardActivityModal` renders `board.activities`. |
| Task activity modal | E2E | `TaskModal` filters board activities by task id. |
| Activity cap (30) | Present | Enforced in `addActivity`. |

## Dashboard / views

| Feature | State | Evidence / gap |
|---------|-------|----------------|
| Chart dashboard | E2E | `LabelChart` + `MemberChart`. Chart type toggle via modal. |
| Kanban view | **Implemented but not wired** | All kanban components exist; `pages/board-details.jsx` comments out the render branch. Flipping `boardType` in state does nothing. |
| Timeline / Gantt | Missing | Only referenced in marketing copy. |
| Calendar | Missing | |
| Form view, gallery view, etc. | Missing | |

## Realtime

| Feature | State | Evidence / gap |
|---------|-------|----------------|
| Board update broadcast | E2E | `board-send-update` / `board-add-update`. |
| Task comment broadcast | E2E | `chat-send-msg` / `chat-add-msg` per-task topic. |
| Presence / cursors | Missing | `SOCKET_EMIT_USER_WATCH` constant exists but unused. |
| Typing indicators | Missing | |
| Conflict-free concurrent edit | Missing | Last-write-wins, full-board rewrite. See [06-data-model.md](06-data-model.md). |

## Notifications

| Feature | State | Evidence / gap |
|---------|-------|----------------|
| In-app notifications | Missing | No notification center. |
| Toasts for errors | Missing | Errors go to console only. |
| Email notifications | Missing | No email provider. |
| @mentions | Missing | No mention detection in comments. |

## Mobile

| Feature | State | Evidence / gap |
|---------|-------|----------------|
| Responsive layouts | Partial | Breakpoints defined (`setup/_variables.scss`). Not systematically tested. |
| Mobile-specific components | Missing | No drawer, no swipe gestures, no bottom sheet. |
| Touch DnD | Likely broken | `react-beautiful-dnd` has known touch-handling issues and is abandoned. |

## Observability / ops

| Feature | State | Evidence / gap |
|---------|-------|----------------|
| Error reporting (Sentry, etc.) | Missing | |
| Structured logging | Missing | `logger.service.js` is console-based; NODE_ENV typo disables the one gate. |
| Rate limiting | Missing | |
| Audit trail beyond activities | Missing | |
| CI | Missing | No `.github/workflows`. |
| Deployment config | Missing | No Dockerfile, no Procfile, no infra. README references a Netlify URL that isn't live. |

## Net completeness vs. "full-featured monday clone"

Ballpark: **~55% functionally, ~35% production-ready.** The UX core is there; everything around auth, permissions, multi-tenant, ops, and non-table views needs building.
