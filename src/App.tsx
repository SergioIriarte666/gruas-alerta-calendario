
import React from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { OperatorLayout } from "@/components/layout/OperatorLayout";
import { UserProvider } from "@/contexts/UserContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/ui/custom-toast";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import Calendar from "./pages/Calendar";
import Clients from "./pages/Clients";
import Cranes from "./pages/Cranes";
import Operators from "./pages/Operators";
import Costs from "./pages/Costs";
import Closures from "./pages/Closures";
import Invoices from "./pages/Invoices";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import OperatorDashboard from "./pages/OperatorDashboard";
import ServiceInspection from "./pages/operator/ServiceInspection";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserProvider>
          <NotificationProvider>
            <ToastProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  
                  <Route path="/operator" element={
                    <ProtectedRoute>
                      <OperatorLayout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<OperatorDashboard />} />
                    <Route path="service/:id/inspect" element={<ServiceInspection />} />
                  </Route>

                  <Route path="/" element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }>
                    <Route index element={<Dashboard />} />
                    <Route path="calendar" element={<Calendar />} />
                    <Route path="services" element={<Services />} />
                    <Route path="clients" element={<Clients />} />
                    <Route path="cranes" element={<Cranes />} />
                    <Route path="operators" element={<Operators />} />
                    <Route path="costs" element={<Costs />} />
                    <Route path="closures" element={<Closures />} />
                    <Route path="invoices" element={<Invoices />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="profile" element={<Profile />} />
                  </Route>
                  
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </ToastProvider>
          </NotificationProvider>
        </UserProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
