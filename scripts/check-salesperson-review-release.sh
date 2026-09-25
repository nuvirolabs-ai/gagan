#!/usr/bin/env bash
set -euo pipefail

# Narrow, read-only release guard. It never builds, deploys, tags, or changes
# repository state. Run it from the repository root before producing a review
# APK and after any future baseline descendant is prepared.

branch=$(git branch --show-current)
case "$branch" in
  codex/gagan-canonical-product-v1|codex/gagan-salesperson-canonical-v1|codex/gagan-jain-padam-routing-v1|codex/gagan-jain-padam-dynamic-routing-v1)
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

if ! rg -q 'https://gagan-srat\.onrender\.com' rep/eas.json; then
  echo "approved review API is not present in rep/eas.json" >&2
  exit 1
fi

for active_config in rep/eas.json mobile/eas.json admin/vercel.json admin/.env.example admin/vite.config.ts; do
  if rg -q 'https://gagan-staging-api\.onrender\.com' "$active_config"; then
    echo "forbidden alternate API is present in active release config: $active_config" >&2
    exit 1
  fi
done

if git show-ref --verify --quiet refs/tags/gagan-salesperson-baseline-v1; then
  baseline_tag=$(git rev-parse refs/tags/gagan-salesperson-baseline-v1^{} 2>/dev/null)
  if ! git merge-base --is-ancestor "$baseline_tag" HEAD; then
    echo "source does not descend from gagan-salesperson-baseline-v1" >&2
    exit 1
  fi
fi

echo "Salesperson review release guard: PASS"
echo "branch=$branch"
echo "source=$(git rev-parse HEAD)"
