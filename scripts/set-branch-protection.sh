#!/usr/bin/env bash
# set-branch-protection.sh — Apply GitHub branch protection rules to `main`.
#
# This script is a one-shot operator action. Run it once after epic 15 merges
# into main. It uses the GitHub CLI (`gh`) to PUT the protection rules defined
# in scripts/branch-protection.json.
#
# Requirements:
#   - gh CLI installed and authenticated (gh auth status)
#   - The authenticated account must have Admin or Owner permission on the repo.
#
# See docs/runbooks/branch-protection.md for the full explanation of each rule.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JSON_PAYLOAD="$SCRIPT_DIR/branch-protection.json"

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Apply GitHub branch protection rules to the 'main' branch of the current repo.

The protection payload is read from scripts/branch-protection.json. The script
detects the owner/repo automatically via 'gh repo view'.

OPTIONS:
  -h, --help      Show this help message and exit
  --dry-run       Print the gh api command but do not execute it

REQUIREMENTS:
  - gh CLI installed:    https://cli.github.com/
  - Authenticated:       gh auth status
  - Admin on the repo:   required to write branch protection rules

EXAMPLE:
  ./scripts/set-branch-protection.sh
  ./scripts/set-branch-protection.sh --dry-run

EOF
}

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    *)
      echo "Unknown option: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Verify prerequisites
# ---------------------------------------------------------------------------
if ! command -v gh &>/dev/null; then
  echo "Error: 'gh' CLI not found." >&2
  echo "Install it from https://cli.github.com/" >&2
  exit 1
fi

if [ ! -f "$JSON_PAYLOAD" ]; then
  echo "Error: payload file not found: $JSON_PAYLOAD" >&2
  echo "Run this script from the repo root, or ensure scripts/branch-protection.json exists." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Detect owner/repo
# ---------------------------------------------------------------------------
echo ""
echo "=== Donezo Branch Protection Setup ==="
echo ""

REPO=$(gh repo view --json owner,name -q '.owner.login + "/" + .name' 2>/dev/null) || {
  echo "Error: could not detect repo via 'gh repo view'." >&2
  echo "Make sure you are inside the repo directory and 'gh' is authenticated." >&2
  exit 1
}

echo "Repo:    $REPO"
echo "Branch:  main"
echo "Payload: $JSON_PAYLOAD"
echo ""

# ---------------------------------------------------------------------------
# Build the command
# ---------------------------------------------------------------------------
GH_CMD="gh api -X PUT \"/repos/$REPO/branches/main/protection\" --input \"$JSON_PAYLOAD\""

if [ "$DRY_RUN" = true ]; then
  echo "[dry-run] Would execute:"
  echo ""
  echo "  $GH_CMD"
  echo ""
  echo "[dry-run] No changes made."
  exit 0
fi

# ---------------------------------------------------------------------------
# Apply the rules
# ---------------------------------------------------------------------------
echo "Applying branch protection rules..."
echo ""

gh api -X PUT "/repos/$REPO/branches/main/protection" --input "$JSON_PAYLOAD"

echo ""
echo "Branch protection rules applied successfully."
echo ""
echo "=== Confirmation ==="
echo ""
echo "Verify the rules are in effect:"
echo ""
echo "  gh api /repos/$REPO/branches/main/protection | jq '{required_status_checks,required_linear_history,allow_force_pushes,allow_deletions}'"
echo ""
echo "Or open in the browser:"
echo "  https://github.com/$REPO/settings/branch_protection_rules"
echo ""
echo "See docs/runbooks/branch-protection.md for the full list of expected values."
