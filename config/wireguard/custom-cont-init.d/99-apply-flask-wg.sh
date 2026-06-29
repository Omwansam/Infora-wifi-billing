#!/usr/bin/with-contenv bash
# Apply WireGuard configs written by Flask into the linuxserver/wireguard container.
# Mount this folder to /custom-cont-init.d on the wireguard service.

set -e

# Enable forwarding so traffic from the flask container (bridge net) can be
# routed into the management tunnel and back.
sysctl -w net.ipv4.ip_forward=1 >/dev/null 2>&1 || true

ensure_mgmt_nat() {
    # SNAT all traffic leaving wg-mgmt to the tunnel server IP (10.250.0.1).
    # The MikroTik peers only allow 10.250.0.1/32, so packets originating from
    # the flask container (172.x) must appear to come from 10.250.0.1, otherwise
    # the router drops the replies and SSH/API never connects.
    if ip link show wg-mgmt >/dev/null 2>&1; then
        if ! iptables -t nat -C POSTROUTING -o wg-mgmt -j MASQUERADE 2>/dev/null; then
            iptables -t nat -A POSTROUTING -o wg-mgmt -j MASQUERADE 2>/dev/null \
                && echo "[infora-wg] MASQUERADE on wg-mgmt added" || true
        fi
    fi
}

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
ensure_mgmt_nat

# Periodic re-apply when Flask updates configs (background)
(
    while true; do
        sleep 120
        apply_conf "/config/mgmt/wg-mgmt.conf" "wg-mgmt" 2>/dev/null || true
        ensure_mgmt_nat 2>/dev/null || true
        while IFS= read -r -d '' wg0; do
            apply_conf "$wg0" "wg0-flask" 2>/dev/null || true
        done < <(find /config -path '*/server_*/wg0.conf' -print0 2>/dev/null || true)
    done
) &
