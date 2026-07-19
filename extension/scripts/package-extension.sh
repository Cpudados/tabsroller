#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
VERSION="$(node -p "require('${EXTENSION_DIR}/manifest.json').version")"
OUTPUT_PATH="${1:-${EXTENSION_DIR}/../tabscroll-${VERSION}.zip}"

cd "${EXTENSION_DIR}"
zip -qrFS "${OUTPUT_PATH}" . \
  -x 'scripts/*' 'README.md' 'STORE_SUBMISSION.md' 'PRIVACY.md'

printf 'Created %s\n' "${OUTPUT_PATH}"
