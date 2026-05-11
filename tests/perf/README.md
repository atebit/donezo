# Perf seed scripts

Manual performance smoke for epic 06 board virtualization.

## Usage

```bash
pnpm tsx tests/perf/seed-board.ts --board <uuid> --tasks 5000 --groups 20
```

Required env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (use the local dev instance — this is service-role and RLS-bypassing).

> **Note:** `tsx` is not installed as a devDep in this repo. To run the script without installing it globally, use `npx tsx` (which downloads it on first run via npx) or install it globally with `npm i -g tsx`. Alternatively, use `node --loader ts-node/esm` if `ts-node` is available.

## What to verify

1. Open the board in dev: `pnpm dev`, navigate to `/w/<workspace>/b/<board>`.
2. Open Chrome DevTools → Performance tab → start recording.
3. Scroll the table for 5 seconds.
4. Stop recording. Verify the FPS counter stays at or near 60fps.
5. Paste the FPS observation into the slice's done report.

## Cleanup

To reset a perf-seeded board, soft-delete its groups (cascades to tasks via the `cascade_soft_delete_to_tasks` trigger):

```sql
update "group" set deleted_at = now() where board_id = '<uuid>' and deleted_at is null;
```

## Notes

- Tests under `tests/perf/` are NOT picked up by `pnpm test` (Vitest's default glob is `tests/unit/**`). This is intentional — the seeder is a manual tool, not a CI test.
- The seeder is idempotent only insofar as it appends new groups/tasks each run; re-running adds duplicates. Clean the board between runs if needed.
