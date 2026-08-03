"""Multi-vendor CWMP conformance tests for the ACS.

Real CPE disagree about almost everything the spec leaves loose: namespace
prefixes, whether child elements are namespaced at all, which cwmp version URN
they announce, and where any given setting lives in the data model. These tests
pin the behaviour that keeps the ACS working across the fleet, using envelopes
shaped like what each vendor actually sends.

Pure protocol/profile level — no database, no Flask app — so they run in the
normal pytest suite.
"""
import pytest

from services.tr069 import profiles, soap


# --------------------------------------------------------------------------
#  Envelope fixtures — each mimics a different vendor's real-world quirks
# --------------------------------------------------------------------------

def _inform(manufacturer, oui, product_class, serial, params,
            cwmp_ns='urn:dslforum-org:cwmp-1-0', soap_prefix='soapenv',
            namespace_children=False):
    """Build an Inform with per-vendor structural quirks."""
    prefix = 'cwmp:' if namespace_children else ''
    param_xml = ''.join(
        f'<ParameterValueStruct><Name>{name}</Name><Value>{value}</Value>'
        '</ParameterValueStruct>' for name, value in params.items()
    )
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<{soap_prefix}:Envelope xmlns:{soap_prefix}="http://schemas.xmlsoap.org/soap/envelope/"
 xmlns:cwmp="{cwmp_ns}">
<{soap_prefix}:Header><cwmp:ID {soap_prefix}:mustUnderstand="1">1</cwmp:ID></{soap_prefix}:Header>
<{soap_prefix}:Body><cwmp:Inform>
<{prefix}DeviceId>
 <{prefix}Manufacturer>{manufacturer}</{prefix}Manufacturer>
 <{prefix}OUI>{oui}</{prefix}OUI>
 <{prefix}ProductClass>{product_class}</{prefix}ProductClass>
 <{prefix}SerialNumber>{serial}</{prefix}SerialNumber>
</{prefix}DeviceId>
<Event><EventStruct><EventCode>1 BOOT</EventCode></EventStruct></Event>
<ParameterList>{param_xml}</ParameterList>
</cwmp:Inform></{soap_prefix}:Body></{soap_prefix}:Envelope>'''


VENDORS = [
    # (label, manufacturer, oui, product_class, root_param, expected_profile, expected_root)
    ('huawei-ont', 'Huawei Technologies Co., Ltd', '00E0FC', 'EG8145V5',
     'InternetGatewayDevice.DeviceInfo.SoftwareVersion', 'huawei-ont', 'InternetGatewayDevice.'),
    ('zte-ont', 'ZTE Corporation', '00259E', 'F670L',
     'InternetGatewayDevice.DeviceInfo.SoftwareVersion', 'zte-ont', 'InternetGatewayDevice.'),
    ('tenda', 'Tenda Technology', 'C83A35', 'AC10',
     'InternetGatewayDevice.DeviceInfo.SoftwareVersion', 'tenda', 'InternetGatewayDevice.'),
    ('mikrotik', 'MikroTik', 'E48D8C', 'hEX lite',
     'Device.DeviceInfo.SoftwareVersion', 'mikrotik', 'Device.'),
    ('unknown-tr181', 'SomeNewVendor', 'AABBCC', 'XYZ1',
     'Device.DeviceInfo.SoftwareVersion', 'tr181-generic', 'Device.'),
    ('unknown-tr098', 'AnotherVendor', 'DDEEFF', 'QQQ2',
     'InternetGatewayDevice.DeviceInfo.SoftwareVersion', 'tr098-generic', 'InternetGatewayDevice.'),
]


@pytest.mark.parametrize('label,mfr,oui,pc,root_param,profile_key,root', VENDORS)
def test_inform_parses_and_resolves_profile(label, mfr, oui, pc, root_param, profile_key, root):
    """Every vendor's Inform must parse and land on the right profile."""
    xml = _inform(mfr, oui, pc, f'SN-{label}', {root_param: '1.0.0'})
    kind, payload = soap.parse_message(xml.encode())

    assert kind == 'Inform'
    assert payload['device_id']['Manufacturer'] == mfr
    assert payload['device_id']['SerialNumber'] == f'SN-{label}'
    assert payload['events'] == ['1 BOOT']

    detected = profiles.detect_data_model_root(payload['parameters'].keys())
    assert detected == root, f'{label}: expected root {root}, got {detected}'

    profile = profiles.resolve_profile(
        manufacturer=mfr, product_class=pc, data_model_root=detected, oui=oui)
    assert profile['key'] == profile_key, f'{label}: got profile {profile["key"]}'


def test_namespaced_child_elements_parse():
    """Some CPE namespace every child element, not just the RPC wrapper."""
    xml = _inform('Huawei', '00E0FC', 'HG8546M', 'SN-NS',
                  {'InternetGatewayDevice.DeviceInfo.SoftwareVersion': 'V1'},
                  namespace_children=True)
    kind, payload = soap.parse_message(xml.encode())
    assert kind == 'Inform'
    assert payload['device_id']['SerialNumber'] == 'SN-NS'


@pytest.mark.parametrize('prefix', ['soapenv', 'SOAP-ENV', 'soap', 's'])
def test_any_soap_prefix_parses(prefix):
    """The SOAP envelope prefix is arbitrary; matching on it would be a bug."""
    xml = _inform('Tenda', 'C83A35', 'AC10', 'SN-P',
                  {'InternetGatewayDevice.DeviceInfo.SoftwareVersion': 'V1'},
                  soap_prefix=prefix)
    kind, payload = soap.parse_message(xml.encode())
    assert kind == 'Inform'
    assert payload['device_id']['SerialNumber'] == 'SN-P'


@pytest.mark.parametrize('version', ['1-0', '1-1', '1-2', '1-3', '1-4'])
def test_cwmp_version_is_echoed(version):
    """Reply in the CPE's own cwmp version — some reject an unknown one."""
    ns = f'urn:dslforum-org:cwmp-{version}'
    xml = _inform('X', 'AABBCC', 'Y', 'SN-V',
                  {'Device.DeviceInfo.SoftwareVersion': 'V1'}, cwmp_ns=ns)
    detected = soap.detect_cwmp_namespace(xml.encode())
    assert detected == ns
    assert ns in soap.build_inform_response(detected, '1')


def test_unparseable_namespace_falls_back():
    assert soap.detect_cwmp_namespace(b'not xml at all') == soap.DEFAULT_CWMP_NS


# --------------------------------------------------------------------------
#  Profile resolution + field mapping
# --------------------------------------------------------------------------

def test_every_profile_covers_the_core_read_set():
    """A profile that cannot answer the core read is useless in the fleet view."""
    for profile in profiles.all_profiles():
        paths = profiles.core_parameter_paths(profile)
        assert paths, f"{profile['key']} resolves no core parameters"
        for field in ('software_version', 'uptime', 'wifi_ssid', 'pppoe_username'):
            assert profiles.param_path(profile, field), \
                f"{profile['key']} cannot resolve {field}"


def test_profile_paths_match_declared_root():
    """A TR-181 profile must not hand out InternetGatewayDevice paths."""
    for profile in profiles.all_profiles():
        for field, path in profile['params'].items():
            assert path.startswith(profile['root']), \
                f"{profile['key']}.{field} = {path} contradicts root {profile['root']}"


def test_reverse_lookup_round_trips():
    for profile in profiles.all_profiles():
        for field, path in profile['params'].items():
            assert profiles.field_for_path(profile, path) == field


def test_wifi_paths_differ_between_data_models():
    """The exact divergence the profile layer exists to absorb."""
    tr098 = profiles.get_profile('tr098-generic')
    tr181 = profiles.get_profile('tr181-generic')
    assert profiles.param_path(tr098, 'wifi_ssid') == \
        'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID'
    assert profiles.param_path(tr181, 'wifi_ssid') == 'Device.WiFi.SSID.1.SSID'


def test_only_gpon_profiles_expose_optical():
    """Copper/WiFi routers must not advertise an optical reading they cannot take."""
    for key in ('huawei-ont', 'zte-ont'):
        assert profiles.param_path(profiles.get_profile(key), 'rx_power')
    for key in ('tenda', 'mikrotik'):
        assert profiles.param_path(profiles.get_profile(key), 'rx_power') is None, \
            f'{key} should not claim optical power'


def test_unsupported_field_resolves_to_nothing():
    assert profiles.param_path(profiles.get_profile('tenda'), 'rx_power') is None
    assert profiles.paths_for_fields(profiles.get_profile('tenda'), ['rx_power']) == {}


# --------------------------------------------------------------------------
#  Optical scaling — a wrong number here dispatches a technician wrongly
# --------------------------------------------------------------------------

def test_huawei_optical_scaling():
    huawei = profiles.get_profile('huawei-ont')
    assert profiles.scale_optical(huawei, '-182') == -18.2   # healthy
    assert profiles.scale_optical(huawei, '-285') == -28.5   # failing


@pytest.mark.parametrize('bad', ['', None, 'n/a', '-99999', '5000', 'NULL'])
def test_optical_rejects_nonsense(bad):
    """Out-of-range or unparseable readings must report nothing, never a guess."""
    assert profiles.scale_optical(profiles.get_profile('huawei-ont'), bad) is None


# --------------------------------------------------------------------------
#  RPC construction
# --------------------------------------------------------------------------

def test_set_parameter_values_types_and_escaping():
    xml = soap.build_set_parameter_values({
        'Device.WiFi.SSID.1.SSID': ('Jane & Co <5G>', 'string'),
        'Device.WiFi.Radio.1.Enable': ('1', 'boolean'),
    })
    assert 'Jane &amp; Co &lt;5G&gt;' in xml, 'XML metacharacters must be escaped'
    assert 'xsi:type="xsd:boolean"' in xml
    assert 'ParameterValueStruct[2]' in xml


def test_get_parameter_values_array_size():
    xml = soap.build_get_parameter_values(['A.B', 'C.D', 'E.F'])
    assert 'xsd:string[3]' in xml
    assert xml.count('<string>') == 3


def test_empty_body_is_a_request_for_work():
    kind, payload = soap.parse_message(b'')
    assert kind == 'Empty'
    kind, _ = soap.parse_message(
        b'<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
        b'<soap:Body></soap:Body></soap:Envelope>')
    assert kind == 'Empty'


def test_malformed_envelope_raises():
    with pytest.raises(ValueError):
        soap.parse_message(b'<not-soap/>')
    with pytest.raises(ValueError):
        soap.parse_message(b'<<<broken')


# --------------------------------------------------------------------------
#  Fault handling — the CPE saying "no"
# --------------------------------------------------------------------------

def test_cwmp_fault_detail_is_extracted():
    xml = b'''<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
 xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
<soap:Body><soap:Fault>
 <faultcode>Client</faultcode><faultstring>CWMP fault</faultstring>
 <detail><cwmp:Fault>
   <FaultCode>9005</FaultCode><FaultString>Invalid parameter name</FaultString>
 </cwmp:Fault></detail>
</soap:Fault></soap:Body></soap:Envelope>'''
    kind, payload = soap.parse_message(xml)
    assert kind == 'Fault'
    # The inner CWMP code is the one that identifies the problem.
    assert payload['cwmp_fault_code'] == '9005'
    assert payload['cwmp_fault_string'] == 'Invalid parameter name'


def test_set_parameter_values_fault_lists_offending_parameter():
    xml = b'''<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
 xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
<soap:Body><soap:Fault><faultcode>Client</faultcode>
 <faultstring>CWMP fault</faultstring>
 <detail><cwmp:Fault><FaultCode>9003</FaultCode><FaultString>Invalid arguments</FaultString>
  <SetParameterValuesFault>
    <ParameterName>Device.WiFi.Radio.1.Channel</ParameterName>
    <FaultCode>9007</FaultCode><FaultString>Value out of range</FaultString>
  </SetParameterValuesFault>
 </cwmp:Fault></detail>
</soap:Fault></soap:Body></soap:Envelope>'''
    kind, payload = soap.parse_message(xml)
    assert kind == 'Fault'
    faults = payload.get('parameter_faults')
    assert faults and faults[0]['name'] == 'Device.WiFi.Radio.1.Channel'
    assert faults[0]['code'] == '9007'


def test_transfer_complete_carries_command_key():
    xml = b'''<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
 xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
<soap:Body><cwmp:TransferComplete>
 <CommandKey>task-42</CommandKey><StartTime>2026-08-03T01:00:00Z</StartTime>
 <CompleteTime>2026-08-03T01:02:00Z</CompleteTime>
 <FaultStruct><FaultCode>0</FaultCode><FaultString></FaultString></FaultStruct>
</cwmp:TransferComplete></soap:Body></soap:Envelope>'''
    kind, payload = soap.parse_message(xml)
    assert kind == 'TransferComplete'
    assert payload['command_key'] == 'task-42'
    assert payload['fault_code'] == '0'


def test_response_kinds_parse():
    for name, marker in [
        ('GetParameterValuesResponse', '<ParameterList><ParameterValueStruct>'
                                       '<Name>A.B</Name><Value>1</Value>'
                                       '</ParameterValueStruct></ParameterList>'),
        ('SetParameterValuesResponse', '<Status>0</Status>'),
        ('AddObjectResponse', '<InstanceNumber>3</InstanceNumber><Status>0</Status>'),
    ]:
        xml = (f'<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" '
               f'xmlns:cwmp="urn:dslforum-org:cwmp-1-0"><soap:Body>'
               f'<cwmp:{name}>{marker}</cwmp:{name}></soap:Body></soap:Envelope>').encode()
        kind, payload = soap.parse_message(xml)
        assert kind == name
    assert payload['instance_number'] == '3'
