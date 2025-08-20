import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Users,
  CreditCard,
  Ticket,
  MessageSquare,
  Settings,
  BarChart3,
  Wifi,
  UserPlus,
  Home,
  Server,
  ChevronDown,
  ChevronRight,
  FileText,
  Receipt,
  DollarSign,
  TrendingUp,
  Mail,
  Smartphone,
  Building,
  Tool,
  Bell,
  LogOut,
  User,
  Moon,
  Sun
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../lib/utils";

function Badge({ children, className }) {
  return (
    <span className={`px-2 py-1 text-xs rounded-full border ${className}`}>
      {children}
    </span>
  );
}

export default function AppSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    customers: true,
    billing: true,
    finance: false,
    communication: false,
    devices: false
  });
  const location = useLocation();
  const { user, logout } = useAuth();

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleMenuClick = () => {
    setIsMobileOpen(false);
  };

  const navigation = [
    {
      title: "Dashboard",
      url: "/",
      icon: Home,
      badge: null
    },
      {
        title: "Customer Management",
        icon: Users,
      section: "customers",
        items: [
        { title: "Add New Customer", url: "/customers/new", icon: UserPlus },
          { title: "View All Customers", url: "/customers", icon: Users },
        { title: "KYC Management", url: "/customers/kyc", icon: FileText }
      ]
      },
      {
        title: "Billing & Payments",
        icon: CreditCard,
      section: "billing",
      items: [
        { title: "Payments", url: "/billing/payments", icon: DollarSign },
        { title: "Vouchers", url: "/billing/vouchers", icon: Receipt },
        { title: "Invoices", url: "/billing/invoices", icon: FileText },
        { title: "Transaction History", url: "/billing/transactions", icon: BarChart3 }
      ]
    },
    {
      title: "Service Plans",
      url: "/plans",
      icon: Wifi,
      badge: null
    },
    {
      title: "Finance",
      icon: TrendingUp,
      section: "finance",
      items: [
        { title: "Leads", url: "/finance/leads", icon: UserPlus },
        { title: "Expenses", url: "/finance/expenses", icon: DollarSign }
      ]
    },
    {
      title: "Communication",
      icon: MessageSquare,
      section: "communication",
      items: [
        { title: "SMS", url: "/communication/sms", icon: Smartphone },
        { title: "Emails", url: "/communication/emails", icon: Mail },
        { title: "Campaigns", url: "/communication/campaigns", icon: Bell }
      ]
    },
    {
      title: "Devices",
      icon: Server,
      section: "devices",
        items: [
        { title: "Mikrotik", url: "/devices/mikrotik", icon: Wifi },
        { title: "Equipment", url: "/devices/equipment", icon: Building }
      ]
    },
    {
      title: "Tickets",
      url: "/tickets",
      icon: Ticket,
      badge: "3"
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
      badge: null
    }
  ];

  const isActive = (url) => {
    if (url === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(url);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
    <aside
        className={cn(
          "fixed left-0 top-0 h-screen flex flex-col w-64 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-slate-700 z-50 transition-transform duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
    >
      {/* Header */}
        <div className="border-b border-slate-700 p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg">
            <Server className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 text-sm leading-tight text-white">
            <div className="font-bold truncate text-lg">Infora WiFi</div>
          <div className="text-xs text-slate-400 truncate">Billing System</div>
        </div>
          <Badge className="border-green-600 text-green-400 bg-green-900/20">
            Online
          </Badge>
      </div>

      {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-4 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Navigation
          </div>
          <div className="px-4 space-y-1">
            {navigation.map((item) => (
            <div key={item.title}>
              {item.items ? (
                <div>
                  <button
                      onClick={() => toggleSection(item.section)}
                      className={cn(
                        "flex items-center justify-between w-full text-left px-3 py-2 rounded-lg transition-colors duration-200",
                        "text-slate-300 hover:bg-slate-700/50 hover:text-white",
                        expandedSections[item.section] && "bg-slate-700/30 text-white"
                      )}
                    >
                      <div className="flex items-center gap-3">
                    <item.icon className="h-4 w-4" />
                        <span className="font-medium">{item.title}</span>
                      </div>
                      {expandedSections[item.section] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                  </button>
                    {expandedSections[item.section] && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.items.map((sub) => (
                          <Link
                        key={sub.title}
                            to={sub.url}
                        onClick={handleMenuClick}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-200",
                              isActive(sub.url)
                                ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                                : "text-slate-400 hover:bg-slate-700/50 hover:text-white"
                            )}
                      >
                        <sub.icon className="h-3 w-3" />
                        {sub.title}
                          </Link>
                    ))}
                  </div>
                    )}
                </div>
              ) : (
                  <Link
                    to={item.url}
                  onClick={handleMenuClick}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg transition-colors duration-200",
                      isActive(item.url)
                        ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                        : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                      <span className="font-medium">{item.title}</span>
                    </div>
                    {item.badge && (
                      <Badge className="bg-red-600 text-white border-red-600">
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
              )}
            </div>
          ))}
        </div>
      </div>

        {/* User Profile & Footer */}
        <div className="border-t border-slate-700 p-4 space-y-3">
          {/* User Profile */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-800/50">
            <img
              src={user?.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face"}
              alt="User"
              className="h-8 w-8 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">
                {user?.name || "Admin User"}
              </div>
              <div className="text-xs text-slate-400 truncate">
                {user?.role || "admin"}
              </div>
            </div>
            <button
              onClick={logout}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* System Status */}
          <div className="text-xs text-slate-400 space-y-1">
        <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span>System Status: Online</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span>Mikrotik: Connected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-500"></div>
              <span>RADIUS: Active</span>
            </div>
        </div>
      </div>
    </aside>

      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-30 lg:hidden p-2 rounded-lg bg-slate-800 text-white border border-slate-700"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </>
  );
}