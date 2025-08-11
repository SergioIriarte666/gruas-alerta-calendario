# Prompt Completo para IA - TMS Grúas v2.1.0

## 📝 Descripción del Sistema

TMS Grúas es un sistema integral de gestión para empresas de servicios de grúas desarrollado en React + TypeScript + Supabase. Incluye gestión completa de servicios, clientes, operadores, inventario, facturación y un portal independiente para clientes.

**Versión Actual**: 2.1.0 (Enero 2025)
**Nueva Funcionalidad Principal**: Sistema completo de gestión de inventario y bodega + Gestión de vehículos

## 🏗️ Arquitectura Técnica Actual

### Stack Tecnológico
```typescript
// Frontend
- React 18.3.1 con TypeScript
- Vite como bundler
- TailwindCSS para estilos (sistema semántico con HSL)
- Shadcn/ui como base de componentes
- React Query (@tanstack/react-query) para estado del servidor
- React Hook Form + Zod para formularios y validación
- Lucide React para iconografía
- React Router DOM para navegación

// Backend
- Supabase como backend completo
- PostgreSQL con Row Level Security (RLS)
- Autenticación integrada
- Storage para archivos
- Edge Functions para lógica custom

// PWA
- Capacidades offline
- Instalable como app nativa
- Optimizado para móviles
```

## 📊 Funcionalidades Principales v2.1.0

### Sistema de Inventario Completo (NUEVO)
- **Gestión de productos**: Catálogo completo con categorización
- **Control de stock**: Stock en tiempo real por ubicación
- **Movimientos de inventario**: Entradas, salidas, ajustes, transferencias
- **Sistema de alertas automáticas**: Stock bajo, sobrestock, sin movimiento
- **Integración con servicios**: Consumo automático durante servicios
- **Reportes avanzados**: Valorización, análisis de consumo, rotación
- **Gestión de proveedores**: Base de datos completa
- **Trazabilidad**: Historial completo de cada movimiento

### Gestión de Vehículos (NUEVO)
- **Gestión de marcas**: CRUD completo de marcas de vehículos
- **Gestión de modelos**: Modelos organizados por marca
- **Sistema de activación**: Control de elementos activos/inactivos
- **Integración con servicios**: Datos disponibles en formularios
- **Interface organizada**: Navegación por tabs entre marcas y modelos

## 🔧 Hooks Principales

### Inventario
```typescript
useInventoryItems() // Catálogo de productos
useInventoryStock() // Control de stock
useInventoryMovements() // Movimientos
useInventoryAlerts() // Sistema de alertas
useInventoryStats() // Estadísticas
```

### Vehículos
```typescript
useVehicleBrands() // Gestión de marcas
useVehicleModels() // Gestión de modelos
```

## 🎨 Sistema de Design Tokens

### Colores Semánticos (HSL)
```css
--primary: 210 100% 50%        /* Azul principal */
--success: 142 76% 36%         /* Verde para completado */
--warning: 45 93% 47%          /* Amarillo para pendiente */
--destructive: 0 84% 60%       /* Rojo para errores */
--inventory-low: 0 84% 60%     /* Stock bajo */
--inventory-normal: 142 76% 36% /* Stock normal */
--inventory-high: 45 93% 47%   /* Sobrestock */
```

## 📱 Patrones de Desarrollo

### Responsive Design
```typescript
// Hooks responsive
useDeviceType() // → 'mobile' | 'tablet' | 'desktop'
useBreakpoint() // → { isMobile, isTablet, isDesktop }

// Mobile-first approach
const { isMobile } = useBreakpoint()
return isMobile ? <MobileView /> : <DesktopView />
```

### Form Patterns con Zod
```typescript
const inventoryItemSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido'),
  category_id: z.string().uuid('Categoría es requerida'),
  minimum_stock: z.number().min(0, 'Debe ser mayor a 0'),
})
```

## 🚨 Sistema de Alertas Inteligente

### Tipos de Alertas
```typescript
type AlertType = 
  | 'low_stock'           // Stock bajo
  | 'overstock'           // Sobrestock
  | 'no_movement'         // Sin movimiento
  | 'expiring_products'   // Productos próximos a vencer
  | 'document_expiry'     // Documentos venciendo
  | 'payment_overdue'     // Pagos vencidos
```

## 📋 Convenciones de Código

### Nomenclatura
```typescript
// Componentes: PascalCase
InventoryMovementForm.tsx
VehicleBrandsManager.tsx

// Hooks: camelCase con 'use'
useInventoryItems.ts
useVehicleBrands.ts

// Páginas: PascalCase
Inventory.tsx
Vehicles.tsx
```

### Debug y Logging
```typescript
// Console logs estructurados para desarrollo
console.log('🔍 Inventory Movement:', {
  type: movementType,
  item: itemName,
  quantity,
  location: locationName,
  timestamp: new Date().toISOString()
})

console.log('🚗 Vehicle Operation:', {
  operation: 'create_brand',
  brand: brandName,
  user: userId
})
```

## 📝 Notas de Implementación Importantes

### Sistema de Inventario
- **Triggers de actualización**: Stock se actualiza automáticamente con movimientos
- **Evaluación de alertas**: Proceso en tiempo real con caching inteligente
- **Integración con servicios**: Consumo automático durante ejecución de servicios
- **Trazabilidad completa**: Cada movimiento con metadata completa

### Gestión de Vehículos
- **Soft delete**: Marcas/modelos se marcan como inactivos, no se eliminan
- **Validación de unicidad**: Nombres únicos por contexto (marca/modelo)
- **Integración**: Datos disponibles inmediatamente en formularios de servicios

### Performance
- **React Query**: Caching inteligente con stale time apropiado
- **Lazy loading**: Componentes cargados bajo demanda
- **Optimistic updates**: Para mejor UX en operaciones CRUD
- **Pagination**: En listas grandes de datos

### Seguridad
- **RLS**: Todas las tablas con políticas de seguridad apropiadas
- **Validación**: Cliente y servidor con Zod schemas
- **Sanitización**: Inputs sanitizados antes de almacenar
- **Audit trail**: Logging de operaciones críticas

## 📞 Contexto de Soporte

### Información para IA
- **Siempre usar semantic tokens** para colores y espaciado
- **Priorizar mobile-first** en cualquier UI nueva
- **Seguir patrones existentes** de hooks y componentes
- **Validación completa** con Zod en todos los formularios
- **Logging estructurado** para debug efectivo
- **RLS apropiada** para cualquier tabla nueva
- **Optimistic updates** para mejor UX
- **Error handling consistente** con toast notifications

### Debugging Común
1. **Problemas de permisos**: Verificar RLS policies
2. **Datos no actualizados**: Invalidar queries apropiadas
3. **Errores de validación**: Verificar Zod schemas
4. **UI rota en mobile**: Verificar responsive classes
5. **Performance lenta**: Revisar React Query settings

¡Este prompt debe permitir a cualquier IA trabajar efectivamente con el sistema TMS Grúas v2.1.0!