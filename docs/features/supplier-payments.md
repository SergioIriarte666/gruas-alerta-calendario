# Pagos a Proveedores - Filtros por Fecha

## Funcionalidad Implementada

### **Filtros de Fecha Disponibles**

Los usuarios pueden filtrar los pagos de proveedores utilizando rangos de fechas específicos:

#### **Tipos de Fecha**
- **Fecha de Vencimiento** (`due_date`): Filtra por la fecha límite de pago
- **Fecha de Creación** (`created_at`): Filtra por cuando se registró el pago
- **Fecha de Pago** (`paid_date`): Filtra por cuando se marcó como pagado (solo pagos con estado "pagado")

#### **Controles de Fecha**
- **Fecha Desde**: Define el inicio del rango temporal
- **Fecha Hasta**: Define el final del rango temporal
- **Validación**: "Fecha Hasta" no puede ser anterior a "Fecha Desde"

### **Filtros Rápidos**

Para mayor comodidad, se incluyen botones de filtro rápido:

- **Hoy**: Filtra pagos del día actual
- **Esta Semana**: Filtra pagos de la semana en curso (domingo a sábado)
- **Este Mes**: Filtra pagos del mes actual
- **Últimos 30 días**: Filtra pagos de los últimos 30 días

### **Integración con Reportes**

#### **Exportación PDF**
- Los filtros de fecha se incluyen en la sección "Filtros Aplicados"
- Muestra el tipo de fecha utilizado y el rango seleccionado
- Formato: "Fecha de Vencimiento: desde 01/12/2024 hasta 31/12/2024"

#### **Exportación Excel**
- Hoja de resumen incluye todos los filtros de fecha aplicados
- Detalle completo de tipo de fecha y rango temporal
- Métricas calculadas según el período filtrado

### **Casos de Uso Principales**

1. **Análisis de Vencimientos**
   - Filtrar por fecha de vencimiento para ver pagos próximos a vencer
   - Identificar pagos vencidos en un período específico
   
2. **Seguimiento de Registros**
   - Filtrar por fecha de creación para ver pagos ingresados en un período
   - Auditoría de registros por rango temporal
   
3. **Control de Pagos Realizados**
   - Filtrar por fecha de pago para analizar flujo de caja
   - Reportes de pagos efectuados en períodos específicos

4. **Proyecciones y Planificación**
   - Usar filtros rápidos para análisis inmediatos
   - Planificación de flujo de caja mensual o trimestral

### **Funcionalidades Técnicas**

#### **Validaciones**
- Fechas de inicio no pueden ser posteriores a fechas de fin
- Filtro por fecha de pago solo aplica a pagos con estado "paid"
- Validación de rangos de fecha en tiempo real

#### **Rendimiento**
- Filtrado optimizado mediante `useMemo`
- Recalculo automático cuando cambian filtros o datos
- Manejo eficiente de grandes volúmenes de pagos

#### **Interfaz**
- Componentes de calendario integrados con shadcn/ui
- Diseño responsivo para dispositivos móviles
- Indicadores visuales de filtros activos
- Botón "Limpiar" para resetear filtros de fecha

### **Integración con Sistema Existente**

Los filtros de fecha se integran seamlessly con:
- Filtros existentes (búsqueda, estado, proveedor)
- Sistema de exportación de reportes
- Métricas y estadísticas del dashboard
- Funcionalidades de ordenamiento y paginación

Esta implementación proporciona control temporal preciso sobre los datos de pagos de proveedores, mejorando significativamente las capacidades de análisis y reporte del sistema.