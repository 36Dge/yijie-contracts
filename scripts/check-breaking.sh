#!/usr/bin/env bash
set -euo pipefail

base_ref="${1:-main}"
base_commit="$(git rev-parse --verify "$base_ref")"
# Preserve the source tree so cross-family relative references resolve to the
# matching baseline, never to a current working-tree dependency.
base_tree="$(mktemp -d)"
trap 'rm -rf "$base_tree"' EXIT
git archive "$base_commit" openapi | tar -xf - -C "$base_tree"

for spec in \
  openapi/public/public.yaml \
  openapi/admin/admin.yaml \
  openapi/internal/internal.yaml \
  openapi/agent-host/agent-host.yaml \
  openapi/native-conversation/native-conversation.yaml \
  openapi/runtime-permissions/runtime-permissions.yaml \
  openapi/native-conversation-v2/native-conversation-v2.yaml \
  openapi/runtime-permissions-v2/runtime-permissions-v2.yaml; do
  if git cat-file -e "$base_ref:$spec" 2>/dev/null; then
    go tool oasdiff breaking "$base_tree/$spec" "$spec"
  fi
done

pnpm exec buf breaking protobuf --against ".git#commit=$base_commit,subdir=protobuf"
node scripts/check-asyncapi-breaking.mjs "$base_ref"
node scripts/check-jsonschema-breaking.mjs "$base_ref"
