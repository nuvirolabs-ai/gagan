#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
verification_database_url="${DATABASE_URL:-postgresql://gagan:gagan@localhost:5432/gagan_test}"

npm --prefix "$repo_root/backend" run typecheck
npm --prefix "$repo_root/backend" test
npm --prefix "$repo_root/backend" run build
(cd "$repo_root/backend" && DATABASE_URL="$verification_database_url" npx prisma validate)
npm --prefix "$repo_root/mobile" run typecheck
npm --prefix "$repo_root/mobile" test
npm --prefix "$repo_root/rep" run typecheck
npm --prefix "$repo_root/rep" test
npm --prefix "$repo_root/founder" run typecheck
npm --prefix "$repo_root/founder" test
npm --prefix "$repo_root/admin" run lint
npm --prefix "$repo_root/admin" test
npm --prefix "$repo_root/admin" run build
