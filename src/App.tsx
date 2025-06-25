import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
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
import Closures from '@/pages/Closures';
import Invoices from '@/pages/Invoices';
import Costs from '@/pages/Costs';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import OperatorDashboard from '@/pages/OperatorDashboard';
import PortalDashboard from '@/pages/portal/PortalDashboard';
import PortalServices from '@/pages/portal/PortalServices';
import PortalInvoices from '@/pages/portal/PortalInvoices';
import Calendar from '@/pages/Calendar';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserProvider>
          <NotificationProvider>
            <ToastProvider>
              <Router>
                <div className="min-h-screen bg-black text-white">
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/" element={<Index />} />

                    {/* Main application routes - using absolute paths */}
                    <Route path="/dashboard" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Dashboard />} />
                    </Route>

                    <Route path="/services" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Services />} />
                    </Route>

                    <Route path="/calendar" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Calendar />} />
                    </Route>

                    <Route path="/closures" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Closures />} />
                    </Route>

                    <Route path="/clients" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Clients />} />
                    </Route>

                    <Route path="/operators" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Operators />} />
                    </Route>

                    <Route path="/cranes" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Cranes />} />
                    </Route>

                    <Route path="/service-types" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<ServiceTypes />} />
                    </Route>

                    <Route path="/invoices" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Invoices />} />
                    </Route>

                    <Route path="/costs" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Costs />} />
                    </Route>

                    <Route path="/reports" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Reports />} />
                    </Route>

                    <Route path="/settings" element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<Settings />} />
                    </Route>

                    <Route path="/operator" element={
                      <ProtectedRoute requireRole="operator">
                        <OperatorLayout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<OperatorDashboard />} />
                    </Route>

                    <Route path="/portal" element={
                      <ProtectedRoute requireRole="client">
                        <PortalLayout />
                      </ProtectedRoute>
                    }>
                      <Route index element={<PortalDashboard />} />
                      <Route path="services" element={<PortalServices />} />
                      <Route path="invoices" element={<PortalInvoices />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  <Toaster />
                </div>
              </Router>
            </ToastProvider>
          </NotificationProvider>
        </UserProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
