---
description: Execute the most recently approved epic dispatch plan by spawning Sonnet executor agents in parallel, one per slice. Handles needs-direction escalations by routing back to the epic-researcher.
argument-hint: <epic-number, e.g. 01 or 05>
---

You are executing the approved dispatch plan for epic **$ARGUMENTS**.

## Steps

1. **Load the plan.** Read `docs/conversion-plan/_dispatch/epic-$ARGUMENTS.md`. If it doesn't exist, stop and tell the user to run `/plan-epic $ARGUMENTS` first.

2. **Confirm clean state.** We must be on `main`, working tree clean, up to date with origin. If not, stop.

3. **Create the epic branch.** `git checkout -b epic/$ARGUMENTS-<short-name>` off `main`, where `<short-name>` is derived from the epic doc title (kebab case, ~3 words).

4. **Dispatch executors in parallel.** For each parallel-safe slice in the plan, spawn an `epic-executor` agent (Sonnet) **in the same message** so they run concurrently. Each agent gets:
   - The slice spec verbatim from the plan.
   - The epic number.
   - The epic branch name.
   - For sub-branchable slices, the sub-branch name `epic/$ARGUMENTS-<short-name>/<slice-kebab>` to create off the epic branch.
   - For small slices, instruction to commit directly on the epic branch in a slice-prefixed commit (only when their file scopes truly don't overlap).

   Do **not** dispatch sequentially-dependent slices yet — wait for their predecessors.

5. **Handle returns.**
   - **Done report:** record it. When all parallel slices for the current stage are done, proceed to the review pass (step 6).
   - **Needs-direction report:** stop that slice, dispatch the `epic-researcher` (Opus) with the report. When the researcher returns an updated spec, re-dispatch the executor with the new spec. If the resolution requires user input, surface it.

6. **Review pass (Opus).** Once a stage's parallel slices are all done, dispatch the `epic-researcher` (Opus) with: the epic number, the stage label, and the diff range to review. The researcher audits the merged result against the epic's definition of done and writes either:
   - **Verdict `CLEAN`** — the stage's work meets the definition of done; proceed to the next stage or to step 7.
   - **Verdict `FOLLOWUP REQUIRED`** — a followup spec is written to `docs/conversion-plan/_dispatch/epic-$ARGUMENTS-followup-<N>.md`. Dispatch Sonnet executors against the followup slices (parallel where the spec allows). When they return done, run the review pass **again** on the followup diff. **Loop until the review returns `CLEAN`.** Followup rounds increment `<N>` each loop.

7. **Sequential follow-ups from the original plan.** After parallel stages and their review loops are clean, run any "Sequential follow-ups" the original dispatch plan listed — typically integration wiring and integration tests. Treat these as their own stage: dispatch executors, then run a review pass, loop until clean.

8. **Final epic-level review.** Once all stages are individually clean, dispatch the `epic-researcher` for an **epic-level review pass** — re-reading the entire epic doc's definition of done against the cumulative diff on the epic branch. Same loop: if `FOLLOWUP REQUIRED`, dispatch executors, re-review, repeat until `CLEAN`.

9. **Verify mechanically.** Run lint, typecheck, and the test suites the plan named. If anything is red, dispatch a fix slice and re-review — do not declare the epic done.

10. **Open the PR.** Use `gh pr create` to open `epic/$ARGUMENTS-<short-name>` → `main` with a body that summarizes what landed, references the epic doc, links every dispatch and followup spec under `docs/conversion-plan/_dispatch/`, and lists any followups the reviewer punted to a later epic. Do not merge — that's a human decision.

## Hard rules

- Executors are Sonnet, dispatched in parallel when their file scopes are disjoint. Never parallelize slices that share files.
- Architectural decisions during execution route to the `epic-researcher` (Opus), not to a fresh planning conversation.
- **A stage is not done because all its executors returned "done" — it's done when the Opus review pass returns `CLEAN`.** The review-and-followup loop continues until the reviewer signs off.
- The epic itself is not done until the **epic-level review pass** (after all stages) returns `CLEAN`.
- Never merge to `main` automatically. Open the PR and stop.
- Never proceed to the next epic — that requires the user to merge this PR and run `/plan-epic <next>`.
- If $ARGUMENTS is missing or no dispatch plan exists for it, stop and ask.
