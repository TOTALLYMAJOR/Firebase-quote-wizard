#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT_DIR"

WITH_CWV="false"
if [[ "${1:-}" == "--with-cwv" ]]; then
  WITH_CWV="true"
fi

echo "== Release readiness check =="

echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
echo "Working tree status:"
git status --short

echo "==> Running environment validation"
npm run check:env

echo "==> Running production build"
npm run build

echo "==> Running documentation governance checks"
npm run check:docs:governance

echo "==> Enforcing bundle budget"
npm run check:perf:bundle

if [[ "$WITH_CWV" == "true" ]]; then
  echo "==> Running CWV smoke gate"
  npm run check:perf:cwv
fi

echo "==> Most recent CHANGELOG heading"
awk '/^## / {print; exit}' CHANGELOG.md || true

echo "Release readiness checks completed successfully."
