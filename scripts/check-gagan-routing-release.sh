#!/usr/bin/env bash
set -euo pipefail

# Read-only release guard for the Gagan routing candidate. It validates the
# source identity and active client/Admin target; it never builds, deploys,
# tags, or changes repository state.

branch=$(git branch --show-current)
case "$branch" in
  codex/gagan-jain-padam-routing-v1|codex/gagan-jain-padam-dynamic-routing-v1)
    ;;
  *)
    echo "wrong branch: $branch" >&2
    exit 1
    ;;
esac

if [[ -n "$(git status --porcelain)" ]]; then
  echo "working tree is dirty" >&2
  exit 1
fi

git diff --check

for active_config in rep/eas.json mobile/eas.json admin/vercel.json admin/.env.example admin/vite.config.ts; do
  if rg -q 'https://gagan-staging-api\.onrender\.com' "$active_config"; then
    echo "forbidden alternate API is present in active release config: $active_config" >&2
    exit 1
  fi
done

for active_config in rep/eas.json mobile/eas.json admin/vercel.json admin/.env.example admin/vite.config.ts; do
  if ! rg -q 'https://gagan-srat\.onrender\.com' "$active_config"; then
    echo "canonical Gagan staging API is missing from active release config: $active_config" >&2
    exit 1
  fi
done

baseline_tag=$(git rev-parse gagan-canonical-product-v1^{} 2>/dev/null || true)
if [[ -z "$baseline_tag" ]] || ! git merge-base --is-ancestor "$baseline_tag" HEAD; then
  echo "source does not descend from gagan-canonical-product-v1" >&2
  exit 1
fi

echo "Gagan routing release guard: PASS"
echo "branch=$branch"
echo "source=$(git rev-parse HEAD)"
