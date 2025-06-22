import React from 'react';
import { LayoutDashboard, FileText, History } from 'lucide-react';

const PortalSidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-tms-green">Grúas Alerta</h2>
        <p className="text-sm text-gray-400">Portal de Clientes</p>
      </div>
      <nav className="flex flex-col space-y-2">
        <a href="/portal/dashboard" className="flex items-center space-x-3 px-3 py-2 rounded-md bg-gray-700 text-white font-medium">
          <LayoutDashboard className="w-5 h-5" />
          <span>Dashboard</span>
        </a>
        <a href="/portal/services" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-300 hover:bg-gray-700 hover:text-white">
          <History className="w-5 h-5" />
          <span>Mis Servicios</span>
        </a>
        <a href="/portal/invoices" className="flex items-center space-x-3 px-3 py-2 rounded-md text-gray-300 hover:bg-gray-700 hover:text-white">
          <FileText className="w-5 h-5" />
          <span>Mis Facturas</span>
        </a>
      </nav>
      <div className="mt-auto">
        <p className="text-xs text-center text-gray-500">© 2025 Grúas Alerta</p>
      </div>
    </aside>
  );
};

export default PortalSidebar;
