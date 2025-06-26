
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, History, Plus } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';

const PortalSidebar: React.FC = () => {
  const { settings } = useSettings();
  const location = useLocation();
  const companyName = settings?.company?.name || 'Grúas Alerta';

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/portal/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Mis Servicios',
      href: '/portal/services',
      icon: History,
    },
    {
      name: 'Solicitar Servicio',
      href: '/portal/request-service',
      icon: Plus,
    },
    // Facturas ocultas temporalmente - falta integración con sello fiscal
    // {
    //   name: 'Mis Facturas',
    //   href: '/portal/invoices',
    //   icon: FileText,
    // },
  ];

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          {settings?.company?.logo && (
            <img 
              src={settings.company.logo} 
              alt="Logo empresa" 
              className="h-10 w-10 object-contain" 
            />
          )}
          <div>
            <h2 className="text-2xl font-bold text-tms-green">{companyName}</h2>
            <p className="text-sm text-gray-400">Portal de Clientes</p>
          </div>
        </div>
      </div>
      <nav className="flex flex-col space-y-2">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                isActive 
                  ? "bg-gray-700 text-white font-medium" 
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <p className="text-xs text-center text-gray-500">© 2025 {companyName}</p>
      </div>
    </aside>
  );
};

export default PortalSidebar;
