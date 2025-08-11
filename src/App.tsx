
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { useNotificationTriggers } from '@/hooks/useNotificationTriggers';
import { ToastProvider } from '@/components/ui/custom-toast';
import { Toaster } from '@/components/ui/sonner';
import { Layout } from '@/components/layout/Layout';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { PortalLayout } from '@/components/portal/layout/PortalLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Index from '@/pages/Index';
import Dashboard from '@/pages/Dashboard';
import Auth from '@/pages/Auth';
import Services from '@/pages/Services';
import Clients from '@/pages/Clients';
import Operators from '@/pages/Operators';
import Cranes from '@/pages/Cranes';
import ServiceTypes from '@/pages/ServiceTypes';
import Vehicles from '@/pages/Vehicles';
import Closures from '@/pages/Closures';
import Invoices from '@/pages/Invoices';
import Costs from '@/pages/Costs';
import CostCenters from '@/pages/CostCenters';
import Inventory from '@/pages/Inventory';
import Reports from '@/pages/Reports';
import Commissions from '@/pages/Commissions';
import Settings from '@/pages/Settings';
import OperatorDashboard from '@/pages/OperatorDashboard';
import ServiceInspection from '@/pages/operator/ServiceInspection';
import PortalDashboard from '@/pages/portal/PortalDashboard';
import PortalServices from '@/pages/portal/PortalServices';
import PortalInvoices from '@/pages/portal/PortalInvoices';
import PortalRequestService from '@/pages/portal/PortalRequestService';
import Calendar from '@/pages/Calendar';
import QuickEntries from '@/pages/QuickEntries';
import { BackupPage } from '@/pages/BackupPage';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function AppContent() {
  // Activar triggers de notificaciones
  useNotificationTriggers();
  
  return (
    <div className="min-h-screen bg-black text-white">
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Index />} />

        {/* Administrative routes - restricted to admin and viewer only */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
        </Route>

        <Route path="/services" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Services />} />
        </Route>

        <Route path="/calendar" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Calendar />} />
        </Route>

        <Route path="/closures" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Closures />} />
        </Route>

        <Route path="/clients" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Clients />} />
        </Route>

        <Route path="/operators" element={
          <ProtectedRoute requireRole="admin">
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Operators />} />
        </Route>

        <Route path="/cranes" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Cranes />} />
        </Route>

        <Route path="/service-types" element={
          <ProtectedRoute requireRole="admin">
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<ServiceTypes />} />
        </Route>

        <Route path="/vehicles" element={
          <ProtectedRoute requireRole="admin">
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Vehicles />} />
        </Route>

        <Route path="/invoices" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Invoices />} />
        </Route>

        <Route path="/costs" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Costs />} />
        </Route>

        <Route path="/commissions" element={
          <ProtectedRoute requireRole="admin">
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Commissions />} />
        </Route>

        <Route path="/inventory" element={
          <ProtectedRoute allowedRoles={['admin', 'operator', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Inventory />} />
        </Route>

        <Route path="/reports" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Reports />} />
        </Route>

        <Route path="/cost-centers" element={
          <ProtectedRoute requireRole="admin">
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<CostCenters />} />
        </Route>

        <Route path="/settings" element={
          <ProtectedRoute requireRole="admin">
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Settings />} />
        </Route>

        <Route path="/quick-entries" element={
          <ProtectedRoute requireRole="admin">
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<QuickEntries />} />
        </Route>

        <Route path="/backup" element={
          <ProtectedRoute requireRole="admin">
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<BackupPage />} />
        </Route>

        {/* Operator routes - restricted to operators only */}
        <Route path="/operator" element={
          <ProtectedRoute requireRole="operator">
            <OperatorLayout />
          </ProtectedRoute>
        }>
          <Route index element={<OperatorDashboard />} />
          <Route path="service/:id/inspection" element={<ServiceInspection />} />
        </Route>

        {/* Client portal routes - restricted to clients only */}
        <Route path="/portal" element={
          <ProtectedRoute requireRole="client">
            <PortalLayout />
          </ProtectedRoute>
        }>
          <Route index element={<PortalDashboard />} />
          <Route path="dashboard" element={<PortalDashboard />} />
          <Route path="services" element={<PortalServices />} />
          <Route path="request-service" element={<PortalRequestService />} />
          <Route path="invoices" element={<PortalInvoices />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserProvider>
          <NotificationProvider>
            <ToastProvider>
              <Router>
                <AppContent />
              </Router>
            </ToastProvider>
          </NotificationProvider>
        </UserProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
