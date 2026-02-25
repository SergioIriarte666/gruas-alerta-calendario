

# Rediseno UI del Modulo Inventario-Proveedores

## Diagnostico

El modulo de Proveedores (`src/pages/Suppliers.tsx`) presenta los siguientes problemas de UX:

1. **Pagina principal sobrecargada**: 5 tabs (Proveedores, Pagos, Categorias, Calendario, Importar) con filtros duplicados entre tabs y botones de accion redundantes en el header vs. dentro de cada tab.
2. **Filtros de fecha en Pagos ocupan demasiado espacio**: Un card completo dedicado solo a filtros de fecha con calendarios Popover (no usa `DatePickerInput` estandar del sistema).
3. **Stats cards estaticas**: No reaccionan al tab activo ni dan contexto relevante.
4. **Tab "Importar" innecesario**: Ya existe un boton "Importar XML" en el header que abre modal. El tab embebe el mismo componente con `isOpen={true}` siempre, lo cual es confuso.
5. **Modal de detalle del proveedor**: 5 sub-tabs (General, Documentos, Pagos, Inventario, Piezas) con tablas sin busqueda/filtro ni totales resumidos.
6. **Inconsistencia visual**: Filtros de fecha usan `Calendar` de Popover en vez de `DatePickerInput`. No sigue el patron del modulo de Costos.

## Restricciones criticas (NO TOCAR)

- **Hook `useSupplierPayments.ts`**: Toda la logica de `markPaymentAsPaid` con sincronizacion a Costos + Bodega (inventory). NO modificar.
- **Hook `useInventory.ts`**: `createInventoryCost` y flujo de movimientos. NO modificar.
- **`inventoryCostHelper.ts`**: NO modificar.
- **Trigger DB `create_supplier_payment_from_cost`**: Bidireccionalidad Costos -> Proveedores. No se toca.
- **`PaymentForm.tsx`**: Logica de `add_to_inventory` checkbox y campos de piezas. Se mantiene intacta la funcionalidad; solo se ajusta layout visual si es necesario.

## Plan de trabajo

### Fase 1: Limpiar pagina principal `Suppliers.tsx`

**Archivo**: `src/pages/Suppliers.tsx`

- Eliminar el tab "Importar" (linea 183-186 y 205-218). El boton XML del header ya cubre esto.
- Reducir de 5 a 4 tabs: Proveedores, Pagos, Calendario, Categorias.
- Mantener stats cards pero hacerlas contextuales: al estar en tab "Pagos", resaltar las de pagos; en tab "Proveedores", resaltar total/activos.

### Fase 2: Consolidar filtros en `PaymentList.tsx`

**Archivo**: `src/components/suppliers/PaymentList.tsx`

- Unificar los 2 cards de filtros (lineas 316-377 y 379-475) en un solo card colapsable, siguiendo el patron de `UnifiedCostFilters` del modulo Costos.
- Reemplazar los `Popover` + `Calendar` (lineas 421-443 y 447-470) por `DatePickerInput` del sistema de diseno.
- Usar un layout de filtros en una sola fila con wrap: Busqueda | Estado | Proveedor | Tipo Fecha | Desde | Hasta | Limpiar. Todo compacto.
- Resultado: de ~160 lineas de filtros a ~60, con mejor consistencia visual.

### Fase 3: Mejorar modal de detalle `SupplierDetailModal.tsx`

**Archivo**: `src/components/suppliers/SupplierDetailModal.tsx`

- Fusionar tabs "Inventario" y "Piezas" en un solo tab "Inventario y Piezas" con dos secciones colapsables. Reduce de 5 a 4 tabs, mejorando la navegacion.
- Agregar totales resumidos al pie de cada seccion (total pagado, total pendiente, total piezas).

### Fase 4: Mejorar sub-tabs del detalle

**Archivos**: 
- `src/components/suppliers/detail/SupplierPaymentsTab.tsx`
- `src/components/suppliers/detail/SupplierDocumentsTab.tsx`
- `src/components/suppliers/detail/SupplierInventoryTab.tsx`  
- `src/components/suppliers/detail/SupplierPartsTab.tsx`

- Agregar fila de totales al pie de cada tabla (suma de montos).
- Agregar buscador inline simple (filtrar por descripcion/nombre) en pagos y documentos.
- Fusionar InventoryTab y PartsTab en un nuevo `SupplierInventoryAndPartsTab.tsx` con secciones colapsables usando `Collapsible`.

### Fase 5: Consistencia visual con modulo Costos

**Todos los archivos modificados**:
- Usar tokens semanticos: `text-foreground`, `bg-muted/30`, `text-primary` para valores monetarios.
- Valores financieros en negrita violeta (`text-violet-600 font-bold`).
- Badges con colores del sistema (verde pagado, rojo vencido, amarillo pendiente con `text-white`).
- Asegurar que `DatePickerInput` se usa en todos los date pickers.

## Resumen de archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/pages/Suppliers.tsx` | Eliminar tab Importar, stats contextuales |
| `src/components/suppliers/PaymentList.tsx` | Consolidar filtros, usar DatePickerInput |
| `src/components/suppliers/SupplierDetailModal.tsx` | Fusionar tabs Inventario+Piezas |
| `src/components/suppliers/detail/SupplierPaymentsTab.tsx` | Totales + buscador inline |
| `src/components/suppliers/detail/SupplierDocumentsTab.tsx` | Totales + buscador inline |
| `src/components/suppliers/detail/SupplierInventoryAndPartsTab.tsx` | NUEVO: fusion de Inventory+Parts con colapsables |

## Archivos que NO se tocan

- `src/hooks/useSupplierPayments.ts`
- `src/hooks/useInventory.ts`  
- `src/utils/inventoryCostHelper.ts`
- `src/components/suppliers/PaymentForm.tsx` (logica intacta)
- `src/components/suppliers/RegisterPaymentModal.tsx`
- `src/hooks/useSupplierDetail.ts`

