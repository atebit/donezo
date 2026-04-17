# Recommendation: Migrate to Supabase Before More Feature Work

A decision memo answering: *"Should we move to Supabase first, or keep iterating on features against MongoDB?"*

## Recommendation

**Migrate to Supabase first.** Do the security-critical subset of [Phase 0](09-roadmap-to-full-featured.md) (fix login, uncomment `requireAuth`, rotate Atlas creds, add `httpOnly`) as a day-one holdover, then start the Supabase migration before building more features.

## Why

### 1. The Mongo "make it viable" work is roughly the same size as the Supabase migration

To run this app as a full-featured multi-user product on MongoDB, you have to:

- Normalize the embedded-document model (add `updatedAt`, use atomic array operators, probably extract comments/activities)
- Add a workspace + membership model
- Replace the broken auth layer with something that isn't Cryptr-plus-commented-out-middleware
- Add authorization checks per board (role-based)
- Authenticate socket connections and enforce topic ACLs
- Upgrade the ancient `mongodb` driver or adopt the unused `mongoose`
- Write input validation schemas

That's [Phases 0–4 of the roadmap](09-roadmap-to-full-featured.md) — estimated M–L each, ~2 weeks of engineer time.

The Supabase migration ([doc 10](10-supabase-migration.md)) is estimated 3–7 engineer-days. Much of that overlap: you're designing a normalized schema and access model *either way*. The difference is whether you end up with a hand-rolled auth system + Mongo + Socket.IO, or Supabase handling all three.

### 2. Several critical bugs disappear by construction on Supabase

From [05-security.md](05-security.md), these go away for free:

- Password login bug — Supabase Auth handles verification.
- Unauthenticated board routes — RLS policies enforce access at the DB.
- Hardcoded Mongo URI — replaced by a `SUPABASE_URL` + anon key (anon key is designed to be public).
- Missing `HttpOnly` cookie — Supabase manages session cookies correctly.
- Socket impersonation (`set-user-socket`) — Realtime subscriptions are authenticated by the user's JWT.
- Concurrency / lost updates from full-doc writes — atomic `UPDATE` on individual rows.
- Label-rename cascade bug — labels have stable ids; tasks reference the id.
- Document 16 MB ceiling — non-issue in Postgres.

These are the scariest items in the audit. Fixing them individually on Mongo is real work; fixing them by moving to Supabase is work you're already doing.

### 3. Every feature built now on Mongo is work you'll redo

`store/board.actions.js` is currently ~360 lines of thunks that assume "save the whole board." Each new feature (bulk actions, timeline view, calendar, @-mentions, presence, notifications) gets written against that shape. When you migrate, every one of those thunks has to be rewritten for normalized tables and Realtime.

If you defer the migration by N features, you pay for those N features twice.

### 4. "Proofing features live" isn't really possible on the current setup

The question framed Mongo as the path that keeps features demo-able. But:

- Login doesn't verify passwords.
- Every board endpoint is open to the internet.
- MongoDB credentials are live in git history.

No one external can touch the current deployment safely. You need Phase 0 either way before any live demo. Given that Phase 0 is ~1 day of work on Mongo and ~0 days on Supabase (the fixes are structural on Supabase), the "keep moving on Mongo" path isn't cheaper at the starting line.

## When staying on Mongo would be the right call

This recommendation would flip if any of these are true:

- **You're shipping to internal users in the next 1–2 weeks** and just need a presentable demo — defer the migration, do Phase 0 only, migrate after the demo.
- **You've invested heavily in a Mongo-specific skill, toolchain, or adjacent system** you want to share. Currently nothing in this repo suggests that.
- **Realtime scale is going to exceed Supabase Realtime's comfort zone** (10k+ concurrent editors on the same board). Not a concern for this product's current trajectory.
- **You explicitly want a schemaless document shape** to experiment with highly-variable task structures. This repo doesn't use that flexibility today.

If none of the above apply, Supabase wins.

## What "migrate now" actually means

Concrete first week, in order:

1. **Day 1** — Phase 0 security fixes against the live Mongo stack. Rotate Atlas creds. Add `bcrypt.compare` to login. Uncomment `requireAuth` on board routes. Add `httpOnly` to cookie options. Set `SECRET1` and fail to boot without it. This is holdover safety while the migration is in flight.
2. **Day 2** — Stand up a Supabase project. Configure Google OAuth provider. Sketch the schema from [doc 10](10-supabase-migration.md). Write the RLS policies for `board` and `board_member`. Test with two fake users from the SQL editor.
3. **Day 3** — Write and dry-run the Mongo → Postgres migration script against a sample board. Verify ids, counts, nested structure → flat rows.
4. **Day 4–5** — Frontend: install `@supabase/supabase-js`. Rewrite `userModule` to derive from `supabase.auth`. Rewrite `store/board.actions.js` to hit Supabase directly. Replace Socket.IO with Realtime subscriptions.
5. **Day 6** — Cutover on a preview environment. Test with real user accounts. Fix RLS edge cases.
6. **Day 7** — Archive `backend/`. Update README. Point production DNS / env vars.

That's the 5–7 day estimate made concrete. It's a detour, but it's a short one.

## What you gain on day 8

- A database where two users can edit different tasks on the same board without losing each other's changes.
- A permission model you can trust because it's enforced by Postgres, not by hoping a middleware is uncommented.
- An auth system that isn't broken.
- Realtime that doesn't let strangers eavesdrop on your boards.
- Multi-file attachments, workspaces, and roles become normal schema changes instead of data-model rewrites.
- The [roadmap from Phase 4 onward](09-roadmap-to-full-featured.md) becomes pure product work — no plumbing interrupts.

## What you lose

- ~1 week of calendar time where no new features ship.
- Familiarity with the document model (already working against it has not been a net win — see the bugs in [07-gaps-and-tech-debt.md](07-gaps-and-tech-debt.md)).

## Bottom line

The case for "keep building on Mongo" is momentum. The case for "migrate now" is that the momentum is against the grain of where the product needs to go. Every week spent adding features to the current shape makes the eventual migration harder and adds rework. The exit cost compounds; the entry cost doesn't.

Migrate now.
