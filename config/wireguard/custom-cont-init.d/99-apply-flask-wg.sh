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

ensure_radius_forward() {
    # Routers send RADIUS auth/acct to 10.250.0.1:1812-1813 — those packets
    # terminate HERE (wg-mgmt's address), but FreeRADIUS runs in the
    # infora_freeradius container. DNAT them across the docker bridge while
    # PRESERVING the source IP (10.250.0.x): FreeRADIUS matches each NAS to
    # its per-device clients.conf entry (per-ISP secret) by that source IP,
    # so we must NOT masquerade this flow. The freeradius container carries
    # a return route to 10.250.0.0/24 via this container (see its
    # entrypoint), and conntrack un-DNATs the replies back to 10.250.0.1.
    FR_IP=$(getent hosts infora_freeradius 2>/dev/null | awk '{print $1; exit}')
    if [ -z "$FR_IP" ]; then
        FR_IP=$(getent hosts freeradius 2>/dev/null | awk '{print $1; exit}')
    fi
    if [ -z "$FR_IP" ] || ! ip link show wg-mgmt >/dev/null 2>&1; then
        return 0
    fi
    # Dedicated chain: flush + repopulate is idempotent and survives
    # freeradius container IP changes without any rule parsing.
    iptables -t nat -N INFORA_RADIUS 2>/dev/null || true
    iptables -t nat -F INFORA_RADIUS 2>/dev/null || true
    if ! iptables -t nat -C PREROUTING -i wg-mgmt -d 10.250.0.1 -p udp -j INFORA_RADIUS 2>/dev/null; then
        iptables -t nat -A PREROUTING -i wg-mgmt -d 10.250.0.1 -p udp -j INFORA_RADIUS
    fi
    iptables -t nat -A INFORA_RADIUS -p udp --dport 1812 -j DNAT --to-destination "$FR_IP:1812"
    iptables -t nat -A INFORA_RADIUS -p udp --dport 1813 -j DNAT --to-destination "$FR_IP:1813"
    echo "[infora-wg] RADIUS DNAT 1812-1813 -> $FR_IP"
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
ensure_radius_forward

# Periodic re-apply when Flask updates configs (background)
(
    while true; do
        sleep 120
        apply_conf "/config/mgmt/wg-mgmt.conf" "wg-mgmt" 2>/dev/null || true
        ensure_mgmt_nat 2>/dev/null || true
        ensure_radius_forward 2>/dev/null || true
        while IFS= read -r -d '' wg0; do
            apply_conf "$wg0" "wg0-flask" 2>/dev/null || true
        done < <(find /config -path '*/server_*/wg0.conf' -print0 2>/dev/null || true)
    done
) &
