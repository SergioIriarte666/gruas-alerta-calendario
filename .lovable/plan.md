
# Popup de Resumen de Pendientes al Iniciar Sesion

## Problema
Actualmente no existe un mecanismo que alerte al usuario sobre lo que esta pendiente cuando inicia sesion. Hay que revisar cliente por cliente para descubrir servicios sin orden de compra, cierres pendientes, etc. El sistema de notificaciones actual solo muestra alertas pasivas en el panel del dashboard, no un aviso proactivo al login.

**Datos reales encontrados en la base de datos:**
- 63 servicios completados sin orden de compra registrada
- 9 servicios completados pendientes de cierre (mas de 30 dias)
- 0 servicios en estado "purchase_order_pending"

## Solucion

Crear un **modal popup** que aparece automaticamente al iniciar sesion (una vez por sesion) mostrando un resumen ejecutivo de todo lo pendiente, agrupado por categoria y con acciones directas.

## Diseno del Popup

Siguiendo los patrones del modulo de Costos (Dialog con header gradient, tipografia consistente, badges de colores):

```text
+----------------------------------------------------------+
|  HEADER (gradient violet/purple como CostForm)           |
|  "Resumen de Pendientes"                                 |
|  "Tienes elementos que requieren tu atencion"            |
+----------------------------------------------------------+
|                                                          |
|  [!] Servicios sin O.C.                          63      |
|  Servicios completados sin orden de compra               |
|  [Ver detalle >]                                         |
|                                                          |
|  [!] Servicios Pendientes de Cierre               9      |
|  Completados hace +30 dias sin incluir en cierre         |
|  [Ver detalle >]                                         |
|                                                          |
|  [!] Facturas Vencidas                            0      |
|  Sin facturas vencidas - todo al dia                     |
|                                                          |
|  [!] Documentos por Vencer                        X      |
|  Permisos, seguros o examenes proximos a vencer          |
|  [Ver detalle >]                                         |
|                                                          |
+----------------------------------------------------------+
|  [ ] No mostrar de nuevo hoy     [Entendido]            |
+----------------------------------------------------------+
```

Cada categoria con badge de color segun urgencia (rojo = critico, amarillo = atencion, verde = ok).

## Detalle Tecnico

### Archivos nuevos

1. **`src/hooks/usePendingSummary.ts`**
   - Hook con React Query que ejecuta consultas paralelas a Supabase:
     - Servicios completados sin O.C. (agrupados por cliente)
     - Servicios pendientes de cierre (+30 dias)
     - Facturas vencidas (via RPC existente `get_overdue_invoices_for_alerts`)
     - Documentos de gruas/operadores por vencer
   - Retorna conteos y datos resumidos por categoria
   - `staleTime: 5min` para no re-consultar innecesariamente

2. **`src/components/dashboard/PendingSummaryModal.tsx`**
   - Modal Dialog siguiendo el estilo del CostForm:
     - Header con gradient `from-violet-500/10 to-purple-500/10`
     - Categorias como cards con iconos, conteos en badges
     - Cada categoria expandible para ver detalle (lista de folios/clientes)
     - Botones "Ir a..." que navegan a la seccion correspondiente (/services, /closures, /invoices)
   - Boton "No mostrar de nuevo hoy" que guarda flag en `sessionStorage`
   - Se cierra con "Entendido" o click fuera

3. **`src/components/dashboard/PendingCategoryCard.tsx`**
   - Componente reutilizable para cada categoria de pendientes
   - Muestra icono, titulo, conteo (badge), descripcion, y boton de accion
   - Estado expandible para mostrar tabla con detalle (folio, cliente, fecha, dias)

### Archivos modificados

4. **`src/pages/Dashboard.tsx`**
   - Importar y renderizar `PendingSummaryModal`
   - Logica: mostrar solo si `sessionStorage` no tiene flag `pending_summary_dismissed_[fecha]`
   - Se muestra cuando `usePendingSummary` tiene datos y el dashboard ya cargo

### Logica de visibilidad
- El popup aparece **una vez por sesion** (controlado con `sessionStorage`)
- Si el usuario marca "No mostrar hoy", se guarda con la fecha actual
- Solo aparece si hay al menos 1 pendiente critico (servicios sin O.C., cierres pendientes, o facturas vencidas)
- No bloquea la navegacion - se puede cerrar inmediatamente

### Categorias de pendientes a consultar

| Categoria | Query | Tipo |
|---|---|---|
| Servicios sin O.C. | `services` where completed + purchase_order empty, agrupado por cliente | warning/error segun antiguedad |
| Pendientes de Cierre | `services` completed +30 dias, no en `closure_services` | warning |
| Facturas Vencidas | RPC `get_overdue_invoices_for_alerts` | error |
| Facturas por Vencer | RPC `get_invoices_due_soon` | warning |
| Documentos por Vencer | `cranes` + `operators` con fechas proximas | warning/error |

### Tambien se mejora `useNotificationsData.ts`
- Agregar consulta de **servicios completados sin orden de compra** como nueva categoria de notificacion, que actualmente no existe
- Esto alimenta tanto el popup como el panel de alertas del dashboard
