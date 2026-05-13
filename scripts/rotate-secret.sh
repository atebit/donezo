#!/usr/bin/env bash
# rotate-secret.sh — Interactive helper to rotate a Donezo secret in Vercel.
#
# This script removes the old value and prompts Vercel to accept a new value
# for the selected key in the selected environment(s). It does NOT generate a
# new secret or touch Supabase / Resend / Sentry dashboards — those steps are
# manual. See docs/runbooks/rotate-secrets.md for the full procedure.
#
# Requirements:
#   - Vercel CLI installed and authenticated (vercel whoami)
#   - The Vercel project must be linked (vercel link) or you must pass --project

set -euo pipefail

# ---------------------------------------------------------------------------
# Secrets managed by this project (sourced from lib/env.ts)
# ---------------------------------------------------------------------------
MANAGED_SECRETS=(
  "SUPABASE_SERVICE_ROLE_KEY"
  "RESEND_API_KEY"
  "INTERNAL_CRON_SECRET"
  "SUPABASE_DB_WEBHOOK_SECRET"
  "SENTRY_AUTH_TOKEN"
  "NEXT_PUBLIC_SENTRY_DSN"
  "SENTRY_DSN"
)

ENVIRONMENTS=("production" "preview" "development")

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Interactive helper for rotating a Donezo secret in Vercel.

This script does NOT generate new secrets or touch external service dashboards.
Read docs/runbooks/rotate-secrets.md for the full per-secret procedure.

OPTIONS:
  -h, --help        Show this help message and exit

STEPS:
  1. Select the secret to rotate.
  2. Select the Vercel environment(s) to update.
  3. The script removes the old value (vercel env rm) and adds a new one
     (vercel env add — Vercel CLI will prompt you to paste the new value).
  4. You will be reminded to update GitHub Actions repo secrets manually.
  5. Trigger a Vercel redeploy when done.

REQUIREMENTS:
  - Vercel CLI installed:  pnpm add -g vercel
  - Authenticated:         vercel whoami
  - Project linked:        vercel link  (or pass VERCEL_PROJECT below)

EOF
}

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Verify Vercel CLI is available
# ---------------------------------------------------------------------------
if ! command -v vercel &>/dev/null; then
  echo "Error: 'vercel' CLI not found." >&2
  echo "Install it with: pnpm add -g vercel" >&2
  exit 1
fi

echo ""
echo "=== Donezo Secret Rotation Helper ==="
echo "See docs/runbooks/rotate-secrets.md for the full procedure."
echo ""

# ---------------------------------------------------------------------------
# Select secret
# ---------------------------------------------------------------------------
echo "Managed secrets:"
for i in "${!MANAGED_SECRETS[@]}"; do
  printf "  [%d] %s\n" "$((i + 1))" "${MANAGED_SECRETS[$i]}"
done
echo ""
read -rp "Enter the number of the secret to rotate (1-${#MANAGED_SECRETS[@]}): " secret_choice

if ! [[ "$secret_choice" =~ ^[0-9]+$ ]] || \
   [ "$secret_choice" -lt 1 ] || \
   [ "$secret_choice" -gt "${#MANAGED_SECRETS[@]}" ]; then
  echo "Error: invalid selection '$secret_choice'." >&2
  exit 1
fi

SECRET_KEY="${MANAGED_SECRETS[$((secret_choice - 1))]}"
echo "Selected: $SECRET_KEY"
echo ""

# ---------------------------------------------------------------------------
# Select environment(s)
# ---------------------------------------------------------------------------
echo "Environments:"
for i in "${!ENVIRONMENTS[@]}"; do
  printf "  [%d] %s\n" "$((i + 1))" "${ENVIRONMENTS[$i]}"
done
printf "  [%d] all (production + preview + development)\n" "$((${#ENVIRONMENTS[@]} + 1))"
echo ""
read -rp "Enter the number of the environment to update (1-$((${#ENVIRONMENTS[@]} + 1))): " env_choice

if ! [[ "$env_choice" =~ ^[0-9]+$ ]] || \
   [ "$env_choice" -lt 1 ] || \
   [ "$env_choice" -gt "$((${#ENVIRONMENTS[@]} + 1))" ]; then
  echo "Error: invalid selection '$env_choice'." >&2
  exit 1
fi

if [ "$env_choice" -eq "$((${#ENVIRONMENTS[@]} + 1))" ]; then
  SELECTED_ENVS=("${ENVIRONMENTS[@]}")
else
  SELECTED_ENVS=("${ENVIRONMENTS[$((env_choice - 1))]}")
fi

echo "Selected environments: ${SELECTED_ENVS[*]}"
echo ""

# ---------------------------------------------------------------------------
# Confirm
# ---------------------------------------------------------------------------
echo "This will:"
for env in "${SELECTED_ENVS[@]}"; do
  echo "  - vercel env rm $SECRET_KEY $env"
  echo "  - vercel env add $SECRET_KEY $env  (you will be prompted for the new value)"
done
echo ""
read -rp "Proceed? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ---------------------------------------------------------------------------
# Rotate
# ---------------------------------------------------------------------------
echo ""
for env in "${SELECTED_ENVS[@]}"; do
  echo "--- Removing $SECRET_KEY from $env ---"
  # vercel env rm returns non-zero if the var doesn't exist; use || true to continue
  vercel env rm "$SECRET_KEY" "$env" --yes 2>/dev/null || true

  echo "--- Adding $SECRET_KEY to $env (paste the new value when prompted) ---"
  vercel env add "$SECRET_KEY" "$env"
  echo "Done: $SECRET_KEY updated in $env."
  echo ""
done

# ---------------------------------------------------------------------------
# Reminder
# ---------------------------------------------------------------------------
cat <<EOF
=== Next steps ===

1. Update GitHub Actions repo secrets manually:
   GitHub repo → Settings → Secrets and variables → Actions → edit '$SECRET_KEY'

2. Trigger a Vercel redeploy so the new value is picked up:
   vercel --prod
   (or redeploy from the Vercel dashboard)

3. Verify the rotation:
   curl -s https://<your-domain>/api/health | jq .
   Check Sentry for errors in the 15 minutes after redeploy.

See docs/runbooks/rotate-secrets.md for full per-secret verification steps.
EOF
