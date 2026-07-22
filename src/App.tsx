
import { Suspense, lazy, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppearanceProvider } from '@/contexts/AppearanceContext';
import { useNotificationTriggers } from '@/hooks/useNotificationTriggers';
import { ToastProvider } from '@/components/ui/custom-toast';
import { SessionTimeoutProvider } from '@/components/auth/SessionTimeoutProvider';
import { Toaster } from '@/components/ui/sonner';
import { Layout } from '@/components/layout/Layout';
import { OperatorLayout } from '@/components/layout/OperatorLayout';
import { PortalLayout } from '@/components/portal/layout/PortalLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AdminOnlyRoute from '@/components/layout/AdminOnlyRoute';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import DebugFreeze from '@/pages/DebugFreeze';
import ConnectionTest from '@/pages/ConnectionTest';
import { businessClock } from '@/utils/businessClock';
import { supabase } from '@/integrations/supabase/client';
import { isOperatorMobileVariant } from '@/lib/appVariant';
import { startLiveUpdateService } from '@/services/liveUpdate';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Precargar zona horaria del negocio antes de renderizar nada
businessClock.bootstrap().catch(() => {/* fallback ya manejado */});

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
  Vehicles: () => import('@/pages/Vehicles'),
  Closures: () => import('@/pages/Closures'),
  Invoices: () => import('@/pages/Invoices'),
  IncomeProjections: () => import('@/pages/IncomeProjections'),
  Costs: () => import('@/pages/Costs'),
  AccountsPayable: () => import('@/pages/AccountsPayable'),
  Inventory: () => import('@/pages/Inventory'),
  DocumentLibrary: () => import('@/pages/DocumentLibrary'),
  Reports: () => import('@/pages/Reports'),
  Commissions: () => import('@/pages/Commissions'),
  Settings: () => import('@/pages/Settings'),
  OperatorDashboard: () => import('@/pages/OperatorDashboard'),
  ServiceInspection: () => import('@/pages/operator/ServiceInspection'),
  OperatorActivity: () => import('@/pages/operator/OperatorActivity'),
  OperatorProfile: () => import('@/pages/operator/OperatorProfile'),
  PortalDashboard: () => import('@/pages/portal/PortalDashboard'),
  PortalServices: () => import('@/pages/portal/PortalServices'),
  PortalInvoices: () => import('@/pages/portal/PortalInvoices'),
  PortalPurchaseOrders: () => import('@/pages/portal/PortalPurchaseOrders'),
  PortalRequestService: () => import('@/pages/portal/PortalRequestService'),
  Calendar: () => import('@/pages/Calendar'),
  QuickEntries: () => import('@/pages/QuickEntries'),
  BackupPage: () => import('@/pages/BackupPage'),
  Suppliers: () => import('@/pages/Suppliers'),
  VipClientPipeline: () => import('@/pages/VipClientPipeline'),
  NotFound: () => import('@/pages/NotFound'),
  DailyReport: () => import('@/pages/DailyReport'),
  Historical: () => import('@/pages/Historical'),
  ResetPassword: () => import('@/pages/ResetPassword'),
  TrackService: () => import('@/pages/TrackService'),
  TripCalculator: () => import('@/pages/TripCalculator'),
  PerformanceTest: () => import('@/pages/PerformanceTest'),
  AuthCallback: () => import('@/pages/AuthCallback'),
  Register: () => import('@/pages/Register'),
  PendingApproval: () => import('@/pages/PendingApproval'),
  PendingUsers: () => import('@/pages/PendingUsers'),
  RegenerarInspeccion: () => import('@/pages/admin/RegenerarInspeccion'),
  ExternalServices: () => import('@/pages/admin/ExternalServices'),
  OperatorLocations: () => import('@/pages/OperatorLocations'),
  LibrosSii: () => import('@/pages/LibrosSii'),
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
const Vehicles = lazy(routeImports.Vehicles);
const Closures = lazy(routeImports.Closures);
const Invoices = lazy(routeImports.Invoices);
const IncomeProjections = lazy(routeImports.IncomeProjections);
const Costs = lazy(routeImports.Costs);
const AccountsPayable = lazy(routeImports.AccountsPayable);
const Inventory = lazy(routeImports.Inventory);
const DocumentLibrary = lazy(routeImports.DocumentLibrary);
const Reports = lazy(routeImports.Reports);
const Commissions = lazy(routeImports.Commissions);
const Settings = lazy(routeImports.Settings);
const OperatorDashboard = lazy(routeImports.OperatorDashboard);
const ServiceInspection = lazy(routeImports.ServiceInspection);
const OperatorActivity = lazy(routeImports.OperatorActivity);
const OperatorProfile = lazy(routeImports.OperatorProfile);
const PortalDashboard = lazy(routeImports.PortalDashboard);
const PortalServices = lazy(routeImports.PortalServices);
const PortalInvoices = lazy(routeImports.PortalInvoices);
const PortalPurchaseOrders = lazy(routeImports.PortalPurchaseOrders);
const PortalRequestService = lazy(routeImports.PortalRequestService);
const Calendar = lazy(routeImports.Calendar);
const QuickEntries = lazy(routeImports.QuickEntries);
const BackupPage = lazy(() => routeImports.BackupPage().then(m => ({ default: m.BackupPage })));
const Suppliers = lazy(() => routeImports.Suppliers().then(m => ({ default: m.Suppliers })));
const VipClientPipeline = lazy(routeImports.VipClientPipeline);
const NotFound = lazy(routeImports.NotFound);
const DailyReport = lazy(routeImports.DailyReport);
const Historical = lazy(routeImports.Historical);
const LibrosSii = lazy(routeImports.LibrosSii);
const ResetPassword = lazy(routeImports.ResetPassword);
const TrackService = lazy(routeImports.TrackService);
const TripCalculator = lazy(routeImports.TripCalculator);
const PerformanceTest = lazy(routeImports.PerformanceTest);
const AuthCallback = lazy(routeImports.AuthCallback);
const Register = lazy(routeImports.Register);
const PendingApproval = lazy(routeImports.PendingApproval);
const PendingUsers = lazy(routeImports.PendingUsers);
const RegenerarInspeccion = lazy(routeImports.RegenerarInspeccion);
const ExternalServices = lazy(routeImports.ExternalServices);
const OperatorLocations = lazy(routeImports.OperatorLocations);

// Preload all route chunks after initial render
const preloadAllRoutes = () => {
  Object.values(routeImports).forEach(importFn => {
    importFn().catch(() => {}); // Silently preload, ignore errors
  });
};

function RouteActivityTracker() {
  const { user } = useAuth();
  const location = useLocation();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const path = location.pathname;
    if (lastPathRef.current === path) return;
    lastPathRef.current = path;

    (async () => {
      try {
        await supabase
          .from('user_activity_log')
          .insert({
            user_id: user.id,
            event_type: 'page_view',
            path,
            metadata: null,
          });
      } catch {
        return;
      }
    })();
  }, [location.pathname, user?.id]);

  return null;
}

const OPERATOR_MOBILE_ALLOWED_PREFIXES = [
  '/',
  '/auth',
  '/auth/callback',
  '/register',
  '/pending',
  '/reset-password',
  '/operator',
];

function MobileAppRouteGuard() {
  const location = useLocation();

  if (!isOperatorMobileVariant()) return null;

  const isAllowedRoute = OPERATOR_MOBILE_ALLOWED_PREFIXES.some((prefix) =>
    prefix === '/'
      ? location.pathname === '/'
      : location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
  );

  if (isAllowedRoute) return null;

  return <Navigate to="/operator" replace />;
}

function AppContent() {
  const navigate = useNavigate();
  // Activar triggers de notificaciones
  useNotificationTriggers();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const openWidgetUrl = (url?: string | null) => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'tmsoperador:' || parsed.hostname !== 'operator') return;
        navigate(parsed.pathname === '/active' ? '/operator?tab=activos' : '/operator');
      } catch {
        return;
      }
    };

    let removeListener: (() => Promise<void>) | undefined;
    void CapacitorApp.addListener('appUrlOpen', ({ url }) => openWidgetUrl(url)).then((handle) => {
      removeListener = () => handle.remove();
    });
    void CapacitorApp.getLaunchUrl().then(({ url }) => openWidgetUrl(url));

    return () => { void removeListener?.(); };
  }, [navigate]);

  useEffect(() => {
    void startLiveUpdateService();
  }, []);

  // Preload all route chunks after first render
  useEffect(() => {
    const timer = setTimeout(preloadAllRoutes, 1000);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="min-h-screen bg-background text-foreground">
        <MobileAppRouteGuard />
        <RouteActivityTracker />
        <Routes>
        <Route path="/auth" element={<ErrorBoundary name="Auth"><Suspense fallback={null}><Auth /></Suspense></ErrorBoundary>} />
        <Route path="/auth/callback" element={<Suspense fallback={null}><AuthCallback /></Suspense>} />
        <Route path="/register" element={<Suspense fallback={null}><Register /></Suspense>} />
        <Route path="/pending" element={<Suspense fallback={null}><PendingApproval /></Suspense>} />
        <Route path="/reset-password" element={<ErrorBoundary name="ResetPassword"><Suspense fallback={null}><ResetPassword /></Suspense></ErrorBoundary>} />
        <Route path="/track/:token" element={<ErrorBoundary name="TrackService"><Suspense fallback={null}><TrackService /></Suspense></ErrorBoundary>} />
        <Route path="/performance-test" element={<Suspense fallback={null}><PerformanceTest /></Suspense>} />
        <Route path="/debug-freeze" element={<DebugFreeze />} />
        <Route path="/connection-test" element={<ConnectionTest />} />
        <Route path="/" element={<ErrorBoundary name="Index"><Suspense fallback={null}><Index /></Suspense></ErrorBoundary>} />

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
          <Route path="/accounts-payable" element={<AccountsPayable />} />
          
          <Route path="/trip-calculator" element={<TripCalculator />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/daily-report" element={<DailyReport />} />
          <Route path="/clients/:clientId/pipeline" element={<VipClientPipeline />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/document-library" element={<DocumentLibrary />} />
          <Route path="/lowboy" element={<LibrosSii />} />
          <Route path="/libros-sii" element={<Navigate to="/lowboy" replace />} />

          {/* Admin-only routes */}
          <Route path="/operators" element={<AdminOnlyRoute><Operators /></AdminOnlyRoute>} />
          <Route path="/service-types" element={<Navigate to="/settings#service-types" replace />} />
          <Route path="/service-rates" element={<Navigate to="/settings#service-rates" replace />} />
          <Route path="/vehicles" element={<AdminOnlyRoute><Vehicles /></AdminOnlyRoute>} />
          <Route path="/commissions" element={<AdminOnlyRoute><Commissions /></AdminOnlyRoute>} />
          <Route path="/cost-centers" element={<Navigate to="/settings#cost-centers" replace />} />
          <Route path="/settings" element={<AdminOnlyRoute><Settings /></AdminOnlyRoute>} />
          <Route path="/quick-entries" element={<AdminOnlyRoute><QuickEntries /></AdminOnlyRoute>} />
          <Route path="/backup" element={<AdminOnlyRoute><BackupPage /></AdminOnlyRoute>} />
          <Route path="/admin/usuarios-pendientes" element={<AdminOnlyRoute><PendingUsers /></AdminOnlyRoute>} />
          <Route path="/admin/inspecciones/regenerar" element={<AdminOnlyRoute><RegenerarInspeccion /></AdminOnlyRoute>} />
          <Route path="/admin/external-services" element={<AdminOnlyRoute><ExternalServices /></AdminOnlyRoute>} />
          <Route path="/operator-locations" element={<AdminOnlyRoute><OperatorLocations /></AdminOnlyRoute>} />
        </Route>

        {/* Operator routes - accessible by operators and admins */}
        <Route path="/operator" element={
          <ProtectedRoute allowedRoles={['operator', 'admin']} moduleKey="operator_portal">
            <OperatorLayout />
          </ProtectedRoute>
        }>
          <Route index element={<OperatorDashboard />} />
          <Route path="activity" element={<OperatorActivity />} />
          <Route path="profile" element={<OperatorProfile />} />
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
          <Route path="purchase-orders" element={<PortalPurchaseOrders />} />
          <Route path="request-service" element={<PortalRequestService />} />
          <Route path="invoices" element={<PortalInvoices />} />
        </Route>

        <Route path="*" element={<ErrorBoundary name="NotFound"><Suspense fallback={null}><NotFound /></Suspense></ErrorBoundary>} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppearanceProvider>
            <SessionTimeoutProvider warningMinutes={20} timeoutMinutes={30}>
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
          </AppearanceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
