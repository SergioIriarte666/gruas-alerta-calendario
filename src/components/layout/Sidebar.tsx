import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { useUserModulePermissions } from '@/hooks/useUserModulePermissions';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useUpcomingServicesCount } from '@/hooks/useUpcomingServicesCount';
import { usePendingUsersCount } from '@/hooks/usePendingUsersCount';
import { 
  LayoutDashboard, Calendar, Truck, Users, Building2, DollarSign, Target,
  FileText, Receipt, BarChart3, Settings, X, LogOut, ChevronLeft, ChevronRight,
  Tags, Car, Package, Zap, Percent, ClipboardList, ChevronDown, ChevronUp,
  Briefcase, Warehouse, TrendingUp, Cog, MapPin, Landmark, Database, HardHat, UserCheck, Archive, FileClock,
  BookOpenCheck
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
  const { user } = useUser();
  const { signOut } = useAuth();
  const { settings } = useSettings();
  const { hasModuleAccess } = useUserModulePermissions();
  const location = useLocation();
  const companyName = settings?.company?.name || 'TMS Grúas';
  const { data: upcomingCount = 0 } = useUpcomingServicesCount();
  const { data: pendingUsersCount = 0 } = usePendingUsersCount(user?.role === 'admin');

  const [expandedGroups, setExpandedGroups] = useState<string[]>(['principal']);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev: string[]) =>
      prev.includes(groupName)
        ? prev.filter((g: string) => g !== groupName)
        : [...prev, groupName]
    );
  };

  const routeToModuleKey: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/daily-report': 'reports',
    '/services': 'services',
    '/admin/external-services': 'services',
    '/clients': 'clients',
    '/document-library': 'document-library',
    '/calendar': 'calendar',
    '/cranes': 'cranes',
    '/operators': 'operators',
    '/vehicles': 'cranes',
    '/inventory': 'inventory',
    '/suppliers': 'suppliers',
    '/costs': 'finanzas',
    '/accounts-payable': 'finanzas',
    '/commissions': 'commissions',
    '/closures': 'closures',
    '/invoices': 'invoices',
    '/income-projections': 'income-projections',
    '/reports': 'reports',
    '/service-types': 'settings',
    '/service-rates': 'service-rates',
    '/cost-centers': 'costs',
    '/quick-entries': 'settings',
    '/backup': 'backup',
    '/settings': 'settings',
    '/admin/inspecciones/regenerar': 'settings',
    '/trip-calculator': 'trip-calculator',
    '/lowboy': 'finanzas',
  };

  useEffect(() => {
    const activeGroup = navigationGroups.find((group) =>
      group.items.some((item) => location.pathname === item.href),
    );

    if (!activeGroup || activeGroup.alwaysExpanded) return;

    setExpandedGroups((prev) =>
      prev.includes(activeGroup.id) ? prev : [...prev, activeGroup.id],
    );
  }, [location.pathname]);

  const navigationGroups = [
    {
      id: 'principal',
      name: 'Principal',
      icon: LayoutDashboard,
      alwaysExpanded: true,
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: false },
        { name: 'Portal Operador', href: '/operator', icon: HardHat, adminOnly: false, requiresOperator: true },
        { name: 'Informe Diario', href: '/daily-report', icon: ClipboardList, adminOnly: false },
        { name: 'Servicios', href: '/services', icon: Truck, adminOnly: false },
        { name: 'Servicios Externos', href: '/admin/external-services', icon: Briefcase, adminOnly: true },
      ]
    },
    {
      id: 'operaciones',
      name: 'Operaciones',
      icon: Briefcase,
      items: [
        { name: 'Clientes', href: '/clients', icon: Users, adminOnly: false },
        { name: 'Biblioteca Documental', href: '/document-library', icon: Archive, adminOnly: false },
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
        { name: 'Ubicaciones', href: '/operator-locations', icon: MapPin, adminOnly: true },
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
        { name: 'Cuentas por Pagar', href: '/accounts-payable', icon: Landmark, adminOnly: false },
        { name: 'Comisiones', href: '/commissions', icon: Percent, adminOnly: true },
        { name: 'Cierres', href: '/closures', icon: FileText, adminOnly: false },
        { name: 'Facturas', href: '/invoices', icon: Receipt, adminOnly: false },
        { name: 'Históricos', href: '/historical', icon: Briefcase, adminOnly: false },
        { name: 'Lowboy', href: '/lowboy', icon: BookOpenCheck, adminOnly: false },
        { name: 'Cálculo de Viajes', href: '/trip-calculator', icon: MapPin, adminOnly: false },
      ]
    },
    {
      id: 'analisis',
      name: 'Análisis',
      icon: BarChart3,
      items: [
        { name: 'Proyección de Ingresos', href: '/income-projections', icon: TrendingUp, adminOnly: false },
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
        { name: 'Respaldos', href: '/settings#respaldos', icon: Database, adminOnly: true },
        { name: 'Regenerar Inspección', href: '/admin/inspecciones/regenerar', icon: FileClock, adminOnly: true },
        { name: 'Configuración', href: '/settings', icon: Settings, adminOnly: true },
        { name: 'Usuarios pendientes', href: '/admin/usuarios-pendientes', icon: UserCheck, adminOnly: true },
      ]
    }
  ];

  const filterItems = (items: typeof navigationGroups[0]['items']) => {
    return items.filter(item => {
      if (item.adminOnly && (!user || user.role !== 'admin')) return false;
      if ((item as any).requiresOperator && !user?.operator_id) return false;
      const moduleKey = routeToModuleKey[item.href];
      if (moduleKey && !hasModuleAccess(moduleKey)) return false;
      return true;
    });
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // redirect handled by AuthContext
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
  const NavItem: React.FC<{
    item: { name: string; href: string; icon: React.ElementType };
    collapsed: boolean;
    onNavigate?: () => void;
  }> = ({ item, collapsed, onNavigate }) => {
    const isActive = location.pathname === item.href;
    const showBadge = item.href === '/calendar' && upcomingCount > 0;
    const showPendingBadge = item.href === '/admin/usuarios-pendientes' && pendingUsersCount > 0;
    const link = (
      <Link
        to={item.href}
        onClick={onNavigate}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl text-sm transition-all duration-150",
          collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
          isActive
            ? "bg-primary/[0.12] font-semibold text-foreground shadow-sm ring-1 ring-primary/15"
            : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
        )}
      >
        {isActive && !collapsed && (
          <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" />
        )}
        <item.icon className={cn("size-4 shrink-0", isActive && "text-primary")} strokeWidth={isActive ? 2.5 : 2} />
        {!collapsed && <span className="truncate">{item.name}</span>}
        {showPendingBadge && !collapsed && (
          <span
            className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-xs font-semibold text-danger-foreground"
            aria-label={`${pendingUsersCount} usuarios pendientes`}
          >
            {pendingUsersCount}
          </span>
        )}
        {showPendingBadge && collapsed && (
          <span
            className="absolute -right-0.5 -top-0.5 inline-flex size-2 rounded-full bg-danger ring-2 ring-card"
            aria-label={`${pendingUsersCount} usuarios pendientes`}
          />
        )}
        {showBadge && !collapsed && (
          <span
            className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground"
            aria-label={`${upcomingCount} servicios programados para hoy o mañana`}
          >
            {upcomingCount}
          </span>
        )}
        {showBadge && collapsed && (
          <span
            className="absolute -right-0.5 -top-0.5 inline-flex size-2 rounded-full bg-primary ring-2 ring-card"
            aria-label={`${upcomingCount} servicios programados para hoy o mañana`}
          />
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right" className="bg-foreground text-background text-xs font-medium">
            {item.name}{showBadge ? ` · ${upcomingCount}` : ''}{showPendingBadge ? ` · ${pendingUsersCount}` : ''}
          </TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  // ── Desktop / tablet content ──
  const SidebarContent = () => (
    <div className="flex h-full flex-col border-r border-border/60 bg-card/90 backdrop-blur-xl">
      {/* Profile header */}
      <div className={cn("flex items-center gap-3 border-b border-border/60", isCollapsed ? "justify-center p-3" : "p-4")}>
        <Avatar className="size-10 shrink-0 border border-border/70 shadow-sm">
          <AvatarImage src={user?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {getUserInitials()}
          </AvatarFallback>
        </Avatar>

        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{getRoleLabel()}</p>
            <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{companyName}</p>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          aria-expanded={!isCollapsed}
          className="hidden lg:flex size-8 shrink-0 rounded-full border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Cerrar menú"
          className="lg:hidden size-8 shrink-0 rounded-full border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" role="navigation" aria-label="Navegación principal">
        <TooltipProvider disableHoverableContent>
          {navigationGroups.map(group => {
            const filteredItems = filterItems(group.items);
            if (filteredItems.length === 0) return null;

            const isExpanded = expandedGroups.includes(group.id) || group.alwaysExpanded;
            return (
              <div key={group.id} className="mb-4">
                {/* Group label / separator */}
                {isCollapsed ? (
                  <Separator className="my-2 bg-border/60" />
                ) : (
                  <button
                    onClick={() => !group.alwaysExpanded && toggleGroup(group.id)}
                    aria-expanded={group.alwaysExpanded ? undefined : isExpanded}
                    aria-label={`${group.name}${group.alwaysExpanded ? '' : isExpanded ? ' - colapsar' : ' - expandir'}`}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground",
                      !group.alwaysExpanded && "cursor-pointer hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <group.icon className="size-3.5" />
                      <span>{group.name}</span>
                    </div>
                    {!group.alwaysExpanded && (
                      isExpanded
                        ? <ChevronUp className="size-3" />
                        : <ChevronDown className="size-3" />
                    )}
                  </button>
                )}

                {/* Items */}
                {(isExpanded || isCollapsed) && (
                  <div className={cn("space-y-1", !isCollapsed && "mt-1")}>
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
      <div className="space-y-2 border-t border-border/60 p-2">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground",
            isCollapsed ? "justify-center px-2" : "justify-start px-3"
          )}
          size="sm"
        >
          <LogOut className="size-4 shrink-0" />
          {!isCollapsed && <span className="ml-2">Cerrar Sesión</span>}
        </Button>

        {!isCollapsed && (
          <p className="text-center text-xs uppercase tracking-[0.16em] text-muted-foreground/80">
            Centro de Operaciones
          </p>
        )}
      </div>
    </div>
  );

  // ── Mobile content (never collapsed) ──
  const MobileSidebarContent = () => (
    <div className="flex h-full flex-col border-r border-border/60 bg-card/95 backdrop-blur-xl">
      {/* Profile header */}
      <div
        className="flex items-center gap-3 border-b border-border/60 p-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
      >
        <Avatar className="size-10 shrink-0 border border-border/70 shadow-sm">
          <AvatarImage src={user?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
            {getUserInitials()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{getRoleLabel()}</p>
          <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
          <p className="truncate text-xs text-muted-foreground">{companyName}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Cerrar menú"
          className="size-8 shrink-0 rounded-full border border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" role="navigation" aria-label="Navegación principal">
        {navigationGroups.map(group => {
          const filteredItems = filterItems(group.items);
          if (filteredItems.length === 0) return null;
          const isExpanded = expandedGroups.includes(group.id) || group.alwaysExpanded;
          return (
            <div key={group.id} className="mb-4">
              <button
                onClick={() => !group.alwaysExpanded && toggleGroup(group.id)}
                aria-expanded={group.alwaysExpanded ? undefined : isExpanded}
                aria-label={`${group.name}${group.alwaysExpanded ? '' : isExpanded ? ' - colapsar' : ' - expandir'}`}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground",
                  !group.alwaysExpanded && "cursor-pointer hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <group.icon className="size-3.5" />
                  <span>{group.name}</span>
                </div>
                {!group.alwaysExpanded && (
                  isExpanded
                    ? <ChevronUp className="size-3" />
                    : <ChevronDown className="size-3" />
                )}
              </button>
              {isExpanded && (
                <div className="mt-1 space-y-1">
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
      <div className="space-y-2 border-t border-border/60 p-2">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start rounded-xl px-3 text-muted-foreground hover:bg-accent hover:text-foreground"
          size="sm"
        >
          <LogOut className="size-4 shrink-0" />
          <span className="ml-2">Cerrar Sesión</span>
        </Button>
        <p className="text-center text-xs uppercase tracking-[0.16em] text-muted-foreground/80">
          Centro de Operaciones
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay/50 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden h-screen transition-all duration-300 lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col",
        isCollapsed ? "lg:w-[4.5rem]" : "lg:w-72"
      )}>
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 lg:hidden h-[100dvh]",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <MobileSidebarContent />
      </div>
    </>
  );
};
