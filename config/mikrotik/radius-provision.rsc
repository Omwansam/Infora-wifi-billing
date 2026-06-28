# MikroTik RouterOS — RADIUS provisioning for Infora ISP billing
# Import: /import file-name=radius-provision.rsc
# Or fetch from billing API after registering the device in the admin UI.
#
# SET THESE BEFORE IMPORT:
#   RADIUS_SERVER  = IP/hostname of FreeRADIUS (billing server)
#   RADIUS_SECRET  = per-ISP secret from Admin → ISPs → RADIUS secret
#   RADIUS_TIMEOUT = 3000ms recommended

:local RADIUS_SERVER "10.0.0.10"
:local RADIUS_SECRET "radius_secret_key"
:local RADIUS_TIMEOUT 3000

# --- RADIUS client ---
:if ([:len [/radius find comment="infora-billing"]] > 0) do={
    /radius remove [find comment="infora-billing"]
}
/radius add address=$RADIUS_SERVER secret=$RADIUS_SECRET service=ppp,hotspot,dhcp timeout=$RADIUS_TIMEOUT comment="infora-billing"
/radius incoming set accept=yes

# --- PPPoE: use RADIUS for authentication and accounting ---
/ppp aaa set use-radius=yes accounting=yes interim-update=5m

# Ensure PPPoE server profile uses RADIUS (adjust interface name as needed)
:local pppoeIf "pppoe-server1"
:if ([:len [/interface pppoe-server find name=$pppoeIf]] > 0) do={
    /interface pppoe-server set [find name=$pppoeIf] authentication=pap,chap,mschap2
}

# --- Hotspot: use RADIUS ---
/ip hotspot profile set [find default=yes] use-radius=yes radius-accounting=yes radius-interim-update=5m

# --- Remove local PPP secrets (optional — uncomment when RADIUS is verified) ---
# /ppp secret remove [find]

:log info "Infora RADIUS provisioning applied (server=$RADIUS_SERVER)"
