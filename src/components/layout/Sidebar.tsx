import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Calendar, Truck, Users, Building2, Wrench, DollarSign, FileText, Receipt, BarChart3, Settings, Menu, X, LogOut, ChevronLeft, ChevronRight, Tags } from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

export const Sidebar = ({
  isCollapsed,
  setIsCollapsed,
  isMobileMenuOpen,
  setIsMobileMenuOpen
}: SidebarProps) => {
  const { user, logout } = useUser();
  const { settings } = useSettings();
  const location = useLocation();
  
  console.log('Sidebar render - User:', user?.name, 'Role:', user?.role);
  
  const companyName = settings?.company?.name || 'TMS Grúas';
  const companyLogo = settings?.company?.logo;
  
  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      adminOnly: false
    },
    {
      name: 'Calendario',
      href: '/calendar',
      icon: Calendar,
      adminOnly: false
    },
    {
      name: 'Servicios',
      href: '/services',
      icon: Truck,
      adminOnly: false
    },
    {
      name: 'Tipos de Servicio',
      href: '/service-types',
      icon: Tags,
      adminOnly: true
    },
    {
      name: 'Clientes',
      href: '/clients',
      icon: Users,
      adminOnly: false
    },
    {
      name: 'Grúas',
      href: '/cranes',
      icon: Building2,
      adminOnly: false
    },
    {
      name: 'Operadores',
      href: '/operators',
      icon: Wrench,
      adminOnly: false
    },
    {
      name: 'Costos',
      href: '/costs',
      icon: DollarSign,
      adminOnly: false
    },
    {
      name: 'Cierres',
      href: '/closures',
      icon: FileText,
      adminOnly: false
    },
    {
      name: 'Facturas',
      href: '/invoices',
      icon: Receipt,
      adminOnly: false
    },
    {
      name: 'Reportes',
      href: '/reports',
      icon: BarChart3,
      adminOnly: false
    },
    {
      name: 'Configuración',
      href: '/settings',
      icon: Settings,
      adminOnly: true
    }
  ];

  // Filter navigation items based on user role
  const filteredNavigation = navigationItems.filter(item => {
    if (!item.adminOnly) return true;
    return user && user.role === 'admin';
  });
  
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };
  
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-tms-dark border-r border-gray-700">
      {/* Header with Company Branding */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-tms-dark">
        {!isCollapsed && (
          <div className="flex items-center space-x-3">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo empresa" className="w-8 h-8 object-contain" />
            ) : (
              <Building2 className="w-8 h-8 text-tms-green" />
            )}
            <div>
              <h1 className="text-lg font-bold text-white">{companyName}</h1>
              <p className="text-xs font-bold text-tms-green">Sistema de Gestión</p>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="flex items-center justify-center w-full">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo empresa" className="w-8 h-8 object-contain" />
            ) : (
              <Building2 className="w-8 h-8 text-tms-green" />
            )}
          </div>
        )}
        
        {/* Desktop collapse button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="hidden lg:flex text-white bg-transparent hover:bg-tms-green hover:text-black"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>

        {/* Mobile close button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsMobileMenuOpen(false)} 
          className="lg:hidden text-white bg-transparent hover:bg-tms-green hover:text-black"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 bg-tms-dark">
        {filteredNavigation.map(item => {
          const isActive = location.pathname === item.href;
          return (
            <Link 
              key={item.name} 
              to={item.href} 
              className={cn(
                "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors nav-link",
                isActive 
                  ? "active bg-tms-green text-black" 
                  : "text-white hover:bg-tms-green hover:text-black"
              )} 
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <item.icon className={cn("w-5 h-5", isCollapsed ? "mx-auto" : "mr-3")} />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-gray-700 bg-tms-dark">
        {!isCollapsed && user && (
          <div className="mb-3">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
            <p className="text-xs capitalize text-tms-green">{user.role}</p>
          </div>
        )}
        
        <Button 
          variant="ghost" 
          onClick={handleLogout} 
          className={cn(
            "w-full text-white bg-transparent hover:bg-tms-green hover:text-black", 
            isCollapsed ? "px-2" : "justify-start"
          )}
        >
          <LogOut className={cn("w-4 h-4", isCollapsed ? "mx-auto" : "mr-2")} />
          {!isCollapsed && "Cerrar Sesión"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden bg-black bg-opacity-50" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 transition-all duration-300",
        isCollapsed ? "lg:w-16" : "lg:w-64"
      )}>
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 lg:hidden",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </div>
    </>
  );
};
