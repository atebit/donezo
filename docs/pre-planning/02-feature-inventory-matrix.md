# Feature Inventory Matrix (Minimal Monday Clone)

Legend:

- **E2E**: implemented end-to-end (UI + API + persistence)
- **Partial**: some parts exist, but incomplete / brittle
- **Missing**: not present

## Core navigation & pages

- **Landing page (`/`)**: **E2E**
  - Loads boards list and offers “get started” into first board.
- **Board details (`/board/:boardId`)**: **E2E**
  - Loads board, users; renders board table view.
- **Task modal route (`/board/:boardId/:groupId/:taskId`)**: **E2E (likely)**
  - Implemented via `BoardModal` which reads route params and shows `TaskModal`.
  - `TaskModal` implementation not reviewed in detail yet, but wiring is present.
- **Dashboard view (chart page inside board)**: **E2E**
  - `Dashboard` renders label/member charts.

## Boards

- **List boards**: **E2E**
  - `GET /api/board` + `boardService.query`.
- **Create board**: **E2E**
  - `POST /api/board`.
- **Update board**: **E2E**
  - Full-document update: `PUT /api/board/:boardId`.
- **Delete board**: **E2E**
  - `DELETE /api/board/:boardId`.
- **Star board**: **E2E**
  - Toggles `isStarred` and reloads list based on `isStarred` filter.

## Groups

- **Add group**: **E2E**
  - Client adds embedded group, saves board.
- **Rename group**: **E2E**
  - ContentEditable title, on blur triggers `updateGroupAction`.
- **Duplicate group**: **E2E**
  - Clones group and saves board.
- **Delete group**: **E2E**
  - Removes group and saves board.
- **Reorder groups (DnD)**: **E2E**
  - Reorders group array and saves board.
- **Group color palette**: **Partial**
  - UI and modal exist, but palette wiring was not fully inspected.

## Tasks

- **Add task**: **E2E**
  - Adds to group.tasks and persists.
- **Rename task**: **E2E**
  - ContentEditable and `updateTaskAction`.
- **Duplicate task**: **E2E**
- **Delete task**: **E2E**
- **Create new task below**: **E2E**
- **Reorder tasks within group (DnD)**: **E2E**
- **Move tasks across groups (DnD)**: **E2E**
  - Uses optimistic update then `saveBoard`.
- **Bulk selection + task tools bar**: **Partial**
  - Selection state exists; task tools modal exists; feature depth not fully reviewed.

## Columns / board “cmpsOrder” system

The board stores `cmpsOrder` and `cmpsOption` and the UI renders “dynamic” per-row columns.

- **Status column**: **E2E**
  - `StatusPicker` uses `board.labels` and updates `task.status`.
- **Priority column**: **Partial**
  - UI exists (`PriorityPicker` updates `task.priority`).
  - Uses the same `board.labels` list as status (no separate priority label set).
  - Board creation defaults show “High Priority / Medium Priority …” inside `labels`, which blurs status vs priority.
- **Person column**: **E2E**
  - `MemberPicker` edits `task.memberIds` via member modal.
- **Date column**: **E2E**
  - `DueDate` writes epoch time to `task.dueDate`.
- **Numbers column**: **E2E**
  - `NumberPicker` writes `task.number`.
- **Files column**: **Partial**
  - Upload via Cloudinary works in principle.
  - Hardcoded cloud/preset; no auth; no activity logging.
- **Updated column**: **Partial**
  - Display-only. Updated-by info is written during many updates, but consistency is not enforced.
- **Checkbox column**: **Missing/Partial**
  - Add-column modal lists `checkbox-picker`, but `TaskPreview.DynamicCmp` has no case for it.

### Add/remove columns

- **Add column**: **E2E**
  - Adds to `board.cmpsOrder` and saves board.
- **Remove column**: **E2E**
  - Removes from `board.cmpsOrder` and saves board.
- **Rename column**: **Missing**
  - UI mentions rename but not implemented.

## Filtering

- **Filter by task title**: **E2E**
  - Uses URL search params and `boardService.getFilteredBoard`.
- **Filter by member**: **E2E**
  - Filters tasks by `memberIds.includes(memberId)`.

## Activity log

- **Capture activity items**: **Partial**
  - `addActivity` exists and is invoked in several places.
  - Not all updates produce activities (e.g. file upload doesn’t).
- **Board activity modal**: **Partial/E2E**
  - Modal wiring exists (`/board/:boardId/:activityLog`), but deeper UX wasn’t fully reviewed.

## Realtime collaboration

- **Realtime board updates via Socket.IO**: **E2E**
  - Emits `board-send-update`, broadcasts to topic room.
  - UI listens for `board-add-update`.

## Auth & users

- **Signup**: **E2E (API + UI)**
  - Creates user, sets login cookie.
- **Login**: **Partial (bug)**
  - Backend login does **not** verify password (no bcrypt compare).
- **Logout**: **E2E**
- **Google login**: **Partial**
  - Frontend obtains user profile; then uses existing signup/login endpoints.
  - Uses `credentials.id` as password (may be unstable).
- **Users list**: **E2E**
  - `GET /api/user`.
- **Authorization/permissions**: **Missing**
  - Board routes do not require auth; guest mode is enabled.

## Multi-tenant / Workspaces

- **Workspaces**: **Missing (product sense)**
  - UI has “WorkspaceSidebar” concept, but persistence model is board-centric.

## Testing

- **Unit tests**: **Partial**
  - Some tests exist under `frontend/src/test/`, but coverage is minimal.
- **Backend tests**: **Missing**

