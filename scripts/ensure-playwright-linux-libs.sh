#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$(uname -s)" != "Linux" ]]; then
  exit 0
fi

LIB_ROOT="$ROOT_DIR/.cache/playwright-libs/root"
DEB_DIR="$ROOT_DIR/.cache/playwright-libs/debs"
LIB_DIR="$LIB_ROOT/usr/lib/x86_64-linux-gnu"

mkdir -p "$LIB_ROOT" "$DEB_DIR"

need_libs=0
for lib in libnspr4.so libnss3.so libnssutil3.so libasound.so.2; do
  if [[ ! -f "$LIB_DIR/$lib" ]]; then
    need_libs=1
    break
  fi
done

if [[ "$need_libs" -eq 1 ]]; then
  pushd "$DEB_DIR" >/dev/null
  apt-get download libnspr4 libnss3 libasound2t64 >/dev/null
  for deb in ./*.deb; do
    dpkg-deb -x "$deb" "$LIB_ROOT"
  done
  popd >/dev/null
fi

echo "$LIB_DIR"
