# Gaps, Bugs, and Technical Debt

A consolidated list of everything that isn't a pure security issue (those live in [05-security.md](05-security.md)). Grouped by severity.

## 🔴 Correctness bugs

1. **`board.service.getById` missing `await`** — `backend/api/board/board.service.js:22`. Returns the `findOne` Promise directly. Downstream `await`s rescue it but refactors or `.then` chains will break.
2. **`board-activity-modal.jsx:49` uses assignment in a `.some()` predicate** — `return group.tasks.some(task => task.id = taskId)`. Mutates the last task's id and always returns truthy. Activity filtering is effectively broken for task-scoped activities in this modal.
3. **Label cascade uses loose equality** — `store/board.reducer.js:~56`: `task.status == oldTitle`. Works by coincidence today but is a landmine.
4. **System reducer never combined** — `store/system.reducer.js` exists but is not in `combineReducers`. `LOADING_START`/`LOADING_DONE` are no-ops. No UI surface reads `isLoading`.
5. **`user.service.query` minBalance filters by `score`** — `backend/api/user/user.service.js:~22`. `score` is never written to user docs. Filter is inert.
6. **`user.service.getById` no null check** — dereferences `user.password` on a potentially null user. Crashes on unknown id instead of 404.
7. **`root-cmp.jsx` re-wraps `<Provider store={store}>`** — already wrapped in `index.js`. Redundant; risks nested-store confusion if someone uses a different store here.

## 🟠 Dead code / scope drift

8. **Kanban view is dead** — all five `cmps/kanban/*` components are imported but `board-details.jsx` comments out the render branch. Either delete or wire a view toggle.
9. **`services/async-storage.service.js`** — unused.
10. **`services/local-board.service.js`** — unused, and defines a `getEmptyTask` shape that conflicts with the real one. Delete to remove drift.
11. **`mongoose` dependency** — listed in `backend/package.json:21`; never imported. Either migrate to it (strong argument: schema validation) or drop it.
12. **`removeUser` action** — commented `TODO:REMOVE THIS` in `store/user.actions.js:20`.
13. **`watchedUser` in user reducer** — state field never read.
14. **`SOCKET_EMIT_USER_WATCH` constant** — exported, never used.
15. **Unused modal state flags** — `isStarredOpen` etc. in `pages/board-details.jsx`.

## 🟠 UX / robustness

16. **Error handling is console-only.** Every catch is `console.log(err)`. No toast, no retry, no "something went wrong" state. Users perceive silent failure.
17. **HTTP service redirects on 500.** `http.service.js` calls `window.location.assign('/')` on a 500. A single transient error blows away the user's unsaved modal state.
18. **Form inputs accept empty values.** Create group with blank title, blank task title, blank comment — all allowed. No trimming.
19. **contentEditable has no explicit undo/redo, no max length, no paste sanitization.**
20. **Modal focus isn't trapped.** Keyboard users can tab out of modals into the board behind them.
21. **No ARIA labels on icon-only buttons.**
22. **Color-only status/priority indicators.** A11y concern.
23. **No loading indicators on modal forms** (create board, add group). User clicks Save, nothing happens visibly until the socket echo.
24. **Double-dispatch risk on drag-end.** `handleOnDragEnd` does an optimistic local update and then persists. If persist fails silently (see #16) state drift across clients is opaque.

## 🟠 API/data shape drift

25. **Task references labels by title, not id.** `task.status = 'Working on it'` ties directly to `board.statusLabels[i].title`. Renaming requires cascade (and has the loose-equality bug).
26. **`cmpsOrder` mixes strings and objects.** Old data is `"status-picker"`; new code also supports `{id, type}`. Consumers must branch. Decide on one and migrate.
27. **`statusLabels` / `priorityLabels` may not exist on older board documents** — the upstream schema had a single `labels` array. If there's pre-existing data, status/priority pickers will render empty lists until migration.
28. **Task `id` is a client-generated `makeId(6)`.** Collision risk at scale. Either use `uuid` (already a dependency) or switch to server-issued ids.

## 🟡 Operational hygiene

29. **No `backend` start scripts.** `README.md` says `npm start` — that script doesn't exist.
30. **No `.env.example`.** New contributors can't know what to set.
31. **No Dockerfile / Compose.** Running locally requires Node + a writable Atlas cluster.
32. **No CI.** No lint, no tests, no type check.
33. **No deployment recipe.** README references a Netlify URL ("not avail yet"). Prod config in `config/prod.js` duplicates dev.
34. **`logger.service.js` typo `NODE_NEV`** — logger gate doesn't work as intended; debug logs run in all environments.
35. **`mongodb` driver 3.2.7** — 2018-era. Missing TLS improvements, modern aggregation, array operator ergonomics. (Also listed in security doc.)
36. **No tests on backend.** Zero.
37. **~5% frontend test coverage.** Two files, both shallow.

## 🟢 Polish / nits

38. **README typos** — "shuold" appears twice.
39. **Various TODO comments**:
    - `pages/login-signup.jsx:30-32` — change header, change label, fix image uploader.
    - `cmps/login/img-uploader.jsx` — "TODO: fix all".
    - `cmps/modal/remove-column-modal.jsx` — column rename should live here.
    - `store/board.reducer.js:52` — "may need dynamic cmpType".
40. **`getById` returns a board that doesn't strip internal fields** — fine today, but as richer user/membership data accumulates, whitelist before sending to client.
41. **Service worker is registered** but there's no offline strategy beyond Workbox defaults, and no update flow (skipWaiting is not wired).

## Compound risks

- **Auth bypass + guest mode + unauth board routes** — the three critical issues in [05-security.md](05-security.md) layer into "anyone on the internet can wipe all boards". Fixing any one is insufficient.
- **Full-doc write + no activity log for most operations + no `updatedAt`** — post-incident recovery is essentially "hope you have a recent Atlas backup". Worth enabling continuous backups even before product fixes.
- **Embedded-document growth + no pagination + abandoned DnD lib** — bigger boards will eventually hit both the Mongo 16 MB ceiling and DnD perf cliffs at the same time.
