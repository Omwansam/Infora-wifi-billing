import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppSidebar from './components/auth/AppSidebar';
import Header from './components/layout/Header';
import Dashboard from './components/Dashboard';
import LoginPage from './components/auth/login';
import SignupPage from './components/auth/signup';
import CustomersPage from './components/customers/CustomersPage';
import CustomerForm from './components/customers/CustomerForm';
import PaymentsPage from './components/billing/PaymentsPage';
import InvoicesPage from './components/billing/InvoicesPage';
import TransactionsPage from './components/billing/TransactionsPage';
import VouchersPage from './components/billing/VouchersPage';
import ServicePlansPage from './components/plans/ServicePlansPage';
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

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

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

      {/* Protected Routes */}
      <Route path="/" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><MainLayout><CustomersPage /></MainLayout></ProtectedRoute>} />
      <Route path="/customers/new" element={<ProtectedRoute><MainLayout><CustomerForm /></MainLayout></ProtectedRoute>} />
      <Route path="/customers/kyc" element={<ProtectedRoute><MainLayout><PlaceholderPage title="KYC Management" description="Customer verification and KYC management functionality" /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/payments" element={<ProtectedRoute><MainLayout><PaymentsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/invoices" element={<ProtectedRoute><MainLayout><InvoicesPage /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/transactions" element={<ProtectedRoute><MainLayout><TransactionsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/billing/vouchers" element={<ProtectedRoute><MainLayout><VouchersPage /></MainLayout></ProtectedRoute>} />
      <Route path="/plans" element={<ProtectedRoute><MainLayout><ServicePlansPage /></MainLayout></ProtectedRoute>} />
      <Route path="/finance/leads" element={<ProtectedRoute><MainLayout><PlaceholderPage title="Leads Management" description="Lead generation and management functionality" /></MainLayout></ProtectedRoute>} />
      <Route path="/finance/expenses" element={<ProtectedRoute><MainLayout><PlaceholderPage title="Expenses Management" description="Expense tracking and management functionality" /></MainLayout></ProtectedRoute>} />
      <Route path="/communication/sms" element={<ProtectedRoute><MainLayout><SmsManagementPage /></MainLayout></ProtectedRoute>} />
      <Route path="/communication/emails" element={<ProtectedRoute><MainLayout><EmailManagementPage /></MainLayout></ProtectedRoute>} />
      <Route path="/communication/campaigns" element={<ProtectedRoute><MainLayout><CampaignsManagementPage /></MainLayout></ProtectedRoute>} />
      <Route path="/devices/mikrotik" element={<ProtectedRoute><MainLayout><MikrotikPage /></MainLayout></ProtectedRoute>} />
      <Route path="/devices/equipment" element={<ProtectedRoute><MainLayout><EquipmentPage /></MainLayout></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute><MainLayout><TicketsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><MainLayout><SettingsPage /></MainLayout></ProtectedRoute>} />

      {/* Settings Routes */}
      <Route path="/settings/2fa" element={<ProtectedRoute><MainLayout><TwoFactorAuthPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings/billing" element={<ProtectedRoute><MainLayout><BillingSubscriptionPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings/users" element={<ProtectedRoute><MainLayout><SystemUsersPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings/logs" element={<ProtectedRoute><MainLayout><SystemLogsPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings/bug-report" element={<ProtectedRoute><MainLayout><BugReportPage /></MainLayout></ProtectedRoute>} />
      <Route path="/settings/contact-support" element={<ProtectedRoute><MainLayout><ContactSupportPage /></MainLayout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Main App Component
function App() {
  return (
    <AuthProvider>
      <Router>
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

