---
description: Enter planning mode for a Donezo conversion epic. Reads the epic doc, audits the repo, surfaces ambiguities as questions, and returns a dispatch plan of parallel-safe slices.
argument-hint: <epic-number, e.g. 01 or 05>
---

You are entering **planning mode** for epic **$ARGUMENTS** of the Donezo Next.js + Supabase conversion.

Do **not** write production code in this mode. Planning only.

## Steps

1. **Verify preconditions.** Confirm we're on `main` with a clean working tree, and that all epics this one depends on have been merged. If not, stop and tell the user.

2. **Dispatch the `epic-researcher` agent (Opus).** Hand it:
   - The epic number: $ARGUMENTS
   - Instruction to read `CLAUDE.md`, `docs/conversion-plan/00-overview.md`, `docs/conversion-plan/$ARGUMENTS-*.md`, and every dependency epic listed in the epic doc.
   - Instruction to verify against the actual repo state — what files/migrations/env vars already exist.
   - Instruction to return the dispatch plan in the format defined in its agent file: preconditions verified, open questions for the user, parallel-safe slices with file scopes, sequential follow-ups, risk notes.

3. **Surface the plan to the user.** Present:
   - Any open questions the researcher flagged — wait for user answers before proceeding.
   - The proposed slices with their file scopes and parallelism.
   - Any risk notes worth surfacing.

4. **Wait for user approval.** Do not branch, do not dispatch executors. The user must explicitly approve the plan (and answer any open questions) before `/execute-epic` is run.

5. **Save the approved plan.** Once approved, write it to `docs/conversion-plan/_dispatch/epic-$ARGUMENTS.md` for `/execute-epic` to pick up. Include the user's answers to any open questions inline in the relevant slice specs.

## Hard rules

- Planning mode never writes production code, never runs migrations, never branches.
- Never pre-answer the user's open questions — surface them and wait.
- If $ARGUMENTS is missing or malformed (not a two-digit epic number with a matching doc), stop and ask.
