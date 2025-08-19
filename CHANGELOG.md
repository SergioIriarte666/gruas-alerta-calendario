
# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

