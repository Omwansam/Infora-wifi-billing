"""Resolve RADIUS-related limits from ServicePlan columns or features JSON."""
import re


def _parse_speed_mbps(speed_str):
    if not speed_str:
        return None
    match = re.search(r'(\d+)', str(speed_str))
    return int(match.group(1)) if match else None


def get_plan_limits(plan):
    """Return normalized plan limits used for FreeRADIUS provisioning."""
    features = plan.features if isinstance(plan.features, dict) else {}

    bandwidth = plan.bandwidth_limit
    if bandwidth is None:
        bandwidth = features.get('bandwidth_limit') or features.get('download_speed_mbps')
    if bandwidth is None:
        bandwidth = _parse_speed_mbps(plan.speed)

    data_limit = plan.data_limit
    if data_limit is None:
        data_limit = features.get('data_limit') or features.get('data_cap_gb')

    session_timeout = plan.session_timeout
    if session_timeout is None:
        session_timeout = features.get('session_timeout')

    idle_timeout = plan.idle_timeout
    if idle_timeout is None:
        idle_timeout = features.get('idle_timeout')

    static_ip = plan.static_ip or features.get('static_ip')

    return {
        'bandwidth_limit': bandwidth,
        'data_limit': data_limit,
        'session_timeout': session_timeout,
        'idle_timeout': idle_timeout,
        'static_ip': static_ip,
    }


def generate_radius_attributes(plan):
    """Build FreeRADIUS reply attributes for a service plan."""
    limits = get_plan_limits(plan)
    attributes = []

    if limits['bandwidth_limit']:
        mbps = int(limits['bandwidth_limit'])
        # MikroTik-Rate-Limit format: rx/tx (e.g. 10M/10M)
        attributes.append({
            'attribute': 'Mikrotik-Rate-Limit',
            'op': '=',
            'value': f'{mbps}M/{mbps}M',
        })

    if limits['data_limit']:
        data_limit_bytes = int(limits['data_limit']) * 1024 * 1024 * 1024
        attributes.append({
            'attribute': 'Mikrotik-Total-Limit',
            'op': '=',
            'value': str(data_limit_bytes),
        })

    if limits['static_ip']:
        attributes.append({
            'attribute': 'Framed-IP-Address',
            'op': '=',
            'value': str(limits['static_ip']),
        })

    if limits['session_timeout']:
        attributes.append({
            'attribute': 'Session-Timeout',
            'op': '=',
            'value': str(int(limits['session_timeout']) * 60),
        })

    if limits['idle_timeout']:
        attributes.append({
            'attribute': 'Idle-Timeout',
            'op': '=',
            'value': str(int(limits['idle_timeout']) * 60),
        })

    return attributes
