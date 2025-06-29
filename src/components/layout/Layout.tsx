
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useServiceRequestAlerts } from '@/hooks/useServiceRequestAlerts';
import { cn } from '@/lib/utils';

export const Layout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Configurar alertas de solicitudes de servicio
  useServiceRequestAlerts();

  return (
    <div className="min-h-screen bg-white text-black flex">
      <Sidebar 
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        "lg:ml-64", // Default margin for expanded sidebar
        isCollapsed && "lg:ml-16" // Reduced margin for collapsed sidebar
      )}>
        <Header setIsMobileMenuOpen={setIsMobileMenuOpen} />
        <main className="flex-1 p-4 sm:p-6 overflow-auto bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
