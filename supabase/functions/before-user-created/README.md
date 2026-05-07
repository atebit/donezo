# before-user-created hook

Restricts new sign-ups to an allowlist of email domains.

## Behavior

- `ALLOWED_DOMAINS` unset or empty → allow all sign-ups (default).
- `ALLOWED_DOMAINS="example.com,foo.org"` → only sign-ups whose email ends in one of those domains succeed; others are rejected with a friendly message.

## Deploy

```
supabase functions deploy before-user-created --no-verify-jwt
supabase secrets set ALLOWED_DOMAINS="example.com,foo.org"   # or omit to allow all
```

## Wire it up

In Supabase dashboard → Authentication → Hooks → "Before user created":
- Hook type: HTTP
- Endpoint: `https://<project-ref>.supabase.co/functions/v1/before-user-created`
- Save.

To disable temporarily: clear the hook in the dashboard.

## Fail-open

On any function error, the hook returns `continue` (allows sign-up) rather than blocking. Better than locking everyone out due to a bug.
