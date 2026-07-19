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

ensure_default_route() {
    # Inbound MikroTik handshakes are DNAT'd from the router's PUBLIC IP. Without
    # a default route the container kernel has (a) no reverse path back to that
    # source — so loose reverse-path filtering (rp_filter=2, which CANNOT be
    # disabled here because /proc/sys is mounted read-only) drops the handshake
    # before it reaches the wg socket — and (b) nowhere to send the handshake
    # REPLY (conntrack un-DNATs it back to the public IP on the host). Docker
    # normally installs this route via the bridge gateway; wg-quick churn can wipe
    # it, so restore it whenever it is missing. Restoring the route fixes both the
    # inbound rp_filter drop and the outbound reply in one shot.
    if ip route show default | grep -q .; then
        return 0
    fi
    local gw
    gw=$(ip -4 route show dev eth0 scope link 2>/dev/null | awk 'NR==1{print $1}' \
         | awk -F'[./]' 'NF>=4{print $1"."$2"."$3".1"}')
    if [ -n "$gw" ]; then
        ip route replace default via "$gw" dev eth0 \
            && echo "[infora-wg] default route via $gw restored (wg handshake path)"
    fi
}

apply_conf() {
    # Bring a WireGuard config up, or update it in place when the interface
    # already exists. `wg syncconf` applies peer/key changes WITHOUT tearing the
    # interface down, so an established handshake survives a config rewrite —
    # only a missing interface triggers a full `wg-quick up`. This is what lets a
    # newly provisioned peer take effect without flapping every other tunnel.
    local conf="$1"
    local iface="$2"
    if [[ ! -f "$conf" ]]; then
        return 0
    fi
    if ip link show "$iface" >/dev/null 2>&1; then
        if wg syncconf "$iface" <(wg-quick strip "$conf") 2>/dev/null; then
            return 0
        fi
        echo "[infora-wg] syncconf $iface failed — rebuilding interface"
        ip link del "$iface" 2>/dev/null || true
    fi
    echo "[infora-wg] Bringing up $iface from $conf"
    wg-quick up "$conf" || echo "[infora-wg] warn: wg-quick up $iface failed (may retry after peers exist)"
}

apply_all() {
    # Customer VPN servers (per ISP)
    while IFS= read -r -d '' wg0; do
        apply_conf "$wg0" "wg0-flask"
    done < <(find /config -path '*/server_*/wg0.conf' -print0 2>/dev/null || true)
    # Management tunnel (MikroTik → billing host, UDP 51821)
    apply_conf "/config/mgmt/wg-mgmt.conf" "wg-mgmt"
    ensure_default_route
    ensure_mgmt_nat
    ensure_radius_forward
}

# Signature of every managed config (path + mtime). Changes the moment Flask
# rewrites a config, which is how the watch loop below knows to re-apply.
configs_signature() {
    {
        [ -f /config/mgmt/wg-mgmt.conf ] && stat -c '%n:%Y' /config/mgmt/wg-mgmt.conf
        find /config -path '*/server_*/wg0.conf' -exec stat -c '%n:%Y' {} \; 2>/dev/null
    } 2>/dev/null | sort | md5sum | awk '{print $1}'
}

# Initial apply at container start.
apply_all
LAST_SIG="$(configs_signature)"

# Watch for Flask-written config changes and re-apply within seconds — no more
# periodic teardown. A peer added during provisioning takes effect almost
# immediately (mtime bumps → syncconf), and established tunnels are never torn
# down just because the loop ticked.
(
    ticks=0
    while true; do
        sleep 5
        # Cheap every-tick guard: if the default route ever gets wiped (wg-quick
        # churn), restore it fast so handshakes keep flowing.
        ensure_default_route 2>/dev/null || true
        SIG="$(configs_signature)"
        if [ "$SIG" != "$LAST_SIG" ]; then
            echo "[infora-wg] config change detected — re-applying"
            apply_all
            LAST_SIG="$SIG"
        fi
        # Re-assert NAT / RADIUS DNAT roughly every 2 min in case the freeradius
        # container IP changed. Both are idempotent (-C guarded) and do not
        # disturb the live tunnel.
        ticks=$((ticks + 1))
        if [ "$ticks" -ge 24 ]; then
            ensure_mgmt_nat 2>/dev/null || true
            ensure_radius_forward 2>/dev/null || true
            ticks=0
        fi
    done
) &
