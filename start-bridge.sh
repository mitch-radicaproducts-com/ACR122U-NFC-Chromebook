#!/bin/bash
# The filename is start-bridge.sh. start_bridge.sh does not exist.
# ChromeOS mounts My files as noexec, so start this with bash:
#   bash /mnt/chromeos/shared/MyFiles/NFC/start-bridge.sh
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${here}/bridge/start-bridge.sh"
