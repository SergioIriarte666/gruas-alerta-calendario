
# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2026-05-30

### Added — Portal del Operador: UI nativa móvil

- **`OperatorThemeForcer`**: componente que aplica tema oscuro solo en el portal del operador sin afectar el resto de la app
- **`OperatorBottomNav`**: barra de navegación inferior fija con tabs Inicio / Activos / Historial, compatible con safe-area iOS
- **`NextServiceCard`**: tarjeta de próximo servicio en el dashboard con countdown dinámico ("Hoy en 2h", "Mañana", "En 3 días")
- **`InspectionProgressBar`**: barra de progreso de inspección por secciones (Vehículo → Equipamiento → Fotos → Firma), reactiva en tiempo real con `form.watch()`
- **`navigationUtils.ts`**: helper `openNavigation()` que abre Google Maps con la dirección de destino
- **`inspectionPdfUpload.ts`**: utilidades para subir el PDF al bucket `inspection-pdfs` y guardar la URL firmada en la tabla `inspections`
- **Edge Function `send-whatsapp-inspection`**: envía link de descarga del PDF por WhatsApp al cliente y al receptor final tras completar la inspección

### Changed — Portal del Operador: mejoras de contenido

- **`OperatorLayout`**: rediseño completo con header compacto tipo app, fondo negro (`zinc-950`), padding safe-area iOS/Android
- **`OperatorDashboard`**: eliminado sistema de tabs; navegación migrada a bottom nav; contador rápido de servicios por estado; footer de debug eliminado
- **`AssignedServiceCard`**: refactorizado en subcomponente `ServiceCardContent` eliminando duplicación de 5 ramas; borde izquierdo de color por urgencia (`rojo=hoy`, `violeta=mañana`, `ámbar=esta semana`); agrega marca, modelo y patente del vehículo; botón de navegación integrado
- **`ServiceDetailsCard`**: expandido con vehículo, patente, fecha completa con hora, persona de contacto y teléfono tappable (`tel:`)
- **`PDFProgress`**: movido de `fixed top-4 right-4` a `fixed bottom-0` con `env(safe-area-inset-bottom)` para evitar solapamiento con teclado virtual en móviles
- **`InspectionHeader`**: rediseñado con estilo dark nativo y botón de volver compacto
- **`index.html`**: agregado `viewport-fit=cover` para soporte de safe-area en iPhones con notch

### Changed — PDF de inspección: rediseño visual profesional

- **`pdfHeader.ts`**: banda superior verde de ancho completo con logo integrado, nombre de empresa y badge de tipo de documento (PRE-SERVICIO / FINAL)
- **`serviceInfo.ts`**: dos tablas en columnas lado a lado (info del servicio + info del vehículo); kilometraje formateado con puntos de miles
- **`equipmentChecklist.ts`**: colores por celda ("SI" verde, "NO" rojo); barra de progreso visual de completitud
- **`pdfSignatures.ts`**: cajas con header verde, área de firma con borde y línea verde bajo cada firma
- **`observations.ts`**: observaciones en recuadro redondeado; footer con separador verde y número de página

### Fixed — Portal del Operador: bugs críticos

- **PDF stuck at 80%**: tres causas corregidas — `company_data` retornaba 406 para operadores (cambiado a `maybeSingle()`); `canvas.toDataURL()` lanzaba `SecurityError` con URLs externas (guard agregado); `setIsGeneratingPDF(false)` nunca se llamaba en caso de error (agregado `finally`)
- **Servicios no visibles en "Asignados"**: diagnóstico y corrección de política RLS `services_operator_select_scoped` — el campo `user_id` en la tabla `operators` no estaba vinculado al perfil de auth del operador
- **Console.log en producción**: 84 llamadas a `console.log/warn` en archivos del portal del operador reemplazadas por `createLogger()` del sistema de logging existente (`src/lib/logger.ts`)

### Infrastructure — Base de datos y Storage

- **Bucket `inspection-pdfs`**: almacenamiento privado para PDFs de inspección con políticas RLS
- **Bucket `inspection-photos`**: almacenamiento para fotos de inspección — fotos ya no dependen solo de localStorage
- **Migración `inspections`**: columnas `pdf_url TEXT` y `pdf_uploaded_at TIMESTAMPTZ` agregadas
- **Migración `whatsapp_settings`**: columna `notify_inspection_completed BOOLEAN DEFAULT true` agregada
- **Plantilla Meta `inspeccion_completada_link`**: creada en WhatsApp Manager, pendiente aprobación (24-48h)

## [2.1.1] - 2025-01-29

### Added - Sistema de Métricas de Servicios
- **📊 Métricas de Servicios**: Implementación completa de 4 tarjetas de métricas principales
  - **Total Servicios**: Cantidad total de servicios con valor generado
  - **Gastos**: Suma de costos operativos asociados a servicios
  - **Total Generado**: Ingresos totales por servicios realizados  
  - **Balance**: Utilidad/pérdida neta con margen de ganancia porcentual
- **🎛️ Filtros de Fecha**: Sistema de filtros rápidos (Hoy, Esta Semana, Este Mes, Ver Todos)
- **⚡ Hook useServicesMetrics**: Lógica de cálculo en tiempo real con optimización de consultas
- **🎨 Componente ServicesDateFilter**: Filtros visuales integrados con diseño consistente

### Enhanced - Componentes de Servicios
- **`ServicesMetrics.tsx`**: Componente de métricas con diseño responsive
- **`ServicesHeader.tsx`**: Integración completa de métricas con sección dedicada
- **`ServicesDateFilter.tsx`**: Filtros de fecha con interfaz optimizada

### Enhanced - Hooks y Lógica
- **`useServicesMetrics.ts`**: Hook personalizado con:
  - Cálculos financieros avanzados (ingresos, costos, utilidad, márgenes)
  - Filtrado inteligente por rangos de fecha
  - Consultas optimizadas a tablas `services` y `costs`
  - Manejo de estados de carga y errores

### Enhanced - Experiencia de Usuario  
- **Estados de Carga**: Skeletons animados durante la carga de métricas
- **Formateo de Moneda**: Integración con `formatCurrency` para CLP
- **Diseño Consistente**: Uso de `ReportMetricCard` para coherencia visual
- **Responsive Design**: Grid adaptativo para todos los dispositivos

### Technical - Arquitectura
- **Consultas Supabase Optimizadas**: Joins eficientes entre `services` y `costs`
- **TypeScript Completo**: Interfaces y tipos para todas las métricas
- **Performance**: Cálculos memoizados y consultas bajo demanda
- **Reutilización**: Aprovechamiento de componentes existentes del sistema

## [2.1.0] - 2025-01-12

### Added - Sistema de Inventario y Bodega Completo
- **🏗️ Módulo de Inventario Completo**: Sistema integral de gestión de bodega
- **📦 Gestión de Productos**: Catálogo completo con categorías, SKU, códigos de barra
- **📍 Control de Ubicaciones**: Múltiples bodegas con seguimiento por ubicación
- **🔄 Movimientos de Inventario**: Entradas, salidas, transferencias, ajustes con trazabilidad
- **📊 Dashboard de Inventario**: Métricas en tiempo real y alertas visuales
- **🚨 Sistema de Alertas Automáticas**: Stock bajo, crítico, sin movimiento, vencimientos
- **📈 Reportes de Inventario**: Valorización, consumo, análisis ABC, proyecciones
- **🏪 Gestión de Proveedores**: Control de suministros y órdenes de compra
- **⚙️ Integración Operativa**: Consumos automáticos por servicios y grúas

### Enhanced - Componentes de Inventario
- **`InventoryMovementForm.tsx`**: Formulario avanzado para movimientos
- **`ProductCatalogTable.tsx`**: Tabla de catálogo con búsqueda y filtros
- **`MovementsHistoryTable.tsx`**: Historial detallado de movimientos
- **`InventoryAlertsPage.tsx`**: Dashboard de alertas con configuración
- **`AlertConfigurationForm.tsx`**: Configuración flexible de alertas
- **`InventoryReportsPage.tsx`**: Reportes especializados con gráficos

### Enhanced - Hooks Especializados
- **`useInventoryItems`**: Gestión CRUD de productos
- **`useInventoryStock`**: Control de stock en tiempo real
- **`useInventoryMovements`**: Movimientos con validación automática
- **`useInventoryCategories`**: Categorías jerárquicas
- **`useInventoryLocations`**: Gestión de ubicaciones
- **`useInventorySuppliers`**: Control de proveedores
- **`useInventoryStats`**: Métricas y estadísticas
- **`useInventoryAlerts`**: Sistema de alertas automáticas

### Enhanced - Base de Datos
- **`inventory_items`**: Catálogo de productos con control de stock
- **`inventory_stock`**: Stock por ubicación con alertas
- **`inventory_movements`**: Trazabilidad completa de movimientos
- **`inventory_categories`**: Categorías con jerarquía
- **`inventory_locations`**: Ubicaciones con códigos únicos
- **`inventory_suppliers`**: Proveedores con términos de pago
- **`inventory_alerts`**: Configuración de alertas automáticas
- **`inventory_consumptions`**: Consumos por grúa y operador

### Enhanced - Navegación y UI
- **Sidebar Optimizado**: Altura completa con scroll automático
- **Responsive Design Mejorado**: Compatibilidad móvil para inventario
- **Sistema de Tabs Avanzado**: Organización de módulos de inventario
- **Alertas Visuales**: Dashboard con indicadores de estado

### Enhanced - Sistema de Alertas Inteligente
- **Evaluación en Tiempo Real**: Monitoreo automático de condiciones
- **Configuración Flexible**: Alertas por producto, ubicación o globales
- **Tipos de Alerta**: Stock bajo, crítico, sin movimiento, vencimientos
- **Notificaciones Automáticas**: Integración con sistema de notificaciones

## [2.0.0] - 2025-01-10

### Added - Sistema Responsive Completo
- **Hooks personalizados responsive**: `useDeviceType` y `useBreakpoint`
- **Sistema de breakpoints avanzado**: sm, md, lg, xl con detección automática
- **Componentes adaptativos**: MetricCard, Layout, Tables, Forms
- **Experiencia táctil optimizada**: Botones y controles touch-friendly
- **Diseño mobile-first**: Prioridad en experiencia móvil
- **Sistema de vehículos opcionales**: Lógica inteligente con `shouldShowVehicleInfo`
- **Helpers de formateo**: `formatVehicleInfo` y utilidades de estado

### Enhanced - Módulos Existentes
- **Dashboard**: Métricas completamente responsive y adaptativos
- **Portal de Operadores**: Optimizado para tablets y móviles
- **Portal de Clientes**: Experiencia móvil mejorada
- **Gestión de Servicios**: Formularios touch-friendly
- **Gestión de Grúas**: Interfaz adaptativa para todos los dispositivos
- **Sistema de Inspecciones**: Optimizado para uso táctil

### Improved - Experiencia de Usuario
- **Navegación móvil**: Sidebar colapsible y menús adaptativos
- **Formularios responsive**: Layouts automáticamente adaptativos
- **Tablas móviles**: Vista optimizada para pantallas pequeñas
- **Modales adaptativos**: Tamaños dinámicos según dispositivo
- **PWA mejorada**: Mejor experiencia offline en móviles

### Technical - Arquitectura
- **TypeScript mejorado**: Tipos para dispositivos y breakpoints
- **Hooks reutilizables**: Sistema modular de detección de dispositivos
- **Componentes optimizados**: Performance mejorada en móviles
- **CSS responsive**: Sistema de tokens semánticos actualizado

## [1.0.0] - 2025-06-15

### Added
- Versión inicial del Sistema de Gestión de Transportes (TMS).
- Módulos de Dashboard, Servicios, Clientes, Grúas, Operadores.
- Funcionalidad de Calendario con vistas de mes, semana y día.
- Módulos de Cierres de Servicios y Facturación.
- Gestión de Costos operativos.
- Módulo de Reportes con filtros y visualización de métricas.
- Panel de Configuración del sistema y de la empresa.
- Autenticación de usuarios con Supabase.
- Carga masiva de servicios mediante archivos CSV/Excel.
- Generación de documentación completa del proyecto.

## Roadmap

### [2.2.0] - Próxima versión
- **Análisis Predictivo de Inventario**: IA para predicción de demanda
- **Códigos QR/Barra**: Integración con escáneres móviles
- **Integración con Proveedores**: API para órdenes automáticas
- **Auditorías de Inventario**: Herramientas de conciliación física
- **Reportes Avanzados**: Dashboard ejecutivo con KPIs de inventario

### [2.3.0] - Futuro
- **Modo oscuro responsive**: Tema oscuro para todas las interfaces
- **Personalización de interfaz**: Configuración por dispositivo y usuario
- **Sincronización offline avanzada**: Cache inteligente para inventario
- **Analytics de uso**: Métricas de utilización del sistema
- **Integración IoT**: Sensores para monitoreo automático de stock

