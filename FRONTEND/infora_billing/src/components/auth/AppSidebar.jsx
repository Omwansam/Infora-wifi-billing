import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import {
  useSidebar,
  SIDEBAR_WIDTH_EXPANDED,
  SIDEBAR_WIDTH_COLLAPSED,
} from '../../contexts/SidebarContext';
import { cn } from '../../lib/utils';
import LumenLogo from '../brand/LumenLogo';
import {
  Activity,
  ArrowDownToLine,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Cpu,
  CreditCard,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  Network,
  Package,
  PanelLeftOpen,
  Radio,
  Router,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
  X,
} from 'lucide-react';

const shellTransition = { duration: 0.28, ease: [0.4, 0, 0.2, 1] };
const revealTransition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] };

/**
 * Navigation model.
 *
 * Grouped by what an operator is trying to do rather than by which backend
 * owns the data — "Leads" sits under Customers even though it is served by the
 * finance blueprint, because that is where someone looks for it.
 *
 * Groups collapse. Only the one containing the current page opens itself, so
 * the resting sidebar is a short list instead of forty links.
 *
 * `admin` mirrors the AdminRoute guards on these pages: support users get the
 * subscriber and billing surface, nothing that exposes router credentials.
 */
function buildSections(isAdmin) {
  const adminOnly = (items) => (isAdmin ? items : []);

  const sections = [
    { items: [{ label: 'Overview', to: '/', icon: LayoutDashboard }] },
    {
      title: 'Customers',
      items: [
        {
          id: 'subscribers',
          label: 'Subscribers',
          icon: Users,
          children: [
            { label: 'All subscribers', to: '/clients' },
            { label: 'PPPoE', to: '/clients/pppoe' },
            { label: 'Hotspot', to: '/clients/hotspot' },
            { label: 'KYC review', to: '/clients/kyc' },
          ],
        },
        { label: 'Live sessions', to: '/clients/online', icon: Radio },
        ...adminOnly([{ label: 'Leads', to: '/finance/leads', icon: TrendingUp }]),
        { label: 'Tickets', to: '/tickets', icon: LifeBuoy },
      ],
    },
    {
      title: 'Network',
      items: [
        { label: 'Plans', to: '/plans', icon: Package },
        ...adminOnly([
          {
            id: 'devices',
            label: 'Devices',
            icon: Router,
            children: [
              { label: 'MikroTik', to: '/devices/mikrotik' },
              { label: 'Equipment', to: '/devices/equipment' },
              { label: 'Status', to: '/devices/status' },
              { label: 'Backups', to: '/devices/backup' },
              { label: 'Firmware', to: '/devices/firmware' },
            ],
          },
          { label: 'TR-069 CPE', to: '/devices/cpe', icon: Cpu },
          {
            id: 'radius',
            label: 'RADIUS',
            icon: ShieldCheck,
            children: [
              { label: 'Server', to: '/network/radius' },
              { label: 'Users', to: '/security/radius-users' },
              { label: 'Groups', to: '/security/radius-groups' },
              { label: 'Accounting', to: '/security/radius-accounting' },
              { label: 'Access control', to: '/security/access-control' },
            ],
          },
          {
            id: 'infrastructure',
            label: 'Infrastructure',
            icon: Network,
            children: [
              { label: 'ISPs', to: '/network/isps' },
              { label: 'VPN', to: '/network/vpn' },
              { label: 'WireGuard', to: '/network/wireguard' },
              { label: 'LDAP', to: '/network/ldap' },
              { label: 'EAP', to: '/network/eap' },
              { label: 'SNMP', to: '/network/snmp' },
            ],
          },
        ]),
        { label: 'FUP monitor', to: '/fup', icon: Gauge },
      ],
    },
    {
      title: 'Finance',
      items: [
        {
          id: 'billing',
          label: 'Billing',
          icon: CreditCard,
          children: [
            { label: 'Payments', to: '/billing/payments' },
            { label: 'Invoices', to: '/billing/invoices' },
            { label: 'Transactions', to: '/billing/transactions' },
            { label: 'Subscriptions', to: '/billing/subscriptions' },
            { label: 'Reports', to: '/billing/reports' },
          ],
        },
        { label: 'Vouchers', to: '/billing/vouchers', icon: Ticket },
        ...adminOnly([{ label: 'Expenses', to: '/finance/expenses', icon: Wallet }]),
      ],
    },
    {
      title: 'Outreach',
      items: adminOnly([
        {
          id: 'communications',
          label: 'Communications',
          icon: Megaphone,
          children: [
            { label: 'Overview', to: '/communication' },
            { label: 'SMS', to: '/communication/sms' },
            { label: 'Emails', to: '/communication/emails' },
            { label: 'Campaigns', to: '/communication/campaigns' },
          ],
        },
      ]),
    },
    {
      title: 'Insights',
      items: adminOnly([
        {
          id: 'reports',
          label: 'Reports',
          icon: BarChart3,
          children: [
            { label: 'Billing', to: '/reports/billing' },
            { label: 'Network', to: '/reports/network' },
            { label: 'Devices', to: '/reports/devices' },
            { label: 'Subscribers', to: '/reports/customers' },
            { label: 'Analytics', to: '/reports/analytics' },
          ],
        },
        {
          id: 'monitoring',
          label: 'Monitoring',
          icon: Activity,
          children: [
            { label: 'SNMP', to: '/monitoring/snmp' },
            { label: 'Device stats', to: '/monitoring/device-stats' },
            { label: 'Traffic', to: '/monitoring/traffic' },
            { label: 'System logs', to: '/monitoring/logs' },
            { label: 'Alerts', to: '/monitoring/alerts' },
          ],
        },
      ]),
    },
    {
      title: 'Data',
      items: adminOnly([
        {
          id: 'import',
          label: 'Import & migration',
          icon: ArrowDownToLine,
          children: [
            { label: 'Overview', to: '/import' },
            { label: 'From a router', to: '/import/router' },
            { label: 'From a file', to: '/import/file' },
            { label: 'Cutover', to: '/import/cutover' },
            { label: 'History', to: '/import/runs' },
          ],
        },
      ]),
    },
  ];

  // A support user empties whole sections; don't leave their headings behind.
  return sections.filter((s) => s.items.length > 0);
}

const FOOTER_LINKS = [
  { label: 'Help & support', to: '/settings/contact-support', icon: HelpCircle },
  { label: 'Send feedback', to: '/settings/bug-report', icon: MessageSquare },
];

/**
 * Longest-prefix match, rather than a rule per link.
 *
 * `/clients/243` has to light "All subscribers" while `/clients/hotspot` lights
 * Hotspot — both are prefixes of the path, so the longer one wins and the
 * special-casing that used to live here disappears.
 */
function findActive(sections, pathname) {
  let best = null;
  let bestLen = -1;

  const consider = (to) => {
    if (!to) return;
    if (to === '/') {
      if (pathname === '/' && bestLen < 0) {
        best = '/';
        bestLen = 0;
      }
      return;
    }
    if ((pathname === to || pathname.startsWith(`${to}/`)) && to.length > bestLen) {
      best = to;
      bestLen = to.length;
    }
  };

  for (const section of sections) {
    for (const item of section.items) {
      consider(item.to);
      item.children?.forEach((child) => consider(child.to));
    }
  }
  return best;
}

const rowBase =
  'group relative flex w-full items-center rounded-lg text-[13.5px] transition-colors duration-150';

function rowTone(active) {
  return active
    ? 'bg-white/[0.08] font-medium text-white'
    : 'text-white/65 hover:bg-white/[0.04] hover:text-white';
}

function Tooltip({ label }) {
  return (
    <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-slate-700 group-hover:block">
      {label}
    </span>
  );
}

function LeafLink({ to, icon: Icon, label, active, collapsed, onNavigate }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(rowBase, rowTone(active), collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-1.5')}
    >
      {Icon && (
        <Icon
          className={cn(
            'h-[17px] w-[17px] shrink-0 transition-colors',
            active ? 'text-amber-400' : 'text-white/40 group-hover:text-white/70'
          )}
        />
      )}
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && <Tooltip label={label} />}
    </Link>
  );
}

/** A collapsed rail can't nest, so groups become hover flyouts. */
function GroupFlyout({ item, activeTo, onNavigate }) {
  const [open, setOpen] = useState(false);
  const Icon = item.icon;
  const hasActive = item.children.some((c) => c.to === activeTo);

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={item.label}
        aria-expanded={open}
        className={cn(rowBase, rowTone(hasActive), 'justify-center p-2.5')}
      >
        <Icon
          className={cn('h-[17px] w-[17px]', hasActive ? 'text-amber-400' : 'text-white/40')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={revealTransition}
            className="absolute left-full top-0 z-50 ml-2 min-w-[210px] rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-2xl shadow-black/50"
          >
            <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              {item.label}
            </p>
            {item.children.map((child) => (
              <Link
                key={child.to}
                to={child.to}
                onClick={() => {
                  setOpen(false);
                  onNavigate?.();
                }}
                className={cn(
                  'flex items-center rounded-lg px-2.5 py-2 text-[13.5px] transition-colors',
                  child.to === activeTo
                    ? 'bg-white/[0.08] font-medium text-white'
                    : 'text-white/65 hover:bg-white/[0.05] hover:text-white'
                )}
              >
                {child.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GroupRow({ item, activeTo, open, onToggle, onNavigate }) {
  const Icon = item.icon;
  const hasActive = item.children.some((c) => c.to === activeTo);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(rowBase, rowTone(hasActive && !open), 'gap-3 px-3 py-1.5')}
      >
        <Icon
          className={cn(
            'h-[17px] w-[17px] shrink-0 transition-colors',
            hasActive ? 'text-amber-400' : 'text-white/40 group-hover:text-white/70'
          )}
        />
        <span className="truncate">{item.label}</span>
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={revealTransition}
          className="ml-auto shrink-0 text-white/40"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={revealTransition}
            className="overflow-hidden"
          >
            <div className="my-0.5 ml-[26px] space-y-px border-l border-slate-800 pl-3">
              {item.children.map((child) => {
                const active = child.to === activeTo;
                return (
                  <Link
                    key={child.to}
                    to={child.to}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center rounded-md px-2.5 py-[5px] text-[13px] transition-colors',
                      active
                        ? 'bg-white/[0.07] font-medium text-white'
                        : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
                    )}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AppSidebar() {
  const { collapsed, toggleCollapsed, isMobile, mobileOpen, closeMobile } = useSidebar();
  const { user } = useAuth();
  const { pathname } = useLocation();

  // The rail only exists on desktop; on mobile the drawer is always full width.
  const isRail = isMobile ? false : collapsed;
  const handleNavigate = () => {
    if (isMobile) closeMobile();
  };

  const sections = useMemo(() => buildSections(Boolean(user?.is_admin)), [user?.is_admin]);
  const activeTo = useMemo(() => findActive(sections, pathname), [sections, pathname]);
  const [openGroups, setOpenGroups] = useState({});

  // Open the group holding the current page, but never close one the operator
  // opened themselves — navigating shouldn't undo their choices.
  useEffect(() => {
    const owner = sections
      .flatMap((s) => s.items)
      .find((i) => i.children?.some((c) => c.to === activeTo));
    if (owner) setOpenGroups((prev) => (prev[owner.id] ? prev : { ...prev, [owner.id]: true }));
  }, [sections, activeTo]);

  return (
    <>
      {isMobile && mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={closeMobile}
        />
      )}

      <motion.aside
        initial={false}
        animate={
          isMobile ? undefined : { width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }
        }
        style={isMobile ? { width: SIDEBAR_WIDTH_EXPANDED } : undefined}
        transition={shellTransition}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-slate-800/70 bg-slate-950',
          isMobile && 'transition-transform duration-300 ease-out',
          isMobile && (mobileOpen ? 'translate-x-0' : '-translate-x-full'),
          'lg:translate-x-0'
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex h-14 shrink-0 items-center',
            isRail ? 'justify-center px-2' : 'gap-2 pl-4 pr-2.5'
          )}
        >
          {isRail ? (
            <LumenLogo size="sm" />
          ) : (
            <LumenLogo size="sm" showText theme="dark" className="min-w-0 flex-1" />
          )}
          {!isRail && !isMobile && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              className="hidden rounded-md p-1.5 text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/70 lg:inline-flex"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={closeMobile}
              aria-label="Close menu"
              className="ml-auto rounded-md p-1.5 text-white/65 hover:bg-white/[0.06] hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav
          aria-label="Main"
          className={cn(
            'sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-3',
            isRail ? 'px-2' : 'px-2.5'
          )}
        >
          {sections.map((section, index) => (
            <div key={section.title || 'primary'} className={index === 0 ? '' : 'mt-4'}>
              {section.title && !isRail && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.09em] text-white/50">
                  {section.title}
                </p>
              )}
              {section.title && isRail && index > 0 && (
                <div className="mx-auto mb-2 h-px w-6 bg-slate-800" aria-hidden="true" />
              )}
              <div className="space-y-px">
                {section.items.map((item) => {
                  if (item.children) {
                    return isRail ? (
                      <GroupFlyout
                        key={item.id}
                        item={item}
                        activeTo={activeTo}
                        onNavigate={handleNavigate}
                      />
                    ) : (
                      <GroupRow
                        key={item.id}
                        item={item}
                        activeTo={activeTo}
                        open={Boolean(openGroups[item.id])}
                        onToggle={() =>
                          setOpenGroups((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                        }
                        onNavigate={handleNavigate}
                      />
                    );
                  }
                  return (
                    <LeafLink
                      key={item.to}
                      to={item.to}
                      icon={item.icon}
                      label={item.label}
                      active={item.to === activeTo}
                      collapsed={isRail}
                      onNavigate={handleNavigate}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pinned utilities. Settings, account and sign-out live in the header's
            profile menu — this used to duplicate them. */}
        <div
          className={cn(
            'shrink-0 space-y-px border-t border-slate-800/70 py-2',
            isRail ? 'px-2' : 'px-2.5'
          )}
        >
          {isRail && !isMobile && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
              className={cn(rowBase, rowTone(false), 'justify-center p-2.5')}
            >
              <PanelLeftOpen className="h-[17px] w-[17px] text-white/40" />
              <Tooltip label="Expand sidebar" />
            </button>
          )}
          {FOOTER_LINKS.map((link) => (
            <LeafLink
              key={link.to}
              to={link.to}
              icon={link.icon}
              label={link.label}
              active={link.to === activeTo}
              collapsed={isRail}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      </motion.aside>
    </>
  );
}
