# MikroTik management WireGuard tunnel (router → billing host)
# Generated per device by GET /api/devices/<id>/management-tunnel-script
# Subnet: 10.250.0.0/24 (distinct from customer VPN 10.200.200.0/24)

# /interface wireguard add name=wg-mgmt listen-port=51822
# /interface wireguard peers add interface=wg-mgmt endpoint-address=PUBLIC_SERVER_HOST endpoint-port=51821
