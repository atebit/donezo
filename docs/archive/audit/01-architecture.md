# Architecture & Runtime

## Repo layout

```
donezo/
├── backend/                  Express + MongoDB + Socket.IO
│   ├── api/                  Domain slices (auth, board, user)
│   │   ├── auth/             auth.controller.js, auth.service.js, auth.routes.js
│   │   ├── board/            board.controller.js, board.service.js, board.routes.js
│   │   └── user/             user.controller.js, user.service.js, user.routes.js
│   ├── config/               dev.js, prod.js, index.js  (selects by NODE_ENV)
│   ├── middlewares/          requireAuth.middleware.js, setupAls.middleware.js
│   ├── services/             db.service.js, socket.service.js, logger.service.js, als.service.js
│   ├── public/               production build target (CRA output copied here)
│   ├── scripts/              seed-user.js
│   └── server.js             Entry point
├── frontend/                 CRA React 18 + Redux + Socket.IO client
│   ├── public/               index.html, manifest, icons
│   └── src/
│       ├── pages/            home-page, board-details, dashboard, login-signup
│       ├── cmps/             Components grouped by domain (board/, task/, modal/, sidebar/, kanban/, chart/, home/, etc.)
│       ├── store/            Redux: board.reducer/actions, user.reducer/actions, system.reducer, store.js
│       ├── services/         http, board, user, socket, upload, util, async-storage, local-board
│       ├── assets/styles/    SCSS (setup/, basics/, views/, cmps/)
│       ├── test/             Two Jest test files (user reducer, statistics cmp)
│       ├── index.js          Entry — wraps Provider + GoogleOAuthProvider + BrowserRouter
│       └── root-cmp.jsx      Route definitions
└── docs/
    ├── pre-planning/         Earlier notes (partially stale)
    └── audit/                This audit
```

## Stack summary

| Concern | Choice |
|---------|--------|
| Frontend framework | Create React App (react-scripts 5) + React 18 |
| State | Redux (legacy_createStore) + redux-thunk |
| Routing | react-router-dom v6 |
| DnD | react-beautiful-dnd 13.1.1 (**abandoned**) |
| Styling | SCSS (no Tailwind, no CSS-in-JS) |
| Realtime | socket.io-client 4.2.0 / socket.io 4.2.0 |
| HTTP | axios 1.7.9 with `withCredentials: true` |
| Auth (frontend) | @react-oauth/google + sessionStorage for user |
| Backend framework | Express 4.17.1 |
| DB driver | `mongodb` 3.2.7 native driver (**v6 is current; v3 dates from 2018**). `mongoose` 8.9.6 is also declared but unused. |
| Auth (backend) | bcrypt + cryptr (symmetric token) + google-auth-library |
| Context propagation | Node `AsyncLocalStorage` (als.service.js) for `loggedinUser` |

## Runtime — frontend

- `src/index.js` wraps the app with `GoogleOAuthProvider`, Redux `Provider`, `BrowserRouter`, and registers a service worker. Client ID reads from `REACT_APP_GOOGLE_CLIENT_ID` with a hardcoded fallback.
- `src/root-cmp.jsx` defines routes. Note: this file re-wraps `<Provider>` around `<Routes>`, which is redundant (already wrapped in `index.js`) but harmless.
- `src/pages/board-details.jsx` is the main work surface. On mount it:
  - `loadBoard(boardId, filterBy)`
  - `loadUsers()`
  - `loadBoards()` (if not loaded)
  - Emits `SOCKET_EMIT_SET_TOPIC` with the boardId; listens for `SOCKET_EVENT_ADD_UPDATE_BOARD`.

### Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `HomePage` | Landing + board list CTA |
| `/board/:boardId/` | `BoardDetails` | Main board view (table) |
| `/board/:boardId/:groupId/:taskId` | `BoardDetails` | Same, with `TaskModal` overlay |
| `/board/:boardId/:activityLog` | `BoardDetails` | Same, with `BoardActivityModal` overlay |
| `/auth/login` | `LoginSignup` | Currently Google-only |
| `/auth/signup` | `LoginSignup` | Same component, same UI (no distinct signup form) |

### HTTP client

- `src/services/http.service.js`. Base URL: `//localhost:3030/api/` in dev, `/api/` in prod. `withCredentials: true`.
- Crude error handling: on 401 clears `sessionStorage`; on 500 calls `window.location.assign('/')`. No toast, no retry.

### Realtime

- `src/services/socket.service.js`. Connects to `//localhost:3030` in dev, same origin in prod.
- Event constants exported: `SOCKET_EVENT_ADD_UPDATE_BOARD`, `SOCKET_EMIT_SEND_UPDATE_BOARD`, `SOCKET_EMIT_SET_TOPIC`, `SOCKET_EVENT_ADD_MSG`, `SOCKET_EMIT_SEND_MSG`, `SOCKET_EMIT_USER_WATCH`.
- Board updates: `BoardDetails` subscribes to `SOCKET_EVENT_ADD_UPDATE_BOARD` and dispatches `loadSocketBoard()`.
- Comments: `TaskModal` subscribes per-task via `SOCKET_EMIT_SET_TOPIC` (taskId) + `SOCKET_EVENT_ADD_MSG`.

## Runtime — backend

- `backend/server.js` — Express + http.createServer wrapping Socket.IO. Port from `process.env.PORT` or 3030.
- Middleware order (top → bottom):
  1. `cookieParser()`
  2. `express.json()`
  3. Prod: static serve from `backend/public/`; Dev: CORS `[http://127.0.0.1:3000, http://localhost:3000]` with credentials
  4. `setupAsyncLocalStorage` on `app.all('*')` — reads `loginToken` cookie, populates ALS store
  5. Routes
- Routes mounted:
  - `/api/auth` → `auth.routes.js`
  - `/api/user` → `user.routes.js`
  - `/api/board` → `board.routes.js`

### AsyncLocalStorage middleware

Every request runs inside `asyncLocalStorage.run({}, ...)`. If `req.cookies.loginToken` decrypts, the `loggedinUser` is stored on the ALS store. Downstream handlers call `asyncLocalStorage.getStore().loggedinUser`.

### requireAuth

`backend/middlewares/requireAuth.middleware.js`. Two middlewares:
- `requireAuth` — if `config.isGuestMode` and no user, synthesizes `req.loggedinUser = { _id: '', fullname: 'Guest' }` and calls `next()`. Otherwise 401.
- `requireAdmin` — checks `loggedinUser.isAdmin`. No guest fallback.

`config.isGuestMode` is hardcoded `true` in `backend/config/index.js:8`. Cannot be disabled without a code change.

### Persistence

- `backend/services/db.service.js` — `MongoClient.connect(config.dbURL)`. Single cached `dbConn`. No connection pooling options, no graceful shutdown.
- Collections in use: `board`, `user`.
- Boards are a single monolithic document: groups and tasks are embedded arrays. Most updates are read-modify-full-write (see [06-data-model.md](06-data-model.md) for concurrency implications).
- `mongoose` is declared in `package.json` but **not imported anywhere**. Dead dependency.

### Socket.IO server

`backend/services/socket.service.js`:
- CORS `origin: '*'`.
- Events handled:
  - `chat-set-topic` — client picks a room (no authz check)
  - `chat-send-msg` / `chat-add-msg` — task comment fan-out
  - `board-send-update` / `board-add-update` — board fan-out
  - `set-user-socket` — stores `userId` on socket (no verification)
- No authentication on connection. No signed session.

## Configuration

- `backend/config/index.js` picks `dev.js` or `prod.js` by `NODE_ENV`, then unconditionally sets `config.isGuestMode = true`.
- Both `dev.js` and `prod.js` currently contain the same hardcoded Mongo URI.
- Env vars referenced:
  - Backend: `NODE_ENV`, `PORT`, `SECRET1`, `GOOGLE_CLIENT_ID`
  - Frontend: `REACT_APP_GOOGLE_CLIENT_ID`
- No `.env.example` in the repo. `.gitignore` does exclude `.env` / `backend/.env` / `frontend/.env`.

## How to run (actual, not README)

Frontend:
```bash
cd frontend
npm install
npm start            # CRA dev server on :3000
```

Backend (README says `npm start`, but the script doesn't exist):
```bash
cd backend
npm install
node server.js       # There is no "start" or "dev" script in package.json
# Optional:
npm run seed:user    # Creates an "admin"/"1234" user (no duplicate check)
```

Required env for Google login to work:
- Backend: `GOOGLE_CLIENT_ID`, `SECRET1`
- Frontend: `REACT_APP_GOOGLE_CLIENT_ID`

See [docs/pre-planning/05-google-login.md](../pre-planning/05-google-login.md) for setup notes.
