
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import Calendar from "./pages/Calendar";
import Clients from "./pages/Clients";
import Cranes from "./pages/Cranes";
import Operators from "./pages/Operators";
import Closures from "./pages/Closures";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/services" element={<Services />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/cranes" element={<Cranes />} />
            {/* Rutas adicionales serán implementadas progresivamente */}
            <Route path="/operators" element={<div className="text-white">Módulo Operadores - En desarrollo</div>} />
            <Route path="/closures" element={<div className="text-white">Módulo Cierres - En desarrollo</div>} />
            <Route path="/invoices" element={<div className="text-white">Módulo Facturas - En desarrollo</div>} />
            <Route path="/reports" element={<div className="text-white">Módulo Reportes - En desarrollo</div>} />
            <Route path="/settings" element={<div className="text-white">Configuración - En desarrollo</div>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
