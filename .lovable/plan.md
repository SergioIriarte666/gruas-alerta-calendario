

## Plan: Eliminación segura de costos con confirmación reforzada y resumen de impacto

### Problema
Al eliminar un costo que tiene datos relacionados (pagos de proveedores, movimientos de inventario, piezas de grúa), la eliminación ocurre inmediatamente sin ningún diálogo de confirmación. El trigger `sync_cost_deletion_cascade` ya limpia los datos relacionados correctamente, pero el usuario no tiene visibilidad de lo que se va a eliminar ni oportunidad de cancelar.

### Solución
Implementar un diálogo de confirmación en dos niveles:

1. **Primer nivel**: Modal que muestra un resumen del impacto (datos relacionados que serán afectados)
2. **Segundo nivel**: Si hay datos relacionados, pedir la contraseña del usuario para confirmar (usando `supabase.auth.signInWithPassword`)

### Cambios

| Archivo | Cambio |
|---------|--------|
| `src/components/costs/CostDeleteConfirmDialog.tsx` | **Nuevo componente**. Dialog con: (1) resumen de impacto mostrando badges de lo que se eliminará/cancelará (pago proveedor, movimientos inventario, piezas grúa), (2) campo de contraseña para confirmar, (3) botón deshabilitado hasta ingresar contraseña. Consulta los datos relacionados al abrirse para mostrar el impacto real. |
| `src/pages/Costs.tsx` | Reemplazar la llamada directa `deleteCost(cost.id)` en `handleDeleteCost` por abrir el nuevo `CostDeleteConfirmDialog`. Agregar estado para `costToDelete` y manejar la confirmación. |

### Flujo

```text
1. Usuario hace clic en "Eliminar" en un costo
2. Se abre modal con resumen:
   - "Este costo tiene datos relacionados:"
   - ⚠️ 1 pago de proveedor (será eliminado)
   - ⚠️ 2 movimientos de inventario (serán cancelados)
   - ⚠️ 1 pieza de grúa (será desvinculada)
3. Campo: "Ingrese su contraseña para confirmar"
4. Se valida contraseña con supabase.auth.signInWithPassword
5. Si es correcta → ejecuta deleteCost → cierra modal
6. Si es incorrecta → muestra error "Contraseña incorrecta"
```

### Detalle técnico

**Consulta de impacto** (al abrir el dialog):
```typescript
// Verificar datos relacionados
const [payments, movements, parts] = await Promise.all([
  supabase.from('supplier_payments').select('id').or(`cost_id.eq.${costId},id.eq.${cost.supplier_payment_id}`),
  supabase.from('inventory_movements').select('id').eq('cost_id', costId).eq('status', 'active'),
  supabase.from('crane_parts').select('id').eq('cost_id', costId)
]);
```

**Validación de contraseña**:
```typescript
const { error } = await supabase.auth.signInWithPassword({
  email: user.email,
  password: inputPassword
});
if (error) throw new Error('Contraseña incorrecta');
// Proceder con deleteCost
```

Si el costo NO tiene datos relacionados, se muestra solo una confirmación simple sin pedir contraseña (para no entorpecer eliminaciones de costos simples).

