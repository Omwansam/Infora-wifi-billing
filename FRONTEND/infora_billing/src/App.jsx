import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AdminRoute, AdminOrSupportRoute } from './components/auth/RoleBasedRoute';
import AppSidebar from './components/auth/AppSidebar';
import Header from './components/layout/Header';
import Dashboard from './components/Dashboard';
import LoginPage from './components/auth/login';
import SignupPage from './components/auth/signup';
import DashboardRedirect from './components/auth/DashboardRedirect';
import CustomersPage from './components/customers/CustomersPage';
import CustomerForm from './components/customers/CustomerForm';
import CustomerDetail from './components/customers/CustomerDetail';
import CustomerEdit from './components/customers/CustomerEdit';
import PaymentsPage from './components/billing/PaymentsPage';
import InvoicesPage from './components/billing/InvoicesPage';
import InvoiceForm from './components/billing/InvoiceForm';
import InvoiceDetail from './components/billing/InvoiceDetail';
import TransactionsPage from './components/billing/TransactionsPage';
import VouchersPage from './components/billing/VouchersPage';
import ServicePlansPage from './components/plans/ServicePlansPage';
import PlanDetail from './components/plans/PlanDetail';
import MikrotikPage from './components/devices/MikrotikPage';
import EquipmentPage from './components/devices/EquipmentPage';
import TicketsPage from './components/tickets/TicketsPage';
import SettingsPage from './components/settings/SettingsPage';
import TwoFactorAuthPage from './components/settings/TwoFactorAuthPage';
import BillingSubscriptionPage from './components/settings/BillingSubscriptionPage';
import SystemUsersPage from './components/settings/SystemUsersPage';
import SystemLogsPage from './components/settings/SystemLogsPage';
import BugReportPage from './components/settings/BugReportPage';
import ContactSupportPage from './components/settings/ContactSupportPage';
import SmsManagementPage from './components/communication/SmsManagementPage';
import EmailManagementPage from './components/communication/EmailManagementPage';
import CampaignsManagementPage from './components/communication/CampaignsManagementPage';
import PlaceholderPage from './components/placeholder/PlaceholderPage';

// Main Layout Component
function MainLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AppSidebar />
      <div className="flex-1 lg:ml-64">
        <Header />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// App Routes Component
function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      
      {/* Dashboard Redirect Route */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />

      {/* Protected Routes - All users can access */}
      <Route path="/" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><MainLayout><CustomersPage /></MainLayout></ProtectedRoute>} />
      <Route path="/customers/new" element={<ProtectedRoute><MainLayout><CustomerForm /></MainLayout></ProtectedRoute>} />
      <Route path="/customers/:customerId" element={<ProtectedRoute><MainLayout><CustomerDetail /></MainLayout></ProtectedRoute>} />
      <Route path="/customers/:customerId/edit" element={<ProtectedRoute><MainLayout><CustomerEdit /></MainLayout></ProtectedRoute>} />
      <Route path="/customers/kyc" element={<ProtectedRoute><MainLayout><PlaceholderPage title="KYC Management" description="Customer verification and KYC management functionality" /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/payments" element={<ProtectedRoute><MainLayout><PaymentsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/invoices" element={<ProtectedRoute><MainLayout><InvoicesPage /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/invoices/create" element={<ProtectedRoute><MainLayout><InvoiceForm /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/invoices/:invoiceId" element={<ProtectedRoute><MainLayout><InvoiceDetail /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/invoices/:invoiceId/edit" element={<ProtectedRoute><MainLayout><InvoiceForm /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/transactions" element={<ProtectedRoute><MainLayout><TransactionsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/vouchers" element={<ProtectedRoute><MainLayout><VouchersPage /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/subscriptions" element={<ProtectedRoute><MainLayout><PlaceholderPage title="Billing Subscriptions" description="Manage customer subscriptions and recurring billing" /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/reports" element={<ProtectedRoute><MainLayout><PlaceholderPage title="Billing Reports" description="Generate and view billing reports and analytics" /></MainLayout></ProtectedRoute>} />
      <Route path="/plans" element={<ProtectedRoute><MainLayout><ServicePlansPage /></MainLayout></ProtectedRoute>} />
      <Route path="/plans/:planId" element={<ProtectedRoute><MainLayout><PlanDetail /></MainLayout></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute><MainLayout><TicketsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><MainLayout><SettingsPage /></MainLayout></ProtectedRoute>} />

      {/* Admin-only Routes */}
      <Route path="/finance/leads" element={<AdminRoute><MainLayout><PlaceholderPage title="Leads Management" description="Lead generation and management functionality" /></MainLayout></AdminRoute>} />
      <Route path="/finance/expenses" element={<AdminRoute><MainLayout><PlaceholderPage title="Expenses Management" description="Expense tracking and management functionality" /></MainLayout></AdminRoute>} />
      <Route path="/communication/sms" element={<AdminRoute><MainLayout><SmsManagementPage /></MainLayout></AdminRoute>} />
      <Route path="/communication/emails" element={<AdminRoute><MainLayout><EmailManagementPage /></MainLayout></AdminRoute>} />
      <Route path="/communication/campaigns" element={<AdminRoute><MainLayout><CampaignsManagementPage /></MainLayout></AdminRoute>} />
      
      {/* Device Management Routes */}
      <Route path="/devices/mikrotik" element={<AdminRoute><MainLayout><MikrotikPage /></MainLayout></AdminRoute>} />
      <Route path="/devices/equipment" element={<AdminRoute><MainLayout><EquipmentPage /></MainLayout></AdminRoute>} />
      <Route path="/devices/status" element={<AdminRoute><MainLayout><PlaceholderPage title="Device Status" description="Monitor device status and connectivity" /></MainLayout></AdminRoute>} />
      <Route path="/devices/backup" element={<AdminRoute><MainLayout><PlaceholderPage title="Device Backup" description="Manage device configuration backups" /></MainLayout></AdminRoute>} />
      <Route path="/devices/firmware" element={<AdminRoute><MainLayout><PlaceholderPage title="Firmware Updates" description="Manage device firmware updates" /></MainLayout></AdminRoute>} />
      
      {/* Network Management Routes */}
      <Route path="/network/isps" element={<AdminRoute><MainLayout><PlaceholderPage title="ISP Management" description="Manage Internet Service Providers and their configurations" /></MainLayout></AdminRoute>} />
      <Route path="/network/radius" element={<AdminRoute><MainLayout><PlaceholderPage title="RADIUS Clients" description="Configure and manage RADIUS client settings" /></MainLayout></AdminRoute>} />
      <Route path="/network/ldap" element={<AdminRoute><MainLayout><PlaceholderPage title="LDAP Servers" description="Configure and manage LDAP server connections" /></MainLayout></AdminRoute>} />
      <Route path="/network/snmp" element={<AdminRoute><MainLayout><PlaceholderPage title="SNMP Devices" description="Monitor and manage SNMP-enabled devices" /></MainLayout></AdminRoute>} />
      <Route path="/network/vpn" element={<AdminRoute><MainLayout><PlaceholderPage title="VPN Configurations" description="Manage VPN server and client configurations" /></MainLayout></AdminRoute>} />
      <Route path="/network/eap" element={<AdminRoute><MainLayout><PlaceholderPage title="EAP Profiles" description="Configure EAP authentication profiles for WiFi" /></MainLayout></AdminRoute>} />
      
      {/* Security Routes */}
      <Route path="/security/radius-users" element={<AdminRoute><MainLayout><PlaceholderPage title="RADIUS Users" description="Manage RADIUS user accounts and authentication" /></MainLayout></AdminRoute>} />
      <Route path="/security/radius-groups" element={<AdminRoute><MainLayout><PlaceholderPage title="RADIUS Groups" description="Manage RADIUS user groups and policies" /></MainLayout></AdminRoute>} />
      <Route path="/security/radius-accounting" element={<AdminRoute><MainLayout><PlaceholderPage title="RADIUS Accounting" description="View RADIUS accounting logs and session data" /></MainLayout></AdminRoute>} />
      <Route path="/security/vpn-clients" element={<AdminRoute><MainLayout><PlaceholderPage title="VPN Clients" description="Manage VPN client connections and configurations" /></MainLayout></AdminRoute>} />
      <Route path="/security/access-control" element={<AdminRoute><MainLayout><PlaceholderPage title="Access Control" description="Configure access control policies and rules" /></MainLayout></AdminRoute>} />
      
      {/* Monitoring Routes */}
      <Route path="/monitoring/snmp" element={<AdminRoute><MainLayout><PlaceholderPage title="SNMP Monitoring" description="Monitor network devices using SNMP protocols" /></MainLayout></AdminRoute>} />
      <Route path="/monitoring/device-stats" element={<AdminRoute><MainLayout><PlaceholderPage title="Device Statistics" description="View detailed device performance statistics" /></MainLayout></AdminRoute>} />
      <Route path="/monitoring/traffic" element={<AdminRoute><MainLayout><PlaceholderPage title="Network Traffic" description="Monitor network traffic and bandwidth usage" /></MainLayout></AdminRoute>} />
      <Route path="/monitoring/logs" element={<AdminRoute><MainLayout><PlaceholderPage title="System Logs" description="View system logs and event history" /></MainLayout></AdminRoute>} />
      <Route path="/monitoring/alerts" element={<AdminRoute><MainLayout><PlaceholderPage title="Alerts" description="Configure and manage system alerts and notifications" /></MainLayout></AdminRoute>} />
      
      {/* Reports & Analytics Routes */}
      <Route path="/reports/billing" element={<AdminRoute><MainLayout><PlaceholderPage title="Billing Reports" description="Generate comprehensive billing reports and analytics" /></MainLayout></AdminRoute>} />
      <Route path="/reports/network" element={<AdminRoute><MainLayout><PlaceholderPage title="Network Reports" description="Generate network performance and usage reports" /></MainLayout></AdminRoute>} />
      <Route path="/reports/devices" element={<AdminRoute><MainLayout><PlaceholderPage title="Device Reports" description="Generate device status and performance reports" /></MainLayout></AdminRoute>} />
      <Route path="/reports/customers" element={<AdminRoute><MainLayout><PlaceholderPage title="Customer Reports" description="Generate customer activity and usage reports" /></MainLayout></AdminRoute>} />
      <Route path="/reports/analytics" element={<AdminRoute><MainLayout><PlaceholderPage title="Performance Analytics" description="Advanced analytics and performance metrics" /></MainLayout></AdminRoute>} />

      {/* Settings Routes */}
      <Route path="/settings/2fa" element={<ProtectedRoute><MainLayout><TwoFactorAuthPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings/billing" element={<ProtectedRoute><MainLayout><BillingSubscriptionPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings/users" element={<AdminRoute><MainLayout><SystemUsersPage /></MainLayout></AdminRoute>} />
      <Route path="/settings/logs" element={<AdminRoute><MainLayout><SystemLogsPage /></MainLayout></AdminRoute>} />
      <Route path="/settings/bug-report" element={<ProtectedRoute><MainLayout><BugReportPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings/contact-support" element={<ProtectedRoute><MainLayout><ContactSupportPage /></MainLayout></ProtectedRoute>} />

      {/* Default redirect to login for any unmatched routes */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

// Main App Component
function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10B981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </Router>
    </AuthProvider>
  );
}

export default App;

