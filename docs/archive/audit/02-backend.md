# Backend Audit

Scope: everything under `/backend`. Focus on behavior, correctness, and attack surface.

## Entry point — `backend/server.js`

- Creates an Express app wrapped in `http.createServer(app)` so Socket.IO can share the port.
- Middleware order (lines ~10–30):
  1. `cookieParser()`
  2. `express.json()`
  3. Prod branch: `express.static('./public')`. Dev branch: `cors({origin:['http://127.0.0.1:3000','http://localhost:3000'], credentials:true})`.
  4. `app.all('*', setupAsyncLocalStorage)` — registers ALS for every route.
  5. Routers mounted at `/api/auth`, `/api/user`, `/api/board`.
- Socket.IO registered via `setupSocketAPI(http)` from `services/socket.service.js`.
- Port: `process.env.PORT || 3030`.

**Issues**
- Prod has no CORS branch at all. Works if frontend is served from the same origin (which it is, from `public/`), but there's no safety net if the split ever changes.
- No `helmet`, no `compression`, no `express-rate-limit`.
- No error-handling middleware: uncaught rejections in route handlers will crash-log but the client gets no structured error.

## Routing map

| Path | Method | Handler | Auth required? |
|------|--------|---------|----------------|
| `/api/auth/login` | POST | `auth.controller.login` | No |
| `/api/auth/signup` | POST | `auth.controller.signup` | No |
| `/api/auth/google` | POST | `auth.controller.googleLogin` | No |
| `/api/auth/logout` | POST | `auth.controller.logout` | No |
| `/api/user` | GET | `user.controller.getUsers` | **No (commented)** |
| `/api/user/:id` | GET | `user.controller.getUser` | **No (commented)** |
| `/api/user/:id` | PUT | `user.controller.updateUser` | Yes |
| `/api/user/:id` | DELETE | `user.controller.deleteUser` | Yes + admin |
| `/api/board` | GET | `board.controller.getBoards` | **No (commented)** |
| `/api/board/:boardId` | GET | `board.controller.getBoardById` | **No (commented)** |
| `/api/board` | POST | `board.controller.addBoard` | **No (commented)** |
| `/api/board/:boardId` | PUT | `board.controller.updateBoard` | **No (commented)** |
| `/api/board/:boardId/:groupId` | PUT | `board.controller.updateGroup` | **No (commented)** |
| `/api/board/:boardId/:groupId/:taskId` | PUT | `board.controller.updateTask` | **No (commented)** |
| `/api/board/:boardId` | DELETE | `board.controller.removeBoard` | **No (commented)** |

Confirmed in `backend/api/board/board.routes.js:6` and `backend/api/user/user.routes.js:7` — both have `// router.use(requireAuth)` commented out. All board mutations are open.

## Auth

### Password login — **BROKEN**

[backend/api/auth/auth.service.js:18-25](backend/api/auth/auth.service.js):

```js
async function login(username, password) {
    logger.debug(`auth.service - login with username: ${username}`)
    const user = await userService.getByUsername(username)
    if (!user) return Promise.reject('Invalid username or password')
    delete user.password
    user._id = user._id.toString()
    return user
}
```

The `password` argument is never compared to `user.password`. Any password works. Signup correctly bcrypt-hashes, so the hash is in DB — login just ignores it.

**Fix**:
```js
const ok = await bcrypt.compare(password, user.password)
if (!ok) return Promise.reject('Invalid username or password')
```

### Signup — correct

`auth.service.js:28-39` validates required fields, rejects duplicate username, hashes with bcrypt saltRounds=10, and calls `userService.add` with the hashed password.

### Google login — correct

`auth.service.js:41-63` uses `google-auth-library`'s `OAuth2Client.verifyIdToken` with `audience: process.env.GOOGLE_CLIENT_ID`, then upserts via `userService.upsertGoogleUser`. Rejects with clear errors if credential or env var is missing.

### Token encryption — weak

`auth.service.js:6` creates `new Cryptr(process.env.SECRET1 || 'Secret-Puk-1234')`. `getLoginToken` encrypts `{ _id, fullname, isAdmin }` as JSON. `validateToken` decrypts and parses.

Concerns:
- Cryptr is simple symmetric encryption; it is **not authenticated** (no HMAC). JWTs would be a more robust pattern.
- Hardcoded fallback secret is trivially grep-able from GitHub.
- Token has no `iat`/`exp`. Sessions never expire.

### Logout

`auth.controller.logout` clears the `loginToken` cookie.

## Authorization

- `requireAuth.middleware.js` exports `requireAuth` and `requireAdmin`.
- `requireAuth` — if `loggedinUser` exists on ALS store, calls `next()`. If `config.isGuestMode` is true and no user, synthesizes a guest user and calls `next()` anyway. Else 401.
- `requireAdmin` — no guest fallback; requires `loggedinUser.isAdmin === true`, else 403.
- `config.isGuestMode` is hardcoded `true` in `backend/config/index.js:8`. Every deploy has guest mode on.

Net effect: even if `requireAuth` were uncommented on board routes, guests would still pass through and appear as `{ _id: '', fullname: 'Guest' }`.

## Board service — data operations

`backend/api/board/board.service.js`:

- `query(filterBy)` — builds Mongo criteria: `title` is regex-matched, `isStarred` exact match. No pagination.
- `getById(boardId)` — **missing `await`** at line 22. `collection.findOne(...)` returns a promise which is assigned to `board` and returned — callers get a Promise instead of a board doc. (Likely works by accident because callers `await` the upstream call.)
- `add(board)` — `collection.insertOne(board)`; returns the inserted board. No validation.
- `update(board)` — full-document replacement. `const boardToSave = {...board}; delete boardToSave._id; collection.updateOne(...)`. No field whitelist — any property the client sends will be persisted.
- `remove(boardId)` — `deleteOne`. No soft-delete, no cascade.
- `updateTask(boardId, groupId, taskId, saveTask)` — fetches the whole board, maps over `groups → tasks`, replaces the matching task, and calls `update(board)`. Full board rewrite for a single-task change.
- `updateGroup(boardId, groupId, saveGroup)` — same pattern for groups.

**Concurrency**: two clients editing different tasks on the same board concurrently can overwrite each other because the read-modify-write is not atomic. No `updatedAt`, no version, no Mongo array operators.

## User service

`backend/api/user/user.service.js`:

- `query(filterBy)` — regex match on `username`/`fullname`; optional `minBalance` filter that maps to a non-existent `score` field.
- `getById(userId)` — deletes password, returns. **No null check** — crashes if user not found.
- `update(user)` — cherry-picks `{_id, fullname, username, password, imgUrl}` and writes. **Accepts the `password` field raw** — a client sending a plaintext password in a PUT will overwrite the hash. This is a privilege-escalation vector.
- `remove(userId)` — hard delete.
- `add(user)` — expects a pre-hashed password (called from `auth.service.signup`).
- `upsertGoogleUser({ googleId, email, fullname, imgUrl })` — finds by `$or: [{googleId}, {username: email}, {email}]`. Updates if found, inserts with `password: null` if new.

## Database layer

`backend/services/db.service.js`:

- Uses the `mongodb` native driver v3.2.7 (released 2018). `useNewUrlParser` and `useUnifiedTopology` flags are passed; both are no-ops/deprecated in modern drivers.
- Single `dbConn` cache. No pool sizing, no timeout config, no reconnect logic.
- `mongoose` (8.9.6) is listed in `backend/package.json:21` but never imported. Dead dep.

## Socket.IO server

`backend/services/socket.service.js`:

- `cors: { origin: '*' }` — any origin can connect.
- No auth handshake. No token verification on `connection`.
- Events handled:
  - `chat-set-topic`: socket joins the room with the supplied topic string. No check that the caller is allowed in that room.
  - `chat-send-msg`: broadcasts to `socket.myTopic`.
  - `board-send-update`: broadcasts `board-add-update` with `{filteredBoard, board}` to the topic room. No validation of the payload.
  - `set-user-socket`: stores the supplied `userId` on `socket.userId`. **Unverified** — any client can claim any ID.
  - `unset-user-socket`: clears it.
- Helpers `emitToUser`, `emitTo`, `broadcast` exist but don't appear to be called by route handlers (broadcasts happen client-to-client via `board-send-update`).

## Configuration

- `backend/config/dev.js` and `backend/config/prod.js` both contain:
  ```js
  dbURL: 'mongodb+srv://donezo:bi246oB3QoSH47Wf@donezo.pv02j.mongodb.net/?retryWrites=true&w=majority'
  dbName: 'donezo'
  ```
  Identical in both. Credentials are live in git history — rotation required.
- `backend/config/index.js` — picks file by `NODE_ENV`, then always sets `isGuestMode = true`.
- `backend/services/logger.service.js:40` references `process.env.NODE_NEV` (typo of `NODE_ENV`). Debug logs therefore always run in prod.

## Scripts

- `backend/scripts/seed-user.js` — inserts `{username: 'admin', email: 'admin@example.com', password: bcrypt('1234')}` into the `user` collection. No dedup check — re-running creates duplicates. `npm run seed:user`.
- No board seed script. No reset script.

## Backend bugs & gaps (one-liner list)

1. `login` doesn't verify password. [auth.service.js:18-25]
2. `user.service.update` stores any `password` field raw — privilege-escalation surface. [user.service.js:65-82]
3. `board.service.getById` missing `await`. [board.service.js:22]
4. `board.service.update` saves arbitrary request fields; no field whitelist. [board.service.js:52-63]
5. `requireAuth` commented out on board + user list routes. [board.routes.js:6, user.routes.js:7]
6. `config.isGuestMode = true` hardcoded; cannot disable per env. [config/index.js:8]
7. Logger env flag typo: `NODE_NEV`. [logger.service.js:40]
8. Cryptr fallback secret hardcoded. [auth.service.js:6]
9. MongoDB URI hardcoded in `dev.js`/`prod.js`, both identical, both in git history.
10. Socket.IO: `origin: '*'`, no auth, topic join is unchecked, userId is self-declared.
11. No `start`/`dev` script in `backend/package.json` — README instructions don't work.
12. `mongoose` is installed but unused.
13. No input validation layer (no Joi/Zod/Yup).
14. No rate limiting on auth endpoints.
15. No tests.
16. No error-handling middleware.
17. Sessions never expire (no `exp` in Cryptr payload, no cookie `Max-Age`).
