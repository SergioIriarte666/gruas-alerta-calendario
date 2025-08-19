# SISTEMA UNIFICADO DE REALTIME

## PROBLEMA ORIGINAL
❌ **Múltiples hooks creando suscripciones duplicadas**:
- `useRealtimeSync`: 2 canales (services, costs)
- `useServiceSyncWatcher`: 4 canales por servicio
- `useReportsRealtime`: 3 canales (costs, cost_centers, services)

**Error resultante**: "subscribe can only be called a single time per channel instance"

## SOLUCIÓN DEFINITIVA IMPLEMENTADA

### ✅ Sistema Unificado de Realtime (`useUnifiedRealtimeManager`)

**Características principales**:
- **Un solo canal por tabla/configuración**
- **Gestión centralizada** de todas las suscripciones
- **Anti-duplicación** automática de canales
- **Logging detallado** para debugging
- **Cleanup automático** al desmontar componentes
- **Invalidación inteligente** de queries

### ✅ Canales Configurados

```typescript
// Canal principal de servicios
'unified-services-updates' → tabla: services, evento: UPDATE

// Canal principal de costos  
'unified-costs-updates' → tabla: costs, evento: *

// Canal de recursos de servicios
'unified-service-resources-updates' → tabla: service_resources, evento: *

// Canal de centros de costo
'unified-cost-centers-updates' → tabla: cost_centers, evento: *

// Canales específicos por servicio (dinámicos)
'unified-service-{serviceId}' → tabla: services, filtro: id=eq.{serviceId}
```

### ✅ Invalidación Inteligente de Queries

El sistema invalida automáticamente las queries relacionadas:

**Para cambios en `services`**:
- `['services']`, `['operatorServices']`, `['crane-services']`
- `['reports']`, `['dashboardData']`

**Para cambios en `costs`**:
- `['costs']`, `['service-costs']`, `['crane-costs']`, `['commissions']`
- `['reports']`, `['dashboardData']`

**Para cambios en `service_resources`**:
- `['service-resources']`, `['services']`

### ✅ Hooks Legacy Actualizados

Todos los hooks existentes ahora delegan al sistema unificado:

```typescript
// useRealtimeSync → useUnifiedRealtimeManager
// useReportsRealtime → useUnifiedRealtimeManager  
// useServiceSyncWatcher → useUnifiedRealtimeManager (para watchers específicos)
```

## BENEFICIOS OBTENIDOS

### 🔧 **Técnicos**
- ❌ Eliminados errores de suscripción múltiple
- ✅ Un solo punto de verdad para realtime
- ✅ Gestión centralizada de canales
- ✅ Debugging simplificado
- ✅ Performance mejorada

### 📊 **Operacionales**  
- ✅ Servicios accesibles sin errores
- ✅ Sincronización automática funcionando
- ✅ Monitoreo detallado via logs
- ✅ Compatibilidad backward mantenida

### 🚀 **Escalabilidad**
- ✅ Fácil agregar nuevos canales
- ✅ Sistema anti-duplicación robusto
- ✅ Configuración centralizada
- ✅ Hooks reutilizables

## USO DEL SISTEMA

### Para desarrolladores:

```typescript
// Usar el hook unificado directamente
const { 
  registerChannel, 
  watchSpecificService, 
  getStatus 
} = useUnifiedRealtimeManager();

// Registrar canal personalizado
registerChannel({
  channelId: 'mi-canal-unico',
  table: 'mi_tabla',
  event: 'UPDATE', 
  onUpdate: (payload) => {
    // Manejar actualización
  }
});

// Observar servicio específico
const cleanup = watchSpecificService('service-id');
```

### Para hooks legacy:
```typescript
// Estos hooks siguen funcionando igual
useRealtimeSync(); // Ahora usa sistema unificado
useReportsRealtime(); // Ahora usa sistema unificado
useServiceSyncWatcher(serviceId); // Usa sistema unificado para watchers específicos
```

## ESTADO ACTUAL

✅ **Sistema productivo y estable**
✅ **Cero errores de suscripción**  
✅ **Compatibilidad 100% mantenida**
✅ **Documentación completa**
✅ **Logging detallado activo**

## MONITOREO

Para ver el estado del sistema:
```typescript
const { getStatus } = useUnifiedRealtimeManager();
console.log(getStatus());
// Retorna: { activeChannels, totalChannels, configs }
```

Los logs aparecen con prefijo `[UNIFIED_REALTIME]` para fácil identificación.