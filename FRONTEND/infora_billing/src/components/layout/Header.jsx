import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  User,
  LogOut,
  ChevronRight,
  Router,
  Wifi,
  Radio,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  Users,
  Package,
  Settings,
  LayoutDashboard,
  Shield,
  CreditCard,
  FileText,
  Bug,
  X,
  Bell,
  Moon,
  Sun,
  AlertTriangle,
  Info,
  Menu,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { BRAND, sanitizeBrandText, STORAGE_KEYS } from '../../lib/brand';
import { buildBreadcrumbs } from '../../lib/navBreadcrumbs';
import { getDashboardStats } from '../../services/dashboardService';
import { cn } from '../../lib/utils';

const QUICK_LINKS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Clients', path: '/clients', icon: Users },
  { label: 'Online users', path: '/clients/online', icon: Radio },
  { label: 'Packages', path: '/plans', icon: Package },
  { label: 'Settings', path: '/settings', icon: Settings },
];

const SETTINGS_ITEMS = [
  {
    title: 'Settings',
    icon: Settings,
    description: 'General system settings and preferences',
    path: '/settings',
  },
  {
    title: '2FA Settings',
    icon: Shield,
    description: 'Two-factor authentication setup',
    path: '/settings/2fa',
  },
  {
    title: 'Billing & Subscription',
    icon: CreditCard,
    description: 'Manage billing and subscription',
    path: '/settings/billing',
  },
  {
    title: 'System Users',
    icon: Users,
    description: 'Manage system users and permissions',
    path: '/settings/users',
  },
  {
    title: 'System Logs',
    icon: FileText,
    description: 'View system activity logs',
    path: '/settings/logs',
  },
  {
    title: 'Features & Bug Report',
    icon: Bug,
    description: 'Report bugs and request features',
    path: '/settings/bug-report',
  },
  {
    title: 'Contact Support',
    icon: MessageSquare,
    description: 'Get help from support team',
    path: '/settings/contact-support',
  },
];

function buildNotifications(dashboard) {
  if (!dashboard) return [];
  const items = (dashboard.alerts || []).map((alert, index) => ({
    id: `alert-${index}-${alert.title}`,
    level: alert.level || 'info',
    title: alert.title,
    message: alert.message,
    link: alert.link,
    time: dashboard.generated_at,
  }));
  return items;
}

const NOTIFICATION_ICONS = {
  warning: AlertTriangle,
  info: Info,
  error: AlertTriangle,
};

function iconButtonClass(active = false) {
  return cn(
    'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
    active
      ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
  );
}

function StatusPill({ to, icon: Icon, label, value, variant = 'default', loading }) {
  const base =
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors shrink-0';
  const variants = {
    default:
      'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
    online:
      'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-500/25',
  };

  const content = (
    <>
      {variant === 'online' ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
      ) : (
        <Icon className="h-3.5 w-3.5 opacity-70" />
      )}
      <span className="tabular-nums">{loading ? '…' : value}</span>
      <span className="font-medium opacity-80">{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={cn(base, variants[variant])}>
        {content}
      </Link>
    );
  }

  return <span className={cn(base, variants[variant])}>{content}</span>;
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleMobile } = useSidebar();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const searchRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readTick, setReadTick] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({});
  const [onlineCount, setOnlineCount] = useState(0);

  const orgName = sanitizeBrandText(user?.company_name, BRAND.companyName);
  const crumbs = buildBreadcrumbs(location.pathname);
  const displayName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.email?.split('@')[0] || 'User';

  const loadNavbarStats = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setStatsLoading(true);

      const dashResult = await getDashboardStats();

      if (dashResult) {
        setStats(dashResult.summary || {});
        setNotifications(buildNotifications(dashResult));
        setOnlineCount(dashResult.session_counts?.all ?? dashResult.active_sessions ?? 0);
      }
    } catch {
      /* keep last known stats */
    } finally {
      setStatsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNavbarStats();
    const interval = setInterval(() => loadNavbarStats(true), 60000);
    return () => clearInterval(interval);
  }, [loadNavbarStats]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setUserMenuOpen(false);
        setSettingsOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchTerm.trim();
    setPaletteOpen(false);
    if (!q) return;
    navigate(`/clients?search=${encodeURIComponent(q)}`);
    setSearchTerm('');
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    setSettingsOpen(false);
    setNotificationsOpen(false);
    await logout();
    navigate('/login');
  };

  const markNotificationsRead = () => {
    localStorage.setItem(STORAGE_KEYS.notificationsReadAt, new Date().toISOString());
    setReadTick((t) => t + 1);
  };

  const unreadCount = useMemo(() => {
    void readTick;
    if (!notifications.length) return 0;
    const readAt = localStorage.getItem(STORAGE_KEYS.notificationsReadAt);
    if (!readAt) return notifications.length;
    const readTime = new Date(readAt).getTime();
    return notifications.filter((n) => {
      const t = n.time ? new Date(n.time).getTime() : Date.now();
      return t > readTime;
    }).length;
  }, [notifications, readTick]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 px-4 h-[60px] min-w-0 lg:gap-3 lg:px-6">
          <button
            type="button"
            onClick={() => toggleMobile()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1.5 min-w-0 shrink text-sm" aria-label="Breadcrumb">
            <span className="hidden sm:inline font-medium text-slate-400 dark:text-slate-500 truncate max-w-[140px] lg:max-w-[200px]">
              {orgName}
            </span>
            <ChevronRight className="hidden sm:block h-3.5 w-3.5 text-slate-300 shrink-0" />
            <ol className="flex items-center gap-1 min-w-0 truncate">
              {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1;
                return (
                  <li key={crumb.path} className="flex items-center gap-1 min-w-0">
                    {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />}
                    {isLast ? (
                      <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{crumb.label}</span>
                    ) : (
                      <Link
                        to={crumb.path}
                        className="font-medium text-slate-500 hover:text-slate-800 truncate"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Status pills — center, scroll on small screens */}
          <div className="hidden md:flex flex-1 items-center justify-center gap-2 min-w-0 overflow-x-auto scrollbar-none px-2">
            <StatusPill
              to="/devices/mikrotik"
              icon={Router}
              label="Routers"
              value={stats.total_devices ?? 0}
              loading={statsLoading}
            />
            <StatusPill
              to="/clients/online"
              icon={Radio}
              label="Online"
              value={onlineCount}
              variant="online"
              loading={statsLoading}
            />
            <StatusPill
              to="/clients/pppoe"
              icon={Router}
              label="PPPoE"
              value={stats.pppoe_customers ?? 0}
              loading={statsLoading}
            />
            <StatusPill
              to="/clients/hotspot"
              icon={Wifi}
              label="Hotspot"
              value={stats.hotspot_customers ?? 0}
              loading={statsLoading}
            />
            <StatusPill
              to="/tickets"
              icon={MessageSquare}
              label="Tickets"
              value={stats.open_tickets ?? 0}
              loading={statsLoading}
            />
            <button
              type="button"
              onClick={() => loadNavbarStats(true)}
              disabled={refreshing}
              title="Refresh status"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Right utilities */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setPaletteOpen(true);
                setTimeout(() => searchRef.current?.focus(), 50);
              }}
              className="hidden sm:flex items-center gap-2 h-9 w-44 lg:w-52 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-3 text-sm text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-white dark:hover:bg-slate-800 transition-colors"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left truncate">Search…</span>
              <kbd className="hidden lg:inline-flex items-center rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                ⌘K
              </kbd>
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const opening = !notificationsOpen;
                  setNotificationsOpen(opening);
                  setSettingsOpen(false);
                  setUserMenuOpen(false);
                  if (opening) markNotificationsRead();
                }}
                title="Notifications"
                className={cn(iconButtonClass(notificationsOpen), 'relative')}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notificationsOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40"
                      aria-label="Close notifications"
                      onClick={() => setNotificationsOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</h2>
                        <button
                          type="button"
                          onClick={() => setNotificationsOpen(false)}
                          className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-10 text-center">
                            <Bell className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">All caught up</p>
                            <p className="text-xs text-slate-400 mt-1">No alerts right now</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {notifications.map((item) => {
                              const LevelIcon = NOTIFICATION_ICONS[item.level] || Info;
                              const tone =
                                item.level === 'warning'
                                  ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400'
                                  : 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400';
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setNotificationsOpen(false);
                                    if (item.link) navigate(item.link);
                                  }}
                                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                                >
                                  <div className={cn('p-2 rounded-lg shrink-0', tone)}>
                                    <LevelIcon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                      {item.title}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                      {item.message}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setNotificationsOpen(false);
                              navigate('/tickets');
                            }}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            View all support items
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className={iconButtonClass()}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Settings dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  setNotificationsOpen(false);
                  setSettingsOpen((v) => !v);
                }}
                title="Settings"
                className={iconButtonClass(settingsOpen)}
              >
                <Settings className="h-4 w-4" />
              </button>

              <AnimatePresence>
                {settingsOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40"
                      aria-label="Close settings"
                      onClick={() => setSettingsOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Settings</h2>
                        <button
                          type="button"
                          onClick={() => setSettingsOpen(false)}
                          className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="p-2 max-h-80 overflow-y-auto">
                        {SETTINGS_ITEMS.map((item, index) => (
                          <motion.button
                            key={item.path}
                            type="button"
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={() => {
                              navigate(item.path);
                              setSettingsOpen(false);
                            }}
                            className="w-full flex items-start gap-3 p-3 text-left rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                          >
                            <div className="p-2 bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 rounded-lg transition-colors shrink-0">
                              <item.icon className="h-4 w-4 text-slate-600 dark:text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                {item.title}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-center">
                        <p className="text-xs text-slate-500">{BRAND.fullName}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Version 1.0.0</p>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen((v) => !v);
                  setSettingsOpen(false);
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                  <User className="h-4 w-4 text-white" />
                </div>
                <ChevronDown
                  className={cn('h-4 w-4 text-slate-400 hidden sm:block transition-transform', userMenuOpen && 'rotate-180')}
                />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-40"
                      aria-label="Close menu"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
                        <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                      </div>
                      <div className="p-1">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 rounded-lg hover:bg-rose-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Mobile status strip */}
        <div className="md:hidden flex items-center gap-2 px-4 pb-2.5 overflow-x-auto scrollbar-none">
          <StatusPill
            to="/clients/online"
            icon={Radio}
            label="Online"
            value={onlineCount}
            variant="online"
            loading={statsLoading}
          />
          <StatusPill
            to="/devices/mikrotik"
            icon={Router}
            label="Routers"
            value={stats.total_devices ?? 0}
            loading={statsLoading}
          />
          <StatusPill
            to="/tickets"
            icon={MessageSquare}
            label="Tickets"
            value={stats.open_tickets ?? 0}
            loading={statsLoading}
          />
        </div>
      </header>

      {/* Command palette / search */}
      <AnimatePresence>
        {paletteOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px]"
              onClick={() => setPaletteOpen(false)}
              aria-label="Close search"
            />
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              className="fixed left-1/2 top-[12%] z-50 w-[min(100%,32rem)] -translate-x-1/2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
                <Search className="h-5 w-5 text-slate-400 shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search clients, invoices, pages…"
                  className="flex-1 border-0 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-0"
                />
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400">
                  esc
                </kbd>
              </form>
              <div className="p-2 max-h-64 overflow-y-auto">
                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Quick navigation
                </p>
                {QUICK_LINKS.map((link) => (
                  <button
                    key={link.path}
                    type="button"
                    onClick={() => {
                      setPaletteOpen(false);
                      navigate(link.path);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <link.icon className="h-4 w-4 text-slate-400" />
                    {link.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
