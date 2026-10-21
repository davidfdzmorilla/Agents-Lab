#!/usr/bin/env bash
# Fails if the Node version in .nvmrc differs from the one pinned in the Dockerfiles and NODE_IMAGE (OD-048).
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

want="$(tr -d '[:space:]' < .nvmrc)"
status=0

for f in docker/worker.Dockerfile docker/web.Dockerfile Makefile; do
  found="$(grep -Eo 'node:[0-9][0-9.]*-' "$f" | sort -u || true)"
  if [ "$found" != "node:${want}-" ]; then
    echo "check-node-version: $f pins '${found:-nothing}', .nvmrc says 'node:${want}-'" >&2
    status=1
  fi
done

[ "$status" -eq 0 ] && echo "check-node-version: .nvmrc, Dockerfiles and Makefile agree on Node $want"
exit "$status"
