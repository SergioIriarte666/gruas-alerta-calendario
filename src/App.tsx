
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import Calendar from "./pages/Calendar";
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
            {/* Rutas adicionales serán implementadas progresivamente */}
            <Route path="/clients" element={<div className="text-white">Módulo Clientes - En desarrollo</div>} />
            <Route path="/cranes" element={<div className="text-white">Módulo Grúas - En desarrollo</div>} />
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
