import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  User, 
  Settings, 
  Bell, 
  X,
  Shield,
  CreditCard,
  Users,
  FileText,
  Bug,
  MessageSquare,
  LogOut,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';

const Header = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const settingsItems = [
    {
      title: 'Settings',
      icon: Settings,
      description: 'General system settings and preferences',
      action: () => {
        navigate('/settings');
        setShowSettings(false);
      }
    },
    {
      title: '2FA Settings',
      icon: Shield,
      description: 'Two-factor authentication setup',
      action: () => {
        navigate('/settings/2fa');
        setShowSettings(false);
      }
    },
    {
      title: 'Billing & Subscription',
      icon: CreditCard,
      description: 'Manage billing and subscription',
      action: () => {
        navigate('/settings/billing');
        setShowSettings(false);
      }
    },
    {
      title: 'System Users',
      icon: Users,
      description: 'Manage system users and permissions',
      action: () => {
        navigate('/settings/users');
        setShowSettings(false);
      }
    },
    {
      title: 'System Logs',
      icon: FileText,
      description: 'View system activity logs',
      action: () => {
        navigate('/settings/logs');
        setShowSettings(false);
      }
    },
    {
      title: 'Features & Bug Report',
      icon: Bug,
      description: 'Report bugs and request features',
      action: () => {
        navigate('/settings/bug-report');
        setShowSettings(false);
      }
    },
    {
      title: 'Contact Support',
      icon: MessageSquare,
      description: 'Get help from support team',
      action: () => {
        navigate('/settings/contact-support');
        setShowSettings(false);
      }
    }
  ];

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  return (
    <>
      {/* Main Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          {/* Left side - Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers, invoices, tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Right side - User and Settings */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-400"></span>
            </button>

            {/* User Profile */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.name || 'Admin User'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user?.email || 'admin@infora.com'}
                  </p>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-gray-400 transition-transform",
                  showUserMenu && "rotate-180"
                )} />
              </button>

              {/* User Dropdown Menu */}
              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.name || 'Admin User'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {user?.email || 'admin@infora.com'}
                      </p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <LogOut className="h-4 w-4 mr-3" />
                        Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Settings Button */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="h-5 w-5" />
              </button>

              {/* Settings Popup */}
              <AnimatePresence>
                {showSettings && (
                  <>
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowSettings(false)}
                      className="fixed inset-0 bg-black bg-opacity-25 z-40"
                    />
                    
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50"
                    >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                      <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
                      <button
                        onClick={() => setShowSettings(false)}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Settings Items */}
                    <div className="p-2 max-h-96 overflow-y-auto">
                      {settingsItems.map((item, index) => (
                        <motion.button
                          key={item.title}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => {
                            item.action();
                          }}
                          className="w-full flex items-start space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors group"
                        >
                          <div className="p-2 bg-gray-100 group-hover:bg-blue-100 rounded-lg transition-colors">
                            <item.icon className="h-4 w-4 text-gray-600 group-hover:text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 truncate">
                              {item.title}
                            </h3>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {item.description}
                            </p>
                          </div>
                        </motion.button>
                      ))}
                    </div>

                                         {/* Footer */}
                     <div className="p-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                       <div className="text-center">
                         <p className="text-xs text-gray-500">
                           Infora WiFi Billing System
                         </p>
                         <p className="text-xs text-gray-400 mt-1">
                           Version 1.0.0
                         </p>
                       </div>
                     </div>
                   </motion.div>
                   </>
                 )}
               </AnimatePresence>
             </div>
           </div>
         </div>
       </header>
     </>
   );
 };
 
 export default Header;
