# Purge User Data

## When to use this runbook

Use this runbook to respond to a GDPR "right to erasure" request (Article 17) or
any other binding data-deletion request for a specific user account.

This procedure uses the Supabase **service-role admin client**, which bypasses RLS.
It must only be run by an authorized operator with access to the service-role key.

> **Warning:** Deletion is permanent and irreversible for hard-deleted rows. Soft-deleted
> rows have `deleted_at` set but data remains. Confirm the scope of the request before
> proceeding — "erasure" under GDPR typically means hard deletion or anonymisation of
> personal data, not just soft deletion.

## Pre-flight

- Obtain the user's `auth.users.id` (UUID). You can find it via the Supabase dashboard
  → `Authentication` → `Users` → search by email.
- Confirm the request is legitimate (written request, identity verified).
- Log the request in your legal/compliance tracker before and after execution.
- Notify the team that a user-data purge is in progress.
- Create a point-in-time backup or note the current timestamp in case of dispute.

## Tables that hold user-keyed rows

The following tables contain rows associated with a specific `user_id`. They must
be addressed in a purge:

| Table | Column | Cascade on `auth.users` delete? | Notes |
|-------|--------|---------------------------------|-------|
| `workspace_member` | `user_id` | Yes — `ON DELETE CASCADE` | Removes workspace access |
| `board_member` | `user_id` | Yes — `ON DELETE CASCADE` | Removes board access |
| `comment` | `author_id` | `ON DELETE SET NULL` | Content remains; author anonymised |
| `attachment` | `uploader_id` | `ON DELETE SET NULL` | File remains; uploader anonymised |
| `notification` | `user_id` | Yes — `ON DELETE CASCADE` | Notifications deleted |
| `saved_view` | `owner_id` | Varies — check migration | Saved views owned by the user |
| `task` | `created_by` / `assignee` | `ON DELETE SET NULL` | Tasks remain; attribution anonymised |

> Verify this list against the current migration state in `supabase/migrations/`.
> Run `grep -r "references auth.users" supabase/migrations/` to get the authoritative list.

## Steps

### 1. Look up the user

```sql
-- Run in Supabase SQL editor (service-role or postgres role required)
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE email = '<user@example.com>';
```

Note the `id` — this is the `<user_id>` used in all subsequent queries.

### 2. Anonymise rather than delete (recommended for comments/attachments)

For rows where `ON DELETE SET NULL` applies (comments, attachments), the content
itself may not be personal data. You can leave the content and only ensure the
author attribution is gone (it will be `NULL` once the auth user is deleted).

If the user explicitly requests content deletion:

```sql
-- Hard-delete comments authored by the user (service-role required)
DELETE FROM public.comment WHERE author_id = '<user_id>';

-- Hard-delete attachments uploaded by the user
-- Note: also delete from Supabase Storage (see Step 3)
DELETE FROM public.attachment WHERE uploader_id = '<user_id>';
```

### 3. Delete Supabase Storage files

Attachments reference files in Supabase Storage. After deleting the `attachment`
rows, remove the actual files:

```bash
# Using the Supabase CLI (logged in as project admin)
supabase storage rm --recursive "attachments/<user_id>/"
```

Or via the Supabase dashboard → `Storage` → navigate to the user's folder and delete.

### 4. Delete saved views owned by the user

```sql
DELETE FROM public.saved_view WHERE owner_id = '<user_id>';
```

### 5. Delete the auth.users record (triggers cascades)

Deleting the `auth.users` row triggers all `ON DELETE CASCADE` foreign keys:
- `workspace_member` rows (user removed from all workspaces)
- `board_member` rows (user removed from all boards)
- `notification` rows (all notifications deleted)

```sql
-- This is irreversible. Double-check the id.
DELETE FROM auth.users WHERE id = '<user_id>';
```

Alternatively, use the Supabase Auth Admin API (safer — goes through the auth stack):

```ts
// scripts/purge-user.ts (run with tsx, service-role key in env)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

await supabase.auth.admin.deleteUser("<user_id>");
```

### 6. Verify deletion

```sql
-- Should return 0 rows
SELECT COUNT(*) FROM auth.users WHERE id = '<user_id>';
SELECT COUNT(*) FROM public.workspace_member WHERE user_id = '<user_id>';
SELECT COUNT(*) FROM public.notification WHERE user_id = '<user_id>';

-- These should return 0 or rows with NULL author_id / uploader_id
SELECT COUNT(*) FROM public.comment WHERE author_id = '<user_id>';
SELECT COUNT(*) FROM public.attachment WHERE uploader_id = '<user_id>';
```

### 7. Log completion

Record the purge in your compliance tracker:
- User email and id (retain for audit trail, even after deletion)
- Date and time of deletion
- Operator who performed the deletion
- Tables affected

## Verification

- `auth.users` query for the user's id returns no rows.
- `workspace_member` and `notification` queries return no rows.
- Comments and attachments that were authored/uploaded by the user have `NULL`
  in the author/uploader column (or are deleted if content deletion was requested).
- Supabase Storage no longer contains the user's files.

## Rollback

Hard deletion cannot be rolled back. If you deleted the wrong user:
1. Restore from the most recent Supabase backup (see [database-restore.md](database-restore.md)).
2. The restoration window may be limited by your backup cadence.

This is why the pre-flight step emphasises confirming the request before proceeding.

## Related runbooks

- [database-restore.md](database-restore.md) — restore if wrong user was deleted
- [incident-response.md](incident-response.md) — if a data breach drove the deletion request
- [rotate-secrets.md](rotate-secrets.md) — rotate SUPABASE_SERVICE_ROLE_KEY after use in sensitive operations
