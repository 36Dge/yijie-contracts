#!/usr/bin/env bash
set -euo pipefail

base_ref="${1:-main}"
base_commit="$(git rev-parse --verify "${base_ref}^{commit}")"
# Canonical URI IDs identify local authorities, not live download locations.
# Each side resolves its own source closure, including JSON Schema dependencies.
comparison_tree="$(mktemp -d)"
trap 'rm -rf "$comparison_tree"' EXIT
node scripts/prepare-breaking-inputs.mjs "$base_commit" "$comparison_tree"

while IFS= read -r spec; do
  GOPROXY=off go tool oasdiff breaking --fail-on ERR "$comparison_tree/base/$spec" "$comparison_tree/current/$spec"
done < "$comparison_tree/specs.txt"

pnpm exec buf breaking protobuf --against ".git#commit=$base_commit,subdir=protobuf"
node scripts/check-asyncapi-breaking.mjs "$base_commit"
node scripts/check-jsonschema-breaking.mjs "$base_commit"
