

## Plan: Reemplazar el importador XML de Costos con el mismo estilo del de Proveedores

### Problema
El importador XML de Costos (`XMLCostUpload`) tiene un diseño diferente al de Proveedores (`XMLDocumentUpload`). El usuario prefiere el flujo del importador de Proveedores por su organización en secciones (Proveedores Encontrados + Documentos Encontrados) con categoría/subcategoría por proveedor.

### Diferencias actuales

```text
COSTOS (actual)                          PROVEEDORES (preferido)
─────────────────                        ────────────────────────
• Cards editables por registro           • Proveedores agrupados con categoría
• Categoría por cada registro            • Categoría + Subcategoría por proveedor
• Sin subcategoría                       • Documentos con folio/monto/fecha
• Acciones masivas (fecha, monto %)      • Condición de pago por documento
• Sync inventario toggle                 • Detección duplicados por folio
• Edición inline de descripción/proveedor• Vinculación a costos existentes
```

### Enfoque
Refactorizar `XMLCostUpload` para adoptar el mismo layout y flujo del importador de Proveedores, pero generando registros en la tabla `costs` (en vez de `supplier_payments`). Se reutilizará el parser `XMLSupplierParser` que ya extrae proveedores y documentos del XML DTE.

### Cambios

| Archivo | Cambio |
|---------|--------|
| `src/components/costs/XMLCostUpload.tsx` | Reescribir completamente para usar el mismo layout que `XMLDocumentUpload`: dropzone, stats cards (Proveedores/Documentos/Errores/Total), sección "Proveedores Encontrados" con categoría+subcategoría por proveedor, sección "Documentos Encontrados" con checkbox/folio/monto/emisión/condición de pago/fecha vencimiento. Usar `XMLSupplierParser` en vez de `XMLCostParser`. Mantener detección de duplicados y vinculación a costos existentes. La acción final crea registros en `costs` (via `addCost`) en vez de `supplier_payments`. |

### Funcionalidad que se mantiene
- Detección de duplicados (adaptada al formato por folio)
- Categoría y subcategoría (ahora por proveedor, no por registro)
- Condición de pago y fecha de vencimiento por documento
- Sync con inventario (como opción en "Opciones de Importación")
- Vinculación con proveedor existente en `inventory_suppliers`
- Batch progress modal

### Funcionalidad que se elimina
- Edición inline de descripción/proveedor por registro (se usa lo que trae el XML)
- Acciones masivas de cambio de fecha y ajuste de monto %
- Vista "mostrar primeros 20" (se usa scroll como en proveedores)

### Flujo resultante (idéntico en ambos módulos)

```text
1. Seleccionar archivo XML (dropzone)
2. Analizar XML → Stats cards
3. Opciones de Importación (checkbox sync inventario)
4. Proveedores Encontrados → Categoría + Subcategoría por proveedor
5. Documentos Encontrados → Folio, monto, fecha, condición pago, fecha venc.
6. Botón "Cargar X Gastos"
```

