# Branch Protection

> **Until `scripts/set-branch-protection.sh` is run, branch protection is NOT
> in force. The operator must run it manually after epic 15 merges into main.**

## When to use this runbook

Use this runbook to:

- Understand the desired branch-protection state for `main`.
- Apply the rules for the first time (one-shot after epic 15 lands).
- Restore the rules if they are accidentally disabled.
- Audit the current protection state.

## Pre-flight

- Confirm you have **Admin** or **Owner** permission on the GitHub repo.
- Confirm the `gh` CLI is installed and authenticated:
  ```bash
  gh auth status
  ```
- Confirm you are inside the repo directory (so `gh repo view` auto-detects it).
- Confirm epic 15 has merged into `main` — the required status-check job names
  must exist in `.github/workflows/ci.yml` before GitHub will accept them as
  required contexts.

## Desired protection state

| Rule | Value | Notes |
|------|-------|-------|
| Require pull request before merging | Enabled | No direct push to `main` |
| Required approving reviews | 0 | Solo repo; checks are the gate, not reviews |
| Dismiss stale reviews | Enabled | Stale approvals cleared on new push |
| Require code owner reviews | Disabled | No CODEOWNERS file in v1 |
| Require status checks to pass | Enabled | See table below |
| Require branches to be up to date | Enabled (`strict: true`) | |
| Require linear history | Enabled | Squash merges only |
| Allow force pushes | Disabled | |
| Allow deletions | Disabled | |
| Require conversation resolution | Enabled | |
| Enforce admins | **Disabled** | Owner can bypass in emergencies — see note below |
| Restrictions (push allowlist) | None | GitHub default: only people with Write access |

> **Note on `enforce_admins: false`:** This allows repo admins to bypass the
> rules in a genuine emergency (e.g., a broken CI job that blocks a hotfix). The
> expectation is that this bypass is exercised rarely and always followed by a
> post-mortem comment in the PR. Enabling `enforce_admins: true` is a stronger
> posture but may leave the operator locked out if a required job is broken.

### Required status checks

The following CI jobs (from `.github/workflows/ci.yml`) must pass before a PR
can be merged into `main`.

| Job ID | Display name | Why required |
|--------|-------------|--------------|
| `lint` | Lint | Biome linting + formatting |
| `typecheck` | Typecheck | TypeScript `--noEmit` |
| `build` | Build | Next.js production build |
| `unit` | Unit tests | Vitest suite |
| `policies` | Policy tests (pgTAP) | RLS policy correctness |
| `e2e` | E2E tests (Playwright) | End-to-end smoke coverage |
| `drift` | Schema drift check | Migrations in sync with local schema |

The following jobs are **soft** (not required). They run on PRs but have
`continue-on-error: true` and are not gating:

| Job ID | Display name | Reason soft |
|--------|-------------|-------------|
| `bundle` | Bundle size analysis | Informational only — no enforced budget in v1 |
| `lighthouse` | Lighthouse CI | Requires Vercel secrets; soft for v1 |

## Applying the rules

### One-shot script (preferred)

The script at `scripts/set-branch-protection.sh` applies the rules in a single
command. It reads the payload from `scripts/branch-protection.json` and calls
the GitHub API.

```bash
# Apply (run once after epic 15 merges)
./scripts/set-branch-protection.sh

# Preview what would be sent without making changes
./scripts/set-branch-protection.sh --dry-run

# Help
./scripts/set-branch-protection.sh --help
```

The script:
1. Detects `owner/repo` via `gh repo view`.
2. Runs: `gh api -X PUT "/repos/$REPO/branches/main/protection" --input scripts/branch-protection.json`
3. Prints a verification command when done.

### Manual invocation (if the script cannot run)

```bash
REPO=$(gh repo view --json owner,name -q '.owner.login + "/" + .name')
gh api -X PUT "/repos/$REPO/branches/main/protection" \
  --input scripts/branch-protection.json
```

### JSON payload

The exact payload is in `scripts/branch-protection.json`. Its shape follows the
[GitHub REST API for branch protection](https://docs.github.com/en/rest/branches/branch-protection):

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["lint", "typecheck", "build", "unit", "policies", "e2e", "drift"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
```

## Confirmation

After running the script, verify the rules are in force:

```bash
REPO=$(gh repo view --json owner,name -q '.owner.login + "/" + .name')

# Full protection object
gh api /repos/$REPO/branches/main/protection

# Focused check — required contexts + key flags
gh api /repos/$REPO/branches/main/protection \
  | jq '{
      required_status_checks: .required_status_checks.contexts,
      strict: .required_status_checks.strict,
      required_linear_history: .required_linear_history.enabled,
      allow_force_pushes: .allow_force_pushes.enabled,
      allow_deletions: .allow_deletions.enabled
    }'
```

Expected output of the focused check:

```json
{
  "required_status_checks": [
    "lint",
    "typecheck",
    "build",
    "unit",
    "policies",
    "e2e",
    "drift"
  ],
  "strict": true,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

You can also verify in the GitHub UI:
`https://github.com/<owner>/<repo>/settings/branch_protection_rules`

## Rollback

If branch protection needs to be removed temporarily (e.g., a broken required
check is blocking all merges):

```bash
REPO=$(gh repo view --json owner,name -q '.owner.login + "/" + .name')
gh api -X DELETE "/repos/$REPO/branches/main/protection"
```

Re-apply when the issue is resolved by running the script again.

## Related runbooks

- [incident-response.md](incident-response.md) — if a broken CI job is blocking
  a hotfix and you need to temporarily bypass protection
- [rotate-secrets.md](rotate-secrets.md) — updating GitHub Actions secrets
  referenced by the required CI jobs
