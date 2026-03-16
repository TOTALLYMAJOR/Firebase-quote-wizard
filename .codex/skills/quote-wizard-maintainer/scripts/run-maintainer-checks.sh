#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$ROOT_DIR"

MODE="full"
WITH_CWV="false"

usage() {
  cat <<'USAGE'
Usage: run-maintainer-checks.sh [--quick] [--build-only] [--with-cwv]

Options:
  --quick       Run lightweight checks (environment validation only)
  --build-only  Run build + governance + bundle checks
  --with-cwv    Also run Lighthouse CWV smoke gate
  -h, --help    Show this help message
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick)
      MODE="quick"
      shift
      ;;
    --build-only)
      MODE="build-only"
      shift
      ;;
    --with-cwv)
      WITH_CWV="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$MODE" != "build-only" ]]; then
  echo "==> Running environment validation"
  npm run check:env
fi

if [[ "$MODE" != "quick" ]]; then
  echo "==> Running production build"
  npm run build

  echo "==> Running documentation governance checks"
  npm run check:docs:governance

  echo "==> Enforcing bundle budget"
  npm run check:perf:bundle
fi

if [[ "$WITH_CWV" == "true" ]]; then
  echo "==> Running CWV smoke gate"
  npm run check:perf:cwv
fi

echo "Checks completed successfully."
