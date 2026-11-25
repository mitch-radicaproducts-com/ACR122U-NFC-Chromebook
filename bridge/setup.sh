# Shared by install.sh and start-bridge.sh. Source this file; do not execute it.
# The runtime copy in ~/nfc is the one that runs while counting. npm install
# belongs there, on the Linux disk, never on /mnt/chromeos.

copy_bridge_runtime() {
    local source_dir="$1"
    local home_nfc="$2"
    mkdir -p "${home_nfc}"
    cp -a \
        "${source_dir}/bridge.mjs" \
        "${source_dir}/ndef.mjs" \
        "${source_dir}/package.json" \
        "${source_dir}/start-bridge.sh" \
        "${source_dir}/setup.sh" \
        "${home_nfc}/"
    if [[ -f "${source_dir}/package-lock.json" ]]; then
        cp -a "${source_dir}/package-lock.json" "${home_nfc}/"
    fi
    chmod +x "${home_nfc}/start-bridge.sh"
}

ensure_pcscd() {
    if ! command -v systemctl >/dev/null 2>&1; then
        return 0
    fi
    local pcscd_default="${PCSCD_DEFAULT:-/etc/default/pcscd}"
    local polkit_changed=0
    if [[ ! -f "${pcscd_default}" ]] || ! grep -q -- '--disable-polkit' "${pcscd_default}"; then
        echo 'PCSCD_ARGS=--disable-polkit' | sudo tee -a "${pcscd_default}" >/dev/null
        polkit_changed=1
    fi
    if [[ "${polkit_changed}" == 1 ]]; then
        sudo systemctl restart pcscd || true
    elif ! systemctl is-active --quiet pcscd; then
        sudo systemctl start pcscd || true
    fi
}

write_launcher() {
    local home_nfc="$1"
    local launcher="$2"
    local exec_line
    local use_terminal
    mkdir -p "$(dirname "${launcher}")"
    if command -v x-terminal-emulator >/dev/null 2>&1; then
        exec_line="x-terminal-emulator -e ${home_nfc}/start-bridge.sh"
        use_terminal="false"
    else
        exec_line="${home_nfc}/start-bridge.sh"
        use_terminal="true"
    fi
    cat > "${launcher}" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=Inventory Day NFC
Comment=Start the ACR122U bridge for Inventory Day
Exec=${exec_line}
Terminal=${use_terminal}
Categories=Utility;
StartupNotify=false
EOF
    chmod +x "${launcher}" "${home_nfc}/start-bridge.sh"
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$(dirname "${launcher}")" >/dev/null 2>&1 || true
    fi
}
