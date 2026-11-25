#!/bin/bash
# Pack the extension folder into dist/inventory-day-nfc.zip.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "${root}/dist"
rm -f "${root}/dist/inventory-day-nfc.zip"
(
    cd "${root}/extension"
    zip -r "${root}/dist/inventory-day-nfc.zip" manifest.json background.js content.js reading.mjs
)
echo "Wrote ${root}/dist/inventory-day-nfc.zip"
