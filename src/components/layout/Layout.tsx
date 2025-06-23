
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useServiceRequestAlerts } from '@/hooks/useServiceRequestAlerts';

export const Layout = () => {
  // Configurar alertas de solicitudes de servicio
  useServiceRequestAlerts();

  return (
    <div className="min-h-screen bg-black text-white flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
