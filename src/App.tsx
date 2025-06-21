
import { Toaster } from "@/components/ui/sonner";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ToastProvider } from "@/components/ui/custom-toast";
import { Layout } from "@/components/layout/Layout";
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
import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <UserProvider>
            <NotificationProvider>
              <ToastProvider>
                <PWAWrapper>
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                    <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
                    <Route path="/services" element={<ProtectedRoute><Layout><Services /></Layout></ProtectedRoute>} />
                    <Route path="/service-types" element={<ProtectedRoute><Layout><ServiceTypes /></Layout></ProtectedRoute>} />
                    <Route path="/clients" element={<ProtectedRoute><Layout><Clients /></Layout></ProtectedRoute>} />
                    <Route path="/cranes" element={<ProtectedRoute><Layout><Cranes /></Layout></ProtectedRoute>} />
                    <Route path="/operators" element={<ProtectedRoute><Layout><Operators /></Layout></ProtectedRoute>} />
                    <Route path="/costs" element={<ProtectedRoute><Layout><Costs /></Layout></ProtectedRoute>} />
                    <Route path="/calendar" element={<ProtectedRoute><Layout><Calendar /></Layout></ProtectedRoute>} />
                    <Route path="/reports" element={<ProtectedRoute><Layout><Reports /></Layout></ProtectedRoute>} />
                    <Route path="/invoices" element={<ProtectedRoute><Layout><Invoices /></Layout></ProtectedRoute>} />
                    <Route path="/closures" element={<ProtectedRoute><Layout><Closures /></Layout></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
                    <Route path="/operator" element={<ProtectedRoute><OperatorDashboard /></ProtectedRoute>} />
                    <Route path="/operator/service/:serviceId/inspection" element={<ProtectedRoute><ServiceInspection /></ProtectedRoute>} />
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
