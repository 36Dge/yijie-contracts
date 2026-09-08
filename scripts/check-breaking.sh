#!/usr/bin/env bash
set -euo pipefail

base_ref="${1:-main}"
base_commit="$(git rev-parse --verify "$base_ref")"

for spec in \
  openapi/public/public.yaml \
  openapi/admin/admin.yaml \
  openapi/internal/internal.yaml \
  openapi/agent-host/agent-host.yaml \
  openapi/native-conversation/native-conversation.yaml; do
  if git cat-file -e "$base_ref:$spec" 2>/dev/null; then
    base_file="$(mktemp)"
    trap 'rm -f "$base_file"' EXIT
    git show "$base_ref:$spec" >"$base_file"
    go tool oasdiff breaking "$base_file" "$spec"
    rm -f "$base_file"
    trap - EXIT
  fi
done

pnpm exec buf breaking protobuf --against ".git#commit=$base_commit,subdir=protobuf"
node scripts/check-asyncapi-breaking.mjs "$base_ref"
node scripts/check-jsonschema-breaking.mjs "$base_ref"
