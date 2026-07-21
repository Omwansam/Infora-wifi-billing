#!/usr/bin/env python3
"""
MikroTik Client for API and SSH connections
"""
import socket
try:
    import paramiko
except ImportError:
    paramiko = None
import time
import json
import ssl
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

class ConnectionType(Enum):
    API = "api"
    SSH = "ssh"

@dataclass
class MikroTikConnectionConfig:
    """Configuration for MikroTik device connection"""
    host: str
    port: int
    username: str
    password: str
    api_key: Optional[str] = None
    connection_type: ConnectionType = ConnectionType.API
    timeout: int = 10
    verify_ssl: bool = False

@dataclass
class DeviceInfo:
    """Device information from MikroTik"""
    uptime: int
    cpu_load: float
    memory_usage: float
    client_count: int
    bandwidth_rx: int
    bandwidth_tx: int
    temperature: Optional[float] = None
    version: Optional[str] = None
    board_name: Optional[str] = None
    memory_total: int = 0
    memory_free: int = 0
    hdd_total: int = 0
    hdd_free: int = 0

class MikroTikAPIError(Exception):
    """Custom exception for MikroTik API errors"""
    pass

class MikroTikSSHError(Exception):
    """Custom exception for MikroTik SSH errors"""
    pass

class MikroTikClient:
    """Client for connecting to MikroTik devices via API or SSH"""
    
    def __init__(self, config: MikroTikConnectionConfig):
        self.config = config
        self.api_socket = None
        self.ssh_client = None
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.disconnect()
    
    def connect(self) -> bool:
        """Connect to MikroTik device"""
        try:
            if self.config.connection_type == ConnectionType.API:
                return self._connect_api()
            else:
                return self._connect_ssh()
        except Exception as e:
            raise MikroTikAPIError(f"Connection failed: {str(e)}")
    
    def disconnect(self):
        """Disconnect from MikroTik device"""
        if self.api_socket:
            try:
                self.api_socket.close()
            except:
                pass
            self.api_socket = None
            
        if self.ssh_client:
            try:
                self.ssh_client.close()
            except:
                pass
            self.ssh_client = None
    
    def _connect_api(self) -> bool:
        """Connect via MikroTik API"""
        try:
            # Create SSL context
            context = ssl.create_default_context()
            if not self.config.verify_ssl:
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
            
            # Connect to device
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.config.timeout)
            sock.connect((self.config.host, self.config.port))
            
            # Wrap with SSL
            self.api_socket = context.wrap_socket(sock, server_hostname=self.config.host)
            
            # Login
            if self.config.api_key:
                # Login with API key
                login_response = self._api_send_command('/login', {'name': self.config.username, 'password': self.config.password})
                if '!trap' in login_response:
                    raise MikroTikAPIError("API key authentication failed")
            else:
                # Login with username/password
                login_response = self._api_send_command('/login', {'name': self.config.username, 'password': self.config.password})
                if '!trap' in login_response:
                    raise MikroTikAPIError("Username/password authentication failed")
            
            return True
            
        except Exception as e:
            raise MikroTikAPIError(f"API connection failed: {str(e)}")
    
    def _connect_ssh(self) -> bool:
        """Connect via SSH"""
        try:
            self.ssh_client = paramiko.SSHClient()
            self.ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # MikroTik SSH negotiates slowly (heavy crypto) and the management
            # tunnel adds latency, so give the banner/auth phases their own
            # generous budgets — the TCP `timeout` alone is too tight and causes
            # "Error reading SSH protocol banner" over the tunnel.
            banner_auth = max(self.config.timeout, 15)
            self.ssh_client.connect(
                hostname=self.config.host,
                port=self.config.port,
                username=self.config.username,
                password=self.config.password,
                timeout=self.config.timeout,
                banner_timeout=banner_auth,
                auth_timeout=banner_auth,
                look_for_keys=False,
                allow_agent=False
            )
            
            return True
            
        except Exception as e:
            raise MikroTikSSHError(f"SSH connection failed: {str(e)}")
    
    def _api_send_command(self, command: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Send command via API"""
        if not self.api_socket:
            raise MikroTikAPIError("Not connected")
        
        try:
            # Build command
            cmd = command.encode('utf-8')
            if params:
                for key, value in params.items():
                    cmd += f"\n={key}={value}".encode('utf-8')
            
            # Send command
            self.api_socket.send(cmd)
            
            # Receive response
            response = b""
            while True:
                chunk = self.api_socket.recv(4096)
                if not chunk:
                    break
                response += chunk
                if b"!done" in response or b"!trap" in response:
                    break
            
            # Parse response
            return self._parse_api_response(response.decode('utf-8'))
            
        except Exception as e:
            raise MikroTikAPIError(f"API command failed: {str(e)}")
    
    def _parse_api_response(self, response: str) -> Dict[str, Any]:
        """Parse API response"""
        result = {}
        lines = response.strip().split('\n')
        
        for line in lines:
            if line.startswith('!') or not line:
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                result[key] = value
        
        return result
    
    def run_cli(self, command: str) -> Tuple[str, str]:
        """Public: run a single RouterOS CLI command over SSH. Returns (stdout, stderr)."""
        return self._ssh_execute_command(command)

    def _ssh_execute_command(self, command: str) -> Tuple[str, str]:
        """Execute command via SSH"""
        if not self.ssh_client:
            raise MikroTikSSHError("Not connected")
        
        try:
            stdin, stdout, stderr = self.ssh_client.exec_command(command)
            output = stdout.read().decode('utf-8')
            error = stderr.read().decode('utf-8')
            return output, error
        except Exception as e:
            raise MikroTikSSHError(f"SSH command failed: {str(e)}")
    
    def get_device_info(self) -> DeviceInfo:
        """Get device information"""
        try:
            if self.config.connection_type == ConnectionType.API:
                return self._get_device_info_api()
            else:
                return self._get_device_info_ssh()
        except Exception as e:
            raise MikroTikAPIError(f"Failed to get device info: {str(e)}")
    
    def _get_device_info_api(self) -> DeviceInfo:
        """Get device info via API"""
        # Get system resources
        resources = self._api_send_command('/system/resource/print')
        
        # Get interface statistics
        interfaces = self._api_send_command('/interface/print')
        
        # Get wireless clients (if applicable)
        wireless_clients = self._api_send_command('/interface/wireless/registration-table/print')
        
        # Parse uptime
        uptime = int(resources.get('uptime', 0))
        
        # Parse CPU load
        cpu_load = float(resources.get('cpu-load', 0))
        
        # Parse memory + storage (bytes; _res_int handles API bytes and SSH units)
        total_memory = _res_int(resources, 'total-memory')
        free_memory = _res_int(resources, 'free-memory')
        memory_usage = ((total_memory - free_memory) / total_memory * 100) if total_memory > 0 else 0
        total_hdd = _res_int(resources, 'total-hdd-space')
        free_hdd = _res_int(resources, 'free-hdd-space')

        # Count clients (wireless + ethernet)
        client_count = len(wireless_clients) if wireless_clients else 0

        # Parse bandwidth (simplified - would need more complex logic for actual usage)
        bandwidth_rx = 0
        bandwidth_tx = 0

        return DeviceInfo(
            uptime=uptime,
            cpu_load=cpu_load,
            memory_usage=memory_usage,
            client_count=client_count,
            bandwidth_rx=bandwidth_rx,
            bandwidth_tx=bandwidth_tx,
            version=resources.get('version', ''),
            board_name=resources.get('board-name', ''),
            memory_total=total_memory,
            memory_free=free_memory,
            hdd_total=total_hdd,
            hdd_free=free_hdd,
        )
    
    def _get_device_info_ssh(self) -> DeviceInfo:
        """Get device info via SSH"""
        # Get system resources
        output, error = self._ssh_execute_command('/system resource print')
        if error:
            raise MikroTikSSHError(f"Failed to get system resources: {error}")
        
        # Parse resources
        lines = output.strip().split('\n')
        resources = {}
        for line in lines:
            if ':' in line:
                key, value = line.split(':', 1)
                resources[key.strip()] = value.strip()
        
        # Active billing clients: hotspot + PPPoE sessions (what the card should
        # show), falling back to bound DHCP leases, then wireless registrations.
        # Best-effort — never let a stats read break sync/status detection.
        client_count = self._ssh_client_count()

        # Live uplink throughput (bits/sec) via monitor-traffic on the WAN port.
        bandwidth_rx, bandwidth_tx = self._ssh_uplink_bps()

        # Parse values
        uptime = int(resources.get('uptime', '0').split()[0]) if 'uptime' in resources else 0
        cpu_load = float(resources.get('cpu-load', '0')) if 'cpu-load' in resources else 0

        # Calculate memory + storage (bytes; _res_int handles SSH's human units)
        total_memory = _res_int(resources, 'total-memory')
        free_memory = _res_int(resources, 'free-memory')
        memory_usage = ((total_memory - free_memory) / total_memory * 100) if total_memory > 0 else 0
        total_hdd = _res_int(resources, 'total-hdd-space')
        free_hdd = _res_int(resources, 'free-hdd-space')

        return DeviceInfo(
            uptime=uptime,
            cpu_load=cpu_load,
            memory_usage=memory_usage,
            client_count=client_count,
            bandwidth_rx=bandwidth_rx,
            bandwidth_tx=bandwidth_tx,
            memory_total=total_memory,
            memory_free=free_memory,
            hdd_total=total_hdd,
            hdd_free=free_hdd,
            version=resources.get('version', ''),
            board_name=resources.get('board-name', '')
        )

    def _ssh_count(self, command: str) -> int:
        """Run a RouterOS 'print count-only' and return the integer (0 on any issue)."""
        try:
            out, _err = self._ssh_execute_command(command)
            digits = ''.join(ch for ch in (out or '') if ch.isdigit())
            return int(digits) if digits else 0
        except Exception:
            return 0

    def _ssh_client_count(self) -> int:
        """Active subscriber count: hotspot + PPPoE, else bound DHCP leases, else wireless."""
        try:
            hotspot = self._ssh_count('/ip hotspot active print count-only')
            pppoe = self._ssh_count('/ppp active print count-only')
            total = hotspot + pppoe
            if total > 0:
                return total
            leases = self._ssh_count('/ip dhcp-server lease print count-only where status=bound')
            if leases > 0:
                return leases
            return self._ssh_count('/interface wireless registration-table print count-only')
        except Exception:
            return 0

    def _ssh_uplink_bps(self) -> Tuple[int, int]:
        """Return (rx_bps, tx_bps) on the WAN/uplink port via monitor-traffic.

        Best-effort: picks ether1 (MikroTik's conventional WAN) or the first
        ethernet port, samples once, and returns raw bits/sec. Any failure
        yields (0, 0) so a stats read never breaks sync/status.
        """
        try:
            uplink = self._ssh_uplink_interface()
            if not uplink:
                return 0, 0
            # One 'as-value' sample -> raw integer bits/sec for rx and tx.
            out, _err = self._ssh_execute_command(
                f':local m [/interface monitor-traffic {uplink} once as-value];'
                ' :put ($m->"rx-bits-per-second"); :put ($m->"tx-bits-per-second")'
            )
            nums = [int(''.join(c for c in ln if c.isdigit()) or 0)
                    for ln in (out or '').strip().splitlines() if ln.strip()]
            rx = nums[0] if len(nums) >= 1 else 0
            tx = nums[1] if len(nums) >= 2 else 0
            return rx, tx
        except Exception:
            return 0, 0

    def _ssh_uplink_interface(self) -> Optional[str]:
        """Best-effort WAN port name: ether1 if present, else the first ethernet."""
        try:
            out, _err = self._ssh_execute_command('/interface ethernet print terse')
            names = []
            for line in (out or '').strip().split('\n'):
                for tok in line.split():
                    if tok.startswith('name='):
                        names.append(tok.split('=', 1)[1])
            if 'ether1' in names:
                return 'ether1'
            return names[0] if names else None
        except Exception:
            return None

    def test_connection(self) -> Dict[str, Any]:
        """Test connection to device"""
        start_time = time.time()
        
        try:
            # Connect
            if not self.connect():
                return {
                    'success': False,
                    'error': 'Failed to establish connection',
                    'response_time': round((time.time() - start_time) * 1000, 2)
                }
            
            # Get device info
            device_info = self.get_device_info()
            
            response_time = round((time.time() - start_time) * 1000, 2)
            
            return {
                'success': True,
                'response_time': response_time,
                'device_info': {
                    'uptime': device_info.uptime,
                    'cpu_load': device_info.cpu_load,
                    'memory_usage': device_info.memory_usage,
                    'client_count': device_info.client_count,
                    'version': device_info.version,
                    'board_name': device_info.board_name
                },
                'connection_type': self.config.connection_type.value
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'response_time': round((time.time() - start_time) * 1000, 2)
            }
        finally:
            self.disconnect()
    
    def get_interface_stats(self) -> Dict[str, Any]:
        """Get interface statistics"""
        try:
            if self.config.connection_type == ConnectionType.API:
                return self._get_interface_stats_api()
            else:
                return self._get_interface_stats_ssh()
        except Exception as e:
            raise MikroTikAPIError(f"Failed to get interface stats: {str(e)}")
    
    def _get_interface_stats_api(self) -> Dict[str, Any]:
        """Get interface stats via API"""
        interfaces = self._api_send_command('/interface/print')
        
        stats = {}
        for interface in interfaces:
            name = interface.get('name', '')
            if name:
                stats[name] = {
                    'rx_byte': int(interface.get('rx-byte', 0)),
                    'tx_byte': int(interface.get('tx-byte', 0)),
                    'rx_packet': int(interface.get('rx-packet', 0)),
                    'tx_packet': int(interface.get('tx-packet', 0)),
                    'running': interface.get('running', 'false') == 'true'
                }
        
        return stats
    
    def _get_interface_stats_ssh(self) -> Dict[str, Any]:
        """Get interface stats via SSH"""
        output, error = self._ssh_execute_command('/interface print')
        if error:
            raise MikroTikSSHError(f"Failed to get interface stats: {error}")
        
        # Parse interface output (simplified)
        stats = {}
        lines = output.strip().split('\n')
        for line in lines:
            if line.strip() and not line.startswith('#'):
                parts = line.split()
                if len(parts) >= 2:
                    name = parts[0]
                    stats[name] = {
                        'rx_byte': 0,  # Would need more complex parsing
                        'tx_byte': 0,  # Would need more complex parsing
                        'rx_packet': 0,
                        'tx_packet': 0,
                        'running': 'R' in line
                    }
        
        return stats
