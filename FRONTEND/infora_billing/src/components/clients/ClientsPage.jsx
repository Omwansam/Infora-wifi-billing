import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  RefreshCw,
  Router,
  Wifi,
  Users,
  Signal,
  ShieldCheck,
  Eye,
  Pencil,
  Trash2,
  PlugZap,
  Unplug,
  UserPlus,
  Upload,
  Clock,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { useConfirm } from '../../contexts/ConfirmContext';
import { formatDate } from '../../lib/utils';
import { customerInitials } from '../../lib/billingFormatters';
import { clientSpeedLabel, isClientConnected } from '../../lib/clientUtils';
import ClientConnectionBadge from './ClientConnectionBadge';
import toast from 'react-hot-toast';

const TYPE_TABS = [
  { key: 'all', label: 'All Clients', path: '/clients', icon: Users },
  { key: 'pppoe', label: 'PPPoE', path: '/clients/pppoe', icon: Router },
  { key: 'hotspot', label: 'Hotspot', path: '/clients/hotspot', icon: Wifi },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'connected', label: 'Connected' },
  { value: 'offline', label: 'Offline' },
  { value: 'pending', label: 'Pending' },
];

function resolveConnectionType(pathname) {
  if (pathname.includes('/hotspot')) return 'hotspot';
  if (pathname.includes('/pppoe') && !pathname.includes('/new')) return 'pppoe';
  return 'all';
}

function ClientTypeBadge({ type }) {
  const styles = {
    pppoe: 'bg-blue-50 text-blue-700 ring-blue-600/15',
    hotspot: 'bg-amber-50 text-amber-800 ring-amber-600/15',
    wireguard: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  };
  const label = type === 'pppoe' ? 'PPPoE' : type === 'hotspot' ? 'Hotspot' : type === 'wireguard' ? 'WireGuard' : type || '—';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${styles[type] || 'bg-slate-100 text-slate-600 ring-slate-500/15'}`}>
      {label}
    </span>
  );
}

function avatarClass(connectionType, clientType) {
  const type = connectionType === 'all' ? clientType : connectionType;
  if (type === 'hotspot') return 'bg-amber-100 text-amber-800';
  if (type === 'wireguard') return 'bg-emerald-100 text-emerald-800';
  return 'bg-blue-100 text-blue-700';
}

export default function ClientsPage() {
  const confirm = useConfirm();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const connectionType = resolveConnectionType(location.pathname);
  const isPppoe = connectionType === 'pppoe';
  const isAll = connectionType === 'all';
  const isHotspot = connectionType === 'hotspot';

  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionId, setActionId] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const result = await customerService.getCustomerStats();
      if (result.success) setStats(result.data || {});
    } catch {
      setStats({});
    }
  }, []);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const result = await customerService.getCustomers({
        per_page: 50,
        search: search || undefined,
        ...(connectionType !== 'all' ? { connection_type: connectionType } : {}),
        status: statusFilter === 'connected' ? 'active' : statusFilter === 'offline' ? 'suspended' : statusFilter !== 'all' ? statusFilter : undefined,
      });
      if (result.success) {
        setClients(result.data.customers || []);
      } else {
        toast.error(result.error || 'Failed to load clients');
      }
    } catch {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [search, connectionType, statusFilter]);

  useEffect(() => {
    const q = searchParams.get('search') || '';
    if (q !== search) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(loadClients, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadClients, search]);

  useEffect(() => {
    setStatusFilter('all');
  }, [connectionType]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleRefresh = () => {
    loadClients();
    loadStats();
  };

  const filteredClients = useMemo(() => {
    if (statusFilter === 'connected') return clients.filter((c) => isClientConnected(c));
    if (statusFilter === 'offline') return clients.filter((c) => !isClientConnected(c) && c.status !== 'pending');
    return clients;
  }, [clients, statusFilter]);

  const connectedCount = clients.filter((c) => isClientConnected(c)).length;

  const statsCards = useMemo(() => {
    const totalType = isAll
      ? stats.total_clients
      : isPppoe
        ? stats.pppoe_clients
        : stats.hotspot_clients;
    const activeType = isAll
      ? stats.active_customers
      : isPppoe
        ? stats.active_pppoe_clients
        : stats.active_hotspot_clients;
    return [
      {
        title: isAll ? 'All Clients' : isPppoe ? 'PPPoE Clients' : 'Hotspot Clients',
        value: loading ? '—' : (clients.length || totalType || 0),
        subtitle: isAll
          ? `${stats.pppoe_clients || 0} PPPoE · ${stats.hotspot_clients || 0} hotspot`
          : `${stats.total_clients || 0} subscribers across all types`,
        icon: isAll ? Users : isPppoe ? Router : Wifi,
        accent: isAll ? 'from-indigo-500 to-violet-600' : isPppoe ? 'from-blue-500 to-indigo-600' : 'from-amber-500 to-orange-600',
      },
      {
        title: 'Connected',
        value: loading ? '—' : connectedCount || activeType || 0,
        subtitle: 'Active RADIUS / internet access',
        icon: Signal,
        accent: 'from-emerald-500 to-teal-600',
      },
      {
        title: 'Offline',
        value: loading ? '—' : Math.max(0, clients.length - connectedCount),
        subtitle: `${stats.suspended_customers || 0} suspended total`,
        icon: Unplug,
        accent: 'from-slate-500 to-slate-700',
      },
      {
        title: 'KYC Pending',
        value: stats.pending_customers ?? '—',
        subtitle: 'Awaiting verification',
        icon: Clock,
        accent: 'from-violet-500 to-purple-600',
      },
    ];
  }, [isAll, isPppoe, stats, clients.length, connectedCount, loading]);

  const toggleConnection = async (client, e) => {
    e?.stopPropagation();
    setActionId(client.id);
    try {
      const connected = isClientConnected(client);
      const result = connected
        ? await customerService.disconnectClient(client.id)
        : await customerService.connectClient(client.id);
      if (result.success) {
        toast.success(connected ? 'Disconnected' : 'Connected');
        loadClients();
        loadStats();
      } else {
        toast.error(result.error || 'Action failed');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (client, e) => {
    e?.stopPropagation();
    if (!(await confirm({ title: 'Delete client?', message: `${client.name} will be permanently deleted, along with their account.`, confirmLabel: 'Delete client', tone: 'danger' }))) return;
    const result = await customerService.deleteCustomer(client.id);
    if (result.success) {
      toast.success('Deleted');
      loadClients();
      loadStats();
    } else {
      toast.error(result.error || 'Delete failed');
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        {/* Header — matches Service Plans / Payments */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Subscribers</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Clients</h1>
              <p className="text-slate-600 mt-1">
                {isAll
                  ? 'All subscribers — PPPoE, hotspot, and other connection types'
                  : isPppoe
                    ? 'PPPoE subscribers — create, connect, and manage speed-limited access'
                    : 'Hotspot users — created via captive portal after payment'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 self-start">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <Link
                to="/clients/kyc"
                className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50"
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                KYC
              </Link>
              {(isPppoe || isAll) && (
                <Link
                  to="/clients/import"
                  className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Link>
              )}
              {(isPppoe || isAll) && (
                <Link
                  to="/clients/new"
                  className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Link>
              )}
            </div>
          </div>
        </motion.div>

        {/* KPI cards — same pattern as Service Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.accent}`} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-2">{stat.subtitle}</p>
                </div>
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white shadow-sm`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Type switcher */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {TYPE_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = connectionType === tab.key;
              return (
                <Link
                  key={tab.key}
                  to={tab.path}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Table card — same pattern as Payments */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    statusFilter === tab.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  {[
                    'Client',
                    ...(isAll ? ['Type'] : []),
                    'Login',
                    'Plan',
                    'Speed',
                    'Status',
                    'Expires',
                    '',
                  ].map((h) => (
                    <th
                      key={h || 'actions'}
                      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
                        h === '' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={isAll ? 8 : 7} className="px-5 py-16 text-center text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading clients…
                    </td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={isAll ? 8 : 7} className="px-5 py-16 text-center">
                      {isHotspot ? (
                        <Wifi className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      ) : isPppoe ? (
                        <Router className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      ) : (
                        <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      )}
                      <p className="font-semibold text-slate-900">No clients found</p>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                        {statusFilter !== 'all'
                          ? 'Try a different filter or search term.'
                          : isPppoe
                            ? 'Add a PPPoE client and connect them to provision internet.'
                            : isHotspot
                              ? 'Hotspot clients appear after payment on the captive portal.'
                              : 'No subscribers yet. Add a PPPoE client or wait for hotspot signups.'}
                      </p>
                      {(isPppoe || isAll) && statusFilter === 'all' && !search && (
                        <Link
                          to="/clients/new"
                          className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
                        >
                          <UserPlus className="h-4 w-4" />
                          Add Client
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    const connected = isClientConnected(client);
                    const busy = actionId === client.id;
                    return (
                      <tr
                        key={client.id}
                        className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass(connectionType, client.connection_type)}`}
                            >
                              {customerInitials(client.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{client.name}</p>
                              <p className="text-xs text-slate-500">{client.phone}</p>
                            </div>
                          </div>
                        </td>
                        {isAll && (
                          <td className="px-5 py-4">
                            <ClientTypeBadge type={client.connection_type} />
                          </td>
                        )}
                        <td className="px-5 py-4">
                          <p className="font-mono text-xs text-slate-700">{client.email}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700">{client.package || '—'}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/15">
                            {clientSpeedLabel(client)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <ClientConnectionBadge connected={connected} status={client.status} />
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600 whitespace-nowrap">
                          {client.subscription_end ? formatDate(client.subscription_end) : '—'}
                        </td>
                        <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              title={connected ? 'Disconnect' : 'Connect'}
                              disabled={busy}
                              onClick={(e) => toggleConnection(client, e)}
                              className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
                                connected
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {connected ? <Unplug className="h-4 w-4" /> : <PlugZap className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              title="View"
                              onClick={() => navigate(`/clients/${client.id}`)}
                              className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {client.connection_type === 'pppoe' && (
                              <button
                                type="button"
                                title="Edit"
                                onClick={() => navigate(`/clients/${client.id}/edit`)}
                                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Delete"
                              onClick={(e) => handleDelete(client, e)}
                              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && filteredClients.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 text-sm text-slate-600">
              Showing {filteredClients.length} of {clients.length}{' '}
              {isAll ? 'clients' : `${connectionType} clients`}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
