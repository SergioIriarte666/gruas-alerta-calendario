
# Prompt de Desarrollo para el TMS v2.1.0

Este documento sirve como una guía o "prompt" para cualquier desarrollador (IA o humano) que trabaje en este proyecto TMS Grúas v2.1.0 con sistema completo de inventario. Su objetivo es asegurar la consistencia y calidad del código.

## 1. Contexto del Proyecto

- **Aplicación**: Sistema de Gestión de Transportes (TMS).
- **Objetivo**: Digitalizar y centralizar la gestión de servicios de grúas, incluyendo clientes, vehículos, operadores, costos, facturación y reportes.
- **Usuario Objetivo**: Personal administrativo de una empresa de servicios de grúas.

## 2. Stack Tecnológico y Convenciones

- **Core**: React, TypeScript, Vite.
- **UI**: Tailwind CSS y **siempre** priorizar componentes de **shadcn/ui**.
- **Iconos**: Exclusivamente de **lucide-react**.
- **Estado del Servidor**: **React Query** (`@tanstack/react-query`) es mandatorio para toda la interacción con la API de Supabase.
- **Formularios**: `react-hook-form` con validación mediante esquemas de `zod`.
- **Backend**: **Supabase**. Las interacciones se hacen con el cliente JS. Las modificaciones de schema se hacen vía migraciones SQL.

## 3. Guía de Estilo y Codificación

- **Componentes**:
  - Siempre funcionales, con hooks.
  - Nombrados en `PascalCase`.
  - Archivos `.tsx`.
  - Deben ser pequeños y enfocados en una sola responsabilidad.
- **Hooks**:
  - Nombrados en `camelCase` (ej. `useServices.ts`).
  - Encapsulan toda la lógica de un dominio.
- **Tipado**:
  - TypeScript es estricto. Evitar el uso de `any`.
  - Usar los tipos de `src/types` y los tipos generados de Supabase (`src/integrations/supabase/types.ts`).
- **Estilos**:
  - Usar clases de Tailwind CSS directamente en el JSX.
  - Para clases condicionales, usar `clsx` o `tailwind-merge` (ya incluidos en `lib/utils.ts`).

## 4. Flujo de Trabajo para Añadir una Nueva Funcionalidad

### Ejemplo: Sistema de Inventario (YA IMPLEMENTADO en v2.1.0)

1.  **Base de Datos (Supabase)**:
    - ✅ Tablas `inventory_items`, `inventory_stock`, `inventory_movements`, `inventory_alerts`
    - ✅ Políticas de RLS configuradas para roles
    - ✅ Triggers automáticos para actualización de stock

2.  **Tipos (TypeScript)**:
    - ✅ Interfaces en `src/types/inventory.ts`
    - ✅ Tipos de Supabase regenerados automáticamente

3.  **Hooks de Datos**:
    - ✅ `src/hooks/inventory/useInventoryItems.ts`
    - ✅ `src/hooks/inventory/useInventoryStock.ts`
    - ✅ `src/hooks/inventory/useInventoryMovements.ts`
    - ✅ `src/hooks/inventory/useInventoryAlerts.ts`

4.  **Componentes y Páginas**:
    - ✅ `src/pages/Inventory.tsx` - Página principal
    - ✅ `src/components/inventory/` - Componentes especializados
    - ✅ Sistema de tabs para organizar funcionalidades

5.  **Enrutamiento y Navegación**:
    - ✅ Ruta `/inventory` añadida
    - ✅ Enlace en sidebar con control de permisos

### Patrón para Nuevas Funcionalidades

Si necesitas añadir una nueva funcionalidad (ej. "Proveedores"):

1.  **Base de Datos**:
    - Diseñar la tabla `providers`
    - Crear migración SQL con RLS policies
    - Considerar relaciones con inventario si aplica

2.  **Tipos TypeScript**:
    - Añadir interfaz `Provider` en `src/types/index.ts`
    - Regenerar tipos de Supabase si es necesario

3.  **Hook de Datos**:
    - Crear `src/hooks/useProviders.ts`
    - Implementar CRUD con React Query

4.  **Componentes**:
    - Crear `src/pages/Providers.tsx`
    - Crear componentes en `src/components/providers/`

5.  **Navegación**:
    - Añadir ruta en `src/App.tsx`
    - Añadir enlace en sidebar con permisos

## 5. Principios Clave

- **Mantenlo Simple (KISS)**: No sobre-ingenierizar. Empezar con la solución más simple que funcione.
- **No te Repitas (DRY)**: Reutilizar lógica con hooks y componentes.
- **Responsivo por Defecto**: Todos los componentes y páginas deben ser usables en dispositivos móviles y de escritorio. Usar las variantes responsivas de Tailwind (`sm:`, `md:`, `lg:`).
- **La Experiencia de Usuario es Prioridad**: Las interfaces deben ser intuitivas, rápidas y accesibles. Utilizar `Skeleton` para estados de carga y `Toast` para notificaciones.

## 6. Estados de Servicios y Flujo de Facturación

### Estados de Servicios
- **pending**: Servicio programado, sin iniciar
- **in_progress**: Servicio en ejecución
- **completed**: Servicio terminado, disponible para cierre
- **cancelled**: Servicio cancelado
- **invoiced**: Servicio facturado (automático vía trigger)

### Flujo de Facturación
1. Servicios `completed` → Incluir en Cierre
2. Cierre `open` → `closed` → Generar Factura
3. Al crear factura → Trigger automático cambia servicios a `invoiced`
4. Servicios `invoiced` NO aparecen en futuros cierres

### Validaciones Críticas
- Solo servicios `completed` pueden incluirse en cierres
- Servicios ya en cierres anteriores no se muestran
- Servicios `invoiced` se excluyen automáticamente
- El trigger `update_service_status_on_invoice` mantiene consistencia

## 7. Servicios con Campos Opcionales

### Tipos de Servicio Especiales
Algunos tipos de servicio permiten información de vehículo opcional:
- **Taxi**: Transporte de pasajeros
- **Transporte de Materiales**: Materiales/suministros
- **Transporte de Suministros**: Diversos suministros

### Implementación
- Campo `vehicle_info_optional` en tabla `service_types`
- Validación condicional en formularios
- UI adaptativa que muestra campos como opcionales
- Manejo de valores `null` en base de datos

## 8. PWA y Portal del Operador

### Características PWA
- Service Worker para cache offline
- Manifest para instalación como app nativa
- Funcionalidad offline para operadores en terreno

### Portal del Operador
- Layout especializado (`OperatorLayout`)
- Solo servicios asignados al operador
- Inspecciones digitales con fotos y firmas
- Sincronización automática al recuperar conexión

## 9. Debugging y Logs

### Console Logs Extensivos
```typescript
// SIEMPRE incluir logs detallados
console.log('Service creation:', { serviceData, userId, timestamp });
console.log('Query result:', { data: data?.length, loading, error });
```

### Estados de Carga
- Usar `Skeleton` components de shadcn/ui
- Mostrar estados de error con `Toast`
- Indicadores de sincronización PWA

## 10. Mejores Prácticas de Código

### Hooks de Datos
```typescript
// Estructura estándar
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

### Componentes Reutilizables
- Crear archivos separados para cada componente
- Mantener componentes bajo 100 líneas
- Usar Props interfaces bien definidas
- Implementar loading y error states

### Validación de Formularios
```typescript
// Usar Zod para esquemas
const serviceSchema = z.object({
  folio: z.string().min(1),
  client_id: z.string().uuid(),
  // Validación condicional para vehículos
  vehicle_brand: z.string().optional(),
});
```

## 11. Sistema de Inventario - Patrones Específicos (v2.1.0)

### Hooks de Inventario
```typescript
// Patrón estándar para hooks de inventario
export const useInventoryItems = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: fetchInventoryItems,
  });

  const createItem = useMutation({
    mutationFn: createInventoryItemAPI,
    onSuccess: () => {
      queryClient.invalidateQueries(['inventory-items']);
      queryClient.invalidateQueries(['inventory-stock']);
    },
  });

  return { data, isLoading, error, createItem };
};
```

### Validación de Movimientos
```typescript
// Validación automática de stock antes de movimientos
const validateMovement = (movement: InventoryMovement) => {
  if (movement.movement_type === 'exit') {
    const availableStock = getAvailableStock(movement.item_id, movement.location_id);
    if (movement.quantity > availableStock) {
      throw new Error('Stock insuficiente para este movimiento');
    }
  }
};
```

### Sistema de Alertas
```typescript
// Evaluación automática de alertas después de movimientos
const evaluateAlertsAfterMovement = async (movement: InventoryMovement) => {
  const stockLevel = await getCurrentStock(movement.item_id, movement.location_id);
  const item = await getInventoryItem(movement.item_id);
  
  if (stockLevel.current_quantity < item.minimum_stock) {
    await triggerLowStockAlert(movement.item_id, movement.location_id);
  }
};
```

### Integración con Servicios
```typescript
// Registro automático de consumos por servicios
const registerServiceConsumption = (serviceId: string, items: ConsumedItem[]) => {
  items.forEach(item => {
    createInventoryMovement({
      item_id: item.id,
      movement_type: 'exit',
      quantity: item.consumed_quantity,
      reason: `Consumo por servicio ${serviceId}`,
      service_id: serviceId
    });
  });
};
```

## 12. Debugging de Inventario

### Console Logs Específicos
```typescript
// SIEMPRE incluir logs detallados para inventario
console.log('Inventory movement:', { 
  itemId, 
  movementType, 
  quantity, 
  currentStock, 
  newStock 
});

console.log('Alert evaluation:', { 
  itemId, 
  currentStock, 
  minimumStock, 
  alertTriggered 
});
```

### Validaciones Críticas
- Verificar stock disponible antes de salidas
- Validar que items existan antes de movimientos
- Comprobar permisos de usuario para cada operación
- Registrar trazabilidad completa de cambios

Esta documentación debe ser la referencia principal para mantener la consistencia del proyecto y asegurar que todas las funcionalidades críticas del sistema, incluyendo el nuevo módulo de inventario, funcionen correctamente.
