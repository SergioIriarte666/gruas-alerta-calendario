
import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { useNotificationTriggers } from '@/hooks/useNotificationTriggers';
import { ToastProvider } from '@/components/ui/custom-toast';
import { SessionTimeoutProvider } from '@/components/auth/SessionTimeoutProvider';
import { Toaster } from '@/components/ui/sonner';
import { Layout } from '@/components/layout/Layout';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { PortalLayout } from '@/components/portal/layout/PortalLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';

const Index = lazy(() => import('@/pages/Index'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Auth = lazy(() => import('@/pages/Auth'));
const Services = lazy(() => import('@/pages/Services'));
const Clients = lazy(() => import('@/pages/Clients'));
const Operators = lazy(() => import('@/pages/Operators'));
const Cranes = lazy(() => import('@/pages/Cranes'));
const ServiceTypes = lazy(() => import('@/pages/ServiceTypes'));
const Vehicles = lazy(() => import('@/pages/Vehicles'));
const Closures = lazy(() => import('@/pages/Closures'));
const Invoices = lazy(() => import('@/pages/Invoices'));
const IncomeProjections = lazy(() => import('@/pages/IncomeProjections'));
const Costs = lazy(() => import('@/pages/Costs'));
const CostCenters = lazy(() => import('@/pages/CostCenters'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const Reports = lazy(() => import('@/pages/Reports'));
const Commissions = lazy(() => import('@/pages/Commissions'));
const Settings = lazy(() => import('@/pages/Settings'));
const OperatorDashboard = lazy(() => import('@/pages/OperatorDashboard'));
const ServiceInspection = lazy(() => import('@/pages/operator/ServiceInspection'));
const PortalDashboard = lazy(() => import('@/pages/portal/PortalDashboard'));
const PortalServices = lazy(() => import('@/pages/portal/PortalServices'));
const PortalInvoices = lazy(() => import('@/pages/portal/PortalInvoices'));
const PortalRequestService = lazy(() => import('@/pages/portal/PortalRequestService'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const QuickEntries = lazy(() => import('@/pages/QuickEntries'));
const BackupPage = lazy(() => import('@/pages/BackupPage').then(m => ({ default: m.BackupPage })));
const Suppliers = lazy(() => import('@/pages/Suppliers').then(m => ({ default: m.Suppliers })));
const VipClientPipeline = lazy(() => import('@/pages/VipClientPipeline'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const DailyReport = lazy(() => import('@/pages/DailyReport'));
const Incomes = lazy(() => import('@/pages/Incomes'));
const ServiceRates = lazy(() => import('@/pages/ServiceRates'));

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
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Cargando...</div>}>
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

        <Route path="/service-rates" element={
          <ProtectedRoute requireRole="admin">
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<ServiceRates />} />
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

        <Route path="/income-projections" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<IncomeProjections />} />
        </Route>

        <Route path="/costs" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Costs />} />
        </Route>

        <Route path="/incomes" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Incomes />} />
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

        <Route path="/suppliers" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Suppliers />} />
        </Route>

        <Route path="/daily-report" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<DailyReport />} />
        </Route>


        {/* VIP Client Pipeline - Fase 2 */}
        <Route path="/clients/:clientId/pipeline" element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<VipClientPipeline />} />
        </Route>

        {/* Operator routes - accessible by operators and admins */}
        <Route path="/operator" element={
          <ProtectedRoute allowedRoles={['operator', 'admin']}>
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
      </Suspense>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SessionTimeoutProvider warningMinutes={25} timeoutMinutes={30}>
          <UserProvider>
            <NotificationProvider>
              <ToastProvider>
                <Router>
                  <AppContent />
                </Router>
              </ToastProvider>
            </NotificationProvider>
          </UserProvider>
        </SessionTimeoutProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
