# MikroTik RouterOS — RADIUS provisioning for Infora ISP billing
# Import: /import file-name=radius-provision.rsc
# Or fetch automatically: GET /api/provision/<token>/script (one-line self-provision)
#
# SET THESE BEFORE IMPORT (the billing API fills them in automatically):
#   RADIUS_SERVER  = IP/hostname of FreeRADIUS (billing server)
#   RADIUS_SECRET  = per-ISP secret from Admin -> ISPs -> RADIUS secret
#   ROUTER_TZ      = router timezone (e.g. Africa/Nairobi)

:local RADIUS_SERVER "10.0.0.10"
:local RADIUS_SECRET "radius_secret_key"
:local RADIUS_TIMEOUT 3000
:local SNMP_COMMUNITY "infora"
:local ROUTER_TZ "Africa/Nairobi"

# --- 0. Connectivity pre-check (abort if no internet) ---
:if ([:len [/ping 8.8.8.8 count=3]] = 0) do={
    :log error "Infora: no internet connectivity, aborting"
    :error "Infora provisioning aborted: no connectivity"
}

# --- 1. RADIUS client (idempotent) ---
:if ([:len [/radius find comment="infora-billing"]] > 0) do={
    /radius remove [find comment="infora-billing"]
}
/radius add address=$RADIUS_SERVER secret=$RADIUS_SECRET service=ppp,hotspot,dhcp timeout=$RADIUS_TIMEOUT comment="infora-billing"
/radius incoming set accept=yes

# --- 2. PPPoE: use RADIUS for authentication and accounting ---
/ppp aaa set use-radius=yes accounting=yes interim-update=5m

# Ensure PPPoE server profile uses RADIUS (adjust interface name as needed)
:local pppoeIf "pppoe-server1"
:if ([:len [/interface pppoe-server find name=$pppoeIf]] > 0) do={
    /interface pppoe-server set [find name=$pppoeIf] authentication=pap,chap,mschap2
}

# --- 3. Remove FastTrack (CRITICAL: it bypasses queues + RADIUS accounting) ---
:do { /ip firewall filter remove [find action=fasttrack-connection] } on-error={}

# --- 4. NAT / masquerade (idempotent) ---
/ip firewall nat remove [find comment="infora-masquerade"]
/ip firewall nat add chain=srcnat action=masquerade comment="infora-masquerade"

# --- 5. Hotspot: use RADIUS ---
/ip hotspot profile set [find default=yes] use-radius=yes radius-accounting=yes radius-interim-update=5m

# --- 6. SNMP monitoring ---
:do { /snmp community remove [find name=$SNMP_COMMUNITY] } on-error={}
/snmp community add name=$SNMP_COMMUNITY
/snmp set enabled=yes contact="Infora Billing"

# --- 7. Timezone (accurate accounting) ---
:do { /system clock set time-zone-name=$ROUTER_TZ } on-error={}

# --- Remove local PPP secrets (optional — uncomment when RADIUS is verified) ---
# /ppp secret remove [find]

:log info "Infora RADIUS provisioning applied (server=$RADIUS_SERVER)"
:put "Infora provisioning completed successfully."
