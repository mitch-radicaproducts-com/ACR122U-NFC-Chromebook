#!/bin/bash
# One-time installer for the Inventory Day NFC reader. Safe to run again.
# ChromeOS mounts My files as noexec, so start this with bash:
#   bash /mnt/chromeos/shared/MyFiles/NFC/install.sh

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bridge_src="${root}/bridge"
home_nfc="${HOME}/nfc"
launcher="${HOME}/.local/share/applications/inventory-day-nfc.desktop"

if [[ ! -f "${bridge_src}/bridge.mjs" || ! -f "${bridge_src}/start-bridge.sh" ]]; then
    echo "Cannot find the bridge files in ${bridge_src}."
    exit 1
fi

case "${home_nfc}" in
    /mnt/chromeos/*)
        echo "The reader library has to be installed on the Linux disk, in ${HOME}/nfc."
        exit 1
        ;;
esac

# shellcheck source=bridge/setup.sh
source "${bridge_src}/setup.sh"

if [[ "${SKIP_SYSTEM:-}" != 1 ]]; then
    echo "Installing Linux packages. Linux may ask for your password."
    sudo apt update
    sudo apt install -y pcscd libccid pcsc-tools libpcsclite-dev build-essential nodejs npm
    ensure_pcscd
fi

copy_bridge_runtime "${bridge_src}" "${home_nfc}"

if [[ "${SKIP_NPM:-}" != 1 ]]; then
    echo "Installing the reader library in ${home_nfc}."
    (cd "${home_nfc}" && npm install)
fi

write_launcher "${home_nfc}" "${launcher}"

echo
echo "Inventory Day NFC is installed."
echo "Open \"Inventory Day NFC\" from the app list and leave that window open while you count."
echo "Load the Chrome extension from the extension folder. See INSTALL.md."
