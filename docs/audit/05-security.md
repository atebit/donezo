# Security Audit

Severity scale: 🔴 critical / 🟠 high / 🟡 medium / 🟢 low.

## Summary table

| Severity | Count | Highlights |
|----------|-------|------------|
| 🔴 Critical | 6 | Login doesn't verify passwords; board routes unauthenticated; MongoDB creds committed; Cryptr fallback secret; cookie missing HttpOnly; socket wide open |
| 🟠 High | 6 | `user.update` accepts raw password; guest mode hardcoded on; no input validation; `mongodb` driver 3.2.7; `react-beautiful-dnd` abandoned; user list & user-by-id unauth |
| 🟡 Medium | 5 | No rate limiting; regex-injection surface; Cloudinary unsigned preset; logger typo disables prod gating; no session expiration |
| 🟢 Low | 2 | CORS prod config implicit; client id hardcoded fallback |

---

## 🔴 Critical

### 1. Password login does not verify passwords

[`backend/api/auth/auth.service.js:18-25`](../../backend/api/auth/auth.service.js) — `login()` fetches the user and returns it without calling `bcrypt.compare`. Any password logs in as any existing user.

**Fix**: add `if (!await bcrypt.compare(password, user.password)) return Promise.reject('Invalid username or password')` before the `delete user.password`.

### 2. Board write endpoints are unauthenticated

[`backend/api/board/board.routes.js:6`](../../backend/api/board/board.routes.js) — `router.use(requireAuth)` is commented out. All seven board endpoints (POST, PUT ×3, DELETE, plus two GETs) are public. Anyone can create, modify, or delete any board on the system.

**Fix**: uncomment, and (ideally) disable `config.isGuestMode` for writes so the guest fallback doesn't neutralize the middleware.

### 3. MongoDB credentials are hardcoded in the repo

`backend/config/dev.js:2` and `backend/config/prod.js:2` both contain:
```
mongodb+srv://donezo:bi246oB3QoSH47Wf@donezo.pv02j.mongodb.net/?retryWrites=true&w=majority
```
Same URI in both envs. The credential is in every commit back to `03457ed`. Rewriting HEAD doesn't help — **rotate the Atlas user password immediately**.

### 4. Cryptr session secret has a hardcoded fallback

`backend/api/auth/auth.service.js:6` — `new Cryptr(process.env.SECRET1 || 'Secret-Puk-1234')`. If `SECRET1` is ever missing in prod, tokens are forgeable by anyone who reads this file (or its git history).

**Fix**: `if (!process.env.SECRET1) throw new Error('SECRET1 is required')`.

### 5. Cookie is missing `HttpOnly`

`backend/api/auth/auth.controller.js:4-9` — `_getLoginCookieOptions` returns `{ sameSite, secure }` only. The cookie is JS-readable, so any XSS can exfiltrate the session token. No `Path`, no `Max-Age`.

**Fix**: add `httpOnly: true` in both branches. Consider `maxAge` so sessions expire.

### 6. Socket.IO has no auth, no authorization, and `origin: '*'`

`backend/services/socket.service.js:5-10` + `:16-36`:
- Anyone can open a socket.
- `chat-set-topic` joins any room — a third party can eavesdrop on board updates for any board id they can guess.
- `set-user-socket` sets `socket.userId` from client input unverified — any client can impersonate any user for the `emitToUser` path.

**Fix**: require `auth.token` on connection; derive `userId` from the token, not the client. Reject joins if the user isn't a board member.

---

## 🟠 High

### 7. `user.service.update` stores the `password` field raw

`backend/api/user/user.service.js:65-82` — cherry-picks `{_id, fullname, username, password, imgUrl}`. A client sending `{_id, password: 'plaintext'}` in a PUT **overwrites the bcrypt hash with plaintext**, breaking future logins (and silently if login check were fixed). If an auth bypass is ever found, attackers can persist credentials.

**Fix**: drop `password` from the updatable fields, or re-hash when present, and never let the client update another user.

### 8. Guest mode is hardcoded on

`backend/config/index.js:8` — `config.isGuestMode = true` unconditionally. Combined with the commented-out `requireAuth`, this means even after you uncomment the middleware, unauthenticated requests still pass as `{_id:'', fullname:'Guest'}`.

**Fix**: drive from env (`GUEST_MODE=1`), default off in prod.

### 9. No input validation anywhere

No Joi/Zod/Yup/express-validator in `backend/package.json`. Controllers pass `req.body` to services. `board.service.update` saves `{...board}` minus `_id`, so a client can attach arbitrary fields to the board document (schema bloat; `__proto__` isn't directly exploitable on modern Node but the general principle is bad).

### 10. `mongodb` driver is 3.2.7 (2018)

Several majors of security fixes missed. `useUnifiedTopology` + `useNewUrlParser` are no-ops in current drivers. Either upgrade to v6 (API changes) or — since `mongoose` 8.9.6 is already in `package.json` and unused — migrate to mongoose models with schema validation.

### 11. `react-beautiful-dnd` is abandoned

`frontend/package.json:24` — last meaningful release 2021, author explicitly recommends migrating. Drop-in replacement is `@hello-pangea/dnd`. `dnd-kit` is a bigger migration but more modern.

### 12. User list + user-by-id are unauthenticated

`backend/api/user/user.routes.js:7` — `router.use(requireAuth)` commented. `GET /api/user` and `GET /api/user/:id` are public. Information disclosure.

---

## 🟡 Medium

### 13. No rate limiting on auth

No `express-rate-limit`. `/api/auth/login`, `/api/auth/signup`, `/api/auth/google` can be called without throttling. Brute force + enumeration friendly.

### 14. Regex injection surface in `query()`

`backend/api/board/board.service.js:8` — `criteria.title = { $regex: filterBy.title, $options: 'i' }`. Client-controlled regex. A malicious pattern (e.g., `^(a+)+$`) can trigger ReDoS. Value is a string, so it can't inject Mongo operators.

**Fix**: escape the regex (`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`) or use `$text`.

### 15. Cloudinary unsigned preset in frontend source

`frontend/src/services/upload.service.js` — cloud name + unsigned preset hardcoded. The cloud name is inherently public; the preset is discoverable. If the preset isn't configured with file-type/size restrictions, anyone can upload anything to the Cloudinary account.

**Fix**: either sign uploads server-side, or lock the preset (max size, allowed formats, folder).

### 16. Logger env flag typo

`backend/services/logger.service.js:40` — `process.env.NODE_NEV` instead of `NODE_ENV`. The branch that gates debug logs always runs. Also leaks request details in prod.

### 17. No session expiration

Cryptr payload has no `iat`/`exp`; cookie has no `Max-Age`/`Expires`. Sessions live as long as the browser. No revocation mechanism.

---

## 🟢 Low

### 18. Production CORS is implicit

`backend/server.js` has no prod CORS config — works only because the frontend is served same-origin. If the split ever changes, the API will reject everything silently.

### 19. Google OAuth client id fallback is hardcoded

`frontend/src/index.js:12-13` — hardcoded client id used when `REACT_APP_GOOGLE_CLIENT_ID` is missing. Client ids aren't secret, but the fallback makes it easy to accidentally ship the wrong env.

---

## XSS surface

React's default escaping is in use throughout. No `dangerouslySetInnerHTML`, no `eval`, no `Function()`. One caveat: `comment-preview.jsx` applies `style={comment.style}` — if a user can craft an object literal server-side (they can, via the unvalidated board write path), they could smuggle strange CSS. Low impact but worth tightening.

## Dependency state

See [08-dependencies.md](08-dependencies.md).

## Git-history leakage

Confirmed committed secrets that predate current HEAD:
- `mongodb+srv://donezo:bi246oB3QoSH47Wf@...` (current)
- `mongodb+srv://atebitcreative:bi246oB3QoSH47Wf@...` (prior commit)
- `mongodb+srv://idandavid:idan5375@...` (from the upstream fork; still reachable via `git log -p`)

BFG / `git filter-repo` can rewrite history, but **rotating the Atlas users is mandatory regardless**.

## Priority fix order

1. Rotate MongoDB Atlas password and move URI + db name to env.
2. Add `bcrypt.compare` to `auth.service.login`.
3. Uncomment `requireAuth` on `board.routes.js` and `user.routes.js`. Gate guest mode on env, default off.
4. Add `httpOnly: true` to cookie options. Add `maxAge`.
5. Add auth + topic-ACL to socket connections; derive `userId` from token.
6. Add input validation layer (Zod or Joi) for at least board/task/user writes.
7. Add `express-rate-limit` to auth endpoints.
8. Upgrade `mongodb` driver (or migrate to mongoose) and migrate `react-beautiful-dnd` → `@hello-pangea/dnd`.
