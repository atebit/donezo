# Architecture & Runtime (Donezo)

## Repo layout

- `frontend/`
  - Create React App (CRA) React 18 app.
  - Redux store + thunk.
  - Socket.IO client for realtime.
  - Drag and drop via `react-beautiful-dnd`.
- `backend/`
  - Express server + Socket.IO.
  - MongoDB via the **native driver** (`mongodb`), not Mongoose models.
  - REST API under `/api/*`.
  - Serves static frontend build from `backend/public/` in production.
- `docs/`
  - Currently empty except for this pre-planning output.

## Frontend runtime

### Entry points

- `frontend/src/index.js`
  - Wraps app with:
    - `GoogleOAuthProvider` (client id is currently hardcoded)
    - Redux `Provider`
    - `BrowserRouter`
    - Registers a service worker.

- `frontend/src/root-cmp.jsx`
  - Routes:
    - `/` → `HomePage`
    - `/board/:boardId/` → `BoardDetails`
    - `/board/:boardId/:groupId/:taskId` → `BoardDetails` (opens task modal via route params)
    - `/board/:boardId/:activityLog` → `BoardDetails` (board activity log modal)
    - `/auth/login` + `/auth/signup` → `LoginSignup`

### Data flow

- Board page (`pages/board-details.jsx`):
  - Loads board via `loadBoard(boardId, queryFilterBy)`.
  - Loads all users via `loadUsers()`.
  - Loads boards list via `loadBoards()`.
  - Subscribes to Socket.IO topic `boardId` and listens for `board-add-update`.

### HTTP client

- `frontend/src/services/http.service.js`
  - Uses Axios with `withCredentials: true`.
  - Base URL:
    - dev: `//localhost:3030/api/`
    - prod: `/api/`

### Realtime

- `frontend/src/services/socket.service.js`
  - Dev socket base: `//localhost:3030`
  - Uses event names:
    - set topic: `chat-set-topic`
    - broadcast updates: `board-send-update` / `board-add-update`

## Backend runtime

### Entry points

- `backend/server.js`
  - Express JSON + cookies.
  - Dev CORS allowed origins: `http://127.0.0.1:3000`, `http://localhost:3000`.
  - Registers ALS middleware across all routes (`setupAls.middleware`).
  - Routes:
    - `/api/auth`
    - `/api/user`
    - `/api/board`
  - Socket.IO server setup via `services/socket.service.js`.

### Config

- `backend/config/index.js` selects `dev.js` or `prod.js`.
- `config.isGuestMode = true` is currently always set.
- `dev.js` / `prod.js` contain a **hardcoded MongoDB Atlas URI and credentials**.
  - This should be moved to environment variables.

### Persistence

- `backend/services/db.service.js`
  - Uses `MongoClient.connect(config.dbURL)` and `db.collection(name)`.
  - Collections observed:
    - `board`
    - `user`

### Auth/session

- Cookie token:
  - `auth.controller.js` sets `loginToken` cookie with `{ sameSite: 'None', secure: true }`.
- ALS:
  - `setupAls.middleware.js` reads the cookie and calls `authService.validateToken`.
  - Stores `loggedinUser` on ALS store.
- Authorization:
  - `requireAuth.middleware.js` checks ALS store.
  - If `config.isGuestMode === true` and there is no logged-in user, it sets guest user and allows the request.
  - Board routes currently **do not** enable `requireAuth` (commented out in `board.routes.js`).

### Socket.IO server

- `backend/services/socket.service.js`
  - Uses rooms based on topic from `chat-set-topic`.
  - Broadcasts `board-add-update` to the topic room when it receives `board-send-update`.

## Board domain shape (current)

Boards are stored as a single MongoDB document with nested arrays.

- Board fields seen in frontend services:
  - `_id`, `title`, `isStarred`, `description`
  - `labels` (used by status/priority)
  - `members` (board members)
  - `groups[]` (embedded)
  - `activities[]` (embedded)
  - `cmpsOrder[]` and `cmpsOption[]` (column system)

- Group fields:
  - `id` (string), `title`, `color`, `tasks[]`

- Task fields (varies by source, but UI expects):
  - `id`, `title`
  - `status`, `priority`, `memberIds`, `dueDate`
  - `comments[]`
  - `number`, `file`, `updatedBy` (at least `{imgUrl, date}`)

### Board API surface

- `GET /api/board` (query by title + `isStarred`)
- `GET /api/board/:boardId`
- `POST /api/board`
- `PUT /api/board/:boardId` (full-board update)
- `PUT /api/board/:boardId/:groupId` (update group)
- `PUT /api/board/:boardId/:groupId/:taskId` (update task)
- `DELETE /api/board/:boardId`

## How to run locally (current vs actual)

### README expectation

Root `README.md` instructs:

- Backend:
  - `cd backend && npm i && npm start`
- Frontend:
  - `cd frontend && npm i && npm start`

### What the code actually provides

- `frontend/package.json` has a `start` script (CRA).
- `backend/package.json` **does not** currently define `start` / `dev` scripts (only `seed:user`).
  - So local run requires invoking node directly (e.g. `node server.js`) or adding scripts.

## Notes on hardcoded external integrations

- Google OAuth client id is hardcoded in `frontend/src/index.js`.
- Cloudinary upload preset + cloud name are hardcoded in `frontend/src/services/upload.service.js`.

These should be moved to runtime config (env vars) for a clean deploy workflow.
