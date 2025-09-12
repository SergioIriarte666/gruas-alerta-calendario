
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { useSettings } from '@/hooks/useSettings';
import { useDeviceType } from '@/hooks/useDeviceType';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Calendar, Truck, Users, Building2, Wrench, DollarSign, Target, FileText, Receipt, BarChart3, Settings, Menu, X, LogOut, ChevronLeft, ChevronRight, Tags, Car, Package, Zap, Percent, Bot, ClipboardList } from 'lucide-react';

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
  const {
    user,
    logout
  } = useUser();
  const {
    settings
  } = useSettings();
  const { isTablet } = useDeviceType();
  const location = useLocation();
  console.log('🔍 SIDEBAR RENDER - User:', user?.name, 'Role:', user?.role);
  console.log('🔍 SIDEBAR COMPONENT LOADED AND RENDERING');
  const companyName = settings?.company?.name || 'TMS Grúas';
  const companyLogo = settings?.company?.logo;
  
  const navigationItems = [{
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    adminOnly: false
  }, {
    name: 'Informe Diario',
    href: '/daily-report',
    icon: ClipboardList,
    adminOnly: false
  }, {
    name: 'Servicios',
    href: '/services',
    icon: Truck,
    adminOnly: false
  }, {
    name: 'Clientes',
    href: '/clients',
    icon: Users,
    adminOnly: false
  }, {
    name: 'Grúas',
    href: '/cranes',
    icon: Building2,
    adminOnly: false
  }, {
    name: 'Operadores',
    href: '/operators',
    icon: Users,
    adminOnly: false
  }, {
    name: 'Calendario',
    href: '/calendar',
    icon: Calendar,
    adminOnly: false
  }, {
    name: 'Bodega',
    href: '/inventory',
    icon: Package,
    adminOnly: false
  }, {
    name: 'Proveedores',
    href: '/suppliers',
    icon: Building2,
    adminOnly: false
  }, {
    name: 'Costos',
    href: '/costs',
    icon: DollarSign,
    adminOnly: false
  }, {
    name: 'Comisiones',
    href: '/commissions',
    icon: Percent,
    adminOnly: true
  }, {
    name: 'Facturación Diferida',
    href: '/deferred-billing',
    icon: Calendar,
    adminOnly: false
  }, {
    name: 'Facturas',
    href: '/invoices',
    icon: Receipt,
    adminOnly: false
  }, {
    name: 'Cierres',
    href: '/closures',
    icon: FileText,
    adminOnly: false
  }, {
    name: 'Reportes',
    href: '/reports',
    icon: BarChart3,
    adminOnly: false
  }, {
    name: 'Tipos de Servicio',
    href: '/service-types',
    icon: Tags,
    adminOnly: false
  }, {
    name: 'Centros de Costo',
    href: '/cost-centers',
    icon: Target,
    adminOnly: false
  }, {
    name: 'Vehículos',
    href: '/vehicles',
    icon: Car,
    adminOnly: false
  }, {
    name: 'Registros Rápidos',
    href: '/quick-entries',
    icon: Zap,
    adminOnly: true
  }, {
    name: 'Configuración',
    href: '/settings',
    icon: Settings,
    adminOnly: true
  }];

  // Filter navigation items based on user role
  const filteredNavigation = navigationItems.filter(item => {
    console.log(`Filtering item: ${item.name}, adminOnly: ${item.adminOnly}, user role: ${user?.role}`);
    if (!item.adminOnly) return true;
    return user && user.role === 'admin';
  });
  
  console.log('Filtered navigation items:', filteredNavigation.map(item => item.name));
  
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };
  
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-background border-r tms-border">
      {/* Header with Company Branding */}
      <div className={cn(
        "flex items-center justify-between border-b tms-border bg-background",
        isTablet ? "p-3" : "p-4"
      )}>
        {!isCollapsed && (
          <div className="flex items-center space-x-3">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo empresa" className="w-8 h-8 object-contain" />
            ) : (
              <Building2 className="w-8 h-8 text-primary" />
            )}
            <div>
              <h1 className={cn(
                "font-bold text-foreground",
                isTablet ? "text-base" : "text-lg"
              )}>{companyName}</h1>
              <p className="text-xs font-bold text-destructive">Sistema de Gestión</p>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="flex items-center justify-center w-full">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo empresa" className="w-8 h-8 object-contain" />
            ) : (
              <Building2 className="w-8 h-8 text-primary" />
            )}
          </div>
        )}
        
        {/* Desktop collapse button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="hidden lg:flex text-foreground hover:bg-primary hover:text-primary-foreground"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>

        {/* Mobile close button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsMobileMenuOpen(false)} 
          className="lg:hidden text-foreground hover:bg-primary hover:text-primary-foreground"
        >
          <X className="w-5 h-5 text-foreground" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 space-y-1 bg-background overflow-y-auto",
        isTablet ? "p-3" : "p-4"
      )}>
        {filteredNavigation.map(item => {
          const isActive = location.pathname === item.href;
          return (
            <Link 
              key={item.name} 
              to={item.href} 
              className={cn(
                "flex items-center rounded-lg font-medium transition-colors nav-link",
                isTablet ? "px-2 py-2 text-sm" : "px-3 py-2 text-sm",
                isActive 
                  ? "active bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <item.icon className={cn("w-5 h-5 text-foreground", isCollapsed ? "mx-auto" : "mr-3")} />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className={cn(
        "border-t tms-border bg-background",
        isTablet ? "p-3" : "p-4"
      )}>
        {!isCollapsed && user && (
          <div className="mb-3">
            <p className="text-sm font-medium text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <p className="text-xs capitalize text-primary">{user.role}</p>
          </div>
        )}
        
        <Button 
          variant="ghost" 
          onClick={handleLogout} 
          className={cn(
            "w-full text-foreground hover:bg-primary hover:text-primary-foreground", 
            isCollapsed ? "px-2" : "justify-start"
          )}
        >
          <LogOut className={cn("w-4 h-4 text-foreground", isCollapsed ? "mx-auto" : "mr-2")} />
          {!isCollapsed && "Cerrar Sesión"}
        </Button>
      </div>
    </div>
  );

  return <>
      {/* Mobile backdrop */}
      {isMobileMenuOpen && <div className="fixed inset-0 z-40 lg:hidden bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* Desktop Sidebar */}
      <div className={cn("hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 transition-all duration-300 h-screen", isCollapsed ? "lg:w-16" : "lg:w-64")}>
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <div className={cn("fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 lg:hidden h-screen", isMobileMenuOpen ? "translate-x-0" : "-translate-x-full")}>
        <SidebarContent />
      </div>
    </>;
};
