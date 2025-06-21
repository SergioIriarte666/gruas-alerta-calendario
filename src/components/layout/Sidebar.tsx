import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Calendar,
  Truck,
  Users,
  Building2,
  Wrench,
  DollarSign,
  FileText,
  Receipt,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Tags
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
  const location = useLocation();

  const isOperator = user?.role === 'operator';
  const isAdmin = user?.role === 'admin';

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, adminOnly: false },
    { name: 'Calendario', href: '/calendar', icon: Calendar, adminOnly: false },
    { name: 'Servicios', href: '/services', icon: Truck, adminOnly: false },
    { name: 'Tipos de Servicio', href: '/service-types', icon: Tags, adminOnly: true },
    { name: 'Clientes', href: '/clients', icon: Users, adminOnly: false },
    { name: 'Grúas', href: '/cranes', icon: Building2, adminOnly: false },
    { name: 'Operadores', href: '/operators', icon: Wrench, adminOnly: false },
    { name: 'Costos', href: '/costs', icon: DollarSign, adminOnly: false },
    { name: 'Cierres', href: '/closures', icon: FileText, adminOnly: false },
    { name: 'Facturas', href: '/invoices', icon: Receipt, adminOnly: false },
    { name: 'Reportes', href: '/reports', icon: BarChart3, adminOnly: false },
    { name: 'Configuración', href: '/settings', icon: Settings, adminOnly: false },
  ];

  const filteredNavigation = navigationItems.filter(item => 
    !item.adminOnly || isAdmin
  );

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!isCollapsed && (
          <div className="flex items-center space-x-3">
            <Building2 className="w-8 h-8 text-tms-green" />
            <h1 className="text-xl font-bold text-white">TMS Grúas</h1>
          </div>
        )}
        
        {/* Desktop collapse button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex text-gray-300 hover:text-white hover:bg-gray-800"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>

        {/* Mobile close button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMobileMenuOpen(false)}
          className="lg:hidden text-gray-300 hover:text-white hover:bg-gray-800"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {filteredNavigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive: linkIsActive }) => cn(
              "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              "hover:bg-gray-800 hover:text-white",
              linkIsActive || isActive(item.href)
                ? "bg-tms-green text-white"
                : "text-gray-300"
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <item.icon className={cn("w-5 h-5", isCollapsed ? "mx-auto" : "mr-3")} />
            {!isCollapsed && <span>{item.name}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-gray-700">
        {!isCollapsed && user && (
          <div className="mb-3">
            <p className="text-sm font-medium text-white">{user.name}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
            <p className="text-xs text-tms-green capitalize">{user.role}</p>
          </div>
        )}
        
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full text-gray-300 hover:text-white hover:bg-gray-800",
            isCollapsed ? "px-2" : "justify-start"
          )}
        >
          <LogOut className={cn("w-4 h-4", isCollapsed ? "mx-auto" : "mr-2")} />
          {!isCollapsed && "Cerrar Sesión"}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden" 
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 bg-gray-900 border-r border-gray-700 transition-all duration-300",
        isCollapsed ? "lg:w-16" : "lg:w-64"
      )}>
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-700 transform transition-transform duration-300 lg:hidden",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </div>
    </>
  );
};
