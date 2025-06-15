
import * as React from 'react';
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
  Building2,
  Wallet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { Sheet, SheetContent } from '@/components/ui/sheet';

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
    title: 'Costos',
    href: '/costs',
    icon: Wallet
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

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
}

export const Sidebar = ({ isCollapsed, setIsCollapsed, isMobileMenuOpen, setIsMobileMenuOpen }: SidebarProps) => {
  const location = useLocation();
  const { settings } = useSettings();

  const MobileNavContent = () => (
    <div className='flex flex-col h-full'>
      <div className="flex items-center p-4 border-b border-gray-800 h-16">
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
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center px-3 py-2 text-gray-300 rounded-md text-sm hover:bg-white/10 hover:text-white transition-colors",
                isActive && "bg-tms-green text-white"
              )}
            >
              <Icon className="h-5 w-5 mr-3" />
              <span className="font-medium">{item.title}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-500 text-center">
          <p>TMS Grúas v1.0</p>
          <p className="mt-1">© 2024 Sistema Profesional</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Sidebar Desktop */}
      <div className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 bg-gradient-to-b from-tms-darker to-tms-dark border-r border-gray-800 transition-all duration-300",
        isCollapsed ? "lg:w-16" : "lg:w-64"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 h-16 border-b border-gray-800">
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
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-gray-300 rounded-md text-sm hover:bg-white/10 hover:text-white transition-colors",
                  isCollapsed ? 'justify-center' : '',
                  isActive && "bg-tms-green text-white"
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <Icon className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                {!isCollapsed && (
                  <span className="font-medium">{item.title}</span>
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

      {/* Sidebar Mobile */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-[280px] bg-gradient-to-b from-tms-darker to-tms-dark border-r-0 flex flex-col">
          <MobileNavContent />
        </SheetContent>
      </Sheet>
    </>
  );
};
