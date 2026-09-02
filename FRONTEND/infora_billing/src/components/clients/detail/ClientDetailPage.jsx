import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Play, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { customerService, unwrap } from '../../../services/customerService';
import { getActivePlans } from '../../../services/planService';
import { formatCurrency } from '../../../lib/utils';
import { formatBytes } from '../../../lib/networkUtils';

import DetailHero from './DetailHero';
import DetailTabs from './DetailTabs';
import OverviewTab from './tabs/OverviewTab';
import ReportsTab from './tabs/ReportsTab';
import {
  DevicesTab, MessagesTab, NotesTab, PackageHistoryTab, PaymentsTab, SessionsTab, TicketsTab,
} from './tabs/ListTabs';
import ChangeExpiryModal from './modals/ChangeExpiryModal';
import {
  BlockModal, CompensateModal, ConfirmModal, DeleteModal, FupOverrideModal, InvoiceModal,
  PauseModal, SendCredentialsModal, SendPaymentDetailsModal, SendSmsModal,
} from './modals/ActionModals';
import { PANEL, StatTile } from './parts';

/* -------------------------------------------------------------------------
 * The subscriber detail page.
 *
 * One eager request (`/overview`) fills the header, the KPI strip and the tab
 * counts; every other tab fetches its own data the first time it is opened and
 * keeps it. Loading all nine up front would make the first paint wait on the
 * slowest query for data most visits never look at.
 *
 * `apiCall` resolves rather than throws on failure, so every call here goes
 * through `unwrap()` — a silent catch would render an empty page and let the
 * operator believe the account really has no payments.
 * ---------------------------------------------------------------------- */

const TAB_KEYS = [
  'overview', 'reports', 'sessions', 'payments', 'packages', 'sms', 'tickets', 'devices', 'notes',
];

function duration(seconds) {
  if (!seconds) return null;
  const hours = Math.floor(seconds / 3600);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function ClientDetailPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabFromUrl = searchParams.get('tab');
  const activeTab = TAB_KEYS.includes(tabFromUrl) ? tabFromUrl : 'overview';

  const [client, setClient] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(null);

  const [plans, setPlans] = useState([]);
  const [password, setPassword] = useState(null);
  const [revealing, setRevealing] = useState(false);

  // Per-tab caches. `undefined` means "never opened", which is what drives the
  // lazy fetch below; `null` would be indistinguishable from an empty result.
  const [tabData, setTabData] = useState({});
  const [tabLoading, setTabLoading] = useState({});
  const [sessionPage, setSessionPage] = useState(1);

  const [modal, setModal] = useState(null);
  // The two canned-SMS dialogs show the real body before sending, so opening
  // one fetches its preview rather than guessing at the wording locally.
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const notify = useCallback((message, isError) => {
    if (isError) toast.error(message);
    else toast.success(message);
  }, []);

  // --- Loading -------------------------------------------------------------

  const loadCore = useCallback(async ({ silent } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [customerResult, overviewResult] = await Promise.all([
        customerService.getCustomer(customerId),
        customerService.getOverview(customerId),
      ]);
      setClient(unwrap(customerResult, 'Could not load this subscriber'));
      setOverview(unwrap(overviewResult, 'Could not load this subscriber'));
      setLoadError(null);
    } catch (error) {
      setLoadError(error.message);
      if (!silent) toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { loadCore(); }, [loadCore]);

  useEffect(() => {
    let cancelled = false;
    // Scoped to the account's own connection type: offering a hotspot package
    // to a PPPoE line is a switch that cannot be provisioned.
    getActivePlans({ plan_type: client?.connection_type })
      .then((result) => { if (!cancelled) setPlans(result?.success ? (result.data.plans || []) : []); })
      .catch(() => { /* the expiry dialog falls back to "keep current package" */ });
    return () => { cancelled = true; };
  }, [client?.connection_type]);

  /** Fetch one tab's data, once, unless `force` re-fetches after a mutation. */
  const loadTab = useCallback(async (key, { force } = {}) => {
    const fetchers = {
      reports: () => customerService.getReports(customerId),
      sessions: () => customerService.getSessions(customerId, { page: sessionPage }),
      payments: () => customerService.getCustomerPayments(customerId, { per_page: 50 }),
      packages: () => customerService.getPackageHistory(customerId),
      sms: () => customerService.getMessages(customerId),
      tickets: () => customerService.getCustomerTickets(customerId, { per_page: 50 }),
      devices: () => customerService.getDevices(customerId),
      notes: () => customerService.getNotes(customerId),
    };
    if (!fetchers[key]) return;
    if (!force && tabData[key] !== undefined) return;

    setTabLoading((state) => ({ ...state, [key]: true }));
    try {
      const payload = unwrap(await fetchers[key](), `Could not load ${key}`);
      setTabData((state) => ({ ...state, [key]: payload }));
    } catch (error) {
      toast.error(error.message);
      setTabData((state) => ({ ...state, [key]: null }));
    } finally {
      setTabLoading((state) => ({ ...state, [key]: false }));
    }
  }, [customerId, sessionPage, tabData]);

  useEffect(() => { loadTab(activeTab); }, [activeTab, loadTab]);
  useEffect(() => {
    if (activeTab === 'sessions') loadTab('sessions', { force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPage]);

  const setTab = (key) => {
    setSearchParams(key === 'overview' ? {} : { tab: key }, { replace: true });
  };

  // --- Actions -------------------------------------------------------------

  /** Run one mutation with a single spinner, one toast, and one refresh. */
  const run = useCallback(async (key, request, successMessage, { refreshTabs = [] } = {}) => {
    setBusy(key);
    try {
      const data = unwrap(await request(), 'That did not work');
      toast.success(typeof successMessage === 'function' ? successMessage(data) : successMessage);
      setModal(null);
      await loadCore({ silent: true });
      // The timeline and any list the action just wrote to are now stale.
      await Promise.all(['packages', ...refreshTabs].map((tab) =>
        tabData[tab] === undefined ? Promise.resolve() : loadTab(tab, { force: true })));
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    } finally {
      setBusy(null);
    }
  }, [loadCore, loadTab, tabData]);

  const openMessageDialog = useCallback(async (which) => {
    const kind = which === 'credentials' ? 'credentials' : 'payment_details';
    setPreview(null);
    setPreviewLoading(true);
    setModal(which);
    try {
      setPreview(unwrap(await customerService.getMessagePreview(customerId, kind),
        'Could not build the message'));
    } catch (error) {
      // A preview that fails is shown in the dialog, not swallowed — the
      // operator needs to know why there is nothing to send.
      setPreview({ error: error.message });
    } finally {
      setPreviewLoading(false);
    }
  }, [customerId]);

  const revealPassword = async () => {
    if (password !== null) { setPassword(null); return; }
    setRevealing(true);
    try {
      const data = unwrap(await customerService.getRadiusCredentials(customerId),
        'Could not load the password');
      const value = data?.password ?? data?.data?.password;
      if (!value) throw new Error('No password stored for this account — reset it to issue one');
      setPassword(value);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRevealing(false);
    }
  };

  const actions = useMemo(() => ({
    sendCredentials: () => openMessageDialog('credentials'),
    sendPaymentDetails: () => openMessageDialog('payment'),
    generateInvoice: () => setModal('invoice'),
    pause: () => setModal('pause'),
    resume: () => setModal('resume'),
    block: () => setModal('block'),
    unblock: () => setModal('unblock'),
    fupOverride: () => setModal('fup'),
    compensate: () => setModal('compensate'),
    remove: () => setModal('delete'),
  }), [openMessageDialog]);

  // --- Render --------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-full bg-slate-50 p-4 sm:p-6 dark:bg-slate-950">
        <div className="mx-auto max-w-lg py-24 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            Subscriber not available
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {loadError || 'This account could not be found.'}
          </p>
          <Link
            to="/clients"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to subscribers
          </Link>
        </div>
      </div>
    );
  }

  const counts = overview?.counts || {};
  // Per-tab summary strips. They ride on the overview call, which always loads,
  // so a tab can show the shape of its data before its own rows arrive.
  const summaries = overview?.summaries || {};
  const subscription = overview?.subscription || {};
  const lastSession = overview?.last_session;
  const wallet = overview?.wallet || {};

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'reports', label: 'Reports' },
    { key: 'sessions', label: 'Sessions', count: counts.sessions },
    { key: 'payments', label: 'Payments', count: counts.payments },
    { key: 'packages', label: 'Package history', count: counts.package_history },
    { key: 'sms', label: 'SMS', count: counts.sms },
    { key: 'tickets', label: 'Tickets', count: counts.tickets },
    { key: 'devices', label: 'Devices', count: counts.devices },
    { key: 'notes', label: 'Notes', count: counts.notes },
  ];

  const expiryTone =
    subscription.state === 'expired' ? 'critical'
      : subscription.state === 'grace' ? 'warning'
        : subscription.days_remaining != null && subscription.days_remaining <= 3 ? 'warning'
          : 'neutral';

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6 dark:bg-slate-950">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <DetailHero
          client={client}
          overview={overview}
          onCopy={notify}
          onEdit={() => navigate(`/clients/${customerId}/edit`)}
          onSendSms={() => setModal('sms')}
          onChangeExpiry={() => setModal('expiry')}
          actions={actions}
        />

        <div className={`mb-5 grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x dark:divide-slate-800 ${PANEL}`}>
          <StatTile
            label="Subscription"
            tone={expiryTone}
            value={subscription.has_expiry ? subscription.label : 'No expiry'}
            sub={subscription.expires_at
              ? `${subscription.state === 'expired' ? 'expired' : 'renews'} ${new Date(subscription.expires_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}${subscription.grace_days ? ` · ${subscription.grace_days}d grace` : ''}`
              : 'Set one from Change expiry'}
          />
          <StatTile
            label="Last session"
            tone={lastSession?.live ? 'good' : 'neutral'}
            value={lastSession
              ? (lastSession.live ? 'Live now' : new Date(lastSession.started_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }))
              : 'Never'}
            sub={lastSession
              ? `${duration(lastSession.duration_seconds) || 'just started'} · ${formatBytes((lastSession.down_bytes || 0) + (lastSession.up_bytes || 0))}`
              : 'No sessions on record'}
          />
          <StatTile
            label="Lifetime value"
            value={formatCurrency(overview?.lifetime_value || 0)}
            sub={`${formatCurrency(overview?.month_to_date || 0)} this month`}
          />
          <StatTile
            label="Wallet balance"
            tone={wallet.enabled ? 'neutral' : 'muted'}
            value={wallet.enabled ? `${wallet.points} pts` : '—'}
            sub={wallet.enabled
              ? (wallet.value != null ? `worth ${formatCurrency(wallet.value)}` : 'loyalty points earned')
              : 'Loyalty scheme not enabled'}
          />
        </div>

        <DetailTabs tabs={tabs} active={activeTab} onChange={setTab} />

        {activeTab === 'overview' && (
          <OverviewTab
            overview={overview}
            client={client}
            password={password}
            revealing={revealing}
            onRevealPassword={revealPassword}
            onSendSms={() => setModal('sms')}
            onCopy={notify}
          />
        )}
        {activeTab === 'reports' && (
          <ReportsTab
            reports={tabData.reports}
            loading={tabLoading.reports && !tabData.reports}
            refreshing={tabLoading.reports}
            onRefresh={() => loadTab('reports', { force: true })}
          />
        )}
        {activeTab === 'sessions' && (
          <SessionsTab
            data={tabData.sessions}
            loading={tabLoading.sessions && !tabData.sessions}
            page={sessionPage}
            onPage={setSessionPage}
            summary={summaries.sessions}
          />
        )}
        {activeTab === 'payments' && (
          <PaymentsTab
            data={tabData.payments}
            loading={tabLoading.payments && !tabData.payments}
            summary={summaries.payments}
          />
        )}
        {activeTab === 'packages' && (
          <PackageHistoryTab
            events={tabData.packages?.events}
            loading={tabLoading.packages && !tabData.packages}
            joinedAt={overview?.reference?.joined_at}
          />
        )}
        {activeTab === 'sms' && (
          <MessagesTab
            messages={tabData.sms?.messages}
            loading={tabLoading.sms && !tabData.sms}
            onSendSms={() => setModal('sms')}
            summary={summaries.messages}
            lifecycle={overview?.lifecycle_messages}
          />
        )}
        {activeTab === 'tickets' && (
          <TicketsTab
            data={tabData.tickets}
            loading={tabLoading.tickets && !tabData.tickets}
            summary={summaries.tickets}
          />
        )}
        {activeTab === 'devices' && (
          <DevicesTab
            devices={tabData.devices?.devices}
            loading={tabLoading.devices && !tabData.devices}
            summary={summaries.devices}
          />
        )}
        {activeTab === 'notes' && (
          <NotesTab
            notes={tabData.notes?.notes}
            loading={tabLoading.notes && !tabData.notes}
            summary={summaries.notes}
            saving={busy === 'note'}
            onAdd={(content) => run('note',
              () => customerService.addNote(customerId, content),
              'Note added', { refreshTabs: ['notes'] })}
            onDelete={(noteId) => run('note',
              () => customerService.deleteNote(customerId, noteId),
              'Note deleted', { refreshTabs: ['notes'] })}
          />
        )}
      </div>

      <ChangeExpiryModal
        open={modal === 'expiry'}
        onClose={() => setModal(null)}
        client={client}
        subscription={subscription}
        plans={plans}
        saving={busy === 'expiry'}
        onSubmit={(payload) => run('expiry',
          () => customerService.changeExpiry(customerId, payload), 'Expiry updated')}
      />

      <SendSmsModal
        open={modal === 'sms'}
        onClose={() => setModal(null)}
        client={client}
        saving={busy === 'sms'}
        onSubmit={(message) => run('sms',
          () => customerService.sendMessage(customerId, message),
          'Message sent', { refreshTabs: ['sms'] })}
      />

      <SendCredentialsModal
        open={modal === 'credentials'}
        onClose={() => setModal(null)}
        client={client}
        preview={preview}
        loading={previewLoading}
        saving={busy === 'credentials'}
        onSubmit={(message) => run('credentials',
          () => customerService.sendCredentials(customerId, message),
          (data) => `Credentials sent to ${data.sent_to}`, { refreshTabs: ['sms'] })}
      />

      <SendPaymentDetailsModal
        open={modal === 'payment'}
        onClose={() => setModal(null)}
        client={client}
        preview={preview}
        loading={previewLoading}
        saving={busy === 'payment-details'}
        onSubmit={(message) => run('payment-details',
          () => customerService.sendPaymentDetails(customerId, message),
          (data) => `Payment details sent to ${data.sent_to}`, { refreshTabs: ['sms'] })}
      />

      <InvoiceModal
        open={modal === 'invoice'}
        onClose={() => setModal(null)}
        client={client}
        plan={overview?.plan}
        saving={busy === 'invoice'}
        onSubmit={(payload) => run('invoice',
          () => customerService.generateInvoice(customerId, payload),
          (data) => `Invoice ${data.invoice.invoice_number} raised for ${formatCurrency(data.invoice.amount)}`,
          { refreshTabs: ['payments'] })}
      />

      <CompensateModal
        open={modal === 'compensate'}
        onClose={() => setModal(null)}
        client={client}
        subscription={subscription}
        saving={busy === 'compensate'}
        onSubmit={(payload) => run('compensate',
          () => customerService.compensate(customerId, payload),
          (data) => `${data.label} added to the subscription`)}
      />

      <FupOverrideModal
        open={modal === 'fup'}
        onClose={() => setModal(null)}
        fup={overview?.fup}
        saving={busy === 'fup'}
        onSubmit={(payload) => run('fup',
          () => customerService.fupOverride(customerId, payload),
          payload.mode === 'inherit'
            ? 'Back under the package policy'
            : `Fair use override set to ${payload.mode}`)}
      />

      <PauseModal
        open={modal === 'pause'}
        onClose={() => setModal(null)}
        client={client}
        subscription={subscription}
        saving={busy === 'pause'}
        onSubmit={(payload) => run('pause',
          () => customerService.pauseSubscription(customerId, payload),
          (data) => data.banked_days
            ? `Paused — ${Number(data.banked_days).toFixed(1)} days banked`
            : 'Subscription paused')}
      />

      <ConfirmModal
        open={modal === 'resume'}
        onClose={() => setModal(null)}
        icon={Play}
        title="Resume subscription"
        description="Access comes back, and so do the banked days."
        body={`${client.name} regains internet access immediately, and any days banked at the pause are added back to the expiry from now.`}
        confirmLabel="Resume subscription"
        saving={busy === 'resume'}
        onConfirm={() => run('resume',
          () => customerService.resumeSubscription(customerId),
          (data) => data.restored_days
            ? `Resumed — ${Number(data.restored_days).toFixed(1)} banked days restored`
            : 'Subscription resumed')}
      />

      <BlockModal
        open={modal === 'block'}
        onClose={() => setModal(null)}
        client={client}
        subscription={subscription}
        saving={busy === 'block'}
        onSubmit={(reason) => run('block',
          () => customerService.blockSubscriber(customerId, reason), 'Subscriber blocked')}
      />

      <ConfirmModal
        open={modal === 'unblock'}
        onClose={() => setModal(null)}
        icon={Play}
        title="Unblock subscriber"
        description="Access is restored under the existing subscription."
        body={`${client.name} can connect again. No days are handed back — the clock kept running while they were blocked.`}
        confirmLabel="Unblock subscriber"
        saving={busy === 'unblock'}
        onConfirm={() => run('unblock',
          () => customerService.unblockSubscriber(customerId), 'Subscriber unblocked')}
      />

      <DeleteModal
        open={modal === 'delete'}
        onClose={() => setModal(null)}
        client={client}
        saving={busy === 'delete'}
        onSubmit={async () => {
          setBusy('delete');
          try {
            unwrap(await customerService.deleteCustomer(customerId), 'Delete failed');
            toast.success('Subscriber deleted');
            navigate('/clients');
          } catch (error) {
            toast.error(error.message);
            setBusy(null);
          }
        }}
      />
    </div>
  );
}
