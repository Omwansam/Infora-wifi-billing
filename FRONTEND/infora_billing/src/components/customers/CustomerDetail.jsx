import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  MapPin,
  Wifi,
  DollarSign,
  Calendar,
  Activity,
  Package,
  ShieldCheck,
  FileText,
  Shield,
  Pause,
  Play,
  Download,
  QrCode,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import wireguardService from '../../services/wireguardService';
import { getAccessToken } from '../../utils/authToken';
import { formatCurrency, formatDate } from '../../lib/utils';
import { isSubscriptionExpired, subscriptionStatusLabel, subscriptionStatusTone } from '../../lib/subscriptionUtils';
import KycStatusBadge from './KycStatusBadge';
import { clientSpeedLabel } from '../../lib/clientUtils';
import toast from 'react-hot-toast';

export default function CustomerDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [wgQrUrl, setWgQrUrl] = useState(null);

  const authBlobDownload = async (url, filename) => {
    const token = getAccessToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const result = await customerService.getCustomer(customerId);
      
      if (result.success) {
        setCustomer(result.data);
      } else {
        toast.error(result.error || 'Failed to load customer details');
        navigate('/clients');
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      toast.error('Failed to load customer details');
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/clients/${customerId}/edit`);
  };

  const handleDelete = () => {
    setDeleteModalOpen(true);
  };

  const handleDisconnect = async () => {
    try {
      setAccessLoading(true);
      const result = await customerService.disconnectClient(customerId);
      if (result.success) {
        toast.success('Client disconnected — internet access removed');
        loadCustomer();
      } else {
        toast.error(result.error || result.data?.error || 'Disconnect failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAccessLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setAccessLoading(true);
      const result = await customerService.connectClient(customerId);
      if (result.success) {
        toast.success('Client connected — internet provisioned at plan speed');
        loadCustomer();
      } else {
        toast.error(result.error || result.data?.error || 'Connect failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAccessLoading(false);
    }
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const result = await customerService.deleteCustomer(customerId);
      
      if (result.success) {
        toast.success('Customer deleted successfully');
        navigate('/clients');
      } else {
        toast.error(result.error || 'Failed to delete customer');
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error('Failed to delete customer: ' + error.message);
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', text: 'Active' },
      suspended: { color: 'bg-red-100 text-red-800', text: 'Suspended' },
      pending: { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const listPath =
    customer?.connection_type === 'pppoe'
      ? '/clients/pppoe'
      : customer?.connection_type === 'hotspot'
        ? '/clients/hotspot'
        : '/clients';

  if (loading) {
    return (
      <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-lg text-gray-600">Loading customer details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Customer Not Found</h1>
            <Link
              to="/clients"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
            <Link
              to={listPath}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to clients
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Client details</h1>
              <p className="text-gray-600 mt-2">
                {customer.connection_type === 'pppoe' ? 'PPPoE subscriber' : customer.connection_type === 'hotspot' ? 'Hotspot user' : 'Subscriber'} · {clientSpeedLabel(customer)}
              </p>
            </div>
            </div>
            <div className="flex items-center space-x-3">
              {customer.status === 'active' ? (
                <button
                  onClick={handleDisconnect}
                  disabled={accessLoading}
                  className="inline-flex items-center px-4 py-2 border border-rose-300 rounded-lg text-sm font-medium text-rose-800 bg-rose-50 hover:bg-rose-100 disabled:opacity-50"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={accessLoading}
                  className="inline-flex items-center px-4 py-2 border border-emerald-300 rounded-lg text-sm font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Connect
                </button>
              )}
              <button
                onClick={handleEdit}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </motion.div>

        {/* Customer Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
          {/* Customer Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-8">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-16 w-16">
                <div className="h-16 w-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                  <span className="text-xl font-bold text-white">
                    {customer.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
              </div>
              <div className="ml-6">
                <h2 className="text-2xl font-bold text-white">{customer.name}</h2>
                <p className="text-blue-100">{customer.email}</p>
                <div className="mt-2">
                  {getStatusBadge(customer.status)}
                </div>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="p-6">
            <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                    <ShieldCheck className="h-5 w-5 mr-2 text-teal-600" />
                    KYC Verification
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    ID: {customer.id_number || 'Not submitted'}
                    {customer.kyc_verified_at ? ` · Verified ${formatDate(customer.kyc_verified_at)}` : ''}
                  </p>
                  {customer.kyc_notes && (
                    <p className="text-sm text-slate-600 mt-2">{customer.kyc_notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <KycStatusBadge status={customer.kyc_status || 'pending'} size="lg" />
                  <Link
                    to="/clients/kyc"
                    className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100"
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    Review KYC
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="h-5 w-5 mr-2 text-blue-600" />
                  Personal Information
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Mail className="h-4 w-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="text-sm font-medium text-gray-900">{customer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="text-sm font-medium text-gray-900">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Address</p>
                      <p className="text-sm font-medium text-gray-900">{customer.address}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Wifi className="h-5 w-5 mr-2 text-blue-600" />
                  Service Information
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Package className="h-4 w-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Package</p>
                      <p className="text-sm font-medium text-gray-900">{customer.package}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Activity className="h-4 w-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Usage</p>
                      <div className="flex items-center">
                        <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${customer.usage_percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{customer.usage_percentage}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Subscription ends</p>
                      <p className={`text-sm font-medium ${isSubscriptionExpired(customer.subscription_end) ? 'text-rose-600' : 'text-gray-900'}`}>
                        {customer.subscription_end ? formatDate(customer.subscription_end) : 'Not set'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <Wifi className="h-4 w-4 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Devices</p>
                      <p className="text-sm font-medium text-gray-900">{customer.device_count} connected</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RADIUS / Network access */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-indigo-600" />
                RADIUS & Network Access
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                  <p className="text-xs font-medium text-indigo-600 uppercase">PPPoE Username</p>
                  <p className="font-mono text-sm text-slate-900 mt-1">{customer.radius_username || customer.email}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase">Connection</p>
                  <p className="text-sm font-medium text-slate-900 mt-1 capitalize">{customer.connection_type || 'pppoe'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase">Access</p>
                  <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${subscriptionStatusTone(customer)}`}>
                    {subscriptionStatusLabel(customer)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Suspend removes radcheck entries immediately. Activate re-provisions after payment or manual activation.
              </p>
            </div>

            {(customer.connection_type === 'wireguard' || customer.wireguard_peer) && (
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-emerald-600" />
                WireGuard VPN
              </h3>
              {customer.wireguard_peer ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                      <p className="text-xs font-medium text-emerald-700 uppercase">Assigned IP</p>
                      <p className="font-mono text-sm text-slate-900 mt-1">{customer.wireguard_peer.assigned_ip}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500 uppercase">Last handshake</p>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        {customer.wireguard_peer.last_handshake ? formatDate(customer.wireguard_peer.last_handshake) : 'Never'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500 uppercase">Data</p>
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        ↓ {(customer.wireguard_peer.rx_bytes / 1e6).toFixed(1)} MB · ↑ {(customer.wireguard_peer.tx_bytes / 1e6).toFixed(1)} MB
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-medium text-slate-500 uppercase">MikroTik sync</p>
                      <p className={`text-sm font-medium mt-1 ${customer.wireguard_peer.mikrotik_sync_error ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {customer.wireguard_peer.mikrotik_sync_error
                          ? 'Sync error'
                          : customer.wireguard_peer.mikrotik_synced_at
                            ? `Synced ${formatDate(customer.wireguard_peer.mikrotik_synced_at)}`
                            : 'Not synced'}
                      </p>
                      {customer.wireguard_peer.bandwidth_limit_mbps && (
                        <p className="text-xs text-slate-500 mt-1">Queue: {customer.wireguard_peer.bandwidth_limit_mbps} Mbps</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => authBlobDownload(wireguardService.downloadConfigUrl(customerId), `wg-${customerId}.conf`).catch((e) => toast.error(e.message))}
                      className="inline-flex items-center px-3 py-2 rounded-lg bg-slate-900 text-white text-sm"
                    >
                      <Download className="h-4 w-4 mr-2" /> Download .conf
                    </button>
                    <button
                      type="button"
                      disabled={accessLoading}
                      onClick={async () => {
                        try {
                          setAccessLoading(true);
                          await wireguardService.syncPeerMikrotik(getAccessToken(), customer.wireguard_peer.id);
                          toast.success('Pushed to MikroTik');
                          loadCustomer();
                        } catch (e) {
                          toast.error(e.message);
                        } finally {
                          setAccessLoading(false);
                        }
                      }}
                      className="inline-flex items-center px-3 py-2 rounded-lg border border-emerald-200 text-emerald-800 text-sm disabled:opacity-50"
                    >
                      Push to MikroTik
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const token = getAccessToken();
                          const res = await fetch(wireguardService.qrcodeUrl(customerId), {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          if (!res.ok) throw new Error('QR failed');
                          const blob = await res.blob();
                          setWgQrUrl(URL.createObjectURL(blob));
                        } catch (e) {
                          toast.error(e.message);
                        }
                      }}
                      className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
                    >
                      <QrCode className="h-4 w-4 mr-2" /> QR code
                    </button>
                  </div>
                  {wgQrUrl && (
                    <img src={wgQrUrl} alt="WireGuard QR" className="max-w-[200px] rounded-lg border border-slate-200 p-2 bg-white" />
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-slate-600">No peer provisioned yet.</p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setAccessLoading(true);
                        await wireguardService.provisionCustomer(getAccessToken(), customerId);
                        toast.success('WireGuard peer provisioned');
                        loadCustomer();
                      } catch (e) {
                        toast.error(e.message);
                      } finally {
                        setAccessLoading(false);
                      }
                    }}
                    className="text-sm text-indigo-600 font-medium hover:underline"
                  >
                    Provision now
                  </button>
                </div>
              )}
            </div>
            )}

            {/* Financial Information */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-blue-600" />
                Financial Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Current Balance</p>
                  <p className={`text-2xl font-bold ${customer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(customer.balance)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Last Payment</p>
                  <p className="text-lg font-medium text-gray-900">
                    {customer.last_payment_date ? formatDate(customer.last_payment_date) : 'No payments'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Join Date</p>
                  <p className="text-lg font-medium text-gray-900">
                    {customer.join_date ? formatDate(customer.join_date) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4"
            >
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-medium text-gray-900">Delete Customer</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone.</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-700">
                  Are you sure you want to delete <span className="font-medium text-gray-900">{customer.name}</span>? 
                  This will permanently remove the customer and all associated data.
                </p>
              </div>
              
              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </div>
                  ) : (
                    'Delete Customer'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
