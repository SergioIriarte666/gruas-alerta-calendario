import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { useSettings } from '@/hooks/useSettings';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
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
  const { user, logout } = useUser();
  const { settings } = useSettings();
  const { isTablet } = useDeviceType();
  const { hasModuleAccess } = useUserModulePermissions();
  const location = useLocation();
  const companyName = settings?.company?.name || 'TMS Grúas';

  const [expandedGroups, setExpandedGroups] = useState<string[]>(['principal']);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupName)
        ? prev.filter(g => g !== groupName)
        : [...prev, groupName]
    );
  };

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

  const navigationGroups = [
    {
      id: 'principal',
      name: 'Principal',
      icon: LayoutDashboard,
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
      items: [
        { name: 'Clientes', href: '/clients', icon: Users, adminOnly: false },
        { name: 'Calendario', href: '/calendar', icon: Calendar, adminOnly: false },
      ]
    },
    {
      id: 'recursos',
      name: 'Recursos',
      icon: Building2,
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
      items: [
        { name: 'Bodega', href: '/inventory', icon: Package, adminOnly: false },
        { name: 'Proveedores', href: '/suppliers', icon: Building2, adminOnly: false },
      ]
    },
    {
      id: 'finanzas',
      name: 'Finanzas',
      icon: TrendingUp,
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
      items: [
        { name: 'Reportes', href: '/reports', icon: BarChart3, adminOnly: false },
      ]
    },
    {
      id: 'configuracion',
      name: 'Configuración',
      icon: Cog,
      items: [
        { name: 'Tipos de Servicio', href: '/service-types', icon: Tags, adminOnly: false },
        { name: 'Tarifas de Servicio', href: '/service-rates', icon: DollarSign, adminOnly: false },
        { name: 'Centros de Costo', href: '/cost-centers', icon: Target, adminOnly: false },
        { name: 'Registros Rápidos', href: '/quick-entries', icon: Zap, adminOnly: true },
        { name: 'Configuración', href: '/settings', icon: Settings, adminOnly: true },
      ]
    }
  ];

  const filterItems = (items: typeof navigationGroups[0]['items']) => {
    return items.filter(item => {
      if (item.adminOnly && (!user || user.role !== 'admin')) return false;
      const moduleKey = routeToModuleKey[item.href];
      if (moduleKey && !hasModuleAccess(moduleKey)) return false;
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

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    const parts = user.name.split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : parts[0][0].toUpperCase();
  };

  const getRoleLabel = () => {
    if (!user?.role) return '';
    const roles: Record<string, string> = {
      admin: 'ADMINISTRADOR',
      operator: 'OPERADOR',
      viewer: 'VISOR',
    };
    return roles[user.role] || user.role.toUpperCase();
  };

  // ── Shared nav item renderer ──
  const NavItem = ({ item, collapsed, onNavigate }: {
    item: { name: string; href: string; icon: React.ElementType };
    collapsed: boolean;
    onNavigate?: () => void;
  }) => {
    const isActive = location.pathname === item.href;
    const link = (
      <Link
        to={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-md text-sm transition-colors duration-150",
          collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
          isActive
            ? "bg-muted font-semibold text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
        {!collapsed && <span className="truncate">{item.name}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="bg-foreground text-background text-xs font-medium">
            {item.name}
          </TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  // ── Desktop / tablet content ──
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Profile header */}
      <div className={cn("flex items-center gap-3 border-b border-border", isCollapsed ? "justify-center p-3" : "p-4")}>
        <Avatar className="h-9 w-9 shrink-0 border border-border">
          <AvatarImage src={undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {getUserInitials()}
          </AvatarFallback>
        </Avatar>

        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{getRoleLabel()}</p>
            <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        <TooltipProvider disableHoverableContent>
          {navigationGroups.map(group => {
            const filteredItems = filterItems(group.items);
            if (filteredItems.length === 0) return null;

            const isExpanded = expandedGroups.includes(group.id) || group.alwaysExpanded;
            const hasActiveItem = filteredItems.some(i => location.pathname === i.href);

            // Auto-expand group that contains the active route
            if (hasActiveItem && !expandedGroups.includes(group.id) && !group.alwaysExpanded) {
              // We don't setState during render — let the user expand manually or use the effect below
            }

            return (
              <div key={group.id}>
                {/* Group label / separator */}
                {isCollapsed ? (
                  <Separator className="my-2" />
                ) : (
                  <button
                    onClick={() => !group.alwaysExpanded && toggleGroup(group.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                      !group.alwaysExpanded && "cursor-pointer hover:text-foreground"
                    )}
                  >
                    <span>{group.name}</span>
                    {!group.alwaysExpanded && (
                      isExpanded
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                )}

                {/* Items */}
                {(isExpanded || isCollapsed) && (
                  <div className={cn("space-y-0.5", !isCollapsed && "mt-1")}>
                    {filteredItems.map(item => (
                      <NavItem
                        key={item.href}
                        item={item}
                        collapsed={isCollapsed}
                        onNavigate={() => setIsMobileMenuOpen(false)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </TooltipProvider>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2 space-y-2">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full text-muted-foreground hover:text-foreground hover:bg-muted/50",
            isCollapsed ? "justify-center px-2" : "justify-start px-3"
          )}
          size="sm"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span className="ml-2">Cerrar Sesión</span>}
        </Button>

        {!isCollapsed && (
          <p className="text-[10px] text-center text-muted-foreground">{companyName}</p>
        )}
      </div>
    </div>
  );

  // ── Mobile content (never collapsed) ──
  const MobileSidebarContent = () => (
    <div className="flex flex-col h-full bg-background border-r border-border">
      {/* Profile header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Avatar className="h-9 w-9 shrink-0 border border-border">
          <AvatarImage src={undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {getUserInitials()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{getRoleLabel()}</p>
          <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(false)}
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
        {navigationGroups.map(group => {
          const filteredItems = filterItems(group.items);
          if (filteredItems.length === 0) return null;
          const isExpanded = expandedGroups.includes(group.id) || group.alwaysExpanded;
          return (
            <div key={group.id}>
              <button
                onClick={() => !group.alwaysExpanded && toggleGroup(group.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                  !group.alwaysExpanded && "cursor-pointer hover:text-foreground"
                )}
              >
                <span>{group.name}</span>
                {!group.alwaysExpanded && (
                  isExpanded
                    ? <ChevronUp className="h-3 w-3" />
                    : <ChevronDown className="h-3 w-3" />
                )}
              </button>
              {isExpanded && (
                <div className="space-y-0.5 mt-1">
                  {filteredItems.map(item => (
                    <NavItem
                      key={item.href}
                      item={item}
                      collapsed={false}
                      onNavigate={() => setIsMobileMenuOpen(false)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2 space-y-2">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50"
          size="sm"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="ml-2">Cerrar Sesión</span>
        </Button>
        <p className="text-[10px] text-center text-muted-foreground">{companyName}</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-black/50"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 transition-all duration-300 h-screen",
        isCollapsed ? "lg:w-16" : "lg:w-64"
      )}>
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 lg:hidden h-screen",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <MobileSidebarContent />
      </div>
    </>
  );
};
