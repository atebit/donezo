# Epic 01 — Board Invitations: Production Readiness

## Goal

The board-invitation feature is functionally complete in the repo — server actions, UI, email template, `/join/[token]` page, RLS policies, and tests all exist. What does **not** exist is a verified path from a board admin clicking "Invite members" in production, to a stranger receiving a real email at their inbox, clicking the link, and landing in the board as a member. This epic closes that gap.

The deliverables are: (a) every external service the flow depends on (Resend, Supabase Auth, Vercel) is configured for the production domain; (b) the two known feature gaps (new-user signup that preserves the invite target, Supabase Auth template branding) are closed; (c) a runbook captures the setup so the next deploy to a new environment does not start from scratch; (d) the full flow has been smoke-tested end-to-end against a real Vercel deployment with a real email recipient.

## Why this is its own epic

The board-invite code shipped across several conversion-plan epics (05 workspaces/boards, 09 comments/activity for in-app notifications, 13 notifications/email). At no point did a single epic own the question "does this actually work in production?". The result is the current state: code exists, env-var schema exists, the runbook list has `preview-environments.md` and `rotate-secrets.md` but no "invitation email DNS + auth allowlist" runbook, and there is no record of a real invite having been sent and accepted on the live site.

This is also the first user-visible flow that crosses **three external boundaries** (Resend → recipient inbox → Supabase Auth) in a single user journey. Each boundary has its own configuration surface and its own way to fail silently. Bundling the prod-readiness work into a feature epic would either bloat that epic or, more likely, leave the ops half undone. A dedicated epic forces the verification.

It is **not** a rebuild of the feature. The bar for "done" is: a real invitation reaches a real inbox from the production deploy, the recipient — whether existing user or brand-new — can accept it, and the steps to reproduce the setup are documented.

## In scope

### Vercel environment configuration

- Inventory required env vars against [`lib/env.ts`](../../lib/env.ts): `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_SAFE_LIST` (preview only), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Confirm each is set on the correct Vercel environment (Production / Preview / Development) with the correct value.
- `NEXT_PUBLIC_SITE_URL` must equal the production apex URL — the join links in emails are built as `${NEXT_PUBLIC_SITE_URL}/join/${token}` in [`b/[boardId]/settings/members/actions.ts`](../../app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/actions.ts) and a misconfigured value sends recipients to the wrong host.
- `EMAIL_SAFE_LIST` must be set in Preview to a comma-separated list of internal addresses so PR deploys cannot accidentally email real users. The guard is implemented in [`lib/email/send.ts`](../../lib/email/send.ts); the value just needs to be present.
- Confirm Production does **not** have `EMAIL_SAFE_LIST` set, otherwise real recipients are silently dropped.

### Resend domain setup

- Verify the apex domain in the Resend dashboard. Add SPF, DKIM, and (optionally) DMARC records to the DNS provider for the sending domain (default in [`lib/email/send.ts`](../../lib/email/send.ts) is `noreply@donezo.app`).
- Decide and lock the canonical `EMAIL_FROM` value (currently defaulted to `Donezo <noreply@donezo.app>`). Record the chosen value in the runbook and set it on Vercel Production.
- Confirm the Resend project has the production API key, and that the key on Vercel Production matches it. Rotate any keys that were ever pasted into preview or dev environments.
- Add the `kind=board_invite` tag (already set by [`actions.ts:141`](../../app/(app)/w/[workspaceSlug]/b/[boardId]/settings/members/actions.ts)) to any Resend dashboards or webhooks the team uses to monitor deliverability.

### Supabase Auth configuration

- In the Supabase dashboard for the production project, set **Site URL** to `NEXT_PUBLIC_SITE_URL`.
- Add the production apex URL and the preview wildcard (`https://donezo-*-<team>.vercel.app` and `https://donezo-pr-*-<team>.vercel.app` per [`preview-environments.md`](../runbooks/preview-environments.md)) to the **Redirect URLs** allowlist. Sign-in returns through `/auth/callback?next=...` and Supabase blocks any host not in this list.
- Decide whether the Supabase Auth confirmation / magic-link emails should ship with default Supabase styling or be replaced with branded templates. Two options:
  - Customize Supabase's built-in email templates in the dashboard (simpler, but Supabase sends them, not Resend).
  - Configure Supabase Auth to route SMTP through Resend so all transactional mail comes from one provider with one set of analytics. Requires a Resend SMTP credential.
  - Open question — resolved in planning.
- Confirm the Supabase service role key on Vercel matches the project the Site URL is set against. A mismatch produces invitations that point at one project but write to another.

### Feature gap 1 — new-user signup preserves invite target

The current join flow at [`app/(auth)/join/[token]/page.tsx:152`](../../app/(auth)/join/[token]/page.tsx) redirects unauthenticated visitors to `/sign-in?next=/join/${token}`. The sign-**in** page honors `next` (it threads it through `/auth/callback?next=...` in [`app/(auth)/actions.ts:77`](../../app/(auth)/actions.ts)). The sign-**up** flow does not: grep for `next` in [`app/(auth)/sign-up/`](../../app/(auth)/sign-up/) returns no hits.

So a brand-new invitee who clicks "Create an account" from the sign-in page loses the `?next=/join/${token}` parameter, lands on `/` after verifying their email, and never gets back to the board.

Close the gap:

- Pass `next` through the sign-in → sign-up link.
- Thread `next` through the sign-up server action and Supabase email-confirmation `redirectTo`.
- After email confirmation, redirect to the original join URL.
- Cover the path with an E2E test alongside the existing [`tests/e2e/invitation-accept.spec.ts`](../../tests/e2e/invitation-accept.spec.ts), but for the new-user variant.

### Feature gap 2 — invite email mentions sender by display name only

The invite email in [`emails/invite/Invite.tsx`](../../emails/invite/Invite.tsx) is fed `inviterName` from the actor's `profile.display_name`, falling back to their email. Verify the email renders sensibly for actors who have not set a display name (a common case for newly signed-up admins) and tighten the fallback copy if it reads as "A teammate has invited you" with no further identification.

### Smoke test against production

- After all configuration lands and the new-user flow is in: open the production app, invite an external email address from a real private board, confirm the email arrives at the recipient's inbox (not spam — DKIM/SPF), click the link, complete signup, land in the board.
- Repeat for an **existing-user** invite (the recipient already has a Donezo account on a different workspace): confirm the in-app notification fires (via [`emitBoardInviteNotification`](../../lib/notifications/emitters.ts)) and the email also arrives.
- Repeat for an invite to an email that **already belongs to a board member** of that board: confirm the action rejects the duplicate at the server-action layer or the UI surfaces a clean error. (If neither happens today, file as a followup, do not block the epic.)
- Record the test results — recipient address (redacted), Resend message id, accept timestamp — in `docs/roadmap/_dispatch/epic-01-smoke.md` as evidence of done.

### Runbook

- Create `docs/runbooks/board-invitations.md` covering: required env vars (with the same names the schema validates), Resend DNS records to add, Supabase Auth Site URL and Redirect URL allowlist entries, the `EMAIL_FROM` decision, the `EMAIL_SAFE_LIST` policy per environment, and a "how to send a test invite from production" checklist.
- Cross-link it from [`rotate-secrets.md`](../runbooks/rotate-secrets.md) (RESEND_API_KEY rotation already lives there or needs to be added) and from [`preview-environments.md`](../runbooks/preview-environments.md).

## Out of scope

- Rate-limiting or abuse prevention on `inviteToBoard` (admin spamming the invite endpoint). Tracked separately; mention in followups.
- Workspace-level invitations. The flow at [`w/[workspaceSlug]/settings/members/actions.ts`](../../app/(app)/w/[workspaceSlug]/settings/members/actions.ts) shares the `invitation` table and most of the same plumbing. The Vercel / Resend / Supabase configuration covers both surfaces by side effect, but feature-level work on workspace invites is not part of this epic.
- Bulk invite (CSV upload, paste-many-emails). The current single-recipient flow is the contract.
- Decline / "leave board" UX. The `/join/[token]` page has a placeholder "Decline" link that goes home; building a real decline action is a separate piece of work.
- Custom redirect after accept (currently always `/`). If we want to drop the new member directly into the board view, that is a one-line change but a product decision that belongs in its own slice.
- Re-running the visual fidelity audit on the invite email or the join page. The locked specs in the conversion-plan design system are the contract; this epic does not reopen them.

## Approach

1. **Audit first.** Before changing anything, produce `docs/roadmap/_dispatch/epic-01-audit.md` listing: the current values (or "unset") of every relevant env var on each Vercel environment, the current Resend domain status (verified / pending / missing records), the current Supabase Site URL and Redirect URL allowlist, and the gap between today and the In Scope contract. This is the slice spec's source of truth and protects the executor from making judgement calls about live infra.
2. **Two parallel-safe slice families.**
   - **Ops slice** (one slice, executed by a maintainer with dashboard access — not a Sonnet executor): Vercel env vars, Resend DNS, Supabase Auth config. The executor cannot do this; planning should explicitly mark it as a human task and produce a checklist instead of an executable spec.
   - **Code slices** (parallel-safe under Sonnet): (a) sign-up `next=` plumbing + E2E test; (b) `inviterName` fallback copy in the invite email + render snapshot test; (c) new runbook + cross-links. These do not overlap files and can run in parallel.
3. **Smoke test gates done.** Code slices land on the epic branch; ops slice completes on the maintainer's side; then the smoke test in production runs from the merged epic branch. If the smoke test fails, the failure mode goes back through `/plan-epic` as a followup slice — not a hot-patch.
4. **No schema, no RLS.** The `invitation` table, the `board_member` table, and all related policies are unchanged. Any temptation to "while we're here, fix the schema" gets bounced to its own epic.

## Tasks

1. **Audit current state** — produce `_dispatch/epic-01-audit.md` against the In Scope checklist. Resolve open questions (Supabase email routing, `EMAIL_FROM` value).
2. **Ops checklist (maintainer task, not executor)** — Vercel env vars on Production + Preview, Resend domain DNS, Supabase Site URL + Redirect URL allowlist. Sign off in the audit doc.
3. **Code slice: sign-up next= plumbing** — thread the `next` query param from sign-in link → sign-up page → sign-up server action → Supabase confirmation `redirectTo` → post-confirmation redirect. Cover with an E2E test extending [`tests/e2e/invitation-accept.spec.ts`](../../tests/e2e/invitation-accept.spec.ts).
4. **Code slice: invite email copy fallback** — verify [`emails/invite/Invite.tsx`](../../emails/invite/Invite.tsx) renders sensibly when `display_name` is null and `email` is the only identifier. Tighten the fallback if it reads as anonymous. Add a render snapshot test in [`tests/unit/email-render.test.tsx`](../../tests/unit/email-render.test.tsx).
5. **Code slice: runbook** — write `docs/runbooks/board-invitations.md`. Cross-link from `rotate-secrets.md` and `preview-environments.md`.
6. **Smoke test in production** — send a real invite from the production deploy to (a) a brand-new recipient and (b) an existing-user recipient. Confirm both paths end in the recipient as a `board_member`. Record results in `_dispatch/epic-01-smoke.md`.
7. **Followups, if any** — capture anything found during smoke (e.g. duplicate-invite handling) as followup slice specs.

## Definition of done

- Every env var in [`lib/env.ts`](../../lib/env.ts) required for board invites is set on the correct Vercel environments with the correct values; the audit doc records this with a date.
- The Resend sending domain is verified (SPF + DKIM at minimum) in the Resend dashboard; the runbook captures the DNS records.
- Supabase Auth Site URL points at `NEXT_PUBLIC_SITE_URL`; the Redirect URL allowlist covers the production apex and the preview wildcards; the open question about SMTP routing (Supabase default vs. Resend SMTP) is resolved and applied.
- The new-user invite path is functional: a stranger clicking the join link, opting to create an account, verifying their email, lands on the board they were invited to — not on `/`.
- A render snapshot of the invite email exists and covers the no-display-name fallback.
- `docs/runbooks/board-invitations.md` exists and is sufficient for a maintainer setting up a new deploy (e.g. staging) from scratch.
- A real production invitation has been sent, received in a real inbox (not spam), accepted, and resulted in the recipient becoming a `board_member`. Evidence captured in `_dispatch/epic-01-smoke.md`.
- An existing-user production invitation has been sent and the in-app notification + email both fire. Evidence captured in the same doc.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the Playwright suite all pass on the epic branch.

## Open questions

1. **Supabase Auth email delivery — default templates or Resend SMTP?** Pros and cons captured in the In Scope section. Default = simpler, two providers in the loop. Resend SMTP = one provider, unified analytics and deliverability, but requires Supabase SMTP credentials and slight template port. Resolve in planning.
2. **Canonical `EMAIL_FROM` value.** Today the default is `Donezo <noreply@donezo.app>`. Confirm the apex domain (`donezo.app` vs. another), the local-part (`noreply`, `hello`, `team`), and the display name. Record the decision in the runbook.
3. **Apex domain and DNS owner.** Which DNS provider hosts `donezo.app`? Who has access? Required before SPF/DKIM records can be added. Identify in planning.
4. **Preview deploys: do they need their own Resend domain, or just the safe-list?** The safe-list approach in [`lib/email/send.ts`](../../lib/email/send.ts) is sufficient if previews share the production sender domain. If we want previews to send freely from a `preview.donezo.app` subdomain, that is a separate DNS configuration. Recommend deferring; document in the runbook.
5. **Existing-board-member invite — server-side reject or UI-side guard?** Today the schema allows inserting an `invitation` row whose email matches an existing `board_member.user_id`'s profile email. The accept flow would no-op cleanly, but the admin sees no warning. Decide whether to add a server-side preflight check or leave as-is. Recommend filing as a followup if found during smoke, not blocking the epic.
