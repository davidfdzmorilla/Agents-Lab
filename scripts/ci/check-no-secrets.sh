#!/usr/bin/env bash
# Runs .githooks/pre-commit over every file tracked at HEAD (same rules as the hook, no copy).
# A clone with an orphan branch stages the whole tree, so `git diff --cached` sees every line as added.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git clone --quiet "$root" "$tmp/tree"
cd "$tmp/tree"
git checkout --quiet --orphan secrets-scan

count="$(git diff --cached --name-only --diff-filter=ACMR | wc -l | tr -d ' ')"
if [ "$count" -le 0 ]; then
  echo "check-no-secrets: nothing to scan" >&2
  exit 1
fi

bash .githooks/pre-commit
echo "check-no-secrets: $count tracked files scanned, no findings"
