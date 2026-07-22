import React, { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar, SIDEBAR_WIDTH_EXPANDED, SIDEBAR_WIDTH_COLLAPSED } from '../../contexts/SidebarContext';
import { cn } from '../../lib/utils';
import LumenLogo from '../brand/LumenLogo';
import { BRAND } from '../../lib/brand';
import {
  Home,
  Users,
  FileText,
  CreditCard,
  Receipt,
  History,
  Gift,
  Package,
  DollarSign,
  TrendingUp,
  MessageSquare,
  Server,
  HelpCircle,
  ChevronDown,
  User,
  LogOut,
  Network,
  Lock,
  Activity,
  BarChart3,
  ShieldCheck,
  Gauge,
  Key,
  Monitor,
  Bell,
  Globe,
  Database,
  RefreshCw,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Wifi,
} from 'lucide-react';

const sidebarTransition = { duration: 0.28, ease: [0.4, 0, 0.2, 1] };
const submenuTransition = { duration: 0.22, ease: [0.4, 0, 0.2, 1] };

function NavItem({ to, icon: Icon, label, collapsed, isActive, badge, onNavigate }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={cn(
        'group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-200',
        collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
        isActive
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/30'
          : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
      )}
    >
      <Icon className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-[18px] w-[18px]')} />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={sidebarTransition}
            className="truncate overflow-hidden whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {badge && !collapsed && (
        <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
          {badge}
        </span>
      )}
      {collapsed && (
        <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-slate-700 group-hover:block">
          {label}
        </span>
      )}
    </Link>
  );
}

function NavSection({ title, icon: Icon, section, items, collapsed, expandedSections, toggleSection, isActive, onNavigate }) {
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const isExpanded = expandedSections[section];
  const hasActiveChild = items?.some((item) => isActive(item.url));

  if (collapsed) {
    return (
      <div
        className="relative"
        onMouseEnter={() => setFlyoutOpen(true)}
        onMouseLeave={() => setFlyoutOpen(false)}
      >
        <button
          type="button"
          title={title}
          className={cn(
            'flex w-full items-center justify-center rounded-lg p-2.5 transition-colors duration-200',
            hasActiveChild
              ? 'bg-blue-600/20 text-blue-400'
              : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
          )}
        >
          <Icon className="h-5 w-5" />
        </button>

        <AnimatePresence>
          {flyoutOpen && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={submenuTransition}
              className="absolute left-full top-0 z-50 ml-2 min-w-[220px] rounded-xl border border-slate-700/80 bg-slate-900 p-2 shadow-2xl shadow-black/40"
            >
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {title}
              </p>
              <div className="space-y-0.5">
                {items.map((subItem) => (
                  <Link
                    key={subItem.url}
                    to={subItem.url}
                    onClick={() => {
                      setFlyoutOpen(false);
                      onNavigate?.();
                    }}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                      isActive(subItem.url)
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    )}
                  >
                    <subItem.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{subItem.title}</span>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => toggleSection(section)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200',
          hasActiveChild
            ? 'bg-slate-800/60 text-blue-400'
            : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Icon className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate">{title}</span>
        </div>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={submenuTransition}
          className="shrink-0"
        >
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={submenuTransition}
            className="overflow-hidden"
          >
            <div className="ml-3 space-y-0.5 border-l border-slate-800 pl-3 pt-1">
              {items.map((subItem) => (
                <Link
                  key={subItem.url}
                  to={subItem.url}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-200',
                    isActive(subItem.url)
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-900/20'
                      : 'text-slate-500 hover:bg-slate-800/80 hover:text-white'
                  )}
                >
                  <subItem.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{subItem.title}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const AppSidebar = () => {
  const { collapsed, toggleCollapsed, isMobile, mobileOpen, closeMobile } = useSidebar();
  const sidebarCollapsed = isMobile ? false : collapsed;
  const handleNavigate = () => {
    if (isMobile) closeMobile();
  };
  const [expandedSections, setExpandedSections] = useState({
    billing: true,
    finance: false,
    devices: false,
    network: false,
    security: false,
    monitoring: false,
    reports: false,
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const isActive = (url) => {
    if (url === '/') return location.pathname === '/';
    if (url === '/clients') {
      return (
        location.pathname === '/clients' ||
        (location.pathname.startsWith('/clients/') && !location.pathname.startsWith('/clients/online'))
      );
    }
    if (url === '/clients/online') {
      return location.pathname.startsWith('/clients/online');
    }
    // Devices is a single link but should stay active across all /devices/* tabs.
    if (url === '/devices/mikrotik') {
      return location.pathname.startsWith('/devices');
    }
    // Network is a single link too — active across all /network/* tabs.
    if (url === '/network/isps') {
      return location.pathname.startsWith('/network');
    }
    return location.pathname.startsWith(url);
  };

  const navigation = useMemo(
    () => [
      { type: 'link', title: 'Dashboard', url: '/', icon: Home },
      { type: 'link', title: 'Clients', url: '/clients', icon: Users },
      { type: 'link', title: 'Online Users', url: '/clients/online', icon: Activity },
      { type: 'link', title: 'Packages', url: '/plans', icon: Package },
      { type: 'link', title: 'FUP Monitor', url: '/fup', icon: Gauge },
      {
        type: 'section',
        title: 'Billing',
        icon: CreditCard,
        section: 'billing',
        items: [
          { title: 'Payments', url: '/billing/payments', icon: CreditCard },
          { title: 'Invoices', url: '/billing/invoices', icon: Receipt },
          { title: 'Transactions', url: '/billing/transactions', icon: History },
          { title: 'Vouchers', url: '/billing/vouchers', icon: Gift },
          { title: 'Subscriptions', url: '/billing/subscriptions', icon: RefreshCw },
          { title: 'Reports', url: '/billing/reports', icon: BarChart3 },
        ],
      },
      ...(user?.is_admin
        ? [
            {
              type: 'section',
              title: 'Finance',
              icon: DollarSign,
              section: 'finance',
              items: [
                { title: 'Leads', url: '/finance/leads', icon: TrendingUp },
                { title: 'Expenses', url: '/finance/expenses', icon: DollarSign },
              ],
            },
            { type: 'link', title: 'Communication', url: '/communication', icon: MessageSquare },
            { type: 'link', title: 'Devices', url: '/devices/mikrotik', icon: Server },
            {
              type: 'section',
              title: 'Network',
              icon: Network,
              section: 'network',
              items: [
                { title: 'ISPs', url: '/network/isps', icon: Globe },
                { title: 'VPN', url: '/network/vpn', icon: Lock },
                { title: 'WireGuard', url: '/network/wireguard', icon: Network },
                { title: 'LDAP', url: '/network/ldap', icon: Database },
                { title: 'EAP', url: '/network/eap', icon: Key },
              ],
            },
            {
              type: 'section',
              title: 'Security',
              icon: ShieldCheck,
              section: 'security',
              items: [
                { title: 'RADIUS Users', url: '/security/radius-users', icon: Users },
                { title: 'RADIUS Groups', url: '/security/radius-groups', icon: ShieldCheck },
                { title: 'Accounting', url: '/security/radius-accounting', icon: Activity },
                { title: 'Access Control', url: '/security/access-control', icon: Key },
              ],
            },
            {
              type: 'section',
              title: 'Monitoring',
              icon: Activity,
              section: 'monitoring',
              items: [
                { title: 'SNMP', url: '/monitoring/snmp', icon: Monitor },
                { title: 'Device Stats', url: '/monitoring/device-stats', icon: BarChart3 },
                { title: 'Traffic', url: '/monitoring/traffic', icon: TrendingUp },
                { title: 'System Logs', url: '/monitoring/logs', icon: FileText },
                { title: 'Alerts', url: '/monitoring/alerts', icon: Bell },
              ],
            },
            {
              type: 'section',
              title: 'Reports',
              icon: BarChart3,
              section: 'reports',
              items: [
                { title: 'Billing', url: '/reports/billing', icon: Receipt },
                { title: 'Network', url: '/reports/network', icon: Network },
                { title: 'Devices', url: '/reports/devices', icon: Server },
                { title: 'Clients', url: '/reports/customers', icon: Users },
                { title: 'Analytics', url: '/reports/analytics', icon: TrendingUp },
              ],
            },
          ]
        : []),
      { type: 'link', title: 'Support', url: '/tickets', icon: HelpCircle },
    ],
    [user?.is_admin]
  );

  const displayName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.email?.split('@')[0] || 'User';

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
        isMobile
          ? undefined
          : { width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }
      }
      style={isMobile ? { width: SIDEBAR_WIDTH_EXPANDED } : undefined}
      transition={sidebarTransition}
      className={cn(
        'fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-slate-800/80 bg-slate-950 text-white shadow-xl',
        isMobile && 'transition-transform duration-300 ease-out',
        isMobile && (mobileOpen ? 'translate-x-0' : '-translate-x-full'),
        'lg:translate-x-0'
      )}
    >
      {/* Brand header */}
      <div className={cn('flex shrink-0 items-center border-b border-slate-800/80', sidebarCollapsed ? 'justify-center p-3' : 'gap-3 p-4')}>
        {sidebarCollapsed ? (
          <LumenLogo size="sm" />
        ) : (
          <LumenLogo size="md" showText theme="dark" subtitle={BRAND.tagline} className="min-w-0 flex-1" />
        )}
        {!sidebarCollapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white lg:inline-flex"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
        {isMobile && (
          <button
            type="button"
            onClick={closeMobile}
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* User strip */}
      <div className={cn('shrink-0 border-b border-slate-800/80', sidebarCollapsed ? 'p-2' : 'p-3')}>
        <div className={cn('flex items-center', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-violet-600 ring-2 ring-slate-800">
            <User className="h-4 w-4 text-white" />
          </div>
          <AnimatePresence initial={false}>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={sidebarTransition}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-medium text-white">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-400">
                  {user?.is_admin ? 'Administrator' : 'Support'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-3">
        <div className={cn('space-y-1', sidebarCollapsed ? 'px-2' : 'px-3')}>
          {!sidebarCollapsed && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              Main Menu
            </p>
          )}
          {navigation.map((item) =>
            item.type === 'link' ? (
              <NavItem
                key={item.url}
                to={item.url}
                icon={item.icon}
                label={item.title}
                collapsed={sidebarCollapsed}
                isActive={isActive(item.url)}
                badge={item.badge}
                onNavigate={handleNavigate}
              />
            ) : (
              <NavSection
                key={item.section}
                title={item.title}
                icon={item.icon}
                section={item.section}
                items={item.items}
                collapsed={sidebarCollapsed}
                expandedSections={expandedSections}
                toggleSection={toggleSection}
                isActive={isActive}
                onNavigate={handleNavigate}
              />
            )
          )}
        </div>
      </nav>

      {/* Footer actions */}
      <div className={cn('shrink-0 space-y-1 border-t border-slate-800/80', sidebarCollapsed ? 'p-2' : 'p-3')}>
        {sidebarCollapsed && !isMobile && (
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Expand sidebar"
            className="flex w-full items-center justify-center rounded-lg p-2.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        )}
        <NavItem
          to="/settings"
          icon={Settings}
          label="Settings"
          collapsed={sidebarCollapsed}
          isActive={isActive('/settings')}
          onNavigate={handleNavigate}
        />
        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
          title={sidebarCollapsed ? 'Logout' : undefined}
          className={cn(
            'group relative flex w-full items-center rounded-lg text-sm font-medium text-slate-400 transition-colors duration-200 hover:bg-rose-950/40 hover:text-rose-400',
            sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
          )}
        >
          <LogOut className={cn('shrink-0', sidebarCollapsed ? 'h-5 w-5' : 'h-[18px] w-[18px]')} />
          <AnimatePresence initial={false}>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={sidebarTransition}
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
          {sidebarCollapsed && !isMobile && (
            <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-slate-700 group-hover:block">
              Logout
            </span>
          )}
        </button>
      </div>
    </motion.aside>
    </>
  );
};

export default AppSidebar;
