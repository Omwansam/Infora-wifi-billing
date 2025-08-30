import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi,
  Settings,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Copy,
  Download,
  Terminal,
  Shield,
  Network,
  Database,
  Zap,
  Clock,
  Users,
  Activity
} from 'lucide-react';
import { mikrotikService } from '../../services/mikrotikService';
import toast from 'react-hot-toast';

const steps = [
  {
    id: 1,
    title: 'Device Information',
    description: 'Enter basic router details',
    icon: Wifi
  },
  {
    id: 2,
    title: 'Connection Settings',
    description: 'Configure API or SSH connection',
    icon: Settings
  },
  {
    id: 3,
    title: 'Test Connection',
    description: 'Verify connectivity and credentials',
    icon: CheckCircle
  },
  {
    id: 4,
    title: 'Billing Integration',
    description: 'Configure billing API settings',
    icon: Database
  },
  {
    id: 5,
    title: 'Final Setup',
    description: 'Complete integration and monitoring',
    icon: Zap
  }
];

export default function MikrotikConnectionWizard({ isOpen, onClose, onSuccess }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    deviceName: '',
    deviceModel: '',
    deviceIP: '',
    location: '',
    description: '',
    connectionType: 'api',
    username: '',
    password: '',
    apiPort: '8729',
    sshPort: '22',
    apiKey: '',
    connectionTested: false,
    connectionStatus: null,
    billingApiUrl: '',
    billingApiKey: '',
    syncInterval: '5',
    autoSync: true,
    monitoringEnabled: true,
    alertsEnabled: true,
    backupEnabled: true
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const testConnection = async () => {
    setIsLoading(true);
    setTestResult(null);
    
    try {
      const connectionData = {
        device_ip: formData.deviceIP,
        username: formData.username,
        password: formData.password,
        connection_type: formData.connectionType,
        port: formData.connectionType === 'api' ? formData.apiPort : formData.sshPort,
        api_key: formData.apiKey || null
      };

      const result = await mikrotikService.testConnection(connectionData);
      
      setTestResult({
        success: result.success,
        message: result.message,
        details: result.details || null
      });
      
      updateFormData('connectionTested', true);
      updateFormData('connectionStatus', result.success ? 'success' : 'failed');
      
      if (result.success) {
        toast.success('Connection test successful!');
      } else {
        toast.error('Connection test failed');
      }
      
    } catch (error) {
      console.error('Connection test error:', error);
      setTestResult({
        success: false,
        message: error.response?.data?.message || 'Connection test failed. Please check your credentials and network connectivity.'
      });
      toast.error('Connection test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const generateApiKey = () => {
    const key = 'sk_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    updateFormData('billingApiKey', key);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const downloadConfig = () => {
    const config = {
      device: {
        name: formData.deviceName,
        ip: formData.deviceIP,
        model: formData.deviceModel
      },
      connection: {
        type: formData.connectionType,
        username: formData.username,
        port: formData.connectionType === 'api' ? formData.apiPort : formData.sshPort
      },
      billing: {
        apiUrl: formData.billingApiUrl,
        apiKey: formData.billingApiKey,
        syncInterval: formData.syncInterval
      }
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.deviceName}_config.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Connect Mikrotik Router</h2>
            <p className="text-gray-600">Step-by-step router integration wizard</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep >= step.id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-500'
                }`}>
                  {currentStep > step.id ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    currentStep >= step.id ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-400">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-96">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <Wifi className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900">Device Information</h3>
                  <p className="text-gray-600 mt-2">Enter the basic details of your Mikrotik router</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Device Name *
                    </label>
                    <input
                      type="text"
                      value={formData.deviceName}
                      onChange={(e) => updateFormData('deviceName', e.target.value)}
                      placeholder="e.g., Main Office Router"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Device Model
                    </label>
                    <select
                      value={formData.deviceModel}
                      onChange={(e) => updateFormData('deviceModel', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Model</option>
                      <option value="RB450G">RB450G</option>
                      <option value="RB750Gr3">RB750Gr3</option>
                      <option value="hAP ac²">hAP ac²</option>
                      <option value="CCR1009-7G-1C-1S+">CCR1009-7G-1C-1S+</option>
                      <option value="RB4011iGS+">RB4011iGS+</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      IP Address *
                    </label>
                    <input
                      type="text"
                      value={formData.deviceIP}
                      onChange={(e) => updateFormData('deviceIP', e.target.value)}
                      placeholder="192.168.1.1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => updateFormData('location', e.target.value)}
                      placeholder="e.g., Main Office, Floor 2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => updateFormData('description', e.target.value)}
                      placeholder="Additional notes about this device..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <Settings className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900">Connection Settings</h3>
                  <p className="text-gray-600 mt-2">Configure how to connect to your Mikrotik router</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <div className="flex items-center space-x-4 mb-4">
                    <input
                      type="radio"
                      id="api"
                      name="connectionType"
                      value="api"
                      checked={formData.connectionType === 'api'}
                      onChange={(e) => updateFormData('connectionType', e.target.value)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="api" className="flex items-center text-sm font-medium text-gray-900">
                      <Terminal className="h-5 w-5 mr-2" />
                      API Connection (Recommended)
                    </label>
                  </div>
                  <div className="flex items-center space-x-4">
                    <input
                      type="radio"
                      id="ssh"
                      name="connectionType"
                      value="ssh"
                      checked={formData.connectionType === 'ssh'}
                      onChange={(e) => updateFormData('connectionType', e.target.value)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="ssh" className="flex items-center text-sm font-medium text-gray-900">
                      <Shield className="h-5 w-5 mr-2" />
                      SSH Connection
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => updateFormData('username', e.target.value)}
                      placeholder="admin"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => updateFormData('password', e.target.value)}
                        placeholder="Enter password"
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {formData.connectionType === 'api' ? 'API Port' : 'SSH Port'}
                    </label>
                    <input
                      type="number"
                      value={formData.connectionType === 'api' ? formData.apiPort : formData.sshPort}
                      onChange={(e) => updateFormData(
                        formData.connectionType === 'api' ? 'apiPort' : 'sshPort', 
                        e.target.value
                      )}
                      placeholder={formData.connectionType === 'api' ? '8729' : '22'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {formData.connectionType === 'api' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        API Key (Optional)
                      </label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={formData.apiKey}
                          onChange={(e) => updateFormData('apiKey', e.target.value)}
                          placeholder="Enter API key if configured"
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Security Note</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        {formData.connectionType === 'api' 
                          ? 'API connections are more secure and recommended for production use. Make sure API access is enabled on your router.'
                          : 'SSH connections require additional security configuration. Ensure SSH is properly secured with key-based authentication.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900">Test Connection</h3>
                  <p className="text-gray-600 mt-2">Verify that we can connect to your router</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">Connection Test</h4>
                      <p className="text-sm text-gray-600">
                        Testing connection to {formData.deviceIP} using {formData.connectionType.toUpperCase()}
                      </p>
                    </div>
                    <button
                      onClick={testConnection}
                      disabled={isLoading || !formData.deviceIP || !formData.username || !formData.password}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Testing...
                        </>
                      ) : (
                        <>
                          <Activity className="h-4 w-4 mr-2" />
                          Test Connection
                        </>
                      )}
                    </button>
                  </div>

                  {testResult && (
                    <div className={`mt-4 p-4 rounded-lg border ${
                      testResult.success 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-start">
                        {testResult.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <h4 className={`text-sm font-medium ${
                            testResult.success ? 'text-green-900' : 'text-red-900'
                          }`}>
                            {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
                          </h4>
                          <p className={`text-sm mt-1 ${
                            testResult.success ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {testResult.message}
                          </p>
                          
                          {testResult.success && testResult.details && (
                            <div className="mt-4 grid grid-cols-2 gap-4">
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm text-gray-600">Uptime: {testResult.details.uptime}</span>
                              </div>
                              <div className="flex items-center">
                                <Network className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm text-gray-600">Version: {testResult.details.version}</span>
                              </div>
                              <div className="flex items-center">
                                <Users className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm text-gray-600">Clients: {testResult.details.clients}</span>
                              </div>
                              <div className="flex items-center">
                                <Activity className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm text-gray-600">CPU: {testResult.details.cpu}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {currentStep === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <Database className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900">Billing Integration</h3>
                  <p className="text-gray-600 mt-2">Configure how the router connects to the billing system</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Billing API URL *
                    </label>
                    <input
                      type="url"
                      value={formData.billingApiUrl}
                      onChange={(e) => updateFormData('billingApiUrl', e.target.value)}
                      placeholder="https://your-billing-api.com/api"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key *
                    </label>
                    <div className="flex space-x-2">
                      <div className="flex-1 relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={formData.billingApiKey}
                          onChange={(e) => updateFormData('billingApiKey', e.target.value)}
                          placeholder="Enter billing API key"
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={generateApiKey}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Generate
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sync Interval (minutes)
                    </label>
                    <select
                      value={formData.syncInterval}
                      onChange={(e) => updateFormData('syncInterval', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="1">Every minute</option>
                      <option value="5">Every 5 minutes</option>
                      <option value="15">Every 15 minutes</option>
                      <option value="30">Every 30 minutes</option>
                      <option value="60">Every hour</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="autoSync"
                        checked={formData.autoSync}
                        onChange={(e) => updateFormData('autoSync', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="autoSync" className="ml-2 block text-sm text-gray-900">
                        Enable automatic synchronization with billing system
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-900">Integration Note</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        The router will automatically sync user data, bandwidth usage, and billing information with your billing system at the specified interval.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 5 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <Zap className="mx-auto h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900">Final Setup</h3>
                  <p className="text-gray-600 mt-2">Complete the integration and configure monitoring</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Monitoring Options</h4>
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="monitoringEnabled"
                          checked={formData.monitoringEnabled}
                          onChange={(e) => updateFormData('monitoringEnabled', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="monitoringEnabled" className="ml-2 block text-sm text-gray-900">
                          Enable real-time monitoring
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="alertsEnabled"
                          checked={formData.alertsEnabled}
                          onChange={(e) => updateFormData('alertsEnabled', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="alertsEnabled" className="ml-2 block text-sm text-gray-900">
                          Enable email alerts
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="backupEnabled"
                          checked={formData.backupEnabled}
                          onChange={(e) => updateFormData('backupEnabled', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="backupEnabled" className="ml-2 block text-sm text-gray-900">
                          Enable automatic backups
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Configuration Summary</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Device:</span>
                        <span className="font-medium">{formData.deviceName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">IP Address:</span>
                        <span className="font-medium">{formData.deviceIP}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Connection:</span>
                        <span className="font-medium">{formData.connectionType.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Sync Interval:</span>
                        <span className="font-medium">Every {formData.syncInterval} minutes</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className="font-medium text-green-600">Ready to connect</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Setup Complete!</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Your Mikrotik router is now configured to integrate with the billing system. You can download the configuration file for backup purposes.
                      </p>
                      <div className="mt-3 flex space-x-3">
                        <button
                          onClick={downloadConfig}
                          className="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded text-xs font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download Config
                        </button>
                        <button
                          onClick={() => copyToClipboard(JSON.stringify(formData, null, 2))}
                          className="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded text-xs font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Config
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </button>

          <div className="flex space-x-3">
            {currentStep === steps.length ? (
              <button
                onClick={async () => {
                  try {
                    setIsLoading(true);
                    
                    // Prepare device data for backend
                    const deviceData = {
                      device_name: formData.deviceName,
                      device_model: formData.deviceModel,
                      device_ip: formData.deviceIP,
                      location: formData.location,
                      description: formData.description,
                      username: formData.username,
                      password: formData.password,
                      connection_type: formData.connectionType,
                      api_port: formData.connectionType === 'api' ? formData.apiPort : null,
                      ssh_port: formData.connectionType === 'ssh' ? formData.sshPort : null,
                      api_key: formData.apiKey || null,
                      billing_api_url: formData.billingApiUrl,
                      billing_api_key: formData.billingApiKey,
                      sync_interval: parseInt(formData.syncInterval),
                      auto_sync: formData.autoSync,
                      monitoring_enabled: formData.monitoringEnabled,
                      alerts_enabled: formData.alertsEnabled,
                      backup_enabled: formData.backupEnabled
                    };

                    // Create device in backend
                    const result = await mikrotikService.createDevice(deviceData);
                    
                    toast.success('Device connected successfully!');
                    onSuccess(result);
                    onClose();
                    
                  } catch (error) {
                    console.error('Error creating device:', error);
                    toast.error(error.response?.data?.message || 'Failed to create device');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
                className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Setup
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={nextStep}
                disabled={
                  (currentStep === 1 && (!formData.deviceName || !formData.deviceIP)) ||
                  (currentStep === 2 && (!formData.username || !formData.password)) ||
                  (currentStep === 3 && !formData.connectionTested) ||
                  (currentStep === 4 && (!formData.billingApiUrl || !formData.billingApiKey))
                }
                className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
