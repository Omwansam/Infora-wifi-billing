import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Settings, 
  FileText, 
  Send, 
  Edit, 
  Trash2, 
  Eye,
  RefreshCw,
  TestTube,
  Users
} from 'lucide-react';
import communicationService from '../../services/communicationService';
import toast from 'react-hot-toast';

const SmsManagementPage = () => {
  const [activeTab, setActiveTab] = useState('providers');
  const [smsProviders, setSmsProviders] = useState([]);
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  
  // Edit states
  const [editingProvider, setEditingProvider] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [testingProvider, setTestingProvider] = useState(null);

  // Form states
  const [providerForm, setProviderForm] = useState({
    name: '',
    provider_type: 'api',
    api_key: '',
    api_secret: '',
    account_sid: '',
    auth_token: '',
    sender_id: '',
    webhook_url: '',
    is_default: false,
    daily_limit: 1000,
    monthly_limit: 30000,
    cost_per_sms: 0.0
  });

  const [templateForm, setTemplateForm] = useState({
    name: '',
    message: '',
    template_type: 'custom'
  });

  const [sendForm, setSendForm] = useState({
    template_id: '',
    recipient_phones: '',
    message: ''
  });

  const [testForm, setTestForm] = useState({
    test_phone: '',
    message: 'Test SMS from Infora WiFi'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [providersData, templatesData] = await Promise.all([
        communicationService.getSmsProviders(),
        communicationService.getSmsTemplates()
      ]);

      setSmsProviders(providersData.data || providersData.providers || []);
      setSmsTemplates(templatesData.data || templatesData.templates || []);
    } catch (error) {
      console.error('Error fetching SMS data:', error);
      toast.error('Failed to fetch SMS data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success('Data refreshed successfully');
  };

  // Provider CRUD operations
  const handleProviderSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProvider) {
        await communicationService.updateSmsProvider(editingProvider.id, providerForm);
        toast.success('SMS provider updated successfully');
      } else {
        await communicationService.createSmsProvider(providerForm);
        toast.success('SMS provider created successfully');
      }
      setShowProviderForm(false);
      setEditingProvider(null);
      resetProviderForm();
      fetchData();
    } catch (error) {
      console.error('Error saving provider:', error);
      toast.error('Failed to save SMS provider');
    }
  };

  const handleDeleteProvider = async (providerId) => {
    if (window.confirm('Are you sure you want to delete this SMS provider?')) {
      try {
        await communicationService.deleteSmsProvider(providerId);
        toast.success('SMS provider deleted successfully');
        fetchData();
      } catch (error) {
        console.error('Error deleting provider:', error);
        toast.error('Failed to delete SMS provider');
      }
    }
  };

  const editProvider = (provider) => {
    setEditingProvider(provider);
    setProviderForm({
      name: provider.name,
      provider_type: provider.provider_type,
      api_key: provider.api_key || '',
      api_secret: provider.api_secret || '',
      account_sid: provider.account_sid || '',
      auth_token: provider.auth_token || '',
      sender_id: provider.sender_id || '',
      webhook_url: provider.webhook_url || '',
      is_default: provider.is_default === true,
      daily_limit: provider.daily_limit || 1000,
      monthly_limit: provider.monthly_limit || 30000,
      cost_per_sms: provider.cost_per_sms || 0.0
    });
    setShowProviderForm(true);
  };

  const testProvider = (provider) => {
    setTestingProvider(provider);
    setTestForm({
      test_phone: '',
      message: 'Test SMS from Infora WiFi'
    });
    setShowTestModal(true);
  };

  // Template CRUD operations
  const handleTemplateSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTemplate) {
        await communicationService.updateSmsTemplate(editingTemplate.id, templateForm);
        toast.success('SMS template updated successfully');
      } else {
        await communicationService.createSmsTemplate(templateForm);
        toast.success('SMS template created successfully');
      }
      setShowTemplateForm(false);
      setEditingTemplate(null);
      resetTemplateForm();
      fetchData();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save SMS template');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (window.confirm('Are you sure you want to delete this SMS template?')) {
      try {
        await communicationService.deleteSmsTemplate(templateId);
        toast.success('SMS template deleted successfully');
        fetchData();
      } catch (error) {
        console.error('Error deleting template:', error);
        toast.error('Failed to delete SMS template');
      }
    }
  };

  const editTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      message: template.message,
      template_type: template.template_type
    });
    setShowTemplateForm(true);
  };

  const viewTemplate = (template) => {
    alert(`Template: ${template.name}\nMessage: ${template.message}`);
  };

  // Send SMS functionality
  const handleSendSms = async (e) => {
    e.preventDefault();
    try {
      const phones = sendForm.recipient_phones.split(',').map(phone => phone.trim());
      
      for (const phone of phones) {
        await communicationService.sendTestSms(
          sendForm.template_id,
          phone,
          sendForm.message || 'SMS from Infora WiFi billing system.'
        );
      }
      
      toast.success(`SMS sent successfully to ${phones.length} recipient(s)`);
      setShowSendModal(false);
      resetSendForm();
    } catch (error) {
      console.error('Error sending SMS:', error);
      toast.error('Failed to send SMS');
    }
  };

  const handleTestSms = async (e) => {
    e.preventDefault();
    try {
      await communicationService.sendTestSms(
        testingProvider.id,
        testForm.test_phone,
        testForm.message
      );
      toast.success('Test SMS sent successfully');
      setShowTestModal(false);
      setTestingProvider(null);
      resetTestForm();
    } catch (error) {
      console.error('Error testing provider:', error);
      toast.error('Failed to send test SMS');
    }
  };

  // Reset form functions
  const resetProviderForm = () => {
    setProviderForm({
      name: '',
      provider_type: 'api',
      api_key: '',
      api_secret: '',
      account_sid: '',
      auth_token: '',
      sender_id: '',
      webhook_url: '',
      is_default: false,
      daily_limit: 1000,
      monthly_limit: 30000,
      cost_per_sms: 0.0
    });
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      message: '',
      template_type: 'custom'
    });
  };

  const resetSendForm = () => {
    setSendForm({
      template_id: '',
      recipient_phones: '',
      message: ''
    });
  };

  const resetTestForm = () => {
    setTestForm({
      test_phone: '',
      message: 'Test SMS from Infora WiFi'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">SMS Management</h1>
            <p className="text-gray-600">Manage SMS providers and templates</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowSendModal(true)}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              <Users size={16} />
              <span>Send SMS</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'providers', label: 'Providers', icon: Settings },
            { id: 'templates', label: 'Templates', icon: FileText }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* SMS Providers Tab */}
      {activeTab === 'providers' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">SMS Providers</h2>
            <button
              onClick={() => {
                setShowProviderForm(true);
                setEditingProvider(null);
                resetProviderForm();
              }}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} />
              <span>Add Provider</span>
            </button>
          </div>

          <div className="grid gap-4">
            {smsProviders.map((provider) => (
              <div key={provider.id} className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                      {provider.is_default && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Default</span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded ${
                        provider.provider_type === 'api' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {provider.provider_type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {provider.sender_id ? `Sender ID: ${provider.sender_id}` : 'No sender ID configured'}
                    </p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Daily Limit: {provider.daily_limit}</span>
                      <span>Sent Today: {provider.current_day_sent || 0}</span>
                      <span>Cost per SMS: ${provider.cost_per_sms || 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => testProvider(provider)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Test Provider"
                    >
                      <TestTube size={16} />
                    </button>
                    <button
                      onClick={() => editProvider(provider)}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                      title="Edit Provider"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteProvider(provider.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete Provider"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SMS Templates Tab */}
      {activeTab === 'templates' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">SMS Templates</h2>
            <button
              onClick={() => {
                setShowTemplateForm(true);
                setEditingTemplate(null);
                resetTemplateForm();
              }}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} />
              <span>Add Template</span>
            </button>
          </div>

          <div className="grid gap-4">
            {smsTemplates.map((template) => (
              <div key={template.id} className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                        {template.template_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{template.message}</p>
                    <div className="text-xs text-gray-400 mt-2">
                      Characters: {template.message?.length || 0}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => viewTemplate(template)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="View Template"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => editTemplate(template)}
                      className="p-2 text-gray-600 hover:bg-gray-50 rounded"
                      title="Edit Template"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete Template"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Provider Form Modal */}
      {showProviderForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {editingProvider ? 'Edit SMS Provider' : 'Add SMS Provider'}
            </h2>
            <form onSubmit={handleProviderSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={providerForm.name}
                    onChange={(e) => setProviderForm({...providerForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider Type</label>
                  <select
                    value={providerForm.provider_type}
                    onChange={(e) => setProviderForm({...providerForm, provider_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="api">API</option>
                    <option value="smpp">SMPP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input
                    type="text"
                    value={providerForm.api_key}
                    onChange={(e) => setProviderForm({...providerForm, api_key: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Secret</label>
                  <input
                    type="password"
                    value={providerForm.api_secret}
                    onChange={(e) => setProviderForm({...providerForm, api_secret: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account SID (Twilio)</label>
                  <input
                    type="text"
                    value={providerForm.account_sid}
                    onChange={(e) => setProviderForm({...providerForm, account_sid: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Auth Token (Twilio)</label>
                  <input
                    type="password"
                    value={providerForm.auth_token}
                    onChange={(e) => setProviderForm({...providerForm, auth_token: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender ID</label>
                  <input
                    type="text"
                    value={providerForm.sender_id}
                    onChange={(e) => setProviderForm({...providerForm, sender_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Daily Limit</label>
                  <input
                    type="number"
                    value={providerForm.daily_limit}
                    onChange={(e) => setProviderForm({...providerForm, daily_limit: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Limit</label>
                  <input
                    type="number"
                    value={providerForm.monthly_limit}
                    onChange={(e) => setProviderForm({...providerForm, monthly_limit: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost per SMS</label>
                  <input
                    type="number"
                    step="0.01"
                    value={providerForm.cost_per_sms}
                    onChange={(e) => setProviderForm({...providerForm, cost_per_sms: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
                <input
                  type="url"
                  value={providerForm.webhook_url}
                  onChange={(e) => setProviderForm({...providerForm, webhook_url: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={providerForm.is_default}
                    onChange={(e) => setProviderForm({...providerForm, is_default: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Default Provider</span>
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowProviderForm(false);
                    setEditingProvider(null);
                    resetProviderForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingProvider ? 'Update' : 'Create'} Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Template Form Modal */}
      {showTemplateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {editingTemplate ? 'Edit SMS Template' : 'Add SMS Template'}
            </h2>
            <form onSubmit={handleTemplateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({...templateForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template Type</label>
                  <select
                    value={templateForm.template_type}
                    onChange={(e) => setTemplateForm({...templateForm, template_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="custom">Custom</option>
                    <option value="welcome">Welcome</option>
                    <option value="reminder">Reminder</option>
                    <option value="alert">Alert</option>
                    <option value="confirmation">Confirmation</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={templateForm.message}
                  onChange={(e) => setTemplateForm({...templateForm, message: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your SMS message here..."
                  maxLength={160}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  {templateForm.message.length}/160 characters
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplateForm(false);
                    setEditingTemplate(null);
                    resetTemplateForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {editingTemplate ? 'Update' : 'Create'} Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send SMS Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Send SMS to Users</h2>
            <form onSubmit={handleSendSms} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                <select
                  value={sendForm.template_id}
                  onChange={(e) => setSendForm({...sendForm, template_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Template</option>
                  {smsTemplates.map(template => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Phone Numbers (comma-separated)</label>
                <textarea
                  value={sendForm.recipient_phones}
                  onChange={(e) => setSendForm({...sendForm, recipient_phones: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1234567890, +0987654321"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSendModal(false);
                    resetSendForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Send SMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Provider Modal */}
      {showTestModal && testingProvider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Test SMS Provider</h2>
            <p className="text-sm text-gray-600 mb-4">
              Send a test SMS to verify your {testingProvider.name} configuration.
            </p>
            <form onSubmit={handleTestSms} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Phone Number</label>
                <input
                  type="tel"
                  value={testForm.test_phone}
                  onChange={(e) => setTestForm({...testForm, test_phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1234567890"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={testForm.message}
                  onChange={(e) => setTestForm({...testForm, message: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={160}
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  {testForm.message.length}/160 characters
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTestModal(false);
                    setTestingProvider(null);
                    resetTestForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Send Test SMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmsManagementPage;
