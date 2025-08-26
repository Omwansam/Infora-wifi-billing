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
            
            self.ssh_client.connect(
                hostname=self.config.host,
                port=self.config.port,
                username=self.config.username,
                password=self.config.password,
                timeout=self.config.timeout,
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
        
        # Parse memory usage
        total_memory = int(resources.get('total-memory', 0))
        free_memory = int(resources.get('free-memory', 0))
        memory_usage = ((total_memory - free_memory) / total_memory * 100) if total_memory > 0 else 0
        
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
            board_name=resources.get('board-name', '')
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
        
        # Get wireless clients
        output, error = self._ssh_execute_command('/interface wireless registration-table print')
        client_count = len([line for line in output.strip().split('\n') if line.strip()]) if output else 0
        
        # Parse values
        uptime = int(resources.get('uptime', '0').split()[0]) if 'uptime' in resources else 0
        cpu_load = float(resources.get('cpu-load', '0')) if 'cpu-load' in resources else 0
        
        # Calculate memory usage
        total_memory = int(resources.get('total-memory', '0')) if 'total-memory' in resources else 0
        free_memory = int(resources.get('free-memory', '0')) if 'free-memory' in resources else 0
        memory_usage = ((total_memory - free_memory) / total_memory * 100) if total_memory > 0 else 0
        
        return DeviceInfo(
            uptime=uptime,
            cpu_load=cpu_load,
            memory_usage=memory_usage,
            client_count=client_count,
            bandwidth_rx=0,  # Would need more complex parsing
            bandwidth_tx=0,  # Would need more complex parsing
            version=resources.get('version', ''),
            board_name=resources.get('board-name', '')
        )
    
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
