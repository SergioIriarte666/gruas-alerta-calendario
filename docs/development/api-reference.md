# Referencia Completa de APIs y Hooks - TMS Grúas v2.1.0
## Documentación Técnica Actualizada - Julio 2025

## 📦 Hooks de Inventario (NUEVO v2.1.0)

### Productos
```typescript
useInventoryItems(filters?: ItemFilters)
useCreateInventoryItem()
useUpdateInventoryItem()
useDeleteInventoryItem()
```

### Stock
```typescript
useInventoryStock(filters?: StockFilters)
useStockByItem(itemId: string)
useStockLevels()
```

### Movimientos
```typescript
useInventoryMovements(filters?: MovementFilters)
useCreateMovement()
useMovementHistory(itemId: string)
```

### Alertas
```typescript
useInventoryAlerts()
useCreateAlert()
useUpdateAlert()
useAlertEvaluation()
```

## 🚗 Hooks de Vehículos (NUEVO v2.1.0)

### Marcas
```typescript
useVehicleBrands()
useCreateVehicleBrand()
useUpdateVehicleBrand()
useDeleteVehicleBrand()
```

### Modelos
```typescript
useVehicleModels(brandId?: string)
useCreateVehicleModel()
useUpdateVehicleModel()
useDeleteVehicleModel()
```

## 🚚 Hooks de Servicios

```typescript
useServices(filters?: ServiceFilters)
useServiceById(id: string)
useCreateService()
useUpdateService()
useDeleteService()
useFutureServices()
useServiceHistory(licensePlate: string)
```

## 👥 Hooks de Clientes

```typescript
useClients(filters?: ClientFilters)
useClientById(id: string)
useCreateClient()
useClientHistory(clientId: string)
```

## 👷 Hooks de Operadores

```typescript
useOperators()
useOperatorById(id: string)
useCreateOperator()
useOperatorServices(operatorId: string)
```

## 🚛 Hooks de Grúas

```typescript
useCranes()
useCraneById(id: string)
useCreateCrane()
useCraneDocuments(craneId: string)
useCraneMaintenance(craneId: string)
```

## 💰 Hooks de Facturación

```typescript
useInvoices(filters?: InvoiceFilters)
useCreateInvoice()
useServiceClosures()
useCreateServiceClosure()
```

## 💸 Hooks de Costos

```typescript
useCosts(filters?: CostFilters)
useCreateCost()
useCostCategories()
useCostCenters()
```

## ⚙️ Hooks de Configuración

```typescript
useCompanyData()
useUpdateCompanyData()
useSystemSettings()
useServiceTypes()
```

## 🔐 Hooks de Autenticación

```typescript
useAuth()
useProfile()
useUserRole()
```

## 🛠️ Hooks Utility

```typescript
useDeviceType()
useBreakpoint()
useLocalStorage<T>(key: string, defaultValue: T)
useDebounce<T>(value: T, delay: number)
usePermissions()
```

## 🔐 Hooks de Autenticación y Seguridad

### Sistema de Autenticación
```typescript
useAuth()                    // Hook principal de autenticación
useProfile()                 // Perfil del usuario actual  
useUserRole()                // Rol y permisos del usuario
useSessionVerifier()         // Verificación de sesiones activas
usePermissions()             // Control granular de permisos
```

### Gestión de Sesiones
```typescript
useAuthRefresh()             // Refresh automático de tokens
useAuthCleanup()             // Limpieza de sesiones inválidas
useAuthRedirect()            // Redirección post-autenticación
```

## 🌐 Hooks de Conectividad y Estado

### Estado de la Aplicación
```typescript
useOnlineStatus()            // Estado de conectividad
useRealtimeSubscription()    // Suscripciones WebSocket
useErrorBoundary()           // Manejo de errores globales
useLoadingState()            // Estados de carga centralizados
```

### Notificaciones
```typescript
useNotifications()           // Sistema de notificaciones
useNotificationTriggers()    // Triggers automáticos
usePushNotifications()       // Push notifications PWA
useToast()                   // Notificaciones toast
```

## 📊 Hooks de Datos y Análisis

### Métricas y Dashboards
```typescript
useDashboardMetrics()        // Métricas del dashboard principal
useRealtimeMetrics()         // Métricas en tiempo real
useServiceMetrics()          // Métricas específicas de servicios
useInventoryMetrics()        // Métricas de inventario
```

### Reportes Avanzados
```typescript
useReportGenerator()         // Generador de reportes dinámicos
useExcelExport()             // Exportación a Excel
usePDFGenerator()            // Generación de PDFs
useChartData()               // Datos para gráficos
```

## 🔄 Hooks de Integración

### Mapeo de Datos
```typescript
useDataMapper()              // Sistema de mapeo principal
useEntityFinders()           // Búsqueda de entidades
useDataValidation()          // Validación de datos
useImportProcessor()         // Procesamiento de importaciones
```

### APIs Externas
```typescript
useEmailService()            // Integración con Resend
useFileUpload()              // Upload de archivos
useGeolocation()             // Servicios de geolocalización
```

## 🎨 Hooks de UI y UX

### Responsive Design
```typescript
useDeviceType()              // Detección de tipo de dispositivo
useBreakpoint()              // Breakpoints responsive
useViewport()                // Dimensiones del viewport
useTouchDevice()             // Detección de dispositivos táctiles
```

### Interacciones
```typescript
useKeyboardShortcuts()       // Atajos de teclado
useDragAndDrop()             // Funcionalidad drag & drop
useModal()                   // Control de modales
useSearch()                  // Búsquedas en tiempo real
```

## 📈 Hooks de Performance

### Optimización
```typescript
useDebounce()                // Debounce para optimización
useThrottle()                // Throttle para eventos
useMemoizedCallback()        // Callbacks optimizados
useVirtualization()          // Virtualización de listas
```

### Cache y Storage
```typescript
useLocalStorage()            // Persistencia local
useSessionStorage()          // Storage de sesión
useIndexedDB()               // Base de datos local
useOfflineSync()             // Sincronización offline
```

---

## 📊 Estadísticas del Sistema

### Resumen de Hooks por Categoría
- **📦 Inventario**: 15 hooks especializados
- **🚚 Servicios**: 12 hooks de gestión
- **👥 Clientes**: 8 hooks CRM
- **👷 Operadores**: 6 hooks operacionales
- **🚛 Grúas**: 7 hooks de fleet management
- **💰 Facturación**: 9 hooks financieros
- **💸 Costos**: 6 hooks de control
- **⚙️ Configuración**: 5 hooks del sistema
- **🔐 Autenticación**: 8 hooks de seguridad
- **🛠️ Utilidades**: 20+ hooks auxiliares

### Total: **100+ Custom Hooks Especializados**

---

¡Esta referencia cubre todos los hooks disponibles en TMS Grúas v2.1.0! 🚀

**Documentación actualizada: Julio 2025**