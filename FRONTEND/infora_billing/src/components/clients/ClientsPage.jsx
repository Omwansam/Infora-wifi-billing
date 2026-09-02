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
import TablePagination from '../ui/TablePagination';
import { useServerPagination } from '../../hooks/usePagination';
import toast from 'react-hot-toast';

const TYPE_TABS = [
  { key: 'all', label: 'All Clients', path: '/clients', icon: Users },
  { key: 'pppoe', label: 'PPPoE', path: '/clients/pppoe', icon: Router },
  { key: 'hotspot', label: 'Hotspot', path: '/clients/hotspot', icon: Wifi },
];

/** Chip colour by urgency. Money-critical reds, service ambers, policy blues. */
const SEGMENT_TONE = {
  critical: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  warning: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
  info: 'bg-sky-50 text-sky-700 hover:bg-sky-100',
  neutral: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
};

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
  // Explicit dark steps: the blanket remap in index.css turns these light
  // tints into low-contrast mud on a dark surface, which is what made the
  // badges unreadable behind a selected row.
  const styles = {
    pppoe: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/25',
    hotspot: 'bg-amber-50 text-amber-800 ring-amber-600/15 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25',
    wireguard: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25',
  };
  const label = type === 'pppoe' ? 'PPPoE' : type === 'hotspot' ? 'Hotspot' : type === 'wireguard' ? 'WireGuard' : type || '—';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${styles[type] || 'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-700/50 dark:text-slate-300 dark:ring-slate-400/25'}`}>
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
  // Worklist segments (expiring, never paid, dark…). Separate from statusFilter
  // because they answer a different question: status is what a subscriber IS,
  // a segment is what a subscriber NEEDS.
  const [segment, setSegment] = useState('all');
  const [segments, setSegments] = useState([]);
  const [segmentCounts, setSegmentCounts] = useState({});
  const [actionId, setActionId] = useState(null);
  // Selection is by id, so it survives a re-render but is cleared whenever the
  // filters change — a selection made under one filter must not be acted on
  // under another.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // True once the operator escalates from "the rows on this page" to "every
  // subscriber matching the current filter", which may exceed what is loaded.
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const pager = useServerPagination({
    storageKey: 'clients',
    defaultPageSize: 25,
    resetOn: [search, connectionType, statusFilter, segment],
  });
  const { page, pageSize, setTotals, total: totalMatching } = pager;

  const loadStats = useCallback(async () => {
    try {
      const result = await customerService.getCustomerStats();
      if (result.success) setStats(result.data || {});
    } catch {
      setStats({});
    }
  }, []);

  // Counts come from the server against the same scoping the list uses, so a
  // chip never promises rows the operator cannot then open.
  const loadSegments = useCallback(async () => {
    const result = await customerService.getSegments({ connection_type: connectionType });
    if (result.success) {
      setSegments(result.data?.segments || []);
      setSegmentCounts(result.data?.counts || {});
    }
  }, [connectionType]);

  useEffect(() => { loadSegments(); }, [loadSegments]);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const result = await customerService.getCustomers({
        page,
        per_page: pageSize,
        search: search || undefined,
        ...(connectionType !== 'all' ? { connection_type: connectionType } : {}),
        status: statusFilter === 'connected' ? 'active' : statusFilter === 'offline' ? 'suspended' : statusFilter !== 'all' ? statusFilter : undefined,
        segment,
      });
      if (result.success) {
        setClients(result.data.customers || []);
        setTotals(result.data);
      } else {
        toast.error(result.error || 'Failed to load clients');
      }
    } catch {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [search, connectionType, statusFilter, segment, page, pageSize, setTotals]);

  // Any change to what is being shown invalidates the selection — a new page
  // of rows included, since ids selected on page 1 are no longer on screen to
  // be unticked.
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  }, [search, connectionType, statusFilter, segment, page, pageSize]);

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
    setSegment('all');
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

  // Page-local, and only ever a fallback: once the table is paginated the
  // cards have to read from the account-wide stats or they would count the 25
  // rows in front of you and call it the subscriber base.
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
        value: loading ? '—' : (totalType ?? totalMatching ?? 0),
        subtitle: isAll
          ? `${stats.pppoe_clients || 0} PPPoE · ${stats.hotspot_clients || 0} hotspot`
          : `${stats.total_clients || 0} subscribers across all types`,
        icon: isAll ? Users : isPppoe ? Router : Wifi,
        accent: isAll ? 'from-indigo-500 to-violet-600' : isPppoe ? 'from-blue-500 to-indigo-600' : 'from-amber-500 to-orange-600',
      },
      {
        title: 'Connected',
        value: loading ? '—' : (activeType ?? connectedCount),
        subtitle: 'Active RADIUS / internet access',
        icon: Signal,
        accent: 'from-emerald-500 to-teal-600',
      },
      {
        title: 'Offline',
        value: loading
          ? '—'
          : (totalType != null && activeType != null
            ? Math.max(0, totalType - activeType)
            : Math.max(0, clients.length - connectedCount)),
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
  }, [isAll, isPppoe, stats, clients.length, connectedCount, totalMatching, loading]);

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

  // --- Bulk selection ------------------------------------------------------

  const allVisibleSelected =
    filteredClients.length > 0 && filteredClients.every((c) => selectedIds.has(c.id));
  // The page holds at most `per_page` rows, so "all on screen" is not "all
  // matching" whenever the server reports more. That gap is the whole reason
  // the escalation banner exists.
  const moreBeyondPage = totalMatching > filteredClients.length;

  const selectedCount = selectAllMatching ? totalMatching : selectedIds.size;

  const toggleOne = (id) => {
    setSelectAllMatching(false);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectAllMatching(false);
    setSelectedIds(allVisibleSelected ? new Set() : new Set(filteredClients.map((c) => c.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectAllMatching(false);
  };

  const filterSummary = () => {
    const parts = [];
    if (connectionType !== 'all') parts.push(connectionType === 'pppoe' ? 'PPPoE' : 'hotspot');
    if (statusFilter !== 'all') parts.push(statusFilter);
    if (segment !== 'all') parts.push(segments.find((x) => x.key === segment)?.label || segment);
    if (search) parts.push(`matching “${search}”`);
    return parts.length ? parts.join(' · ') : null;
  };

  const handleBulkDelete = async () => {
    if (!selectedCount || bulkBusy) return;

    const noFilters = connectionType === 'all' && statusFilter === 'all' && segment === 'all' && !search;
    // "Everything" is about coverage, not the escalation banner: on an account
    // with fewer subscribers than one page, ticking the header box already
    // selects the entire list without the banner ever appearing.
    const coversEverything = noFilters && selectedCount >= totalMatching && totalMatching > 0;
    const activeFilter = filterSummary();

    // Wiping a whole list is the one action worth making deliberately slow, so
    // it always requires typing — a small ISP's 9 subscribers is still all of
    // them. Large partial selections get the same treatment.
    const requireText =
      coversEverything || selectAllMatching || selectedCount >= 10
        ? String(selectedCount)
        : null;

    const ok = await confirm({
      title: coversEverything
        ? 'Delete every subscriber?'
        : `Delete ${selectedCount} subscriber${selectedCount === 1 ? '' : 's'}?`,
      message: coversEverything
        ? `All ${selectedCount} subscribers in this account will be permanently deleted.`
        : selectAllMatching
          ? `All ${selectedCount} subscribers ${activeFilter ? `(${activeFilter})` : ''} will be permanently deleted.`
          : `${selectedCount} selected subscriber${selectedCount === 1 ? '' : 's'} will be permanently deleted.`,
      details:
        'This cannot be undone. Their invoices, payments, devices, tickets and '
        + 'RADIUS credentials go with them, and anyone currently online will lose access.',
      requireText,
      confirmLabel: coversEverything ? 'Delete everything' : 'Delete permanently',
      tone: 'danger',
    });
    if (!ok) return;

    setBulkBusy(true);
    try {
      const result = await customerService.bulkDeleteCustomers(
        selectAllMatching
          ? {
              scope: 'filtered',
              filters: {
                connection_type: connectionType,
                status: statusFilter === 'connected' ? 'active'
                  : statusFilter === 'offline' ? 'suspended'
                    : statusFilter,
                search: search || undefined,
              },
              expectedCount: selectedCount,
            }
          : { scope: 'ids', ids: [...selectedIds], expectedCount: selectedIds.size },
      );

      if (!result.success) {
        toast.error(result.error || 'Bulk delete failed');
        return;
      }

      const { deleted = 0, failed = [] } = result.data || {};
      if (failed.length) {
        toast.error(
          `Deleted ${deleted}, but ${failed.length} could not be removed: `
          + failed.slice(0, 3).map((f) => f.name).join(', ')
          + (failed.length > 3 ? '…' : ''),
          { duration: 8000 },
        );
      } else {
        toast.success(`Deleted ${deleted} subscriber${deleted === 1 ? '' : 's'}`);
      }
      clearSelection();
      loadClients();
      loadStats();
    } catch {
      toast.error('Bulk delete failed');
    } finally {
      setBulkBusy(false);
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
                  to="/import/file"
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

          {/* Worklists. A second row rather than more status pills, because these
              answer a different question: status is what a subscriber IS, a
              segment is what a subscriber NEEDS today. Counts come from the
              server so a chip never offers rows that are not there. */}
          {segments.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Worklists
              </span>
              <button
                type="button"
                onClick={() => setSegment('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  segment === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Everyone
              </button>
              {segments.map((item) => {
                const count = segmentCounts[item.key];
                const active = segment === item.key;
                // An empty worklist is still worth showing, greyed: "nobody is
                // lapsed today" is information, and hiding the chip would make
                // the row jump around as the fleet changes.
                const empty = count === 0;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSegment(active ? 'all' : item.key)}
                    title={item.description}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-slate-800 text-white'
                        : empty
                          ? 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          : `${SEGMENT_TONE[item.tone] || SEGMENT_TONE.neutral} hover:opacity-80`
                    }`}
                  >
                    {item.label}
                    {count !== null && count !== undefined && (
                      <span className={`tabular-nums ${active ? 'text-white/70' : 'opacity-60'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Selection toolbar — only present once something is selected, so it
              never competes with the filters for attention. */}
          {selectedCount > 0 && (
            <div className="flex flex-col gap-3 border-b border-indigo-100 bg-indigo-50/70 px-5 py-3 dark:border-indigo-500/20 dark:bg-indigo-500/10 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                  {selectedCount} subscriber{selectedCount === 1 ? '' : 's'} selected
                  {selectAllMatching && ' — everything matching this view'}
                </p>
                {/* The escalation. Without this, ticking the header box selects
                    only the loaded page while reading as "all". */}
                {!selectAllMatching && allVisibleSelected && moreBeyondPage && (
                  <button
                    type="button"
                    onClick={() => setSelectAllMatching(true)}
                    className="mt-0.5 text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100"
                  >
                    Select all {totalMatching} subscribers
                    {filterSummary() ? ` (${filterSummary()})` : ' in this account'}
                  </button>
                )}
                {selectAllMatching && (
                  <button
                    type="button"
                    onClick={toggleAllVisible}
                    className="mt-0.5 text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100"
                  >
                    Select only the {filteredClients.length} shown here
                  </button>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={bulkBusy}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60 dark:bg-rose-600 dark:hover:bg-rose-500"
                >
                  {bulkBusy ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {bulkBusy ? 'Deleting…' : `Delete ${selectedCount}`}
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="w-12 px-5 py-3 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select all clients on this page"
                      checked={allVisibleSelected}
                      // Indeterminate when the page is partly selected, or when
                      // the selection extends past what is rendered.
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            !allVisibleSelected
                            && (selectedIds.size > 0 || selectAllMatching);
                        }
                      }}
                      onChange={toggleAllVisible}
                      disabled={loading || filteredClients.length === 0}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900"
                    />
                  </th>
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
                    <td colSpan={isAll ? 9 : 8} className="px-5 py-16 text-center text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                      Loading clients…
                    </td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={isAll ? 9 : 8} className="px-5 py-16 text-center">
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
                    const checked = selectAllMatching || selectedIds.has(client.id);
                    return (
                      <tr
                        key={client.id}
                        // Selection is informational, not destructive — only the
                        // Delete button is. Painting every ticked row red made the
                        // table read as "about to be destroyed" and, with no dark
                        // variant, washed the whole thing out in dark mode.
                        // The left accent bar carries selection alongside the tint
                        // so it still reads for anyone who cannot separate the two
                        // shades; the unselected rows keep a transparent border of
                        // the same width so nothing shifts when a row is ticked.
                        className={`cursor-pointer transition-colors ${
                          checked
                            ? 'bg-indigo-50/70 hover:bg-indigo-100/70 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                        onClick={() => navigate(`/clients/${client.id}`)}
                      >
                        {/* The accent lives on the cell, not the row: a border on
                            a <tr> is only honoured on the first row in a collapsed
                            table, so the rest of the selection silently lost it. */}
                        <td
                          className={`border-l-2 px-5 py-4 ${checked ? 'border-indigo-500' : 'border-transparent'}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select ${client.name}`}
                            checked={checked}
                            onChange={() => toggleOne(client.id)}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass(connectionType, client.connection_type)}`}
                            >
                              {customerInitials(client.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900 dark:text-white">{client.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{client.phone}</p>
                            </div>
                          </div>
                        </td>
                        {isAll && (
                          <td className="px-5 py-4">
                            <ClientTypeBadge type={client.connection_type} />
                          </td>
                        )}
                        <td className="px-5 py-4">
                          <p className="font-mono text-xs text-slate-700 dark:text-slate-300">{client.email}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-300">{client.package || '—'}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-500/15 dark:bg-slate-700/50 dark:text-slate-200 dark:ring-slate-400/25">
                            {clientSpeedLabel(client)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <ClientConnectionBadge connected={connected} status={client.status} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600 dark:text-slate-400">
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
                                  ? 'text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/15'
                                  : 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/15'
                              }`}
                            >
                              {connected ? <Unplug className="h-4 w-4" /> : <PlugZap className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              title="View"
                              onClick={() => navigate(`/clients/${client.id}`)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-blue-500/15 dark:hover:text-blue-300"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {client.connection_type === 'pppoe' && (
                              <button
                                type="button"
                                title="Edit"
                                onClick={() => navigate(`/clients/${client.id}/edit`)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              title="Delete"
                              onClick={(e) => handleDelete(client, e)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
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

          <TablePagination
            {...pager.paginationProps}
            loading={loading}
            noun={isAll ? 'client' : `${connectionType} client`}
            nounPlural={isAll ? 'clients' : `${connectionType} clients`}
          />
        </motion.div>
      </div>
    </div>
  );
}
