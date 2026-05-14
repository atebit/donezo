# Google-only Login (Implementation Notes)

This project now supports a clean Google-only login flow:

- Frontend obtains a Google **ID token** (`credential`).
- Backend verifies the ID token and upserts the user.

## Backend

### Endpoint

- `POST /api/auth/google`
  - Body: `{ "credential": "<google id token>" }`
  - Response: user object
  - Also sets `loginToken` cookie (dev-friendly cookie options).

### Required env vars

Set these in the backend environment:

- `GOOGLE_CLIENT_ID`
  - Must match the Google OAuth Web Client ID used by the frontend.
- `SECRET1`
  - Used to encrypt the app login token (`loginToken` cookie).

## Frontend

### Google OAuth Provider

The app reads:

- `process.env.REACT_APP_GOOGLE_CLIENT_ID`

If not provided, it falls back to the currently hardcoded client id in `src/index.js`.

### Login page

`/auth/login` uses the `GoogleLogin` button and sends the returned `credential` to `/api/auth/google`.

## Google Cloud Console setup

In Google Cloud Console:

- Create OAuth consent screen (if not already).
- Create **OAuth 2.0 Client ID** of type **Web application**.
- Add Authorized JavaScript origins:
  - `http://localhost:3000`
  - (add your production origin later)

## Notes

- This is “private app friendly”: you can ignore permissions for now.
- If you later decide to require auth for board writes, you can enable `requireAuth` on board routes and use the cookie-based `loginToken` that this flow sets.
