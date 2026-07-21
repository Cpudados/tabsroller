#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VERSION="$(sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${EXTENSION_DIR}/manifest.json" | head -n 1)"
OUTPUT_PATH="${1:-${EXTENSION_DIR}/../tabscroll-${VERSION}.zip}"

if [[ -z "${VERSION}" ]]; then
  echo "Could not read the extension version from manifest.json" >&2
  exit 1
fi

cd "${EXTENSION_DIR}"

if command -v zip >/dev/null 2>&1; then
  zip -qrFS "${OUTPUT_PATH}" . \
    -x 'scripts/*' 'README.md' 'STORE_SUBMISSION.md' 'PRIVACY.md'
elif command -v powershell.exe >/dev/null 2>&1; then
  EXTENSION_PATH_WINDOWS="$(wslpath -w "${EXTENSION_DIR}")"
  OUTPUT_PATH_WINDOWS="$(wslpath -w "${OUTPUT_PATH}")"
  powershell.exe -NoProfile -Command \
    "\$items = Get-ChildItem -LiteralPath '${EXTENSION_PATH_WINDOWS}' | Where-Object { \$_.Name -notin @('scripts', 'README.md', 'STORE_SUBMISSION.md', 'PRIVACY.md') }; Compress-Archive -LiteralPath \$items.FullName -DestinationPath '${OUTPUT_PATH_WINDOWS}' -Force"
else
  echo "Packaging requires either zip or Windows PowerShell" >&2
  exit 1
fi

printf 'Created %s\n' "${OUTPUT_PATH}"
