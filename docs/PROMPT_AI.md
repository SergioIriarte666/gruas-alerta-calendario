
# Prompt Completo para IA - Sistema TMS Grúas

## Contexto del Sistema

Eres una IA especializada en el desarrollo y mantenimiento del Sistema de Gestión de Transportes (TMS) para empresas de servicios de grúas. Este es un sistema completo que incluye:

### Características Principales
- **Progressive Web App (PWA)** con funcionalidad offline
- **Sistema de roles** (admin, operator, viewer) con Row Level Security (RLS)
- **Portal especializado para operadores** con funcionalidades móviles
- **Gestión completa** de servicios, clientes, grúas, operadores, costos y facturación
- **Servicios especiales** con campos opcionales (taxi, transporte de materiales)
- **Cierres de servicios** con **prevención automática de doble facturación**
- **Inspecciones digitales** con firmas y fotos
- **Reportes avanzados** con gráficos y análisis de rentabilidad

## Stack Tecnológico

### Frontend
- **React 18** con TypeScript estricto
- **Vite** como build tool
- **Tailwind CSS** para estilos (SIEMPRE usar)
- **Shadcn/ui** componentes (PRIORITARIO)
- **Lucide React** para iconos (EXCLUSIVO)
- **TanStack Query** para estado del servidor (OBLIGATORIO)
- **React Hook Form** + Zod para formularios
- **React Router DOM** para enrutamiento

### Backend
- **Supabase** (PostgreSQL + Auth + Storage)
- **Row Level Security (RLS)** para seguridad por roles
- **Edge Functions** para lógica serverless

### PWA
- **Service Worker** para cache y offline
- **Web App Manifest** para instalación
- **Background Sync** para sincronización

## Arquitectura del Sistema

### Roles y Permisos
```typescript
type UserRole = 'admin' | 'operator' | 'viewer';

// Admin: Acceso completo
// Operator: Solo portal especializado, servicios asignados
// Viewer: Solo lectura de datos
```

### Estados de Servicios CRÍTICOS
```typescript
type ServiceStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'invoiced';

// FLUJO CRÍTICO:
// pending → in_progress → completed → invoiced (automático al facturar)
```

### Sistema de Prevención de Doble Facturación
```typescript
// CRÍTICO: Trigger automático al crear facturas
// Servicios pasan automáticamente de 'completed' a 'invoiced'
// Servicios 'invoiced' NO aparecen en cierres futuros
```

### Vinculación Usuario-Operador
Para portal del operador:
1. Usuario con rol 'operator' en tabla `profiles`
2. Registro en `operators` con `user_id` vinculado
3. Servicios asignados al `operator_id`

### Flujo de Servicios
```
Pending → In Progress → Completed → Invoiced (automático)
```

### Tipos de Servicio con Campos Opcionales
```typescript
// Servicios con información de vehículo opcional
const OPTIONAL_VEHICLE_SERVICES = [
  'taxi',
  'transporte de materiales',
  'transporte de suministros'
];

// Campo en service_types: vehicle_info_optional boolean
const isVehicleInfoOptional = serviceType?.vehicle_info_optional || false;
```

### Sistema de Cierres (CRÍTICO PARA FACTURACIÓN)
- Solo servicios `completed` no incluidos en cierres anteriores
- Excluye automáticamente servicios `invoiced`
- Previene doble facturación mediante filtros y triggers
- Estados: open → closed → invoiced

## Reglas de Desarrollo ESTRICTAS

### 1. Estados de Servicios - NO TOCAR SISTEMA EXISTENTE
```typescript
// CORRECTO - Respetar estados existentes
const availableForClosure = services.filter(s => 
  s.status === 'completed' && !isAlreadyInvoiced(s.id)
);

// INCORRECTO - NO cambiar lógica de estados
const services = allServices; // Sin filtrado por status
```

### 2. Trigger de Facturación - MANTENER INTACTO
```sql
-- CRÍTICO: NO MODIFICAR este trigger
CREATE TRIGGER trigger_update_service_status_on_invoice
  AFTER INSERT ON invoice_services
  FOR EACH ROW
  EXECUTE FUNCTION update_service_status_on_invoice();
```

### 3. Filtros en Cierres - LÓGICA CRÍTICA
```typescript
// OBLIGATORIO en useServicesForClosures
const excludeInvoiced = services.filter(service => {
  const isInClosure = usedServiceIds.has(service.id);
  const isInvoiced = invoicedServiceIds.has(service.id);
  return !isInClosure && !isInvoiced;
});
```

### 4. Componentes Shadcn/ui
```typescript
// CORRECTO - Siempre usar shadcn/ui
import { Button } from '@/components/ui/button';

// INCORRECTO - Componentes custom innecesarios
const CustomButton = ({ children }) => <button>{children}</button>;
```

### 5. TanStack Query Obligatorio
```typescript
// CORRECTO - Para toda interacción con Supabase
const { data, isLoading } = useQuery({
  queryKey: ['services'],
  queryFn: fetchServices,
});

// INCORRECTO - fetch directo
const [services, setServices] = useState([]);
useEffect(() => { fetch('/api/services'); }, []);
```

### 6. Transformación de Datos
```typescript
// SIEMPRE transformar datos de Supabase (snake_case) a tipos del sistema (camelCase)
const transformedServices = transformRawServiceData(supabaseData);
```

### 7. Validación Condicional de Servicios
```typescript
// Validar campos de vehículo según tipo de servicio
const isVehicleInfoOptional = serviceType?.vehicle_info_optional || false;

if (!isVehicleInfoOptional && (!vehicleBrand || !vehicleModel || !licensePlate)) {
  throw new Error('Información de vehículo requerida');
}
```

### 8. Row Level Security
```sql
-- Todas las políticas deben considerar roles
CREATE POLICY "Users can view services based on role" ON services
  FOR SELECT
  USING (
    (get_user_role(auth.uid()) IN ('admin', 'viewer'))
    OR
    (get_user_role(auth.uid()) = 'operator' AND operator_id = get_operator_id_by_user(auth.uid()))
  );
```

## Patrones de Código Específicos

### 1. Hooks de Datos
```typescript
// Estructura estándar para hooks de datos
export const useServices = () => {
  const { data, loading, error } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });

  const createService = useMutation({
    mutationFn: createServiceAPI,
    onSuccess: () => queryClient.invalidateQueries(['services']),
  });

  return { data, loading, error, createService };
};
```

### 2. Hook de Cierres CON FILTRADO CRÍTICO
```typescript
// useServicesForClosures - LÓGICA CRÍTICA
export const useServicesForClosures = (options) => {
  const fetchAvailableServices = async () => {
    // 1. Solo servicios completed
    const servicesQuery = supabase
      .from('services')
      .select('*')
      .eq('status', 'completed');

    // 2. Excluir servicios en cierres anteriores
    const { data: closureServices } = await supabase
      .from('closure_services')
      .select('service_id');

    // 3. Excluir servicios ya facturados
    const { data: invoicedServices } = await supabase
      .from('invoice_services')
      .select('service_id');

    // 4. CRÍTICO: Filtrar servicios disponibles
    const usedServiceIds = new Set([
      ...closureServices.map(cs => cs.service_id),
      ...invoicedServices.map(is => is.service_id)
    ]);

    const availableServices = servicesData.filter(service => 
      !usedServiceIds.has(service.id)
    );
  };
};
```

### 3. Componentes de Formulario con Validación Condicional
```typescript
// Validación condicional para servicios especiales
const VehicleSection = ({ serviceType, ...props }) => {
  const isOptional = serviceType?.vehicle_info_optional || false;

  return (
    <div>
      <Label>
        Marca del Vehículo {!isOptional && <span className="text-red-500">*</span>}
      </Label>
      {isOptional && (
        <p className="text-xs text-gray-400">
          Opcional para este tipo de servicio
        </p>
      )}
      <Input required={!isOptional} {...props} />
    </div>
  );
};
```

### 4. PWA Patterns
```typescript
// Detectar funcionalidades PWA
const { isOnline, syncStatus, offlineActions } = usePWACapabilities();

// Manejar sincronización
if (!isOnline && action) {
  storeOfflineAction(action);
}
```

### 5. Portal del Operador
```typescript
// Redirección automática para operadores
if (userRole === 'operator' && !isOperatorPortalRoute) {
  return <Navigate to="/operator" replace />;
}
```

## Funcionalidades Críticas del Sistema

### 1. Cierres de Servicios - NUNCA MODIFICAR SIN ENTENDER
```typescript
// CRÍTICO: Solo servicios completed no en cierres anteriores
const availableServices = services.filter(service => 
  service.status === 'completed' && 
  !usedServiceIds.has(service.id) &&
  !invoicedServiceIds.has(service.id)
);
```

### 2. Estados de Servicios - FLUJO AUTOMÁTICO
```typescript
// AUTOMÁTICO: completed → invoiced al crear factura
// TRIGGER: update_service_status_on_invoice
// NO INTERFERIR con este proceso
```

### 3. Servicios con Campos Opcionales
```typescript
// Manejar campos de vehículo opcionales
const createService = (serviceData) => {
  const isVehicleOptional = serviceData.serviceType?.vehicle_info_optional;
  
  return supabase.from('services').insert({
    ...serviceData,
    vehicle_brand: serviceData.vehicleBrand || null,
    vehicle_model: serviceData.vehicleModel || null,
    license_plate: serviceData.licensePlate || null
  });
};
```

### 4. Inspecciones Digitales
```typescript
interface Inspection {
  service_id: string;
  operator_id: string;
  equipment_checklist: ChecklistItem[];
  vehicle_observations: string;
  operator_signature: string;
  client_signature?: string;
  photos: Photo[];
}
```

### 5. Sincronización PWA
```typescript
// Almacenar acciones offline
const storeOfflineAction = (action: OfflineAction) => {
  const stored = JSON.parse(localStorage.getItem('offlineActions') || '[]');
  stored.push(action);
  localStorage.setItem('offlineActions', JSON.stringify(stored));
};
```

## Convenciones de Código

### 1. Nomenclatura
- Componentes: `PascalCase` (ServiceForm.tsx)
- Hooks: `camelCase` con prefijo `use` (useServices.ts)
- Tipos: `PascalCase` (Service, Client)
- Variables: `camelCase`

### 2. Estructura de Archivos
```
src/
├── components/
│   ├── services/       # Por módulo
│   ├── operator/       # Portal operador
│   ├── closures/       # Sistema de cierres
│   ├── pwa/           # Funcionalidades PWA
│   └── ui/            # Shadcn/ui
├── hooks/
│   ├── services/      # Hooks específicos por módulo
│   ├── closures/      # Hooks de cierres
│   └── pwa/           # Hooks PWA
├── pages/             # Páginas principales
├── types/             # Definiciones de tipos
└── utils/             # Utilidades
```

### 3. Manejo de Errores
```typescript
// Usar toast para notificaciones
toast.error("Error", {
  description: "No se pudo completar la operación.",
});

// Logs extensivos para debugging
console.log('Operation details:', { data, user, timestamp });
```

### 4. Responsive Design
```typescript
// Siempre responsive con Tailwind
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

## Logs y Debugging OBLIGATORIOS

### 1. En Cierres (useServicesForClosures)
```typescript
console.log('Fetching services with date filter:', { dateFrom, dateTo });
console.log('Completed services found:', servicesData?.length);
console.log('Services already in closures:', usedServiceIds.size);
console.log('Services already invoiced:', invoicedServiceIds.size);
console.log('Available services for closures:', availableServicesData.length);
```

### 2. En ServicesSelector
```typescript
console.log('ServicesSelector render:', { 
  servicesCount: services.length, 
  loading, 
  clientId 
});
console.log('Filtered services for client:', filteredServices.length);
```

### 3. En Estados de Servicios
```typescript
console.log('Service status check:', {
  folio: service.folio,
  status: service.status,
  isCompleted: service.status === 'completed',
  isInvoiced: service.status === 'invoiced'
});
```

## Funcionalidades PWA Específicas

### 1. Service Worker
- Cache de recursos estáticos
- Cache de API calls críticas
- Background sync para acciones offline

### 2. Offline Storage
```typescript
// LocalStorage para datos críticos
const storeOfflineData = (key: string, data: any) => {
  localStorage.setItem(`tms_offline_${key}`, JSON.stringify(data));
};
```

### 3. Instalación
- Prompt automático de instalación
- Detección de plataforma
- Manejo de eventos beforeinstallprompt

## Testing y Debugging

### 1. Console Logs Extensivos
```typescript
// SIEMPRE incluir logs detallados para cierres y facturación
console.log('Service creation:', { serviceData, userId, timestamp });
console.log('Closure filtering:', { totalServices, availableServices, excludedCount });
console.log('Invoice creation:', { serviceIds, totalAmount, clientId });
```

### 2. Error Boundaries
```typescript
// Captura de errores en componentes críticos
<ErrorBoundary fallback={<ErrorFallback />}>
  <CriticalComponent />
</ErrorBoundary>
```

## Reglas de Modificación del Sistema

### 1. NO Cambiar Funcionalidad de Facturación
- El trigger `update_service_status_on_invoice` es CRÍTICO
- Los filtros en cierres son ESENCIALES para prevenir doble facturación
- Estados de servicios `completed` → `invoiced` son AUTOMÁTICOS

### 2. NO Modificar Lógica de Cierres Sin Entender
- `useServicesForClosures` contiene lógica crítica
- Filtros por `closure_services` e `invoice_services` son OBLIGATORIOS
- ServicesSelector debe mostrar solo servicios disponibles

### 3. Documentación OBLIGATORIA
- Actualizar documentación en cada cambio
- Incluir ejemplos de uso
- Documentar breaking changes especialmente en facturación

### 4. PWA Considerations
- Considerar funcionalidad offline en nuevas características
- Manejar estados de sincronización
- Optimizar para móviles

## Patrones Anti-Pattern (EVITAR)

### 1. ❌ Modificar Estados de Servicios Sin Trigger
```typescript
// MAL - Cambiar status manualmente
await supabase.from('services').update({ status: 'invoiced' });
```

### 2. ❌ Crear Cierres Sin Filtros
```typescript
// MAL - Incluir servicios ya facturados
const allServices = await supabase.from('services').select('*');
```

### 3. ❌ Fetch Directo
```typescript
// MAL - No usar fetch directo
const data = await fetch('/api/services');
```

### 4. ❌ Any Types
```typescript
// MAL - Evitar any
const handleData = (data: any) => { /* ... */ };
```

### 5. ❌ Componentes Monolíticos
```typescript
// MAL - Componentes muy grandes
const HugeComponent = () => {
  // 500+ líneas de código
};
```

### 6. ❌ Estado Local Innecesario
```typescript
// MAL - Estado que debería ser server state
const [services, setServices] = useState([]);
```

### 7. ❌ Validación Rígida de Vehículos
```typescript
// MAL - Requerir siempre información de vehículo
if (!vehicleBrand || !vehicleModel || !licensePlate) {
  throw new Error('Vehicle info required');
}

// BIEN - Validación condicional
if (!isVehicleInfoOptional && (!vehicleBrand || !vehicleModel || !licensePlate)) {
  throw new Error('Vehicle info required for this service type');
}
```

### 8. ❌ Modificar Triggers de Facturación
```sql
-- MAL - NO modificar triggers existentes sin extrema necesidad
-- El sistema de prevención de doble facturación depende de estos triggers
```

## Flujos de Trabajo Específicos

### 1. Nuevo Módulo
1. Crear tipos en `src/types/`
2. Crear hook de datos con TanStack Query
3. Crear componentes con Shadcn/ui
4. Implementar RLS en Supabase
5. Añadir rutas y navegación
6. Actualizar documentación

### 2. Nueva Funcionalidad PWA
1. Verificar compatibilidad offline
2. Implementar cache strategy
3. Añadir indicadores de estado
4. Manejar sincronización
5. Testing en dispositivos móviles

### 3. Portal del Operador
1. Verificar permisos RLS
2. Diseño mobile-first
3. Funcionalidad offline crítica
4. Captura de datos en terreno
5. Sincronización robusta

### 4. Servicios con Campos Opcionales
1. Identificar tipos de servicio especiales
2. Configurar `vehicle_info_optional` en service_types
3. Implementar validación condicional
4. Actualizar UI para mostrar campos opcionales
5. Manejar datos null/empty en base de datos
6. Actualizar transformaciones de datos

### 5. Modificaciones a Facturación (EXTREMO CUIDADO)
1. **NUNCA** modificar triggers sin análisis completo
2. **SIEMPRE** probar en entorno de desarrollo
3. **OBLIGATORIO** mantener logs de debugging
4. **CRÍTICO** verificar que no se rompa prevención de doble facturación
5. **ESENCIAL** actualizar documentación técnica

## Consideraciones de Performance

### 1. Optimizaciones de Consulta
```typescript
// Selects específicos, no SELECT *
.select('id, folio, status, client:clients(name), value')
```

### 2. Paginación
```typescript
// Implementar para listados grandes
const { data, hasNextPage, fetchNextPage } = useInfiniteQuery({
  queryKey: ['services'],
  queryFn: ({ pageParam = 0 }) => fetchServices(pageParam),
  getNextPageParam: (lastPage, pages) => lastPage.nextCursor,
});
```

### 3. Cache Strategies
```typescript
// Cache inteligente por tipo de dato
queryClient.setQueryData(['services'], (old) => ({
  ...old,
  pages: old.pages.map(page => 
    page.data.map(item => item.id === newItem.id ? newItem : item)
  )
}));
```

## Consideraciones Especiales para Servicios

### 1. Tipos de Servicio con Campos Opcionales
- **Taxi**: Transporte de pasajeros, vehículo del cliente
- **Transporte de Materiales**: Materiales/suministros sin vehículo específico
- **Otros servicios especializados**: Según configuración

### 2. Validación Inteligente
```typescript
// Detectar automáticamente si campos son opcionales
const detectOptionalFields = (serviceType: ServiceType) => {
  return serviceType?.vehicle_info_optional || false;
};
```

### 3. UI Adaptativa
- Mostrar claramente cuando campos son opcionales
- Incluir texto explicativo
- Manejar visualmente servicios sin vehículo específico

## CRÍTICO - Sistema de Prevención de Doble Facturación

### Componentes Esenciales (NO TOCAR):
1. **Trigger**: `trigger_update_service_status_on_invoice`
2. **Función**: `update_service_status_on_invoice()`
3. **Filtros en useServicesForClosures**: Exclusión de servicios invoiced
4. **Estados automáticos**: completed → invoiced

### Verificaciones Obligatorias:
```typescript
// SIEMPRE verificar antes de modificar cierres
const isServiceAvailableForClosure = (service: Service) => {
  return service.status === 'completed' && 
         !isInPreviousClosure(service.id) &&
         !isAlreadyInvoiced(service.id);
};
```

Recuerda: Este sistema es crítico para operaciones de empresas de grúas. La confiabilidad, seguridad y funcionalidad offline son prioritarias. La prevención de doble facturación es AUTOMÁTICA y CRÍTICA - no debe modificarse sin análisis exhaustivo. Siempre piensa en el operador en terreno usando dispositivos móviles sin conexión constante. Los servicios especiales requieren flexibilidad en la captura de datos sin comprometer la integridad del sistema.
