#!/usr/bin/env bash
# Fails if the Node version in .nvmrc differs from the one pinned in the Dockerfiles and NODE_IMAGE,
# or if any of those references lacks a sha256 digest or uses a different one (OD-048, TD-045).
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

want="$(tr -d '[:space:]' < .nvmrc)"
status=0
digests=""
pin_re='^node:[0-9][0-9.]*-[a-z0-9-]+@sha256:[0-9a-f]{64}$'

for f in docker/worker.Dockerfile docker/web.Dockerfile Makefile; do
  found="$(grep -Eo 'node:[0-9][0-9.]*-' "$f" | sort -u | tr '\n' ' ' | sed 's/ $//' || true)"
  if [ "$found" != "node:${want}-" ]; then
    echo "check-node-version: $f pins '${found:-nothing}', .nvmrc says 'node:${want}-'" >&2
    status=1
  fi

  # Every FROM / NODE_IMAGE line that mentions a node image must pin it by tag and digest.
  refs="$(grep -Ei '^[[:space:]]*(FROM|NODE_IMAGE)[[:space:]:=][^#]*node[:@]' "$f" || true)"
  if [ -z "$refs" ]; then
    echo "check-node-version: $f has no node image reference" >&2
    status=1
    continue
  fi
  while IFS= read -r line; do
    tok="$(printf '%s\n' "$line" | grep -Eoi 'node[:@][^[:space:]]*' | head -n 1)"
    if [[ "$tok" =~ $pin_re ]]; then
      digests="${digests}${tok##*@} ${f}"$'\n'
    elif [[ "$tok" != *"@sha256:"* ]]; then
      echo "check-node-version: $f has a node image without sha256 digest: $tok" >&2
      status=1
    else
      echo "check-node-version: $f node image '$tok' is not node:<version>-<variant>@sha256:<64 hex>" >&2
      status=1
    fi
  done <<< "$refs"
done

if [ "$(printf '%s' "$digests" | cut -d' ' -f1 | sort -u | wc -l | tr -d ' ')" -gt 1 ]; then
  echo "check-node-version: Node image digests differ between files:" >&2
  printf '%s' "$digests" | sed 's/^/  /' >&2
  status=1
fi

[ "$status" -eq 0 ] && echo "check-node-version: .nvmrc, Dockerfiles and Makefile agree on Node $want and on the image digest"
exit "$status"
