
import { Toaster } from "@/components/ui/sonner";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
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
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
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
              <PWAWrapper>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
                  <Route path="/service-types" element={<ProtectedRoute><ServiceTypes /></ProtectedRoute>} />
                  <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
                  <Route path="/cranes" element={<ProtectedRoute><Cranes /></ProtectedRoute>} />
                  <Route path="/operators" element={<ProtectedRoute><Operators /></ProtectedRoute>} />
                  <Route path="/costs" element={<ProtectedRoute><Costs /></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
                  <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
                  <Route path="/closures" element={<ProtectedRoute><Closures /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/operator" element={<ProtectedRoute><OperatorDashboard /></ProtectedRoute>} />
                  <Route path="/operator/service/:serviceId/inspection" element={<ProtectedRoute><ServiceInspection /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <Toaster />
              </PWAWrapper>
            </NotificationProvider>
          </UserProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
