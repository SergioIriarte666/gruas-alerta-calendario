
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
    <aside className="flex h-full w-64 flex-col border-r border-border/70 bg-card p-4">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-x-3">
            {settings?.company?.logo && (
              <img 
                src={settings.company.logo} 
                alt="Logo empresa" 
                className="size-10 object-contain" 
              />
            )}
            <div>
              <h2 className="text-2xl font-bold text-primary">{companyName}</h2>
              <p className="text-sm text-muted-foreground">Portal de Clientes</p>
            </div>
          </div>
          {showCloseButton && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </Button>
          )}
        </div>
      </div>
      <nav className="flex flex-col gap-y-2">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={handleNavClick}
              className={cn(
                'flex items-center space-x-3 rounded-md px-3 py-2 transition-colors',
                isActive 
                  ? 'border border-primary/20 bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="size-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        <p className="text-center text-xs text-muted-foreground">© 2025 {companyName}</p>
      </div>
    </aside>
  );
};

export default PortalSidebar;
