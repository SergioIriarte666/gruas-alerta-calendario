
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, History, Plus, X, FileText } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PortalSidebarProps {
  onClose?: () => void;
  showCloseButton?: boolean;
}

const PortalSidebar: React.FC<PortalSidebarProps> = ({ onClose, showCloseButton = false }) => {
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
    {
      name: 'Mis Facturas',
      href: '/portal/invoices',
      icon: FileText,
    },
  ];

  const handleNavClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className="w-64 h-full bg-gray-900 border-r border-gray-800 p-4 flex flex-col">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            {settings?.company?.logo && (
              <img 
                src={settings.company.logo} 
                alt="Logo empresa" 
                className="size-10 object-contain" 
              />
            )}
            <div>
              <h2 className="text-2xl font-bold text-tms-green">{companyName}</h2>
              <p className="text-sm text-gray-400">Portal de Clientes</p>
            </div>
          </div>
          {showCloseButton && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-gray-800"
            >
              <X className="size-5" />
            </Button>
          )}
        </div>
      </div>
      <nav className="flex flex-col space-y-2">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={handleNavClick}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                isActive 
                  ? "bg-gray-700 text-white font-medium" 
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              )}
            >
              <item.icon className="size-5" />
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
