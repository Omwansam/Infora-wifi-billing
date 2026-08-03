#!/usr/bin/env python3
"""Simulate a TR-069 CPE against the Infora ACS — no hardware required.

Speaks real CWMP: sends an Inform, then drives the session, answering whatever
RPCs the ACS issues, until the ACS closes with 204. Use it to exercise the ACS
end to end on localhost before pointing an actual ONT at it.

    # register a simulated Huawei ONT (needs TR069_ALLOW_UNKNOWN=true)
    python scripts/cpe-simulator.py --acs http://localhost:5000/tr069

    # then approve it in the UI (Devices -> Customer CPE) and run again to pick
    # up whatever the ACS has queued
    python scripts/cpe-simulator.py --acs http://localhost:5000/tr069 --loop 3

    # pretend to be a pre-enrolled device with credentials
    python scripts/cpe-simulator.py --username cpe-abc --password s3cret

    # simulate a subscriber whose fibre is failing
    python scripts/cpe-simulator.py --rx-power -285

Requires only `requests`, which the backend already depends on.
"""
import argparse
import re
import sys
import xml.etree.ElementTree as ET

try:
    import requests
except ImportError:
    sys.exit('pip install requests')


def local(tag):
    return tag.rsplit('}', 1)[-1] if '}' in tag else tag


class SimulatedCpe:
    """Minimal but honest CWMP client: TR-098 data model, Huawei-style extensions."""

    def __init__(self, args):
        self.args = args
        self.session = requests.Session()
        # Every parameter this fake ONT knows about. The ACS reads from here and
        # writes back into it, so a SetParameterValues actually "takes effect".
        self.params = {
            'InternetGatewayDevice.DeviceInfo.Manufacturer': args.manufacturer,
            'InternetGatewayDevice.DeviceInfo.ModelName': args.product_class,
            'InternetGatewayDevice.DeviceInfo.SoftwareVersion': args.software,
            'InternetGatewayDevice.DeviceInfo.HardwareVersion': '1.0',
            'InternetGatewayDevice.DeviceInfo.SerialNumber': args.serial,
            'InternetGatewayDevice.DeviceInfo.UpTime': str(args.uptime),
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress': '102.68.1.42',
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username': args.pppoe,
            'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID': args.ssid,
            'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations': str(args.clients),
            # Huawei reports optical power in 0.1 dBm units, hence -182 => -18.2 dBm
            'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.RXPower': str(args.rx_power),
            'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.TXPower': str(args.tx_power),
        }

    # -- request plumbing ------------------------------------------------
    def post(self, body):
        auth = None
        if self.args.username:
            auth = (self.args.username, self.args.password or '')
        return self.session.post(
            self.args.acs,
            data=body.encode('utf-8') if body else b'',
            headers={'Content-Type': 'text/xml; charset=utf-8',
                     'SOAPAction': ''},
            auth=auth,
            timeout=20,
        )

    # -- envelopes --------------------------------------------------------
    def inform(self, event):
        listed = [
            'InternetGatewayDevice.DeviceInfo.SoftwareVersion',
            'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
            'InternetGatewayDevice.WANDevice.1.X_HW_GponInterfaceConfig.RXPower',
            'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
        ]
        structs = ''.join(
            f'<ParameterValueStruct><Name>{p}</Name>'
            f'<Value xsi:type="xsd:string">{self.params.get(p, "")}</Value>'
            '</ParameterValueStruct>' for p in listed
        )
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
 xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/"
 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
<soapenv:Header><cwmp:ID soapenv:mustUnderstand="1">1</cwmp:ID></soapenv:Header>
<soapenv:Body><cwmp:Inform>
<DeviceId>
 <Manufacturer>{self.args.manufacturer}</Manufacturer>
 <OUI>{self.args.oui}</OUI>
 <ProductClass>{self.args.product_class}</ProductClass>
 <SerialNumber>{self.args.serial}</SerialNumber>
</DeviceId>
<Event soapenc:arrayType="cwmp:EventStruct[1]">
 <EventStruct><EventCode>{event}</EventCode><CommandKey></CommandKey></EventStruct>
</Event>
<MaxEnvelopes>1</MaxEnvelopes>
<CurrentTime>2026-08-02T12:00:00Z</CurrentTime>
<RetryCount>0</RetryCount>
<ParameterList soapenc:arrayType="cwmp:ParameterValueStruct[{len(listed)}]">{structs}</ParameterList>
</cwmp:Inform></soapenv:Body></soapenv:Envelope>'''

    def gpv_response(self, names):
        structs = ''.join(
            f'<ParameterValueStruct><Name>{n}</Name>'
            f'<Value xsi:type="xsd:string">{self.params.get(n, "")}</Value>'
            '</ParameterValueStruct>' for n in names
        )
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
 xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/"
 xmlns:xsd="http://www.w3.org/2001/XMLSchema"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
 xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
<soapenv:Body><cwmp:GetParameterValuesResponse>
<ParameterList soapenc:arrayType="cwmp:ParameterValueStruct[{len(names)}]">{structs}</ParameterList>
</cwmp:GetParameterValuesResponse></soapenv:Body></soapenv:Envelope>'''

    @staticmethod
    def simple_response(name, inner=''):
        return f'''<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
 xmlns:cwmp="urn:dslforum-org:cwmp-1-0">
<soapenv:Body><cwmp:{name}>{inner}</cwmp:{name}></soapenv:Body></soapenv:Envelope>'''

    # -- session ----------------------------------------------------------
    def handle(self, xml_text):
        """Answer whatever RPC the ACS just sent. Returns the reply body."""
        root = ET.fromstring(xml_text)
        node = None
        for element in root.iter():
            if local(element.tag) == 'Body':
                children = [c for c in element if isinstance(c.tag, str)]
                node = children[0] if children else None
                break
        if node is None:
            return None

        kind = local(node.tag)
        print(f'  <- ACS: {kind}')

        if kind == 'GetParameterValues':
            names = [e.text for e in node.iter() if local(e.tag) == 'string' and e.text]
            for n in names:
                print(f'       read {n} = {self.params.get(n, "<unset>")}')
            return self.gpv_response(names)

        if kind == 'SetParameterValues':
            for struct in node.iter():
                if local(struct.tag) != 'ParameterValueStruct':
                    continue
                name = value = None
                for child in struct:
                    if local(child.tag) == 'Name':
                        name = child.text
                    elif local(child.tag) == 'Value':
                        value = child.text or ''
                if name:
                    self.params[name] = value
                    shown = '********' if re.search(r'pass|key', name, re.I) else value
                    print(f'       APPLIED {name} = {shown}')
            return self.simple_response('SetParameterValuesResponse', '<Status>0</Status>')

        if kind == 'Reboot':
            print('       *** device would reboot now ***')
            return self.simple_response('RebootResponse')

        if kind == 'FactoryReset':
            print('       *** device would factory reset now ***')
            return self.simple_response('FactoryResetResponse')

        if kind == 'GetParameterNames':
            return self.simple_response(
                'GetParameterNamesResponse',
                f'<ParameterList soapenc:arrayType="cwmp:ParameterInfoStruct[{len(self.params)}]">'
                + ''.join(f'<ParameterInfoStruct><Name>{n}</Name><Writable>1</Writable>'
                          '</ParameterInfoStruct>' for n in self.params)
                + '</ParameterList>')

        print(f'       (unhandled {kind} — ending session)')
        return None

    def run_session(self, event='2 PERIODIC'):
        print(f'\n=== CWMP session ({event}) -> {self.args.acs} ===')
        response = self.post(self.inform(event))
        if response.status_code == 401:
            print('  !! 401 Unauthorized.')
            print('     Either pass --username/--password for a pre-enrolled device,')
            print('     or start the backend with TR069_ALLOW_UNKNOWN=true.')
            return False
        if response.status_code != 200:
            print(f'  !! Inform rejected: HTTP {response.status_code} {response.text[:300]}')
            return False
        print('  <- ACS: InformResponse')

        # Empty POST asks the ACS for work; keep answering until it sends 204.
        body = ''
        for _ in range(20):
            response = self.post(body)
            if response.status_code == 204:
                print('  <- ACS: 204 (session complete, no more work)')
                return True
            if response.status_code != 200:
                print(f'  !! HTTP {response.status_code}: {response.text[:300]}')
                return False
            body = self.handle(response.text)
            if body is None:
                return True
        print('  !! too many turns, giving up')
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--acs', default='http://localhost:5000/tr069', help='ACS URL')
    parser.add_argument('--serial', default='4857544390SIM001')
    parser.add_argument('--oui', default='00E0FC')
    parser.add_argument('--product-class', default='EG8145V5')
    parser.add_argument('--manufacturer', default='Huawei Technologies Co., Ltd')
    parser.add_argument('--software', default='V5R020C10S115')
    parser.add_argument('--pppoe', default='', help='PPPoE username — set this to a real '
                        'radius_login to watch the ACS auto-bind the CPE to that subscriber')
    parser.add_argument('--ssid', default='Infora-Home')
    parser.add_argument('--clients', type=int, default=4)
    parser.add_argument('--uptime', type=int, default=864000)
    parser.add_argument('--rx-power', type=int, default=-182,
                        help='optical Rx in 0.1 dBm units (-182 = -18.2 dBm, healthy; '
                             '-285 = -28.5 dBm, failing)')
    parser.add_argument('--tx-power', type=int, default=25)
    parser.add_argument('--username', help='CWMP Basic auth username')
    parser.add_argument('--password', help='CWMP Basic auth password')
    parser.add_argument('--event', default='1 BOOT', help='Inform EventCode')
    parser.add_argument('--loop', type=int, default=1, help='how many sessions to run')
    args = parser.parse_args()

    cpe = SimulatedCpe(args)
    ok = True
    for i in range(args.loop):
        event = args.event if i == 0 else '2 PERIODIC'
        ok = cpe.run_session(event) and ok

    print(f"\nFinal SSID on the simulated device: {cpe.params['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID']}")
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
