# Frontend Audit

Scope: everything under `/frontend/src`.

## Entry & routing

- `src/index.js` — wraps app with `GoogleOAuthProvider` → Redux `Provider` → `BrowserRouter` → `RootCmp`. Registers service worker. Google client id from `process.env.REACT_APP_GOOGLE_CLIENT_ID` with hardcoded fallback.
- `src/root-cmp.jsx` — **redundantly** re-wraps `<Provider store={store}>` around `<Routes>`. Harmless but wrong.

### Routes

| Path | Component | Notes |
|------|-----------|-------|
| `/` | `HomePage` | Landing, CTA into first board |
| `/board/:boardId/` | `BoardDetails` | Table view |
| `/board/:boardId/:groupId/:taskId` | `BoardDetails` | Also opens `TaskModal` via route params |
| `/board/:boardId/:activityLog` | `BoardDetails` | Also opens `BoardActivityModal` |
| `/auth/login` | `LoginSignup` | Google-only login |
| `/auth/signup` | `LoginSignup` | Same component — no separate signup UI |

## Pages

### `pages/home-page.jsx`
- Mounts `HomeHeader`, `HomeTeaser`, `HomeScreenShot`, `StartedButton`.
- Calls `loadBoards()` on mount. CTA navigates to `/board/<firstBoardId>`.

### `pages/board-details.jsx`
- Core work surface. Loads board + users + boards.
- Subscribes to `SOCKET_EMIT_SET_TOPIC` with boardId; listens for `SOCKET_EVENT_ADD_UPDATE_BOARD` → `loadSocketBoard(...)`.
- Has five local `useState` flags for modals (`isCreateModalOpen`, `isShowDescription`, `isInviteModalOpen`, `isLoginModalOpen`, `isStarredOpen`) — inconsistent with Redux `dynamicModalObj` used elsewhere.
- `isStarredOpen` has a setter that is never called.
- `GroupListKanban` is imported but the render branch is commented out (lines ~73-74). The Kanban code path exists but is not reachable from the UI.

### `pages/dashboard.jsx`
- 16 lines. Renders `LabelChart` + `MemberChart`. Chart type switch handled via `ChartTypeModal` + `dynamicModalObj`.

### `pages/login-signup.jsx`
- Google login only. Renders `GoogleLogin` button from `@react-oauth/google`, sends the `credential` to `userService.googleLogin`, then navigates to the first board.
- Three TODO comments about fixing headers/labels/image uploader.

## Component inventory

Rough tree (paths relative to `src/cmps/`):

| Area | Files | Notes |
|------|-------|-------|
| `sidebar/` | `main-sidebar`, `workspace-sidebar`, `workspace-icon`, `workspace/workspace-board`, `workspace/workspace-favorite` | Left rail + workspace board list |
| `board/` | `group-list`, `group-preview`, `title-group-preview`, `statistics-group`, `board-header`, `board-filter`, `board-preview`, `board-modal`, `board-activity-modal`, `board-description` | Board surface |
| `kanban/` | `group-list-kanban`, `group-preview-kanban`, `task-list-kanban`, `task-preview-kanban`, `task-title-kanban` | Kanban view — implemented but not routed into the UI |
| `task/` | `task-preview`, `status-picker`, `priority-picker`, `member-picker`, `date-picker`, `file-picker`, `number-picker`, `checkbox-picker`, `updated-picker`, `comment-preview` | Row + column pickers. Checkbox is wired in `TaskPreview.DynamicCmp` (verified) |
| `modal/` | `task-modal`, `dynamic-modal`, `task-menu-modal`, `task-tools-modal`, `board-menu-modal`, `group-menu-modal`, `add-group-modal`, `add-column-modal`, `remove-column-modal`, `create-board`, `modal-member`, `modal-member-invite`, `modal-status-priority`, `member-filter-modal`, `chart-type-modal`, `modal-comment`, `login-logout-modal` | Modal routing via `DynamicModal` type dispatch |
| `chart/` | `member-chart`, `label-chart` | `react-chartjs-2` pies/bars/doughnuts |
| `home/` | `home-header`, `home-teaser`, `home-screenshots` | Landing |
| `custom/` | `getstarted-btn` | Landing CTA |
| `login/` | `login-page-header`, `img-uploader` | `img-uploader` is marked TODO "fix all" |
| Root `cmps/` | `color-palette`, `activity-preview`, `last-viewed`, `loader`, `logo` | Shared |

## State management

### Store — `store/store.js`
- `combineReducers({ boardModule, userModule })` + `applyMiddleware(thunk)` via `legacy_createStore`.
- Redux DevTools wired.
- **`system.reducer` exists but is never combined**. `LOADING_START` / `LOADING_DONE` are dispatched in `user.actions.js` but no reducer is subscribed. There is no loading indicator in the store.

### Board slice — `store/board.reducer.js`
State shape:
```js
{
  boards: [],
  filteredBoard: null,
  board: null,
  isBoardModalOpen: false,
  dynamicModalObj: { isOpen: false, pos: {x:'',y:''}, type: '' },
  filter: { title: '', memberId: '' },
}
```
- Actions: `SET_BOARDS`, `SET_BOARD`, `SET_FILTER_BOARD`, `SET_FILTER`, `ADD_BOARD`, `UPDATE_BOARD`, `REMOVE_BOARD`, `ADD_GROUP`, `REMOVE_GROUP`, `SET_MODAL`, `SET_DYNAMIC_MODAL`.
- `UPDATE_BOARD` has label-rename cascading logic (rewrites `task.status` / `task.priority` across all tasks). Line ~56 uses `==` instead of `===` (loose equality).

### Board actions — `store/board.actions.js`
Big file (~360 lines). Public surface:
- `loadBoards(filter)`, `loadBoard(boardId, filterBy)`, `loadSocketBoard(filteredBoard, board)`
- `saveBoard(board)`, `removeBoard(boardId)`
- `addGroup`, `updateGroups` (delete), `updateGroupAction`, `duplicateGroup`
- `addTask`, `addTaskOnFirstGroup`, `updateTaskAction`, `duplicateTask`
- `addActivity`, `toggleStarred`, `updateBoardAction` (label updates), `handleOnDragEnd`
- `updatePickerCmpsOrder` (column reorder)
- UI helpers: `setFilter`, `setDynamicModalObj`, `closeDynamicModal`, `toggleModal`

After most write actions, the thunk also emits `SOCKET_EMIT_SEND_UPDATE_BOARD` with `{filteredBoard, board}` so peer clients pick it up.

### User slice — `store/user.reducer.js`, `store/user.actions.js`
- State: `{ user, users, watchedUser }`. `watchedUser` is never read.
- Actions: `loadUsers`, `login`, `googleLogin`, `signup`, `logout`, `removeUser` (marked `TODO:REMOVE THIS`).
- `user` is hydrated from `sessionStorage` via `userService.getLoggedinUser()` on boot. Hard refresh with a live cookie but cleared sessionStorage would look "logged out" on the frontend even though the server-side session cookie is still valid.

## Services

| File | Purpose |
|------|---------|
| `http.service.js` | Axios wrapper. Base URL: `//localhost:3030/api/` (dev) or `/api/` (prod). `withCredentials: true`. 401 → clear sessionStorage. 500 → `window.location.assign('/')`. |
| `board.service.js` | CRUD + helpers. Exports `getDefaultFilterBoard`, `getFilteredBoard` (client-side filter), `getEmptyGroup/Task/Board/Comment/Activity`. |
| `user.service.js` | CRUD + `login/googleLogin/signup/logout`. `saveLocalUser` writes a minimal `{_id, fullname, imgUrl}` to `sessionStorage`. |
| `socket.service.js` | Wraps `socket.io-client`. Exports event constants + `on/off/emit/login/logout/terminate`. |
| `upload.service.js` | Cloudinary upload. **Hardcoded cloud name + unsigned preset**. |
| `util.service.js` | `makeId`, `makeLorem`, `debounce`, storage wrappers, `calculateTime` (relative time), color palette. |
| `async-storage.service.js` | Present but not imported anywhere. Dead. |
| `local-board.service.js` | Present but not imported anywhere. Dead (but contains a different `getEmptyTask` shape that conflicts with the one in use). |

## Realtime wiring

| Surface | Emit | Listen | Effect |
|---------|------|--------|--------|
| Board updates | `SOCKET_EMIT_SEND_UPDATE_BOARD` (after writes) | `SOCKET_EVENT_ADD_UPDATE_BOARD` (in `BoardDetails`) | Dispatches `loadSocketBoard()` which replaces Redux state |
| Topic switch | `SOCKET_EMIT_SET_TOPIC` (boardId on mount, taskId when modal opens) | n/a | Server joins the socket into that room |
| Comments | `SOCKET_EMIT_SEND_MSG` | `SOCKET_EVENT_ADD_MSG` (in `TaskModal`) | Adds comment locally |
| Presence (`SOCKET_EMIT_USER_WATCH`) | Exported but unused in code | n/a | Dead constant |

Known fragility: no conflict resolution. `loadSocketBoard` blindly overwrites Redux state with whatever the peer just wrote.

## Styling

- Entry: `assets/styles/main.scss`.
- `setup/_variables.scss` — color tokens (status/priority palette, home gradients), spacing (xs–xxxl), typography (Figtree/Roboto/Rubik/Poppins), breakpoints (460/720/960).
- `setup/_mixins.scss`, `setup/_functions.scss`, `setup/_fonts.scss`.
- `basics/` — layout utilities, typography.
- `views/` — page-level styles.
- `cmps/` — 45+ component-scoped SCSS files, one per cmp group.
- No dark mode. No theming.

## Tests

Two files under `src/test/`:
- `user.reducer.test.js` — initial state + `SET_USER` action.
- `statistics.test.js` — `StatisticGroup` component render cases.

Nothing else. No service tests, no action tests, no component tests beyond the one above. Coverage is effectively ~5%.

## Frontend bugs & dead code

1. `cmps/board/board-activity-modal.jsx:49` — `task.id = taskId` (assignment in a `.some()` callback) instead of `===`. The predicate always returns truthy on the last element.
2. `store/board.reducer.js:~56` — loose `==` in label-rename cascade.
3. `store/system.reducer.js` — not combined into the root reducer. All `LOADING_START` / `LOADING_DONE` dispatches are no-ops.
4. `root-cmp.jsx` — redundant `<Provider>`.
5. `pages/board-details.jsx` — `isStarredOpen` declared but never updated.
6. `pages/board-details.jsx:~11, 73-74` — Kanban view imported and commented out in JSX. Five Kanban components effectively dead code.
7. `cmps/login/img-uploader.jsx` — top-of-file "TODO: fix all".
8. `services/async-storage.service.js`, `services/local-board.service.js` — unused.
9. `services/upload.service.js` — Cloudinary cloud name + unsigned preset hardcoded. Should come from env.
10. `index.js` — Google OAuth client id fallback is hardcoded.
11. Error handling is console-only throughout. No toasts, no retries, no user-visible errors on failed writes.
12. Form inputs have no validation (board title, group title, task title, comment text all accept empty/whitespace).
13. A11y: no ARIA labels on icon buttons, contenteditable blocks, modal focus traps. Color-only status indicators.
14. `TaskPreview` passes `isMainCheckbox` through but the parent never updates the flag.
