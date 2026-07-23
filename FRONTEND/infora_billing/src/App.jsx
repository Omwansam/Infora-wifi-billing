import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AdminRoute, AdminOrSupportRoute } from './components/auth/RoleBasedRoute';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './components/Dashboard';
import LoginPage from './components/auth/login';
import SignupPage from './components/auth/signup';
import DashboardRedirect from './components/auth/DashboardRedirect';
import ClientsPage from './components/clients/ClientsPage';
import ClientForm from './components/clients/ClientForm';
import ImportClients from './components/clients/ImportClients';
import ClientDetail from './components/clients/ClientDetail';
import OnlineUsersPage from './components/clients/OnlineUsersPage';
import ClientEdit from './components/clients/ClientEdit';
import PaymentsPage from './components/billing/PaymentsPage';
import InvoicesPage from './components/billing/InvoicesPage';
import InvoiceForm from './components/billing/InvoiceForm';
import InvoiceDetail from './components/billing/InvoiceDetail';
import TransactionsPage from './components/billing/TransactionsPage';
import SubscriptionsPage from './components/billing/SubscriptionsPage';
import VouchersPage from './components/billing/VouchersPage';
import ServicePlansPage from './components/plans/ServicePlansPage';
import PlanDetail from './components/plans/PlanDetail';
import PlanForm from './components/plans/PlanForm';
import FupMonitorPage from './components/monitoring/FupMonitorPage';
import MikrotikPage from './components/devices/MikrotikPage';
import DeviceDetailPage from './components/devices/DeviceDetailPage';
import EquipmentPage from './components/devices/EquipmentPage';
import DeviceStatusPage from './components/devices/DeviceStatusPage';
import DeviceBackupPage from './components/devices/DeviceBackupPage';
import DeviceFirmwarePage from './components/devices/DeviceFirmwarePage';
import IspsPage from './components/network/IspsPage';
import RadiusPage from './components/network/RadiusPage';
import LdapPage from './components/network/LdapPage';
import SnmpPage from './components/network/SnmpPage';
import VpnPage from './components/network/VpnPage';
import WireGuardPage from './components/network/WireGuardPage';
import EapPage from './components/network/EapPage';
import TicketsPage from './components/tickets/TicketsPage';
import SettingsPage from './components/settings/SettingsPage';
import TwoFactorAuthPage from './components/settings/TwoFactorAuthPage';
import BillingSubscriptionPage from './components/settings/BillingSubscriptionPage';
import SystemUsersPage from './components/settings/SystemUsersPage';
import SystemLogsPage from './components/settings/SystemLogsPage';
import BugReportPage from './components/settings/BugReportPage';
import ContactSupportPage from './components/settings/ContactSupportPage';
// Security section
import RadiusUsersPage from './components/security/RadiusUsersPage';
import RadiusGroupsPage from './components/security/RadiusGroupsPage';
import AccountingPage from './components/security/AccountingPage';
import AccessControlPage from './components/security/AccessControlPage';
// Monitoring section
import DeviceStatsPage from './components/monitoring/DeviceStatsPage';
import TrafficPage from './components/monitoring/TrafficPage';
import AlertsPage from './components/monitoring/AlertsPage';
// Reports section
import ReportsBillingPage from './components/reports/ReportsBillingPage';
import ReportsNetworkPage from './components/reports/ReportsNetworkPage';
import ReportsDevicesPage from './components/reports/ReportsDevicesPage';
import ReportsClientsPage from './components/reports/ReportsClientsPage';
import ReportsAnalyticsPage from './components/reports/ReportsAnalyticsPage';
import CommunicationHubPage from './components/communication/CommunicationHubPage';
import SmsManagementPage from './components/communication/SmsManagementPage';
import EmailManagementPage from './components/communication/EmailManagementPage';
import CampaignsManagementPage from './components/communication/CampaignsManagementPage';
import FinanceLeadsPage from './components/finance/FinanceLeadsPage';
import FinanceExpensesPage from './components/finance/FinanceExpensesPage';
import FinanceReportsPage from './components/finance/FinanceReportsPage';
import CustomerKycPage from './components/customers/CustomerKycPage';
import PlaceholderPage from './components/placeholder/PlaceholderPage';
import HotspotVoucherPage from './components/portal/HotspotVoucherPage';
import HotspotAccessPage from './components/portal/HotspotAccessPage';
import CaptivePortalPage from './components/portal/CaptivePortalPage';
import PppoePortalPage from './components/portal/PppoePortalPage';
import { DEMO_MODE, DemoLanding } from './demo';
import { useAuth } from './contexts/AuthContext';

function LegacyClientRedirect({ suffix = '' }) {
  const { customerId } = React.useParams();
  const target = customerId ? `/clients/${customerId}${suffix}` : '/clients';
  return <Navigate to={target} replace />;
}

// Demo build: signed-out visitors see the fictional ISP landing page at "/";
// after signing in "/" is the dashboard as usual.
function HomeRoute() {
  const { user, loading } = useAuth();
  if (DEMO_MODE && !loading && !user) {
    return <DemoLanding />;
  }
  return (
    <ProtectedRoute>
      <MainLayout>
        <Dashboard />
      </MainLayout>
    </ProtectedRoute>
  );
}

// App Routes Component
function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      
      {/* Public captive portal — no login required */}
      <Route path="/portal" element={<CaptivePortalPage />} />
      <Route path="/portal/voucher" element={<HotspotVoucherPage />} />
      <Route path="/portal/access" element={<HotspotAccessPage />} />
      <Route path="/portal/hotspot" element={<Navigate to="/portal#wifi-packages" replace />} />
      <Route path="/portal/pppoe" element={<PppoePortalPage />} />
      <Route path="/portal/wireguard" element={<Navigate to="/portal" replace />} />

      {/* Dashboard Redirect Route */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />

      {/* Protected Routes - All users can access (demo: public ISP landing when signed out) */}
      <Route path="/" element={<HomeRoute />} />

      {/* Client management */}
      <Route path="/clients" element={<ProtectedRoute><MainLayout><ClientsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/clients/new" element={<ProtectedRoute><MainLayout><ClientForm /></MainLayout></ProtectedRoute>} />
      <Route path="/clients/import" element={<ProtectedRoute><MainLayout><ImportClients /></MainLayout></ProtectedRoute>} />
      <Route path="/clients/pppoe/new" element={<ProtectedRoute><MainLayout><ClientForm /></MainLayout></ProtectedRoute>} />
      <Route path="/clients/pppoe" element={<ProtectedRoute><MainLayout><ClientsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/clients/hotspot" element={<ProtectedRoute><MainLayout><ClientsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/clients/online" element={<ProtectedRoute><MainLayout><OnlineUsersPage /></MainLayout></ProtectedRoute>} />
      <Route path="/clients/kyc" element={<ProtectedRoute><MainLayout><CustomerKycPage /></MainLayout></ProtectedRoute>} />
      <Route path="/clients/:customerId" element={<ProtectedRoute><MainLayout><ClientDetail /></MainLayout></ProtectedRoute>} />
      <Route path="/clients/:customerId/edit" element={<ProtectedRoute><MainLayout><ClientEdit /></MainLayout></ProtectedRoute>} />

      {/* Legacy customer URLs → clients */}
      <Route path="/customers" element={<Navigate to="/clients" replace />} />
      <Route path="/customers/new" element={<Navigate to="/clients/new" replace />} />
      <Route path="/customers/kyc" element={<Navigate to="/clients/kyc" replace />} />
      <Route path="/customers/:customerId/edit" element={<LegacyClientRedirect suffix="/edit" />} />
      <Route path="/customers/:customerId" element={<LegacyClientRedirect />} />
      <Route path="/billing/payments" element={<ProtectedRoute><MainLayout><PaymentsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/invoices" element={<ProtectedRoute><MainLayout><InvoicesPage /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/invoices/create" element={<ProtectedRoute><MainLayout><InvoiceForm /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/invoices/:invoiceId" element={<ProtectedRoute><MainLayout><InvoiceDetail /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/invoices/:invoiceId/edit" element={<ProtectedRoute><MainLayout><InvoiceForm /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/transactions" element={<ProtectedRoute><MainLayout><TransactionsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/vouchers" element={<ProtectedRoute><MainLayout><VouchersPage /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/subscriptions" element={<ProtectedRoute><MainLayout><SubscriptionsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/reports" element={<ProtectedRoute><MainLayout><FinanceReportsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/packages" element={<Navigate to="/plans" replace />} />
      <Route path="/plans" element={<ProtectedRoute><MainLayout><ServicePlansPage /></MainLayout></ProtectedRoute>} />
      <Route path="/plans/new" element={<ProtectedRoute><MainLayout><PlanForm /></MainLayout></ProtectedRoute>} />
      <Route path="/plans/:planId/edit" element={<ProtectedRoute><MainLayout><PlanForm /></MainLayout></ProtectedRoute>} />
      <Route path="/plans/:planId" element={<ProtectedRoute><MainLayout><PlanDetail /></MainLayout></ProtectedRoute>} />
      <Route path="/fup" element={<ProtectedRoute><MainLayout><FupMonitorPage /></MainLayout></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute><MainLayout><TicketsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><MainLayout><SettingsPage /></MainLayout></ProtectedRoute>} />

      {/* Admin-only Routes */}
      <Route path="/finance/leads" element={<AdminRoute><MainLayout><FinanceLeadsPage /></MainLayout></AdminRoute>} />
      <Route path="/finance/expenses" element={<AdminRoute><MainLayout><FinanceExpensesPage /></MainLayout></AdminRoute>} />
      <Route path="/communication" element={<AdminRoute><MainLayout><CommunicationHubPage /></MainLayout></AdminRoute>} />
      <Route path="/communication/sms" element={<AdminRoute><MainLayout><SmsManagementPage /></MainLayout></AdminRoute>} />
      <Route path="/communication/emails" element={<AdminRoute><MainLayout><EmailManagementPage /></MainLayout></AdminRoute>} />
      <Route path="/communication/campaigns" element={<AdminRoute><MainLayout><CampaignsManagementPage /></MainLayout></AdminRoute>} />
      
      {/* Device Management Routes */}
      <Route path="/devices/mikrotik" element={<AdminRoute><MainLayout><MikrotikPage /></MainLayout></AdminRoute>} />
      <Route path="/devices/mikrotik/:id" element={<AdminRoute><MainLayout><DeviceDetailPage /></MainLayout></AdminRoute>} />
      <Route path="/devices/equipment" element={<AdminRoute><MainLayout><EquipmentPage /></MainLayout></AdminRoute>} />
      <Route path="/devices/status" element={<AdminRoute><MainLayout><DeviceStatusPage /></MainLayout></AdminRoute>} />
      <Route path="/devices/backup" element={<AdminRoute><MainLayout><DeviceBackupPage /></MainLayout></AdminRoute>} />
      <Route path="/devices/firmware" element={<AdminRoute><MainLayout><DeviceFirmwarePage /></MainLayout></AdminRoute>} />
      
      {/* Network Management Routes */}
      <Route path="/network" element={<Navigate to="/network/isps" replace />} />
      <Route path="/network/isps" element={<AdminRoute><MainLayout><IspsPage /></MainLayout></AdminRoute>} />
      <Route path="/network/radius" element={<AdminRoute><MainLayout><RadiusPage /></MainLayout></AdminRoute>} />
      <Route path="/network/ldap" element={<AdminRoute><MainLayout><LdapPage /></MainLayout></AdminRoute>} />
      <Route path="/network/snmp" element={<AdminRoute><MainLayout><SnmpPage /></MainLayout></AdminRoute>} />
      <Route path="/network/vpn" element={<AdminRoute><MainLayout><VpnPage /></MainLayout></AdminRoute>} />
      <Route path="/network/wireguard" element={<AdminRoute><MainLayout><WireGuardPage /></MainLayout></AdminRoute>} />
      <Route path="/network/eap" element={<AdminRoute><MainLayout><EapPage /></MainLayout></AdminRoute>} />
      
      {/* Security Routes */}
      <Route path="/security/radius-users" element={<AdminRoute><MainLayout><RadiusUsersPage /></MainLayout></AdminRoute>} />
      <Route path="/security/radius-groups" element={<AdminRoute><MainLayout><RadiusGroupsPage /></MainLayout></AdminRoute>} />
      <Route path="/security/radius-accounting" element={<AdminRoute><MainLayout><AccountingPage /></MainLayout></AdminRoute>} />
      <Route path="/security/access-control" element={<AdminRoute><MainLayout><AccessControlPage /></MainLayout></AdminRoute>} />
      {/* VPN moved to Network section */}
      <Route path="/security/vpn-clients" element={<Navigate to="/network/vpn" replace />} />

      {/* Monitoring Routes */}
      <Route path="/monitoring/snmp" element={<AdminRoute><MainLayout><SnmpPage /></MainLayout></AdminRoute>} />
      <Route path="/monitoring/device-stats" element={<AdminRoute><MainLayout><DeviceStatsPage /></MainLayout></AdminRoute>} />
      <Route path="/monitoring/traffic" element={<AdminRoute><MainLayout><TrafficPage /></MainLayout></AdminRoute>} />
      <Route path="/monitoring/logs" element={<AdminRoute><MainLayout><SystemLogsPage /></MainLayout></AdminRoute>} />
      <Route path="/monitoring/alerts" element={<AdminRoute><MainLayout><AlertsPage /></MainLayout></AdminRoute>} />

      {/* Reports & Analytics Routes */}
      <Route path="/reports/billing" element={<AdminRoute><MainLayout><ReportsBillingPage /></MainLayout></AdminRoute>} />
      <Route path="/reports/network" element={<AdminRoute><MainLayout><ReportsNetworkPage /></MainLayout></AdminRoute>} />
      <Route path="/reports/devices" element={<AdminRoute><MainLayout><ReportsDevicesPage /></MainLayout></AdminRoute>} />
      <Route path="/reports/customers" element={<AdminRoute><MainLayout><ReportsClientsPage /></MainLayout></AdminRoute>} />
      <Route path="/reports/analytics" element={<AdminRoute><MainLayout><ReportsAnalyticsPage /></MainLayout></AdminRoute>} />

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
    <ThemeProvider>
      <AuthProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ConfirmProvider>
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
        </ConfirmProvider>
      </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

