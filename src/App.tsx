
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserProvider } from '@/contexts/UserContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
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
            <Router>
              <div className="min-h-screen bg-black text-white">
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={<Index />} />

                  {/* Main application routes */}
                  <Route path="/*" element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }>
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="services" element={<Services />} />
                    <Route path="calendar" element={<Calendar />} />
                    <Route path="closures" element={<Closures />} />
                    <Route path="clients" element={<Clients />} />
                    <Route path="operators" element={<Operators />} />
                    <Route path="cranes" element={<Cranes />} />
                    <Route path="service-types" element={<ServiceTypes />} />
                    <Route path="invoices" element={<Invoices />} />
                    <Route path="costs" element={<Costs />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="settings" element={<Settings />} />
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
          </NotificationProvider>
        </UserProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
