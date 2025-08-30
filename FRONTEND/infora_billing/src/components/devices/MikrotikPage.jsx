import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  Filter,
  Wifi,
  Activity,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  Signal,
  HardDrive
} from 'lucide-react';
import { mikrotikDevices } from '../../data/mockData';
import MikrotikConnectionWizard from './MikrotikConnectionWizard';
import { mikrotikService } from '../../services/mikrotikService';
import toast from 'react-hot-toast';

export default function MikrotikPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showWizard, setShowWizard] = useState(false);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch devices from backend
  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await mikrotikService.getDevices();
      setDevices(response.devices || response || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error('Failed to fetch devices');
      // Fallback to mock data if API fails
      setDevices(mikrotikDevices);
    } finally {
      setLoading(false);
    }
  };

  // Refresh devices
  const refreshDevices = async () => {
    try {
      setRefreshing(true);
      await fetchDevices();
      toast.success('Devices refreshed successfully');
    } catch (error) {
      console.error('Error refreshing devices:', error);
      toast.error('Failed to refresh devices');
    } finally {
      setRefreshing(false);
    }
  };

  // Load devices on component mount
  useEffect(() => {
    fetchDevices();
  }, []);

  // Handle device deletion
  const handleDeleteDevice = async (deviceId) => {
    if (window.confirm('Are you sure you want to delete this device?')) {
      try {
        await mikrotikService.deleteDevice(deviceId);
        toast.success('Device deleted successfully');
        fetchDevices(); // Refresh the list
      } catch (error) {
        console.error('Error deleting device:', error);
        toast.error('Failed to delete device');
      }
    }
  };

  // Handle device sync
  const handleSyncDevice = async (deviceId) => {
    try {
      await mikrotikService.syncDevice(deviceId);
      toast.success('Device synced successfully');
      fetchDevices(); // Refresh the list
    } catch (error) {
      console.error('Error syncing device:', error);
      toast.error('Failed to sync device');
    }
  };

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.device_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.device_ip?.includes(searchTerm) ||
                         device.device_model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.ip?.includes(searchTerm) ||
                         device.model?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         device.device_status === statusFilter || 
                         device.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      online: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      offline: { color: 'bg-red-100 text-red-800', icon: XCircle },
      maintenance: { color: 'bg-yellow-100 text-yellow-800', icon: Clock }
    };
    const config = statusConfig[status] || statusConfig.offline;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getBandwidthColor = (bandwidth) => {
    const percentage = parseInt(bandwidth);
    if (percentage > 80) return 'text-red-600';
    if (percentage > 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  const stats = [
    {
      title: 'Total Devices',
      value: devices.length,
      change: '+2',
      icon: Wifi,
      color: 'bg-blue-500'
    },
    {
      title: 'Online Devices',
      value: devices.filter(d => d.device_status === 'online' || d.status === 'online').length,
      change: '+1',
      icon: CheckCircle,
      color: 'bg-green-500'
    },
    {
      title: 'Total Clients',
      value: devices.reduce((sum, d) => sum + (d.client_count || d.clients || 0), 0),
      change: '+15%',
      icon: Users,
      color: 'bg-purple-500'
    },
    {
      title: 'Avg Uptime',
      value: '12.5 days',
      change: '+2.3 days',
      icon: Activity,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mikrotik Devices</h1>
              <p className="text-gray-600 mt-2">Manage and monitor router devices</p>
            </div>
            <div className="flex space-x-3">
                             <button 
                 onClick={refreshDevices}
                 disabled={refreshing}
                 className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {refreshing ? (
                   <>
                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                     Refreshing...
                   </>
                 ) : (
                   <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
                   </>
                 )}
              </button>
              <button 
                onClick={() => setShowWizard(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Device
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-sm text-green-600 mt-1">{stat.change} from last month</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search devices by name, IP, or model..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </button>
            </div>
          </div>
        </motion.div>

        {/* Devices Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <div className="h-6 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                  <div className="h-6 w-16 bg-gray-200 rounded"></div>
                </div>
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="flex items-center justify-between">
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredDevices.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center py-12"
          >
            <Wifi className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No devices found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
          </motion.div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDevices.map((device, index) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-200 hover:shadow-md ${
                  (device.device_status || device.status) === 'online' ? 'border-green-200' : 'border-red-200'
              }`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                      <h3 className="text-lg font-bold text-gray-900">{device.device_name || device.name}</h3>
                      <p className="text-sm text-gray-500">{device.device_model || device.model}</p>
                  </div>
                    {getStatusBadge(device.device_status || device.status)}
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">IP Address</span>
                      <span className="text-sm font-mono text-gray-900">{device.device_ip || device.ip}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Uptime</span>
                      <span className="text-sm text-gray-900">{device.uptime || 'N/A'}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Active Clients</span>
                      <span className="text-sm font-bold text-gray-900">{device.client_count || device.clients || 0}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Bandwidth</span>
                      <span className={`text-sm font-bold ${getBandwidthColor(device.bandwidth_usage || device.bandwidth || '0%')}`}>
                        {device.bandwidth_usage || device.bandwidth || '0%'}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleSyncDevice(device.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Sync Device"
                      >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                      <button className="text-gray-600 hover:text-gray-900" title="Edit Device">
                      <Edit className="h-4 w-4" />
                    </button>
                      <button 
                        onClick={() => handleDeleteDevice(device.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Device"
                      >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <button className="inline-flex items-center px-3 py-1 border border-transparent rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                    Manage
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-8"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button 
              onClick={() => setShowWizard(true)}
              className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Device
            </button>
            <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
              <Activity className="h-4 w-4 mr-2" />
              Monitor All
            </button>
            <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
              <Signal className="h-4 w-4 mr-2" />
              Network Map
            </button>
            <button className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors">
              <HardDrive className="h-4 w-4 mr-2" />
              Backup Config
            </button>
          </div>
        </motion.div>
      </div>

             {/* Mikrotik Connection Wizard */}
       <MikrotikConnectionWizard
         isOpen={showWizard}
         onClose={() => setShowWizard(false)}
         onSuccess={(deviceData) => {
           console.log('Device connected successfully:', deviceData);
           // Refresh the device list after successful connection
           fetchDevices();
           setShowWizard(false);
         }}
       />
    </div>
  );
}
