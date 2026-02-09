import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { useSettings } from '@/hooks/useSettings';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, Calendar, Truck, Users, Building2, DollarSign, Target, 
  FileText, Receipt, BarChart3, Settings, X, LogOut, ChevronLeft, ChevronRight, 
  Tags, Car, Package, Zap, Percent, ClipboardList, ChevronDown, ChevronUp,
  Briefcase, Warehouse, TrendingUp, Cog
} from 'lucide-react';

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
  const { hasModuleAccess } = useUserModulePermissions();
  const location = useLocation();
  const companyName = settings?.company?.name || 'TMS Grúas';
  const companyLogo = settings?.company?.logo;
  
  // Estado para grupos expandidos
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['principal']);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    );
  };

  // Mapeo de rutas a module keys para verificación de permisos
  const routeToModuleKey: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/daily-report': 'reports',
    '/services': 'services',
    '/clients': 'clients',
    '/calendar': 'calendar',
    '/cranes': 'cranes',
    '/operators': 'operators',
    '/vehicles': 'cranes',
    '/inventory': 'inventory',
    '/suppliers': 'suppliers',
    '/incomes': 'incomes',
    '/costs': 'costs',
    '/commissions': 'commissions',
    '/closures': 'closures',
    '/invoices': 'invoices',
    '/income-projections': 'incomes',
    '/reports': 'reports',
    '/service-types': 'settings',
    '/service-rates': 'service-rates',
    '/cost-centers': 'costs',
    '/quick-entries': 'settings',
    '/settings': 'settings',
    '/payments': 'payments',
  };

  // Navegación organizada en dos niveles con colores
  const navigationGroups = [
    {
      id: 'principal',
      name: 'Principal',
      icon: LayoutDashboard,
      color: 'principal',
      alwaysExpanded: true,
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: false },
        { name: 'Informe Diario', href: '/daily-report', icon: ClipboardList, adminOnly: false },
        { name: 'Servicios', href: '/services', icon: Truck, adminOnly: false },
      ]
    },
    {
      id: 'operaciones',
      name: 'Operaciones',
      icon: Briefcase,
      color: 'operaciones',
      items: [
        { name: 'Clientes', href: '/clients', icon: Users, adminOnly: false },
        { name: 'Calendario', href: '/calendar', icon: Calendar, adminOnly: false },
      ]
    },
    {
      id: 'recursos',
      name: 'Recursos',
      icon: Building2,
      color: 'recursos',
      items: [
        { name: 'Grúas', href: '/cranes', icon: Building2, adminOnly: false },
        { name: 'Operadores', href: '/operators', icon: Users, adminOnly: false },
        { name: 'Vehículos', href: '/vehicles', icon: Car, adminOnly: false },
      ]
    },
    {
      id: 'inventario',
      name: 'Inventario',
      icon: Warehouse,
      color: 'inventario',
      items: [
        { name: 'Bodega', href: '/inventory', icon: Package, adminOnly: false },
        { name: 'Proveedores', href: '/suppliers', icon: Building2, adminOnly: false },
      ]
    },
    {
      id: 'finanzas',
      name: 'Finanzas',
      icon: TrendingUp,
      color: 'finanzas',
      items: [
        
        { name: 'Costos', href: '/costs', icon: DollarSign, adminOnly: false },
        { name: 'Comisiones', href: '/commissions', icon: Percent, adminOnly: true },
        { name: 'Cierres', href: '/closures', icon: FileText, adminOnly: false },
        { name: 'Facturas', href: '/invoices', icon: Receipt, adminOnly: false },
        
      ]
    },
    {
      id: 'analisis',
      name: 'Análisis',
      icon: BarChart3,
      color: 'analisis',
      items: [
        { name: 'Reportes', href: '/reports', icon: BarChart3, adminOnly: false },
      ]
    },
    {
      id: 'configuracion',
      name: 'Configuración',
      icon: Cog,
      color: 'configuracion',
      items: [
        { name: 'Tipos de Servicio', href: '/service-types', icon: Tags, adminOnly: false },
        { name: 'Tarifas de Servicio', href: '/service-rates', icon: DollarSign, adminOnly: false },
        { name: 'Centros de Costo', href: '/cost-centers', icon: Target, adminOnly: false },
        { name: 'Registros Rápidos', href: '/quick-entries', icon: Zap, adminOnly: true },
        { name: 'Configuración', href: '/settings', icon: Settings, adminOnly: true },
      ]
    }
  ];

  // Filtrar items según permisos de rol Y permisos de módulo
  const filterItems = (items: typeof navigationGroups[0]['items']) => {
    return items.filter(item => {
      // Primero verificar permisos de rol (adminOnly)
      if (item.adminOnly && (!user || user.role !== 'admin')) {
        return false;
      }
      
      // Luego verificar permisos de módulo
      const moduleKey = routeToModuleKey[item.href];
      if (moduleKey && !hasModuleAccess(moduleKey)) {
        return false;
      }
      
      return true;
    });
  };
  
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
              <p className="text-xs font-bold text-violet-600">Sistema de Gestión</p>
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

      {/* Navigation con grupos */}
      <nav className={cn(
        "flex-1 space-y-1 bg-background overflow-y-auto",
        isTablet ? "p-2" : "p-3"
      )}>
        {navigationGroups.map(group => {
          const filteredItems = filterItems(group.items);
          if (filteredItems.length === 0) return null;
          
          const isExpanded = expandedGroups.includes(group.id) || group.alwaysExpanded;
          const hasActiveItem = filteredItems.some(item => location.pathname === item.href);
          
          return (
            <div key={group.id} className="space-y-1">
              {/* Group Header */}
              {!isCollapsed && (
                <button
                  onClick={() => !group.alwaysExpanded && toggleGroup(group.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-lg mb-1",
                    `sidebar-group-${group.color}`,
                    hasActiveItem && "shadow-sm",
                    group.alwaysExpanded ? "cursor-default" : "cursor-pointer hover:shadow-md"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <group.icon className="w-4 h-4" />
                    <span>{group.name}</span>
                  </div>
                  {!group.alwaysExpanded && (
                    isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              )}
              
              {/* Collapsed Group Indicator */}
              {isCollapsed && (
                <div className={cn(
                  "w-full h-1 rounded-full mb-2 transition-all",
                  `bg-sidebar-${group.color}`,
                  hasActiveItem && "h-1.5 shadow-sm"
                )} />
              )}

              {/* Group Items */}
              {(isExpanded || isCollapsed) && (
                <div className={cn("space-y-1", !isCollapsed && "ml-2")}>
                  {filteredItems.map(item => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link 
                        key={item.name} 
                        to={item.href} 
                        className={cn(
                          "relative flex items-center rounded-lg font-medium transition-all duration-200",
                          `sidebar-item-${group.color}`,
                          isTablet ? "px-3 py-2 text-sm" : "px-3 py-2 text-sm",
                          isActive && "active shadow-sm",
                          !isActive && "hover:shadow-sm"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                        title={isCollapsed ? item.name : undefined}
                      >
                        <div className={cn(
                          "flex items-center justify-center rounded-lg",
                          isCollapsed ? "w-8 h-8" : "w-7 h-7 mr-3"
                        )}>
                          <item.icon className="w-4 h-4" strokeWidth={2.5} />
                        </div>
                        {!isCollapsed && <span className="truncate">{item.name}</span>}
                        
                        {/* Collapsed mode color indicator */}
                        {isCollapsed && isActive && (
                          <div className={cn(
                            "sidebar-indicator",
                            `sidebar-indicator-${group.color}`
                          )} />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
            <p className="text-xs text-foreground">{user.email}</p>
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
          <div className={cn(
            "flex items-center justify-center rounded-lg bg-primary/20",
            isCollapsed ? "w-8 h-8" : "w-8 h-8 mr-2"
          )}>
            <LogOut className="w-4 h-4 text-foreground" strokeWidth={2.25} />
          </div>
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
