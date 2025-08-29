import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import {
  Home,
  Users,
  UserPlus,
  FileText,
  CreditCard,
  Receipt,
  History,
  Gift,
  Package,
  DollarSign,
  TrendingUp,
  MessageSquare,
  Mail,
  Megaphone,
  Server,
  Settings,
  Wrench,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  User,
  LogOut,
  Shield,
  Network,
  Database,
  Router,
  Wifi,
  Lock,
  Activity,
  BarChart3,
  FileSpreadsheet,
  Calendar,
  Zap,
  Globe,
  ShieldCheck,
  Key,
  Monitor,
  HardDrive,
  Cpu,
  Smartphone,
  Tablet,
  Laptop,
  Printer,
  Camera,
  Bell,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  Award,
  Target,
  PieChart,
  LineChart,
  TrendingDown,
  Wallet,
  Download,
  Upload,
  RefreshCw,
  Power,
  PowerOff,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Image,
  File,
  Folder,
  Archive,
  Trash2,
  Edit,
  Plus,
  Minus,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  MoreHorizontal,
  MoreVertical,
  ExternalLink,
  Link as LinkIcon,
  Unlink,
  Copy,
  Scissors,
  Save,
  Share,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Bookmark,
  Tag,
  Hash,
  AtSign,
  Percent,
  Infinity,
  X,
  Check,
  AlertCircle,
  Info,
  Lightbulb,
  Moon,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  Wind,
  Thermometer,
  Droplets,
  Umbrella
} from 'lucide-react';

const AppSidebar = () => {
  const [expandedSections, setExpandedSections] = useState({
    customers: true,
    billing: true,
    finance: true,
    communication: true,
    devices: true,
    network: true,
    security: true,
    monitoring: true,
    reports: true
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const navigation = [
    { title: "Dashboard", url: "/", icon: Home, badge: null },
    {
      title: "Customer Management", icon: Users, section: "customers",
      items: [
        { title: "Add New Customer", url: "/customers/new", icon: UserPlus },
        { title: "View All Customers", url: "/customers", icon: Users },
        { title: "KYC Management", url: "/customers/kyc", icon: FileText }
      ]
    },
    {
      title: "Billing & Payments", icon: CreditCard, section: "billing",
      items: [
        { title: "Payments", url: "/billing/payments", icon: CreditCard },
        { title: "Invoices", url: "/billing/invoices", icon: Receipt },
        { title: "Transaction History", url: "/billing/transactions", icon: History },
        { title: "Vouchers", url: "/billing/vouchers", icon: Gift },
        { title: "Subscriptions", url: "/billing/subscriptions", icon: RefreshCw },
        { title: "Reports", url: "/billing/reports", icon: BarChart3 }
      ]
    },
    {
      title: "Service Plans", icon: Package, url: "/plans", badge: null
    },
    // Admin-only sections
    ...(user?.is_admin ? [{
      title: "Finance", icon: DollarSign, section: "finance",
      items: [
        { title: "Leads Management", url: "/finance/leads", icon: TrendingUp },
        { title: "Expenses Management", url: "/finance/expenses", icon: DollarSign }
      ]
    }] : []),
    ...(user?.is_admin ? [{
      title: "Communication", icon: MessageSquare, section: "communication",
      items: [
        { title: "SMS Management", url: "/communication/sms", icon: MessageSquare },
        { title: "Email Management", url: "/communication/emails", icon: Mail },
        { title: "Campaigns", url: "/communication/campaigns", icon: Megaphone }
      ]
    }] : []),
    ...(user?.is_admin ? [{
      title: "Device Management", icon: Server, section: "devices",
      items: [
        { title: "Mikrotik Routers", url: "/devices/mikrotik", icon: Router },
        { title: "Equipment", url: "/devices/equipment", icon: Wrench },
        { title: "Device Status", url: "/devices/status", icon: Activity },
        { title: "Device Backup", url: "/devices/backup", icon: Download },
        { title: "Firmware Updates", url: "/devices/firmware", icon: Upload }
      ]
    }] : []),
    ...(user?.is_admin ? [{
      title: "Network Management", icon: Network, section: "network",
      items: [
        { title: "ISPs", url: "/network/isps", icon: Globe },
        { title: "RADIUS Clients", url: "/network/radius", icon: Shield },
        { title: "LDAP Servers", url: "/network/ldap", icon: Database },
        { title: "SNMP Devices", url: "/network/snmp", icon: Monitor },
        { title: "VPN Configurations", url: "/network/vpn", icon: Lock },
        { title: "EAP Profiles", url: "/network/eap", icon: Key }
      ]
    }] : []),
    ...(user?.is_admin ? [{
      title: "Security", icon: Shield, section: "security",
      items: [
        { title: "RADIUS Users", url: "/security/radius-users", icon: Users },
        { title: "RADIUS Groups", url: "/security/radius-groups", icon: ShieldCheck },
        { title: "RADIUS Accounting", url: "/security/radius-accounting", icon: Activity },
        { title: "VPN Clients", url: "/security/vpn-clients", icon: Lock },
        { title: "Access Control", url: "/security/access-control", icon: Key }
      ]
    }] : []),
    ...(user?.is_admin ? [{
      title: "Monitoring", icon: Activity, section: "monitoring",
      items: [
        { title: "SNMP Monitoring", url: "/monitoring/snmp", icon: Monitor },
        { title: "Device Statistics", url: "/monitoring/device-stats", icon: BarChart3 },
        { title: "Network Traffic", url: "/monitoring/traffic", icon: TrendingUp },
        { title: "System Logs", url: "/monitoring/logs", icon: FileText },
        { title: "Alerts", url: "/monitoring/alerts", icon: Bell }
      ]
    }] : []),
    ...(user?.is_admin ? [{
      title: "Reports & Analytics", icon: BarChart3, section: "reports",
      items: [
        { title: "Billing Reports", url: "/reports/billing", icon: Receipt },
        { title: "Network Reports", url: "/reports/network", icon: Network },
        { title: "Device Reports", url: "/reports/devices", icon: Server },
        { title: "Customer Reports", url: "/reports/customers", icon: Users },
        { title: "Performance Analytics", url: "/reports/analytics", icon: TrendingUp }
      ]
    }] : []),
    {
      title: "Support Tickets", icon: HelpCircle, url: "/tickets", badge: null
    }
  ];

  const isActive = (url) => {
    if (url === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(url);
  };

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white shadow-xl z-50">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">I</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Infora WiFi</h1>
            <p className="text-xs text-gray-400">Billing System</p>
          </div>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.first_name && user?.last_name 
                ? `${user.first_name} ${user.last_name}` 
                : user?.email || 'User'}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {user?.email || 'user@example.com'}
            </p>
            <p className="text-xs text-blue-400 truncate">
              {user?.is_admin ? 'Administrator' : 'Support'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-4 space-y-2">
          {navigation.map((item) => {
            if (item.url) {
              // Single item
              return (
                <Link
                  key={item.title}
                  to={item.url}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive(item.url)
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.title}</span>
                  {item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            } else {
              // Section with items
              const isExpanded = expandedSections[item.section];
              const hasActiveChild = item.items?.some(subItem => isActive(subItem.url));

              return (
                <div key={item.title}>
                  <button
                    onClick={() => toggleSection(item.section)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      hasActiveChild
                        ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-300"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  
                  {isExpanded && (
                    <div className="ml-6 mt-2 space-y-1">
                      {item.items?.map((subItem) => (
                        <Link
                          key={subItem.title}
                          to={subItem.url}
                          className={cn(
                            "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                            isActive(subItem.url)
                              ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                              : "text-gray-400 hover:bg-gray-700 hover:text-white"
                          )}
                        >
                          <subItem.icon className="w-4 h-4" />
                          <span>{subItem.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
          })}
        </div>
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={async () => {
            await logout();
            navigate('/login');
          }}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default AppSidebar;
