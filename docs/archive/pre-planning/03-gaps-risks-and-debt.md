# Gaps, Risks, and Technical Debt

## High-impact correctness issues

### Auth login does not validate passwords

- `backend/api/auth/auth.service.js`:
  - `login(username, password)` loads user by username but **never checks** `bcrypt.compare`.
  - This means anyone can log in as any existing username.

**Impact**: Security + correctness blocker for any non-demo use.

### Backend cookie settings likely break local dev auth

- `auth.controller.js` sets cookie with `{ sameSite: 'None', secure: true }`.
  - Modern browsers require HTTPS when `secure: true`.
  - In local dev (`http://localhost:3000`), cookies may not be stored/sent.

**Impact**: Local dev “auth works sometimes” / confusing behavior.

### Guest mode enabled globally

- `backend/config/index.js`: `config.isGuestMode = true`.
- `requireAuth.middleware.js`: if guest mode and no logged in user, request proceeds.

**Impact**: makes auth/permissions hard to reason about; can mask auth bugs.

## Security / secrets management

### Hardcoded secrets in repository

Observed hardcoded values:

- MongoDB Atlas URI includes credentials in `backend/config/dev.js` and `backend/config/prod.js`.
- Google OAuth client id hardcoded in `frontend/src/index.js`.
- Cloudinary cloud name + preset hardcoded in `frontend/src/services/upload.service.js`.
- Cryptr secret fallback is hardcoded in `backend/api/auth/auth.service.js`.

**Impact**:

- Credentials leakage risk.
- Difficult deploy to new environments.

**Recommendation**:

- Move all secrets to env vars.
- Rotate compromised credentials.

## Data model / API design risks

### Embedded “board document” writes

- Current design stores groups/tasks embedded under `board`.
- Most actions save the entire board or group/task by rewriting portions.

Risks:

- **Concurrency**: two clients updating different tasks can overwrite each other.
- **Performance**: boards grow quickly; each update writes large payloads.

Suggested next steps:

- Short term: add server-side merge logic or versioning (`updatedAt`, optimistic concurrency).
- Longer term: consider normalizing (tasks collection) if needed.

### Lack of validation

- No schema validation on board/group/task shapes.
- UI assumes fields like `task.updatedBy.date` and `task.comments` always exist.

**Impact**: runtime crashes, “undefined” state, brittle migrations.

## Frontend robustness gaps

### Column system is inconsistent

- `cmpsOrder` includes `checkbox-picker`, but task row renderer doesn’t implement it.
- Priority and status share a single `board.labels` set.

**Impact**: UX confusion + unimplemented features exposed to users.

### Inconsistent task fields

- `board.service.getEmptyTask()` sets:
  - `status`, `memberIds`, `dueDate`, `comments`, `updatedBy`, `file`.
- `local-board.service.getEmptyTask()` sets different fields.

**Impact**: different seed sources can break UI expectations.

## Backend quality gaps

### Backend start scripts

- `backend/package.json` is missing `start` / `dev` scripts.

**Impact**: root README instructions don’t match reality; onboarding friction.

### Logger env typo

- `backend/services/logger.service.js` checks `process.env.NODE_NEV` (typo).

**Impact**:

- Debug logs might remain enabled unexpectedly.

## Realtime design considerations

- Socket topics reuse `chat-set-topic` for boards.
- Broadcast is “fire and forget”; no ack, no ordering, no conflict resolution.

**Impact**:

- Hard-to-debug state drift across clients.

## Missing product-level capabilities (relative to minimal Monday)

- Permissions/roles per board.
- Workspace concept (multi-board org with membership).
- Invite flow that persists membership changes.
- Column rename + separate label sets per column type.
- Activity log coverage for all edits.

