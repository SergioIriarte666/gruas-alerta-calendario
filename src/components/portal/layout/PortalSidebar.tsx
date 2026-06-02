
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Building2, FileText, FileWarning as FileAlert, History, LayoutDashboard, Plus, X } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useUser } from '@/contexts/UserContext';
import { usePortalOCCount } from '@/hooks/portal/usePortalOCCount';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface PortalSidebarProps {
  onClose?: () => void;
  showCloseButton?: boolean;
}

const PortalSidebar: React.FC<PortalSidebarProps> = ({ onClose, showCloseButton = false }) => {
  const { settings } = useSettings();
  const { user } = useUser();
  const location = useLocation();
  const ocCount = usePortalOCCount();
  const companyName = settings?.company?.name || 'Grúas Alerta';
  const userName = user?.name || user?.email || 'Cliente';
  const userInitials = userName.slice(0, 2).toUpperCase();

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
      name: 'Sin orden de compra',
      href: '/portal/purchase-orders',
      icon: FileAlert,
      badgeCount: ocCount,
      urgent: ocCount > 0,
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
    <aside className="flex h-full w-64 flex-col border-r border-[#e2e8f0] bg-white p-4">
      <div className="mb-6 border-b border-[#f1f5f9] pb-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {settings?.company?.logo ? (
              <img
                src={settings.company.logo}
                alt="Logo empresa"
                className="size-8 rounded-[8px] object-contain"
              />
            ) : (
              <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br from-violet-600 to-indigo-600">
                <Building2 className="size-4 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[#0f172a]">{companyName}</p>
              <p className="text-[10px] text-[#94a3b8]">Portal de clientes</p>
            </div>
          </div>
          {showCloseButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-[#64748b] hover:bg-slate-50 hover:text-[#334155]"
            >
              <X className="size-5" />
            </Button>
          )}
        </div>
      </div>
      <p className="mb-1 mt-2 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.7px] text-[#cbd5e1]">
        Menú
      </p>
      <nav className="flex flex-col gap-y-1">
        {navigationItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={handleNavClick}
              className={cn(
                'flex items-center gap-2 rounded-[7px] px-2.5 py-2 text-[12px] transition-colors',
                isActive && !item.urgent ? 'bg-violet-50 font-medium text-violet-700' : '',
                isActive && item.urgent ? 'bg-amber-50 font-medium text-amber-800' : '',
                !isActive ? 'text-[#64748b] hover:bg-slate-50 hover:text-[#334155]' : ''
              )}
            >
              <item.icon className="size-[14px]" />
              <span>{item.name}</span>
              {item.href === '/portal/purchase-orders' && ocCount > 0 && (
                <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-medium text-white">
                  {ocCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-[#f1f5f9] pt-3">
        <div className="flex items-center gap-2 rounded-[8px] border border-[#f1f5f9] bg-[#f8fafc] p-2.5">
          <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-[11px] font-medium text-white">
            {userInitials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-[#0f172a]">{userName}</p>
            <p className="text-[10px] text-[#94a3b8]">Cliente</p>
          </div>
          <div className="ml-auto size-2 flex-shrink-0 rounded-full bg-green-400" title="Conectado" />
        </div>
      </div>
    </aside>
  );
};

export default PortalSidebar;
