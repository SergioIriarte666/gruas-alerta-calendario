# Plan: Sincronización Bidireccional Completa entre Costos, Proveedores e Inventario

## ✅ IMPLEMENTADO

### Cambios Realizados

1. **Migración SQL ejecutada**: Trigger `create_supplier_payment_from_cost` + columna `cost_id` en `supplier_payments`
2. **XMLCostUpload.tsx modificado**: 
   - Función `findSupplierByRutOrName` para vincular proveedor automáticamente
   - `supplier_id` incluido en datos del costo
   - Toggle de sincronización con inventario
   - Datos de compra (`purchase_quantity`, `purchase_unit_cost`) para activar trigger de inventario

### Flujo de Sincronización Activo

```
XML Upload (Costos)
       │
       ▼
   costs ─────────────────────┐
       │                      │
       ├── supplier_id ────► supplier_payments (trigger automático)
       │
       └── purchase_quantity + purchase_unit_cost ────► inventory_movements (trigger existente)
```

### Resultado

Al cargar costos desde XML:
1. Se busca el proveedor por RUT o nombre
2. Si se encuentra, se vincula al costo
3. El trigger `create_supplier_payment_from_cost` crea automáticamente el pago
4. Si "Sincronizar con Bodega" está activo, también se crea el movimiento de inventario
