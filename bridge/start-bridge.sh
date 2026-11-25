#!/bin/bash
# Daily launcher for the Inventory Day NFC bridge.
# The filename is start-bridge.sh. start_bridge.sh does not exist.
#
# First-time setup is the installer at the project root:
#   bash install.sh
# After that, open "Inventory Day NFC" from the Chromebook app list.
# Leave the window open while counting. Close it to stop the reader.

set -u

source_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
home_nfc="${HOME}/nfc"
# shellcheck source=setup.sh
source "${source_dir}/setup.sh"

if [[ "${source_dir}" == /mnt/chromeos/* ]]; then
    copy_bridge_runtime "${source_dir}" "${home_nfc}"
    exec "${home_nfc}/start-bridge.sh"
fi

cd "${source_dir}"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "Node is not installed in Linux. Run the installer, then start the bridge again:"
    echo "  bash <project>/install.sh"
    echo
    echo "Or install the packages yourself:"
    echo "  sudo apt update && sudo apt install -y pcscd libccid pcsc-tools libpcsclite-dev build-essential nodejs npm"
    echo
    echo "Press Enter to close."
    read -r _
    exit 1
fi

if [[ ! -d node_modules/nfc-pcsc ]]; then
    echo "Installing the reader library. This can take a minute the first time."
    npm install || {
        echo
        echo "Install failed. Press Enter to close."
        read -r _
        exit 1
    }
fi

ensure_pcscd

if [[ -x "${home_nfc}/start-bridge.sh" ]]; then
    launch_dir="${home_nfc}"
else
    launch_dir="${source_dir}"
fi
write_launcher "${launch_dir}" "${HOME}/.local/share/applications/inventory-day-nfc.desktop"

echo "Inventory Day NFC bridge. Leave this window open while you count."
echo "Close the window to stop the reader."
echo
node bridge.mjs
status=$?
echo
echo "Bridge stopped. Press Enter to close."
read -r _
exit "${status}"
