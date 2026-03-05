
import { Suspense, lazy, useEffect } from 'react';
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
import AdminOnlyRoute from '@/components/layout/AdminOnlyRoute';
import DebugFreeze from '@/pages/DebugFreeze';
import ConnectionTest from '@/pages/ConnectionTest';

// Version check for production debugging
  console.log('App version: 1.0.8 - Optimized Invoice Selector (Fix Freeze)');

// Route chunk imports - stored for preloading
const routeImports = {
  Index: () => import('@/pages/Index'),
  Profile: () => import('@/pages/Profile'),
  Dashboard: () => import('@/pages/Dashboard'),
  Auth: () => import('@/pages/Auth'),
  Services: () => import('@/pages/Services'),
  Clients: () => import('@/pages/Clients'),
  Operators: () => import('@/pages/Operators'),
  Cranes: () => import('@/pages/Cranes'),
  ServiceTypes: () => import('@/pages/ServiceTypes'),
  Vehicles: () => import('@/pages/Vehicles'),
  Closures: () => import('@/pages/Closures'),
  Invoices: () => import('@/pages/Invoices'),
  IncomeProjections: () => import('@/pages/IncomeProjections'),
  Costs: () => import('@/pages/Costs'),
  CostCenters: () => import('@/pages/CostCenters'),
  Inventory: () => import('@/pages/Inventory'),
  Reports: () => import('@/pages/Reports'),
  Commissions: () => import('@/pages/Commissions'),
  Settings: () => import('@/pages/Settings'),
  OperatorDashboard: () => import('@/pages/OperatorDashboard'),
  ServiceInspection: () => import('@/pages/operator/ServiceInspection'),
  PortalDashboard: () => import('@/pages/portal/PortalDashboard'),
  PortalServices: () => import('@/pages/portal/PortalServices'),
  PortalInvoices: () => import('@/pages/portal/PortalInvoices'),
  PortalRequestService: () => import('@/pages/portal/PortalRequestService'),
  Calendar: () => import('@/pages/Calendar'),
  QuickEntries: () => import('@/pages/QuickEntries'),
  BackupPage: () => import('@/pages/BackupPage'),
  Suppliers: () => import('@/pages/Suppliers'),
  VipClientPipeline: () => import('@/pages/VipClientPipeline'),
  NotFound: () => import('@/pages/NotFound'),
  DailyReport: () => import('@/pages/DailyReport'),
  Incomes: () => import('@/pages/Incomes'),
  Historical: () => import('@/pages/Historical'),
  ServiceRates: () => import('@/pages/ServiceRates'),
  ResetPassword: () => import('@/pages/ResetPassword'),
  TripCalculator: () => import('@/pages/TripCalculator'),
  PerformanceTest: () => import('@/pages/PerformanceTest'),
};

// Lazy components using the same import functions
const Index = lazy(routeImports.Index);
const Profile = lazy(routeImports.Profile);
const Dashboard = lazy(routeImports.Dashboard);
const Auth = lazy(routeImports.Auth);
const Services = lazy(routeImports.Services);
const Clients = lazy(routeImports.Clients);
const Operators = lazy(routeImports.Operators);
const Cranes = lazy(routeImports.Cranes);
const ServiceTypes = lazy(routeImports.ServiceTypes);
const Vehicles = lazy(routeImports.Vehicles);
const Closures = lazy(routeImports.Closures);
const Invoices = lazy(routeImports.Invoices);
const IncomeProjections = lazy(routeImports.IncomeProjections);
const Costs = lazy(routeImports.Costs);
const CostCenters = lazy(routeImports.CostCenters);
const Inventory = lazy(routeImports.Inventory);
const Reports = lazy(routeImports.Reports);
const Commissions = lazy(routeImports.Commissions);
const Settings = lazy(routeImports.Settings);
const OperatorDashboard = lazy(routeImports.OperatorDashboard);
const ServiceInspection = lazy(routeImports.ServiceInspection);
const PortalDashboard = lazy(routeImports.PortalDashboard);
const PortalServices = lazy(routeImports.PortalServices);
const PortalInvoices = lazy(routeImports.PortalInvoices);
const PortalRequestService = lazy(routeImports.PortalRequestService);
const Calendar = lazy(routeImports.Calendar);
const QuickEntries = lazy(routeImports.QuickEntries);
const BackupPage = lazy(() => routeImports.BackupPage().then(m => ({ default: m.BackupPage })));
const Suppliers = lazy(() => routeImports.Suppliers().then(m => ({ default: m.Suppliers })));
const VipClientPipeline = lazy(routeImports.VipClientPipeline);
const NotFound = lazy(routeImports.NotFound);
const DailyReport = lazy(routeImports.DailyReport);
const Incomes = lazy(routeImports.Incomes);
const Historical = lazy(routeImports.Historical);
const ServiceRates = lazy(routeImports.ServiceRates);
const ResetPassword = lazy(routeImports.ResetPassword);
const TripCalculator = lazy(routeImports.TripCalculator);
const PerformanceTest = lazy(routeImports.PerformanceTest);

// Preload all route chunks after initial render
const preloadAllRoutes = () => {
  Object.values(routeImports).forEach(importFn => {
    importFn().catch(() => {}); // Silently preload, ignore errors
  });
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 minutes - serve cached data without refetch
      gcTime: 10 * 60 * 1000, // 10 minutes - keep cache in memory during navigation
      retry: 1,
      refetchOnWindowFocus: false, // Don't refetch on tab focus
    },
  },
});

function AppContent() {
  // Activar triggers de notificaciones
  useNotificationTriggers();

  // Preload all route chunks after first render
  useEffect(() => {
    const timer = setTimeout(preloadAllRoutes, 1000);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="min-h-screen bg-background text-foreground">
        <Routes>
        <Route path="/auth" element={<Suspense fallback={null}><Auth /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={null}><ResetPassword /></Suspense>} />
        <Route path="/performance-test" element={<Suspense fallback={null}><PerformanceTest /></Suspense>} />
        <Route path="/debug-freeze" element={<DebugFreeze />} />
        <Route path="/connection-test" element={<ConnectionTest />} />
        <Route path="/" element={<Suspense fallback={null}><Index /></Suspense>} />

        {/* All administrative routes share a single ProtectedRoute + Layout */}
        <Route element={
          <ProtectedRoute allowedRoles={['admin', 'viewer']}>
            <Layout />
          </ProtectedRoute>
        }>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/services" element={<Services />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/closures" element={<Closures />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/cranes" element={<Cranes />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/historical" element={<Historical />} />
          <Route path="/income-projections" element={<IncomeProjections />} />
          <Route path="/costs" element={<Costs />} />
          
          <Route path="/incomes" element={<Incomes />} />
          <Route path="/trip-calculator" element={<TripCalculator />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/daily-report" element={<DailyReport />} />
          <Route path="/clients/:clientId/pipeline" element={<VipClientPipeline />} />
          <Route path="/inventory" element={<Inventory />} />

          {/* Admin-only routes */}
          <Route path="/operators" element={<AdminOnlyRoute><Operators /></AdminOnlyRoute>} />
          <Route path="/service-types" element={<AdminOnlyRoute><ServiceTypes /></AdminOnlyRoute>} />
          <Route path="/service-rates" element={<AdminOnlyRoute><ServiceRates /></AdminOnlyRoute>} />
          <Route path="/vehicles" element={<AdminOnlyRoute><Vehicles /></AdminOnlyRoute>} />
          <Route path="/commissions" element={<AdminOnlyRoute><Commissions /></AdminOnlyRoute>} />
          <Route path="/cost-centers" element={<AdminOnlyRoute><CostCenters /></AdminOnlyRoute>} />
          <Route path="/settings" element={<AdminOnlyRoute><Settings /></AdminOnlyRoute>} />
          <Route path="/quick-entries" element={<AdminOnlyRoute><QuickEntries /></AdminOnlyRoute>} />
          <Route path="/backup" element={<AdminOnlyRoute><BackupPage /></AdminOnlyRoute>} />
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

        <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
      </Routes>
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
