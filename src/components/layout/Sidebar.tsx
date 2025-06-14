import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Truck, 
  Users, 
  FileText, 
  Receipt, 
  BarChart3, 
  Settings,
  Menu,
  X,
  Calendar,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

const menuItems = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard
  },
  {
    title: 'Calendario',
    href: '/calendar',
    icon: Calendar
  },
  {
    title: 'Servicios',
    href: '/services',
    icon: Truck
  },
  {
    title: 'Clientes',
    href: '/clients',
    icon: Users
  },
  {
    title: 'Grúas',
    href: '/cranes',
    icon: Building2
  },
  {
    title: 'Operadores',
    href: '/operators',
    icon: Users
  },
  {
    title: 'Cierres',
    href: '/closures',
    icon: FileText
  },
  {
    title: 'Facturas',
    href: '/invoices',
    icon: Receipt
  },
  {
    title: 'Reportes',
    href: '/reports',
    icon: BarChart3
  },
  {
    title: 'Configuración',
    href: '/settings',
    icon: Settings
  }
];

export const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const { settings } = useSettings();

  return (
    <>
      {/* Sidebar Desktop */}
      <div className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 lg:w-64 bg-gradient-to-b from-tms-darker to-tms-dark border-r border-gray-800 transition-all duration-300",
        isCollapsed && "lg:w-16"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              {settings?.company.logo ? (
                <img src={settings.company.logo} alt="Company Logo" className="w-8 h-8 rounded-lg object-contain" />
              ) : (
                <div className="w-8 h-8 bg-tms-green rounded-lg flex items-center justify-center">
                  <Truck className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-white">{settings?.company.name || 'TMS Grúas'}</h1>
                <p className="text-xs text-gray-400">Sistema de Gestión</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-white"
          >
            {isCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "nav-link",
                  isActive && "active"
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <span className="ml-3 font-medium">{item.title}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs text-gray-500 text-center">
              <p>TMS Grúas v1.0</p>
              <p className="mt-1">© 2024 Sistema Profesional</p>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Mobile - será implementado en una versión posterior */}
    </>
  );
};
