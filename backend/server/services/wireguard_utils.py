"""Shared WireGuard naming constants (no heavy imports)."""

WG_INTERFACE = 'wg-infora'


def peer_comment(customer_id):
    return f'customer-{customer_id}'


def peer_queue_comment(customer_id):
    return f'customer-{customer_id}-wg'


def peer_resource_name(customer_id, assigned_ip):
    return f'infora-{customer_id}-{assigned_ip.replace(".", "-")}'


def queue_resource_name(customer_id):
    return f'infora-q-{customer_id}'
