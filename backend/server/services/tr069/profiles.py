"""Vendor parameter maps — semantic operation -> concrete CWMP parameter path.

Two CPE can both be "TR-069 compliant" and share not one parameter path. WiFi
SSID alone is:

    InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID   (TR-098)
    Device.WiFi.SSID.1.SSID                                      (TR-181)

and optical power — the number that actually diagnoses an FTTH fault — is a
vendor extension with no standard location at all. So the rest of the ACS never
names a raw path: it asks for a *field* ('wifi_ssid', 'rx_power') and a profile
resolves it. Adding a new ONT model means adding a dict here, not touching the
protocol or the UI.

Resolution order (first match wins):
  1. exact manufacturer + product class
  2. manufacturer only
  3. the generic TR-098 / TR-181 profile for the device's data model root

Mirrors the shape of services/router_scan/profiles.py.
"""

# Canonical field names used everywhere outside this module.
FIELDS = (
    'manufacturer', 'model', 'software_version', 'hardware_version', 'serial_number',
    'uptime', 'wan_ip', 'pppoe_username', 'pppoe_password',
    'wifi_ssid', 'wifi_password', 'wifi_enabled', 'wifi_channel',
    'connected_clients', 'rx_power', 'tx_power',
)

# Fields worth pulling on every contact. Kept small on purpose: a full parameter
# walk on a Huawei ONT is 3000+ values and several seconds of session time.
CORE_FIELDS = (
    'software_version', 'hardware_version', 'uptime', 'wan_ip',
    'pppoe_username', 'wifi_ssid', 'connected_clients', 'rx_power', 'tx_power',
)


_TR098 = {
    'key': 'tr098-generic',
    'label': 'Generic TR-098 (InternetGatewayDevice)',
    'root': 'InternetGatewayDevice.',
    'params': {
        'manufacturer': 'InternetGatewayDevice.DeviceInfo.Manufacturer',
        'model': 'InternetGatewayDevice.DeviceInfo.ModelName',
        'software_version': 'InternetGatewayDevice.DeviceInfo.SoftwareVersion',
        'hardware_version': 'InternetGatewayDevice.DeviceInfo.HardwareVersion',
        'serial_number': 'InternetGatewayDevice.DeviceInfo.SerialNumber',
        'uptime': 'InternetGatewayDevice.DeviceInfo.UpTime',
        'wan_ip': 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
        'pppoe_username': 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
        'pppoe_password': 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password',
        'wifi_ssid': 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
        'wifi_password': 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase',
        'wifi_enabled': 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable',
        'wifi_channel': 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Channel',
        'connected_clients': 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations',
    },
    'types': {
        'wifi_enabled': 'boolean',
        'wifi_channel': 'unsignedInt',
    },
}

_TR181 = {
    'key': 'tr181-generic',
    'label': 'Generic TR-181 (Device)',
    'root': 'Device.',
    'params': {
        'manufacturer': 'Device.DeviceInfo.Manufacturer',
        'model': 'Device.DeviceInfo.ModelName',
        'software_version': 'Device.DeviceInfo.SoftwareVersion',
        'hardware_version': 'Device.DeviceInfo.HardwareVersion',
        'serial_number': 'Device.DeviceInfo.SerialNumber',
        'uptime': 'Device.DeviceInfo.UpTime',
        'wan_ip': 'Device.IP.Interface.1.IPv4Address.1.IPAddress',
        'pppoe_username': 'Device.PPP.Interface.1.Username',
        'pppoe_password': 'Device.PPP.Interface.1.Password',
        'wifi_ssid': 'Device.WiFi.SSID.1.SSID',
        'wifi_password': 'Device.WiFi.AccessPoint.1.Security.KeyPassphrase',
        'wifi_enabled': 'Device.WiFi.Radio.1.Enable',
        'wifi_channel': 'Device.WiFi.Radio.1.Channel',
        'connected_clients': 'Device.WiFi.AccessPoint.1.AssociatedDeviceNumberOfEntries',
    },
    'types': {
        'wifi_enabled': 'boolean',
        'wifi_channel': 'unsignedInt',
    },
}


def _extend(base, key, label, params=None, types=None, **meta):
    """Vendor profile = a generic one plus its overrides."""
    merged = dict(base['params'])
    merged.update(params or {})
    merged_types = dict(base.get('types', {}))
    merged_types.update(types or {})
    profile = dict(base)
    profile.update({
        'key': key,
        'label': label,
        'params': merged,
        'types': merged_types,
    })
    profile.update(meta)
    return profile


# Huawei GPON ONTs (HG8145V5, HG8546M, EG8145V5 …). Optical power lives under a
# vendor extension and is reported in dBm directly.
_HUAWEI_ONT = _extend(
    _TR098, 'huawei-ont', 'Huawei GPON ONT',
    params={
        'rx_power': 'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.RXPower',
        'tx_power': 'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.TXPower',
    },
    # Huawei reports optical power in units of 0.1 dBm on most firmware.
    optical_scale=0.1,
)

# ZTE GPON ONTs (F660, F670L …). Same idea, different extension namespace, and
# the raw value is in 0.002 dBm steps offset by -30 on several firmware lines —
# left at plain dBm here until measured against real hardware.
_ZTE_ONT = _extend(
    _TR098, 'zte-ont', 'ZTE GPON ONT',
    params={
        'rx_power': 'InternetGatewayDevice.WANDevice.1.X_ZTE-COM_WANPONInterfaceConfig.RXPower',
        'tx_power': 'InternetGatewayDevice.WANDevice.1.X_ZTE-COM_WANPONInterfaceConfig.TXPower',
    },
    optical_scale=1.0,
)

_PROFILES = (_HUAWEI_ONT, _ZTE_ONT, _TR181, _TR098)

# manufacturer substring (lowercase) -> profile
_BY_MANUFACTURER = {
    'huawei': _HUAWEI_ONT,
    'zte': _ZTE_ONT,
}


def all_profiles():
    return list(_PROFILES)


def get_profile(key):
    for profile in _PROFILES:
        if profile['key'] == key:
            return profile
    return None


def resolve_profile(manufacturer=None, product_class=None, data_model_root=None, oui=None):
    """Pick the best profile for a device seen in an Inform."""
    haystack = ' '.join(str(v or '') for v in (manufacturer, product_class, oui)).lower()
    for needle, profile in _BY_MANUFACTURER.items():
        if needle in haystack:
            return profile

    if data_model_root and data_model_root.startswith('Device.'):
        return _TR181
    return _TR098


def detect_data_model_root(parameter_names):
    """Infer TR-181 vs TR-098 from any parameter path the CPE has sent us.

    The Inform's ParameterList is enough — every CPE includes at least
    ``<root>.DeviceInfo.*`` or ``<root>.ManagementServer.*`` in it.
    """
    for name in parameter_names or ():
        if name.startswith('Device.'):
            return 'Device.'
        if name.startswith('InternetGatewayDevice.'):
            return 'InternetGatewayDevice.'
    return None


def param_path(profile, field):
    """Concrete CWMP path for a semantic field, or None if unsupported."""
    return (profile or {}).get('params', {}).get(field)


def param_type(profile, field):
    return (profile or {}).get('types', {}).get(field, 'string')


def paths_for_fields(profile, fields):
    """Resolve many fields at once, dropping any this profile cannot express."""
    resolved = {}
    for field in fields:
        path = param_path(profile, field)
        if path:
            resolved[field] = path
    return resolved


def core_parameter_paths(profile):
    """Paths to fetch on every contact."""
    return list(paths_for_fields(profile, CORE_FIELDS).values())


def field_for_path(profile, path):
    """Reverse lookup — used to fold a GetParameterValuesResponse back into fields."""
    for field, candidate in (profile or {}).get('params', {}).items():
        if candidate == path:
            return field
    return None


def scale_optical(profile, raw_value):
    """Normalise a vendor's optical reading to dBm, or None if unusable."""
    if raw_value in (None, ''):
        return None
    try:
        value = float(raw_value)
    except (TypeError, ValueError):
        return None
    scaled = value * float((profile or {}).get('optical_scale', 1.0))
    # Sanity bound: a real ONT reads roughly -40..+10 dBm. Anything outside that
    # means the scale factor is wrong for this firmware, and a wrong number here
    # would send a technician to the wrong house — better to report nothing.
    if not -50.0 <= scaled <= 20.0:
        return None
    return round(scaled, 2)
