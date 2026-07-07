import { 
  LayoutDashboard, 
  Truck, 
  Landmark,
  Calendar, 
  FolderClosed, 
  Users, 
  HardHat, 
  Receipt, 
  DollarSign, 
  Package, 
  BarChart, 
  Percent, 
  Building, 
  Settings,
  FileText,
  MapPin,
  TrendingUp,
  Database,
  Archive,
  Smartphone,
  type LucideIcon
} from 'lucide-react';

export interface AppModule {
  key: string;
  label: string;
  icon: LucideIcon;
  description: string;
  defaultRoles: string[];
  route?: string;
}

export const APP_MODULES: AppModule[] = [
  { 
    key: 'dashboard', 
    label: 'Dashboard', 
    icon: LayoutDashboard, 
    description: 'Panel principal con métricas',
    defaultRoles: ['admin', 'viewer'],
    route: '/dashboard'
  },
  { 
    key: 'services', 
    label: 'Servicios', 
    icon: Truck, 
    description: 'Gestión de servicios',
    defaultRoles: ['admin', 'viewer'],
    route: '/services'
  },
  { 
    key: 'calendar', 
    label: 'Calendario', 
    icon: Calendar, 
    description: 'Calendario de servicios',
    defaultRoles: ['admin', 'viewer'],
    route: '/calendar'
  },
  { 
    key: 'closures', 
    label: 'Cierres', 
    icon: FolderClosed, 
    description: 'Cierres de servicios',
    defaultRoles: ['admin', 'viewer'],
    route: '/closures'
  },
  { 
    key: 'clients', 
    label: 'Clientes', 
    icon: Users, 
    description: 'Gestión de clientes',
    defaultRoles: ['admin', 'viewer'],
    route: '/clients'
  },
  { 
    key: 'operators', 
    label: 'Operadores', 
    icon: HardHat, 
    description: 'Gestión de operadores',
    defaultRoles: ['admin'],
    route: '/operators'
  },
  { 
    key: 'cranes', 
    label: 'Grúas', 
    icon: Truck, 
    description: 'Gestión de vehículos',
    defaultRoles: ['admin', 'viewer'],
    route: '/vehicles'
  },
  { 
    key: 'invoices', 
    label: 'Facturas', 
    icon: Receipt, 
    description: 'Facturación',
    defaultRoles: ['admin', 'viewer'],
    route: '/invoices'
  },
  { 
    key: 'costs', 
    label: 'Costos', 
    icon: DollarSign, 
    description: 'Gestión de costos',
    defaultRoles: ['admin', 'viewer'],
    route: '/costs'
  },
  { 
    key: 'inventory', 
    label: 'Inventario', 
    icon: Package, 
    description: 'Gestión de inventario',
    defaultRoles: ['admin', 'viewer', 'operator'],
    route: '/inventory'
  },
  {
    key: 'document-library',
    label: 'Biblioteca Documental',
    icon: Archive,
    description: 'Gestión documental del negocio',
    defaultRoles: ['admin', 'viewer'],
    route: '/document-library'
  },
  { 
    key: 'trip-calculator', 
    label: 'Cálculo de Viajes', 
    icon: MapPin, 
    description: 'Calculadora de costos de viaje',
    defaultRoles: ['admin', 'viewer'],
    route: '/trip-calculator'
  },
  { 
    key: 'reports', 
    label: 'Reportes', 
    icon: BarChart, 
    description: 'Reportes y estadísticas',
    defaultRoles: ['admin', 'viewer'],
    route: '/reports'
  },
  {
    key: 'income-projections',
    label: 'Proyección de Ingresos',
    icon: TrendingUp,
    description: 'Proyección y seguimiento de cobros pendientes',
    defaultRoles: ['admin', 'viewer'],
    route: '/income-projections'
  },
  { 
    key: 'commissions', 
    label: 'Comisiones', 
    icon: Percent, 
    description: 'Comisiones de operadores',
    defaultRoles: ['admin'],
    route: '/commissions'
  },
  { 
    key: 'suppliers', 
    label: 'Proveedores', 
    icon: Building, 
    description: 'Gestión de proveedores',
    defaultRoles: ['admin', 'viewer'],
    route: '/suppliers'
  },
  { 
    key: 'accounts-payable', 
    label: 'Cuentas por Pagar', 
    icon: Landmark, 
    description: 'Deudas, cuotas y obligaciones financieras',
    defaultRoles: ['admin', 'viewer'],
    route: '/accounts-payable'
  },
  { 
    key: 'service-rates', 
    label: 'Tarifas', 
    icon: FileText, 
    description: 'Tarifas de servicios',
    defaultRoles: ['admin'],
    route: '/service-rates'
  },
  {
    key: 'backup',
    label: 'Respaldos',
    icon: Database,
    description: 'Respaldos manuales y herramientas avanzadas de reparación',
    defaultRoles: ['admin'],
    route: '/backup'
  },
  {
    key: 'settings',
    label: 'Configuración',
    icon: Settings,
    description: 'Configuración del sistema',
    defaultRoles: ['admin'],
    route: '/settings'
  },
  {
    key: 'operator_portal',
    label: 'Portal Operador',
    icon: Smartphone,
    description: 'Acceso a la app/portal del operador (/operator)',
    defaultRoles: ['operator'],
    route: '/operator'
  },
];

export const getModuleByKey = (key: string): AppModule | undefined => {
  return APP_MODULES.find(m => m.key === key);
};

export const getModuleByRoute = (route: string): AppModule | undefined => {
  return APP_MODULES.find(m => m.route === route);
};
