import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  MapPin,
  Router,
  Wifi,
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
  Loader2,
  Wallet,
  Smartphone,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import wireguardService from '../../services/wireguardService';
import { getAccessToken } from '../../utils/authToken';
import { formatCurrency, formatDate } from '../../lib/utils';
import { customerInitials } from '../../lib/billingFormatters';
import {
  isSubscriptionExpired,
  subscriptionStatusLabel,
  subscriptionStatusTone,
} from '../../lib/subscriptionUtils';
import { clientSpeedLabel, parseSpeedMbps } from '../../lib/clientUtils';
import ClientConnectionBadge from './ClientConnectionBadge';
import KycStatusBadge from '../customers/KycStatusBadge';
import toast from 'react-hot-toast';

const TYPE_META = {
  pppoe: {
    label: 'PPPoE',
    description: 'Monthly dial-up subscription',
    icon: Router,
    badge: 'bg-violet-50 text-violet-700 ring-violet-600/20',
    avatar: 'bg-violet-100 text-violet-800',
    accent: 'violet',
  },
  hotspot: {
    label: 'Hotspot',
    description: 'Captive portal / voucher',
    icon: Wifi,
    badge: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    avatar: 'bg-amber-100 text-amber-800',
    accent: 'amber',
  },
  wireguard: {
    label: 'WireGuard',
    description: 'VPN tunnel access',
    icon: Shield,
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    avatar: 'bg-emerald-100 text-emerald-800',
    accent: 'emerald',
  },
};

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono, highlight }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p
          className={`text-sm font-medium mt-0.5 break-words ${
            mono ? 'font-mono' : ''
          } ${highlight || 'text-slate-900'}`}
        >
          {value || '—'}
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'bg-white border-slate-200',
    emerald: 'bg-emerald-50/50 border-emerald-100',
    rose: 'bg-rose-50/50 border-rose-100',
    amber: 'bg-amber-50/50 border-amber-100',
  };
  const iconTones = {
    slate: 'bg-slate-100 text-slate-600',
    emerald: 'bg-emerald-100 text-emerald-700',
    rose: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className={`rounded-2xl border p-5 ${tones[tone]}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconTones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="text-xl font-bold text-slate-900 truncate">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function ClientDetail() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [wgQrUrl, setWgQrUrl] = useState(null);
  const [radiusPassword, setRadiusPassword] = useState(null);
  const [revealingPassword, setRevealingPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

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
    loadClient();
  }, [customerId]);

  const loadClient = async () => {
    try {
      setLoading(true);
      const result = await customerService.getCustomer(customerId);
      if (result.success) {
        setClient(result.data);
      } else {
        toast.error(result.error || 'Failed to load client');
        navigate('/clients');
      }
    } catch {
      toast.error('Failed to load client');
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  };

  const listPath =
    client?.connection_type === 'pppoe'
      ? '/clients/pppoe'
      : client?.connection_type === 'hotspot'
        ? '/clients/hotspot'
        : '/clients';

  const handleDisconnect = async () => {
    try {
      setAccessLoading(true);
      const result = await customerService.disconnectClient(customerId);
      if (result.success) {
        toast.success('Client disconnected — internet access removed');
        loadClient();
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
        loadClient();
      } else {
        toast.error(result.error || result.data?.error || 'Connect failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAccessLoading(false);
    }
  };

  const handleRevealPassword = async () => {
    if (radiusPassword !== null) {
      setRadiusPassword(null); // toggle: hide
      return;
    }
    try {
      setRevealingPassword(true);
      const result = await customerService.getRadiusCredentials(customerId);
      if (result.success) {
        const pw = result.data?.data?.password ?? result.data?.password;
        if (pw) {
          setRadiusPassword(pw);
        } else {
          toast.error('No password stored for this client — reset to issue one');
        }
      } else {
        toast.error(result.error || result.data?.error || 'Could not load password');
      }
    } catch (e) {
      toast.error(e.message || 'Could not load password');
    } finally {
      setRevealingPassword(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      setResettingPassword(true);
      const result = await customerService.resetRadiusCredentials(customerId);
      if (result.success) {
        const pw = result.data?.data?.password ?? result.data?.password;
        setRadiusPassword(pw || null);
        toast.success(
          result.data?.data?.radius_reprovisioned
            ? 'Password reset — RADIUS re-provisioned'
            : 'Password reset'
        );
      } else {
        toast.error(result.error || result.data?.error || 'Reset failed');
      }
    } catch (e) {
      toast.error(e.message || 'Reset failed');
    } finally {
      setResettingPassword(false);
    }
  };

  const copyToClipboard = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed');
    }
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const result = await customerService.deleteCustomer(customerId);
      if (result.success) {
        toast.success('Client deleted');
        navigate('/clients');
      } else {
        toast.error(result.error || 'Failed to delete client');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete client');
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
        <div className="max-w-7xl mx-auto text-center py-24">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Client not found</h1>
          <Link
            to="/clients"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to clients
          </Link>
        </div>
      </div>
    );
  }

  const typeMeta = TYPE_META[client.connection_type] || TYPE_META.pppoe;
  const TypeIcon = typeMeta.icon;
  const plan = client.service_plan;
  const mbps = parseSpeedMbps(plan?.speed || client.package);
  const usagePct = Math.min(100, Math.max(0, client.usage_percentage || 0));
  const usageTone = usagePct >= 90 ? 'bg-rose-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-blue-500';
  const balanceTone = client.balance > 0 ? 'rose' : 'emerald';
  const subExpired = isSubscriptionExpired(client.subscription_end);

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            to={listPath}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to clients
          </Link>

          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${typeMeta.avatar}`}
              >
                {customerInitials(client.name)}
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Subscribers</p>
                <h1 className="text-3xl font-bold text-slate-900 mt-0.5">{client.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <ClientConnectionBadge connected={client.status === 'active'} status={client.status} />
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${typeMeta.badge}`}
                  >
                    <TypeIcon className="h-3 w-3" />
                    {typeMeta.label}
                  </span>
                  <span className="text-sm text-slate-400">#{client.id}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {client.status === 'active' ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={accessLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 disabled:opacity-50"
                >
                  {accessLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={accessLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {accessLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Connect
                </button>
              )}
              <Link
                to={`/clients/${customerId}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Link>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </motion.div>

        {/* KPI strip */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8"
        >
          <StatCard
            icon={Wallet}
            label="Balance"
            value={formatCurrency(client.balance)}
            sub={client.balance > 0 ? 'Outstanding amount' : 'Account clear'}
            tone={balanceTone}
          />
          <StatCard
            icon={Activity}
            label="Data usage"
            value={`${usagePct}%`}
            sub={clientSpeedLabel(client)}
            tone={usagePct >= 90 ? 'rose' : 'slate'}
          />
          <StatCard
            icon={Smartphone}
            label="Devices"
            value={String(client.device_count ?? 1)}
            sub="Simultaneous sessions allowed"
          />
          <StatCard
            icon={Calendar}
            label="Subscription ends"
            value={client.subscription_end ? formatDate(client.subscription_end) : 'Not set'}
            sub={subExpired ? 'Expired — renew to restore access' : 'Current billing period'}
            tone={subExpired ? 'amber' : 'slate'}
          />
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main column */}
          <div className="xl:col-span-2 space-y-8">
            {/* Package */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8"
            >
              <SectionHeader title="Package" subtitle="Active service plan and bandwidth limits." />
              <div
                className={`flex items-start gap-4 p-5 rounded-xl border-2 ${
                  typeMeta.accent === 'amber'
                    ? 'bg-amber-50 border-amber-200'
                    : typeMeta.accent === 'emerald'
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-violet-50 border-violet-200'
                }`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${
                    typeMeta.accent === 'amber'
                      ? 'bg-amber-500'
                      : typeMeta.accent === 'emerald'
                        ? 'bg-emerald-500'
                        : 'bg-violet-500'
                  }`}
                >
                  <Package className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg text-slate-900">{plan?.name || client.package || 'No package'}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{clientSpeedLabel(client)}</p>
                  {plan?.price != null && (
                    <p className="text-base font-bold text-slate-900 mt-2">{formatCurrency(plan.price)}</p>
                  )}
                </div>
                {plan?.id && (
                  <Link
                    to={`/plans/${plan.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 shrink-0"
                  >
                    View package
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
                  <span>Usage this period</span>
                  <span>{usagePct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usageTone}`}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
              </div>

              {mbps && (
                <div className="mt-5 flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">RADIUS rate limit</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      {mbps}M / {mbps}M download / upload
                    </p>
                  </div>
                </div>
              )}
            </motion.section>

            {/* Contact */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8"
            >
              <SectionHeader title="Contact details" subtitle="Subscriber contact and login information." />
              <div className="divide-y divide-slate-100">
                <InfoRow icon={Mail} label="Email" value={client.email} />
                <InfoRow icon={Phone} label="Phone" value={client.phone} />
                <InfoRow icon={MapPin} label="Installation address" value={client.address || 'Not provided'} />
                {client.connection_type === 'pppoe' && (
                  <InfoRow
                    icon={User}
                    label="PPPoE username"
                    value={client.radius_username || client.email}
                    mono
                  />
                )}
              </div>
            </motion.section>

            {/* RADIUS */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8"
            >
              <SectionHeader
                title="RADIUS & network access"
                subtitle="Provisioning status and connection credentials."
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-indigo-600">Login</p>
                  <p className="font-mono text-sm font-medium text-slate-900 mt-1 break-all">
                    {client.radius_username || client.email}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Connection</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1 capitalize">{client.connection_type || 'pppoe'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Subscription</p>
                  <span
                    className={`inline-flex mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${subscriptionStatusTone(client)}`}
                  >
                    {subscriptionStatusLabel(client)}
                  </span>
                </div>
              </div>

              {(client.connection_type === 'pppoe' || client.connection_type === 'hotspot') && (
                <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" />
                        {client.connection_type === 'pppoe' ? 'PPPoE password' : 'Hotspot password'}
                      </p>
                      <p className="font-mono text-sm font-medium text-slate-900 mt-1 break-all">
                        {radiusPassword !== null ? radiusPassword : '••••••••••'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleRevealPassword}
                        disabled={revealingPassword}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-200/60 disabled:opacity-50"
                        title={radiusPassword !== null ? 'Hide password' : 'Reveal password'}
                      >
                        {revealingPassword ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : radiusPassword !== null ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                      {radiusPassword !== null && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(radiusPassword, 'Password')}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-200/60"
                          title="Copy password"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={resettingPassword}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
                        title="Generate a new password and re-provision RADIUS"
                      >
                        {resettingPassword ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 mt-4">
                Disconnect removes RADIUS access immediately. Connect re-provisions the client at the assigned package speed.
              </p>
            </motion.section>

            {/* WireGuard */}
            {(client.connection_type === 'wireguard' || client.wireguard_peer) && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8"
              >
                <SectionHeader title="WireGuard VPN" subtitle="Tunnel configuration and MikroTik sync status." />
                {client.wireguard_peer ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Assigned IP</p>
                        <p className="font-mono text-sm font-medium text-slate-900 mt-1">
                          {client.wireguard_peer.assigned_ip}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Last handshake</p>
                        <p className="text-sm font-medium text-slate-900 mt-1">
                          {client.wireguard_peer.last_handshake
                            ? formatDate(client.wireguard_peer.last_handshake)
                            : 'Never'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Data transfer</p>
                        <p className="text-sm font-medium text-slate-900 mt-1">
                          ↓ {(client.wireguard_peer.rx_bytes / 1e6).toFixed(1)} MB · ↑{' '}
                          {(client.wireguard_peer.tx_bytes / 1e6).toFixed(1)} MB
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">MikroTik sync</p>
                        <p
                          className={`text-sm font-medium mt-1 ${
                            client.wireguard_peer.mikrotik_sync_error ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {client.wireguard_peer.mikrotik_sync_error
                            ? 'Sync error'
                            : client.wireguard_peer.mikrotik_synced_at
                              ? `Synced ${formatDate(client.wireguard_peer.mikrotik_synced_at)}`
                              : 'Not synced'}
                        </p>
                        {client.wireguard_peer.bandwidth_limit_mbps && (
                          <p className="text-xs text-slate-500 mt-1">
                            Queue: {client.wireguard_peer.bandwidth_limit_mbps} Mbps
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          authBlobDownload(
                            wireguardService.downloadConfigUrl(customerId),
                            `wg-${customerId}.conf`
                          ).catch((e) => toast.error(e.message))
                        }
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium"
                      >
                        <Download className="h-4 w-4" />
                        Download .conf
                      </button>
                      <button
                        type="button"
                        disabled={accessLoading}
                        onClick={async () => {
                          try {
                            setAccessLoading(true);
                            await wireguardService.syncPeerMikrotik(getAccessToken(), client.wireguard_peer.id);
                            toast.success('Pushed to MikroTik');
                            loadClient();
                          } catch (e) {
                            toast.error(e.message);
                          } finally {
                            setAccessLoading(false);
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 text-emerald-800 text-sm font-medium disabled:opacity-50"
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
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
                      >
                        <QrCode className="h-4 w-4" />
                        QR code
                      </button>
                    </div>
                    {wgQrUrl && (
                      <img
                        src={wgQrUrl}
                        alt="WireGuard QR"
                        className="max-w-[200px] rounded-xl border border-slate-200 p-2 bg-white"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 px-4 py-4">
                    <p className="text-sm text-slate-600">No WireGuard peer provisioned yet.</p>
                    <button
                      type="button"
                      disabled={accessLoading}
                      onClick={async () => {
                        try {
                          setAccessLoading(true);
                          await wireguardService.provisionCustomer(getAccessToken(), customerId);
                          toast.success('WireGuard peer provisioned');
                          loadClient();
                        } catch (e) {
                          toast.error(e.message);
                        } finally {
                          setAccessLoading(false);
                        }
                      }}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      Provision now
                    </button>
                  </div>
                )}
              </motion.section>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* KYC */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8"
            >
              <SectionHeader
                title="KYC verification"
                action={
                  <Link
                    to="/clients/kyc"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Review
                  </Link>
                }
              />
              <div className="flex items-center justify-between gap-3 mb-4">
                <KycStatusBadge status={client.kyc_status || 'pending'} size="lg" />
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ID number</p>
                  <p className="font-medium text-slate-900 mt-0.5">{client.id_number || 'Not submitted'}</p>
                </div>
                {client.kyc_verified_at && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Verified</p>
                    <p className="font-medium text-slate-900 mt-0.5">{formatDate(client.kyc_verified_at)}</p>
                  </div>
                )}
                {client.kyc_notes && (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                    <p className="text-xs text-slate-600">{client.kyc_notes}</p>
                  </div>
                )}
              </div>
            </motion.section>

            {/* Account timeline */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8"
            >
              <SectionHeader title="Account history" subtitle="Billing and membership dates." />
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                    <Clock className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Member since</p>
                    <p className="text-sm font-medium text-slate-900">
                      {client.join_date ? formatDate(client.join_date) : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                    <Wallet className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Last payment</p>
                    <p className="text-sm font-medium text-slate-900">
                      {client.last_payment_date ? formatDate(client.last_payment_date) : 'No payments yet'}
                    </p>
                  </div>
                </div>
                {client.subscription_start && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                      <Calendar className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Current period
                      </p>
                      <p className="text-sm font-medium text-slate-900">
                        {formatDate(client.subscription_start)}
                        {client.subscription_end ? ` → ${formatDate(client.subscription_end)}` : ''}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.section>

            {/* Quick actions hint */}
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold text-slate-700">Quick tip</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Use <strong className="font-medium text-slate-700">Disconnect</strong> to suspend internet without
                deleting the account. Edit the client to change package, balance, or account status.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full border border-slate-200"
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete client</h3>
                <p className="text-sm text-slate-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              Permanently remove <span className="font-semibold text-slate-900">{client.name}</span> and all associated
              RADIUS records, billing data, and network configuration.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete client'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
