#!/usr/bin/with-contenv bash
# Apply WireGuard configs written by Flask into the linuxserver/wireguard container.
# Mount this folder to /custom-cont-init.d on the wireguard service.

set -e

apply_conf() {
    local conf="$1"
    local iface="$2"
    if [[ ! -f "$conf" ]]; then
        return 0
    fi
    echo "[infora-wg] Applying $conf as $iface"
    ip link del "$iface" 2>/dev/null || true
    wg-quick up "$conf" || echo "[infora-wg] warn: wg-quick up $iface failed (may retry after peers exist)"
}

# Customer VPN servers (per ISP)
while IFS= read -r -d '' wg0; do
    apply_conf "$wg0" "wg0-flask"
done < <(find /config -path '*/server_*/wg0.conf' -print0 2>/dev/null || true)

# Management tunnel (MikroTik → billing host, UDP 51821)
apply_conf "/config/mgmt/wg-mgmt.conf" "wg-mgmt"

# Periodic re-apply when Flask updates configs (background)
(
    while true; do
        sleep 120
        apply_conf "/config/mgmt/wg-mgmt.conf" "wg-mgmt" 2>/dev/null || true
        while IFS= read -r -d '' wg0; do
            apply_conf "$wg0" "wg0-flask" 2>/dev/null || true
        done < <(find /config -path '*/server_*/wg0.conf' -print0 2>/dev/null || true)
    done
) &
