
import { Toaster } from "@/components/ui/sonner";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ToastProvider } from "@/components/ui/custom-toast";
import { Layout } from "@/components/layout/Layout";
import { OperatorLayout } from "@/components/layout/OperatorLayout";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import ServiceTypes from "./pages/ServiceTypes";
import Clients from "./pages/Clients";
import Cranes from "./pages/Cranes";
import Operators from "./pages/Operators";
import Costs from "./pages/Costs";
import Calendar from "./pages/Calendar";
import Reports from "./pages/Reports";
import Invoices from "./pages/Invoices";
import Closures from "./pages/Closures";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import OperatorDashboard from "./pages/OperatorDashboard";
import ServiceInspection from "./pages/operator/ServiceInspection";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { PWAWrapper } from "@/components/pwa/PWAWrapper";
import "@/utils/connectionManager";
import "./App.css";

// Portal Imports
import PortalLogin from "./pages/portal/PortalLogin";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalServices from "./pages/portal/PortalServices";
import PortalInvoices from "./pages/portal/PortalInvoices";
import PortalRequestService from "./pages/portal/PortalRequestService";
import { PortalLayout } from "./components/portal/layout/PortalLayout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: (failureCount, error: any) => {
        // Don't retry on authentication errors
        if (error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

function NetworkStatusIndicator() {
  const { isOnline } = useNetworkStatus();
  
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 z-50">
        Sin conexión a internet. Algunas funciones pueden no estar disponibles.
      </div>
    );
  }
  
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <UserProvider>
            <NotificationProvider>
              <ToastProvider>
                <PWAWrapper>
                  <NetworkStatusIndicator />
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                    
                    {/* Client Portal Routes - Sin verificación de roles específicos ya que ProtectedRoute maneja la auth */}
                    <Route path="/portal/login" element={<PortalLogin />} />
                    <Route 
                      path="/portal/*" 
                      element={
                        <ProtectedRoute>
                          <PortalLayout>
                            <Routes>
                              <Route path="dashboard" element={<PortalDashboard />} />
                              <Route path="services" element={<PortalServices />} />
                              <Route path="invoices" element={<PortalInvoices />} />
                              <Route path="request-service" element={<PortalRequestService />} />
                            </Routes>
                          </PortalLayout>
                        </ProtectedRoute>
                      } 
                    />
                    
                    {/* Admin routes with Layout */}
                    <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="services" element={<Services />} />
                      <Route path="service-types" element={<ServiceTypes />} />
                      <Route path="clients" element={<Clients />} />
                      <Route path="cranes" element={<Cranes />} />
                      <Route path="operators" element={<Operators />} />
                      <Route path="costs" element={<Costs />} />
                      <Route path="calendar" element={<Calendar />} />
                      <Route path="reports" element={<Reports />} />
                      <Route path="invoices" element={<Invoices />} />
                      <Route path="closures" element={<Closures />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="profile" element={<Profile />} />
                    </Route>
                    
                    {/* Operator routes with OperatorLayout */}
                    <Route path="/operator" element={<ProtectedRoute><OperatorLayout /></ProtectedRoute>}>
                      <Route index element={<OperatorDashboard />} />
                    </Route>
                    <Route path="/operator/service/:serviceId/inspection" element={<ProtectedRoute><ServiceInspection /></ProtectedRoute>} />
                    <Route path="/operator/service/:serviceId/inspect" element={<ProtectedRoute><ServiceInspection /></ProtectedRoute>} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  <Toaster />
                </PWAWrapper>
              </ToastProvider>
            </NotificationProvider>
          </UserProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
