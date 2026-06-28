"""Resolve RADIUS-related limits from ServicePlan columns or features JSON."""
import re
from datetime import datetime, timedelta


def plan_subscription_end(plan, from_time=None, stack_from=None):
    """Return subscription end datetime. If stack_from is in the future, add duration to it."""
    from_time = from_time or datetime.utcnow()
    if plan.plan_type == 'hotspot':
        hours = plan.duration_hours or 24
        delta = timedelta(hours=hours)
    else:
        days = plan.billing_cycle_days or 30
        delta = timedelta(days=days)
    if stack_from and stack_from.replace(tzinfo=None) > from_time:
        return stack_from.replace(tzinfo=None) + delta
    return from_time + delta


def _parse_speed_mbps(speed_str):
    if not speed_str:
        return None
    match = re.search(r'(\d+)', str(speed_str))
    return int(match.group(1)) if match else None


def _parse_data_cap_gb(value):
    """Parse data cap from GB number or strings like '500 MB', '5 GB', 'Unlimited'."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        gb = float(value)
        return None if gb <= 0 else gb
    text = str(value).strip().lower()
    if not text or text in ('unlimited', 'none', '0'):
        return None
    mb_match = re.search(r'(\d+(?:\.\d+)?)\s*mb', text)
    if mb_match:
        return float(mb_match.group(1)) / 1024
    gb_match = re.search(r'(\d+(?:\.\d+)?)\s*gb', text)
    if gb_match:
        return float(gb_match.group(1))
    num_match = re.search(r'(\d+(?:\.\d+)?)', text)
    if num_match:
        return float(num_match.group(1))
    return None


def get_plan_speed_mbps(plan):
    """Resolve upload/download Mbps from columns, speed string, or features JSON."""
    features = plan.features if isinstance(plan.features, dict) else {}

    download = plan.bandwidth_limit
    if download is None:
        download = features.get('bandwidth_limit') or features.get('download_speed_mbps')
    if download is None:
        download = _parse_speed_mbps(features.get('download_speed'))
    if download is None:
        download = _parse_speed_mbps(plan.speed)

    upload = features.get('upload_speed_mbps') or features.get('upload_mbps')
    if upload is None:
        upload = _parse_speed_mbps(features.get('upload_speed'))
    if upload is None:
        upload = download

    return {'upload_mbps': upload, 'download_mbps': download}


def format_plan_speed_hint(plan):
    """Compact speed label for tables, e.g. 4/4 or 6/50M."""
    speeds = get_plan_speed_mbps(plan)
    upload = speeds['upload_mbps']
    download = speeds['download_mbps']
    if not download:
        return plan.speed or ''
    if upload and upload != download:
        return f'{upload}/{download}M'
    return f'{download}/{download}'


def format_plan_data_cap_display(plan):
    """Human-readable data cap for UI tables."""
    limits = get_plan_limits(plan)
    gb = limits.get('data_limit')
    if gb is not None:
        gb = float(gb)
        if gb <= 0:
            return 'Unlimited'
        if gb < 1:
            return f'{round(gb * 1024)} MB'
        if gb == int(gb):
            return f'{int(gb)} GB'
        return f'{gb:g} GB'

    features = plan.features if isinstance(plan.features, dict) else {}
    cap = features.get('data_cap')
    if not cap:
        return 'Unlimited'
    cap_str = str(cap).strip()
    if cap_str.lower() == 'unlimited':
        return 'Unlimited'
    return cap_str


def extract_package_policy(plan):
    """Burst / FUP / router pricing stored in features JSON."""
    features = plan.features if isinstance(plan.features, dict) else {}
    throttled = features.get('fup_throttled_speed')
    if throttled is None and features.get('fup_speed_mbps'):
        throttled = f"{features['fup_speed_mbps']}M"
    burst = features.get('burst_speed_mbps')
    if burst is None:
        burst = features.get('burst_download_mbps')
    return {
        'burst_speed': burst,
        'burst_threshold_pct': features.get('burst_threshold_pct'),
        'burst_time_seconds': features.get('burst_time_seconds'),
        'fup_enabled': bool(features.get('fup_enabled')),
        'fup_threshold_gb': features.get('fup_threshold_gb'),
        'fup_throttled_speed': throttled,
        'fup_reset_cycle': features.get('fup_reset_cycle') or 'monthly',
        'router_price_mikrotik': features.get('router_price_mikrotik'),
    }


def get_plan_data_cap_gb(plan):
    """Resolved monthly data cap in GB from columns or features JSON."""
    limits = get_plan_limits(plan)
    data_limit = limits.get('data_limit')
    if data_limit is not None and float(data_limit) > 0:
        return float(data_limit)
    features = plan.features if isinstance(plan.features, dict) else {}
    return _parse_data_cap_gb(features.get('data_cap'))


def get_plan_limits(plan):
    """Return normalized plan limits used for FreeRADIUS provisioning."""
    features = plan.features if isinstance(plan.features, dict) else {}

    bandwidth = plan.bandwidth_limit
    if bandwidth is None:
        bandwidth = features.get('bandwidth_limit') or features.get('download_speed_mbps')
    if bandwidth is None:
        bandwidth = _parse_speed_mbps(features.get('download_speed'))
    if bandwidth is None:
        bandwidth = _parse_speed_mbps(plan.speed)

    data_limit = plan.data_limit
    if data_limit is None:
        data_limit = features.get('data_limit') or features.get('data_cap_gb')
    if data_limit is None and features.get('data_cap'):
        data_limit = _parse_data_cap_gb(features.get('data_cap'))

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


def format_mikrotik_rate_limit(download_mbps, upload_mbps=None):
    """MikroTik simple-queue max-limit format (e.g. 10M/10M)."""
    if not download_mbps:
        return None
    down = int(download_mbps)
    up = int(upload_mbps) if upload_mbps else down
    return f'{down}M/{up}M'

