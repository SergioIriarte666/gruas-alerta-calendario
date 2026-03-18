

# Plan: Rediseno Completo del Modulo de Proveedores

## Diagnostico Actual

El modulo tiene 3 pestanas (Proveedores, Pagos, Calendario) con ~1260 lineas entre `PaymentList.tsx` (669 lineas) y `SupplierList.tsx` (590 lineas). Problemas identificados:

- **Pagos**: Lista plana sin agrupacion, orden por defecto ascendente (mas antiguo primero)
- **Proveedores**: Columna "Pagos" muestra "0 pagos" hardcodeado, no calcula datos reales
- **Stats Cards**: Basicas, sin indicadores visuales de urgencia
- **Filtros**: Funcionales pero desconectados visualmente del contenido
- **Calendario**: Funcional pero aislado del contexto de pagos

## Cambios Propuestos

### 1. Pagina Principal (`Suppliers.tsx`)
- Redisenar Stats Cards con indicadores de color mas agresivos (rojo pulsante para vencidos, amarillo para pendientes)
- Agregar stat card de "Total Pagado este Mes" para contexto temporal
- Botones de accion simplificados: solo "Nuevo Proveedor" y "Registrar Pago" (eliminar duplicados)

### 2. Pestana Pagos - Agrupacion por Proveedor (`PaymentList.tsx`)
**Cambio principal**: Reemplazar la tabla plana por secciones colapsables agrupadas por proveedor.

```text
┌─────────────────────────────────────────────┐
│ [Filtros colapsables]                       │
├─────────────────────────────────────────────┤
│ ▼ Entel PCS (3 pagos) ── Total: $1.200.000 │
│   ├─ Factura 52897759  $450.000  Pagado     │
│   ├─ Factura 52891234  $350.000  Pendiente  │
│   └─ Factura 52890001  $400.000  Vencido    │
│                                             │
│ ▼ Copec S.A. (2 pagos) ── Total: $800.000  │
│   ├─ Combustible Mar   $500.000  Pagado     │
│   └─ Combustible Feb   $300.000  Pendiente  │
└─────────────────────────────────────────────┘
```

- Orden por defecto: mas reciente primero (`desc` por `due_date`)
- Cada grupo muestra: nombre proveedor, cantidad de pagos, total, y subtotales por estado
- Grupos colapsables con `Collapsible`
- Proveedores con pagos vencidos aparecen primero (prioridad visual)
- Mantener vista de tabla dentro de cada grupo
- En movil: tarjetas agrupadas por proveedor

### 3. Pestana Proveedores (`SupplierList.tsx`)
- Corregir columna "Pagos" para mostrar datos reales (count + monto pendiente) usando un join con `supplier_payments`
- Agregar indicador visual de deuda: badge rojo si tiene pagos vencidos
- Simplificar columnas: eliminar "Calif." (poco usado), compactar contacto

### 4. Detalle del Proveedor (`SupplierDetailModal.tsx`)
- Sin cambios estructurales, ya esta bien organizado

### 5. Hook de Pagos (`useSupplierPayments.ts`)
- Cambiar orden por defecto a `descending` por `due_date`

### 6. Hook de Proveedores (`useSuppliers.ts`)
- Agregar query para obtener conteo de pagos y monto pendiente por proveedor (para la columna "Pagos" en la lista)

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Suppliers.tsx` | Redisenar stats, simplificar botones |
| `src/components/suppliers/PaymentList.tsx` | Reescribir con agrupacion por proveedor, orden desc |
| `src/components/suppliers/SupplierList.tsx` | Corregir columna pagos, agregar indicador deuda |
| `src/hooks/useSupplierPayments.ts` | Orden descendente por defecto |
| `src/hooks/useSuppliers.ts` | Query de stats por proveedor |
| `src/hooks/useSupplierStats.ts` | Agregar stat "pagado este mes" |

## Restricciones
- Preservar toda la logica bidireccional Costos-Proveedores-Inventario
- Mantener exportacion PDF/Excel funcional
- Respetar sistema de diseno violeta con alto contraste
- No modificar hooks de sincronizacion (`useUniversalSync`)

