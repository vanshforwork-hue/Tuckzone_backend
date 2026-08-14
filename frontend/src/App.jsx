import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import MenuPage from './pages/MenuPage';
import OrdersPage from './pages/OrdersPage';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import ChildrenPage from './pages/ChildrenPage';
import DashboardPage from './pages/admin/DashboardPage';
import FixedMenuPage from './pages/admin/FixedMenuPage';
import DailyMenuPage from './pages/admin/DailyMenuPage';
import OrdersBoardPage from './pages/admin/OrdersBoardPage';
import SubAdminsPage from './pages/admin/SubAdminsPage';
import PaymentSettingsPage from './pages/admin/PaymentSettingsPage';
import AccountsPage from './pages/admin/AccountsPage';
import ExpensesPage from './pages/admin/ExpensesPage';
import ReportsPage from './pages/admin/ReportsPage';
import IncomingOrdersPage from './pages/subadmin/IncomingOrdersPage';
import MenuManagementPage from './pages/subadmin/MenuManagementPage';
import ExportOrdersPage from './pages/subadmin/ExportOrdersPage';
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage';
import TermsPage from './pages/legal/TermsPage';
import AccountDeletionPage from './pages/legal/AccountDeletionPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#ffffff',
                color: '#1f2937',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: '0.875rem',
                fontFamily: 'Inter, system-ui, sans-serif',
              },
              success: {
                iconTheme: { primary: '#16a34a', secondary: '#ffffff' },
              },
              error: {
                iconTheme: { primary: '#dc2626', secondary: '#ffffff' },
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/account-deletion" element={<AccountDeletionPage />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/menu" replace />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/wallet" element={<WalletPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />

                {/* Parent Only */}
                <Route element={<ProtectedRoute allowedRoles={['PARENT']} />}>
                  <Route path="/children" element={<ChildrenPage />} />
                </Route>

                {/* Canteen Admin Only */}
                <Route element={<ProtectedRoute allowedRoles={['CANTEEN_ADMIN']} />}>
                  <Route path="/admin/dashboard" element={<DashboardPage />} />
                  <Route path="/admin/fixed-menu" element={<FixedMenuPage />} />
                  <Route path="/admin/daily-menu" element={<DailyMenuPage />} />
                  <Route path="/admin/orders" element={<OrdersBoardPage />} />
                  <Route path="/admin/export" element={<ExportOrdersPage />} />
                  <Route path="/admin/accounts" element={<AccountsPage />} />
                  <Route path="/admin/expenses" element={<ExpensesPage />} />
                  <Route path="/admin/reports" element={<ReportsPage />} />
                  <Route path="/admin/sub-admins" element={<SubAdminsPage />} />
                  <Route path="/admin/payment-settings" element={<PaymentSettingsPage />} />
                </Route>

                {/* Sub Admin Only */}
                <Route element={<ProtectedRoute allowedRoles={['SUB_ADMIN']} />}>
                  <Route path="/subadmin/orders" element={<IncomingOrdersPage />} />
                  <Route path="/subadmin/menu" element={<MenuManagementPage />} />
                  <Route path="/subadmin/export" element={<ExportOrdersPage />} />
                </Route>
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
