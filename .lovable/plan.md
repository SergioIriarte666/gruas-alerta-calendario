

## Plan: Corregir creación de proveedor en importación de compras

### Problema raíz

Los logs muestran claramente el error:

```
Error creating inventory_supplier: Could not find the 'contact_name' column of 'inventory_suppliers' in the schema cache
```

La tabla `inventory_suppliers` tiene la columna `contact_person`, **no** `contact_name`. El insert en la línea 557 envía `contact_name: ''` lo que causa que **todos** los proveedores nuevos fallen al crearse, y por lo tanto todas sus facturas también fallan.

### Cambio

En `src/components/finance/historical/PurchaseHistoryImport.tsx`, línea 553-559, eliminar los campos innecesarios del insert a `inventory_suppliers`. Solo se necesitan `name`, `rut` e `is_active` (las otras inserciones en líneas 642 y 698 ya están correctas):

```typescript
// Línea 553-559 — ANTES:
.insert({
    name: us.razonSocial,
    rut: us.rut,
    is_active: true,
    contact_name: '',  // ← NO EXISTE
    phone: '',
    email: ''
})

// DESPUÉS:
.insert({
    name: us.razonSocial,
    rut: us.rut,
    is_active: true
})
```

### Impacto
- Solo se modifica 1 bloque de insert (las otras 2 inserciones a `inventory_suppliers` en líneas 642 y 698 ya usan los campos correctos)
- Los proveedores se crearán correctamente y sus facturas se importarán sin error

### Archivo a modificar
- `src/components/finance/historical/PurchaseHistoryImport.tsx`

