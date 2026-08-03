"""CWMP (TR-069) SOAP envelope parsing and construction.

TR-069 is SOAP 1.1 over HTTP. Only the RPCs an ISP actually uses day to day are
implemented — Inform, GetParameterValues, SetParameterValues, GetParameterNames,
AddObject, DeleteObject, Reboot, FactoryReset, Download — plus fault handling.

Namespace handling is deliberately loose. The spec pins cwmp to one of four
versioned URNs (``urn:dslforum-org:cwmp-1-{0..4}``) but shipping CPE get this
wrong constantly: some send no prefix on child elements, some use a private
namespace, some use ``soap`` where others use ``SOAP-ENV``. Matching on local
tag names rather than fully-qualified ones is what makes this work against real
hardware rather than only against the spec.
"""
import xml.etree.ElementTree as ET

SOAP_ENV = 'http://schemas.xmlsoap.org/soap/envelope/'
SOAP_ENC = 'http://schemas.xmlsoap.org/soap/encoding/'
XSD = 'http://www.w3.org/2001/XMLSchema'
XSI = 'http://www.w3.org/2001/XMLSchema-instance'
# The CPE tells us which cwmp version it speaks in its Inform; we echo it back.
# 1-0 is the safe default — every device understands it.
DEFAULT_CWMP_NS = 'urn:dslforum-org:cwmp-1-0'

_NS = {
    'soap': SOAP_ENV,
    'xsd': XSD,
    'xsi': XSI,
}


def _local(tag):
    """Strip any namespace from an element tag."""
    return tag.rsplit('}', 1)[-1] if '}' in tag else tag


def _find_local(element, name):
    """First descendant whose local name matches, namespace ignored."""
    for child in element.iter():
        if _local(child.tag) == name:
            return child
    return None


def _findall_local(element, name):
    return [child for child in element.iter() if _local(child.tag) == name]


def detect_cwmp_namespace(xml_bytes):
    """Pull the cwmp namespace URN out of a raw envelope.

    Echoing the CPE's own version back avoids devices that reject a response
    carrying a namespace they did not offer.
    """
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return DEFAULT_CWMP_NS
    for element in root.iter():
        if '}' in element.tag:
            ns = element.tag.split('}', 1)[0][1:]
            if 'cwmp' in ns:
                return ns
    return DEFAULT_CWMP_NS


class CwmpFault(Exception):
    """A Fault the CPE returned in place of a normal response."""

    def __init__(self, code, string, detail=None):
        super().__init__(f'{code}: {string}')
        self.code = code
        self.string = string
        self.detail = detail


# --------------------------------------------------------------------------
#  Parsing (CPE -> ACS)
# --------------------------------------------------------------------------

def parse_message(xml_bytes):
    """Parse a CWMP envelope into ``(kind, payload)``.

    ``kind`` is the SOAP body's local element name — 'Inform',
    'GetParameterValuesResponse', 'Fault', etc. An empty body (the CPE's way of
    saying "I have nothing more, give me work") parses as ``('Empty', {})``.
    """
    if not xml_bytes or not xml_bytes.strip():
        return 'Empty', {}

    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        raise ValueError(f'Malformed SOAP envelope: {exc}') from exc

    body = None
    for element in root.iter():
        if _local(element.tag) == 'Body':
            body = element
            break
    if body is None:
        raise ValueError('SOAP envelope has no Body')

    children = [c for c in body if isinstance(c.tag, str)]
    if not children:
        return 'Empty', {}

    node = children[0]
    kind = _local(node.tag)

    parser = _PARSERS.get(kind)
    return kind, parser(node) if parser else {}


def _parse_inform(node):
    device_id = {}
    device_node = _find_local(node, 'DeviceId')
    if device_node is not None:
        for child in device_node:
            device_id[_local(child.tag)] = (child.text or '').strip()

    events = []
    event_node = _find_local(node, 'Event')
    if event_node is not None:
        for struct in _findall_local(event_node, 'EventStruct'):
            code = _find_local(struct, 'EventCode')
            if code is not None and code.text:
                events.append(code.text.strip())

    return {
        'device_id': device_id,
        'events': events,
        'parameters': _parse_parameter_list(node),
        'max_envelopes': _text_of(node, 'MaxEnvelopes'),
        'current_time': _text_of(node, 'CurrentTime'),
        'retry_count': _text_of(node, 'RetryCount'),
    }


def _text_of(node, name):
    found = _find_local(node, name)
    return (found.text or '').strip() if found is not None and found.text else None


def _parse_parameter_list(node):
    """ParameterValueStruct list -> {path: value}."""
    values = {}
    for struct in _findall_local(node, 'ParameterValueStruct'):
        name = _find_local(struct, 'Name')
        value = _find_local(struct, 'Value')
        if name is not None and name.text:
            values[name.text.strip()] = (value.text or '') if value is not None else ''
    return values


def _parse_get_parameter_values_response(node):
    return {'parameters': _parse_parameter_list(node)}


def _parse_get_parameter_names_response(node):
    names = []
    for struct in _findall_local(node, 'ParameterInfoStruct'):
        name = _find_local(struct, 'Name')
        writable = _find_local(struct, 'Writable')
        if name is not None and name.text:
            names.append({
                'name': name.text.strip(),
                'writable': (writable.text or '0').strip() in ('1', 'true') if writable is not None else False,
            })
    return {'names': names}


def _parse_set_parameter_values_response(node):
    return {'status': _text_of(node, 'Status')}


def _parse_add_object_response(node):
    return {
        'instance_number': _text_of(node, 'InstanceNumber'),
        'status': _text_of(node, 'Status'),
    }


def _parse_fault(node):
    """SOAP Fault, with the CWMP-specific detail extracted when present."""
    fault = {
        'faultcode': _text_of(node, 'faultcode'),
        'faultstring': _text_of(node, 'faultstring'),
        # The inner cwmp:Fault carries the code that actually matters
        # (9001 request denied, 9003 invalid arguments, 9005 invalid param name…)
        'cwmp_fault_code': _text_of(node, 'FaultCode'),
        'cwmp_fault_string': _text_of(node, 'FaultString'),
    }
    failures = []
    for struct in _findall_local(node, 'SetParameterValuesFault'):
        failures.append({
            'name': _text_of(struct, 'ParameterName'),
            'code': _text_of(struct, 'FaultCode'),
            'string': _text_of(struct, 'FaultString'),
        })
    if failures:
        fault['parameter_faults'] = failures
    return fault


def _parse_transfer_complete(node):
    return {
        'command_key': _text_of(node, 'CommandKey'),
        'start_time': _text_of(node, 'StartTime'),
        'complete_time': _text_of(node, 'CompleteTime'),
        'fault_code': _text_of(node, 'FaultCode'),
        'fault_string': _text_of(node, 'FaultString'),
    }


_PARSERS = {
    'Inform': _parse_inform,
    'GetParameterValuesResponse': _parse_get_parameter_values_response,
    'GetParameterNamesResponse': _parse_get_parameter_names_response,
    'SetParameterValuesResponse': _parse_set_parameter_values_response,
    'AddObjectResponse': _parse_add_object_response,
    'DeleteObjectResponse': _parse_set_parameter_values_response,
    'Fault': _parse_fault,
    'TransferComplete': _parse_transfer_complete,
}


# --------------------------------------------------------------------------
#  Building (ACS -> CPE)
# --------------------------------------------------------------------------

def _envelope(cwmp_ns, request_id, body_xml):
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<soap:Envelope xmlns:soap="{SOAP_ENV}" xmlns:soapenc="{SOAP_ENC}" '
        f'xmlns:xsd="{XSD}" xmlns:xsi="{XSI}" xmlns:cwmp="{cwmp_ns}">'
        '<soap:Header>'
        f'<cwmp:ID soap:mustUnderstand="1">{_escape(request_id)}</cwmp:ID>'
        '</soap:Header>'
        f'<soap:Body>{body_xml}</soap:Body>'
        '</soap:Envelope>'
    )


def _escape(value):
    if value is None:
        return ''
    return (
        str(value)
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
    )


def build_inform_response(cwmp_ns=DEFAULT_CWMP_NS, request_id='1', max_envelopes=1):
    return _envelope(cwmp_ns, request_id, (
        '<cwmp:InformResponse>'
        f'<MaxEnvelopes>{int(max_envelopes)}</MaxEnvelopes>'
        '</cwmp:InformResponse>'
    ))


def build_get_parameter_values(names, cwmp_ns=DEFAULT_CWMP_NS, request_id='1'):
    items = ''.join(f'<string>{_escape(n)}</string>' for n in names)
    return _envelope(cwmp_ns, request_id, (
        '<cwmp:GetParameterValues>'
        f'<ParameterNames soapenc:arrayType="xsd:string[{len(names)}]">{items}</ParameterNames>'
        '</cwmp:GetParameterValues>'
    ))


def build_set_parameter_values(values, cwmp_ns=DEFAULT_CWMP_NS, request_id='1', command_key=''):
    """``values`` is {path: (value, xsd_type)} or {path: value} (defaults to string)."""
    structs = []
    for path, entry in values.items():
        if isinstance(entry, (tuple, list)) and len(entry) == 2:
            value, xsd_type = entry
        else:
            value, xsd_type = entry, 'string'
        structs.append(
            '<ParameterValueStruct>'
            f'<Name>{_escape(path)}</Name>'
            f'<Value xsi:type="xsd:{xsd_type}">{_escape(value)}</Value>'
            '</ParameterValueStruct>'
        )
    joined = ''.join(structs)
    return _envelope(cwmp_ns, request_id, (
        '<cwmp:SetParameterValues>'
        f'<ParameterList soapenc:arrayType="cwmp:ParameterValueStruct[{len(values)}]">'
        f'{joined}</ParameterList>'
        f'<ParameterKey>{_escape(command_key)}</ParameterKey>'
        '</cwmp:SetParameterValues>'
    ))


def build_get_parameter_names(path='', next_level=False, cwmp_ns=DEFAULT_CWMP_NS, request_id='1'):
    return _envelope(cwmp_ns, request_id, (
        '<cwmp:GetParameterNames>'
        f'<ParameterPath>{_escape(path)}</ParameterPath>'
        f'<NextLevel>{"1" if next_level else "0"}</NextLevel>'
        '</cwmp:GetParameterNames>'
    ))


def build_reboot(command_key='', cwmp_ns=DEFAULT_CWMP_NS, request_id='1'):
    return _envelope(cwmp_ns, request_id, (
        f'<cwmp:Reboot><CommandKey>{_escape(command_key)}</CommandKey></cwmp:Reboot>'
    ))


def build_factory_reset(cwmp_ns=DEFAULT_CWMP_NS, request_id='1'):
    return _envelope(cwmp_ns, request_id, '<cwmp:FactoryReset></cwmp:FactoryReset>')


def build_add_object(object_name, cwmp_ns=DEFAULT_CWMP_NS, request_id='1', command_key=''):
    return _envelope(cwmp_ns, request_id, (
        '<cwmp:AddObject>'
        f'<ObjectName>{_escape(object_name)}</ObjectName>'
        f'<ParameterKey>{_escape(command_key)}</ParameterKey>'
        '</cwmp:AddObject>'
    ))


def build_delete_object(object_name, cwmp_ns=DEFAULT_CWMP_NS, request_id='1', command_key=''):
    return _envelope(cwmp_ns, request_id, (
        '<cwmp:DeleteObject>'
        f'<ObjectName>{_escape(object_name)}</ObjectName>'
        f'<ParameterKey>{_escape(command_key)}</ParameterKey>'
        '</cwmp:DeleteObject>'
    ))


def build_download(url, file_type='1 Firmware Upgrade Image', cwmp_ns=DEFAULT_CWMP_NS,
                   request_id='1', command_key='', username='', password='',
                   file_size=0, target_filename='', delay_seconds=0):
    return _envelope(cwmp_ns, request_id, (
        '<cwmp:Download>'
        f'<CommandKey>{_escape(command_key)}</CommandKey>'
        f'<FileType>{_escape(file_type)}</FileType>'
        f'<URL>{_escape(url)}</URL>'
        f'<Username>{_escape(username)}</Username>'
        f'<Password>{_escape(password)}</Password>'
        f'<FileSize>{int(file_size)}</FileSize>'
        f'<TargetFileName>{_escape(target_filename)}</TargetFileName>'
        f'<DelaySeconds>{int(delay_seconds)}</DelaySeconds>'
        '<SuccessURL></SuccessURL><FailureURL></FailureURL>'
        '</cwmp:Download>'
    ))


def build_transfer_complete_response(cwmp_ns=DEFAULT_CWMP_NS, request_id='1'):
    return _envelope(cwmp_ns, request_id, '<cwmp:TransferCompleteResponse></cwmp:TransferCompleteResponse>')


def build_fault(code='9002', message='Internal error', cwmp_ns=DEFAULT_CWMP_NS, request_id='1'):
    """A SOAP Fault carrying a CWMP fault detail, as the CPE expects."""
    return _envelope(cwmp_ns, request_id, (
        '<soap:Fault>'
        '<faultcode>Server</faultcode>'
        '<faultstring>CWMP fault</faultstring>'
        '<detail>'
        f'<cwmp:Fault><FaultCode>{_escape(code)}</FaultCode>'
        f'<FaultString>{_escape(message)}</FaultString></cwmp:Fault>'
        '</detail>'
        '</soap:Fault>'
    ))
