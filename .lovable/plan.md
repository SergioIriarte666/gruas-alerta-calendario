## Objetivo

Agregar una nueva pestaña **"Anular Compra"** dentro del panel de Configuración → Liberación, que permita revertir de forma segura y completa una compra de bodega (con o sin consumo inmediato), eliminando en cascada todos sus rastros: costo, movimientos de inventario, pago a proveedor y vinculación con factura/XML. Diseñada para casos como compras devueltas por producto erróneo, con reembolso del proveedor.

Pensada como **herramienta de admin** (igual que las otras del panel), no para uso diario.

---

## Ubicación

`Configuración → Liberación → [nueva pestaña] Anular Compra`

Junto a las pestañas existentes: Liberación, Forzar Estado, Reparación Masiva, Eliminar Servicio, Reconexión Pagos.

Icono: `PackageX` (lucide-react), siguiendo el patrón visual de las otras pestañas.

---

## Flujo de la herramienta (UI)

### 1. Búsqueda de la compra
- Buscador que filtre **costos vinculados a inventario** (`costs` con `inventory_movement_id` no nulo, o que tengan `purchase_quantity` definido).
- Filtros: por proveedor, por rango de fechas, por descripción/producto.
- Lista de resultados estilo tabla con: fecha, proveedor, producto, cantidad, monto, estado de pago, badge si tuvo consumo inmediato.

### 2. Vista previa de impacto
Al seleccionar una compra, mostrar un panel que liste exactamente qué se va a revertir:

- **Costo**: ID, monto, descripción.
- **Movimiento de entrada en bodega**: producto, cantidad, ubicación.
- **Movimiento de salida** (si hubo consumo inmediato): grúa destino o consumo.
- **Pago a proveedor** (si existe): folio, monto, fecha.
- **Factura/XML vinculada** (si existe): folio, RUT del emisor.
- **Stock resultante** después de la reversa (validación: que no quede negativo).

Cada elemento con un check para que el admin confirme qué quiere revertir (por defecto todos marcados).

### 3. Motivo y confirmación
- Campo obligatorio **Motivo de la anulación** (texto libre): "Producto incorrecto", "Devolución por defecto", etc.
- Campo opcional **Proveedor que reemplaza** (selector de proveedores) — solo informativo, queda en el log.
- Confirmación con el patrón existente: escribir **"ANULAR"** para habilitar el botón.

### 4. Ejecución y resultado
- Llamada a una RPC transaccional en Supabase que ejecuta toda la cascada en una transacción (todo o nada).
- Toast de éxito con resumen: "Compra anulada: 1 costo, 2 movimientos, 1 pago revertidos."
- Registro en una tabla de auditoría `purchase_voids` con: usuario, fecha, motivo, snapshot del costo eliminado.

---

## Diseño técnico

### Archivos nuevos
- `src/components/admin/PurchaseVoidTool.tsx` — UI de la herramienta.
- `src/hooks/admin/usePurchaseVoid.ts` — hook con la mutación.

### Archivos modificados
- `src/components/admin/AdminEmergencyPanel.tsx` — agregar la nueva `TabsTrigger` y `TabsContent`. Cambiar `md:grid-cols-5` a `md:grid-cols-6`.

### Base de datos (migración)

**Nueva tabla de auditoría** `purchase_voids`:
```
- id (uuid pk)
- voided_at (timestamptz)
- voided_by (uuid, fk user)
- reason (text)
- replacement_supplier_id (uuid, nullable)
- original_cost_snapshot (jsonb)  -- snapshot completo
- original_movements_snapshot (jsonb)
- original_payment_snapshot (jsonb)
- original_invoice_link_snapshot (jsonb, nullable)
```
RLS: solo admin puede insertar/leer.

**Nueva función RPC** `void_inventory_purchase(p_cost_id uuid, p_reason text, p_replacement_supplier_id uuid, p_revert_payment bool, p_revert_invoice bool)`:
- `SECURITY DEFINER`, validación de rol admin con `has_role(auth.uid(), 'admin')`.
- Dentro de una transacción:
  1. Toma snapshots de `costs`, `inventory_movements` (entrada y salida), `supplier_payments`, `supplier_invoices` vinculadas.
  2. Valida que el stock no quede negativo después de revertir la entrada.
  3. Elimina movimiento de salida (si existe) → recalcula stock vía trigger existente.
  4. Elimina movimiento de entrada → recalcula stock vía trigger existente.
  5. Si `p_revert_payment`: elimina `supplier_payments` y aplicaciones asociadas (respetando idempotencia del sync existente).
  6. Si `p_revert_invoice`: desvincula o elimina la fila en `supplier_invoices`/`supplier_invoice_items`.
  7. Elimina la fila en `costs`.
  8. Inserta registro en `purchase_voids` con todos los snapshots.
  9. Devuelve resumen de lo revertido.
- Si cualquier paso falla, rollback completo.

### Validaciones críticas
- Bloquear si el costo está dentro de un **cierre contable cerrado** → mostrar error claro.
- Bloquear si la **factura vinculada ya está conciliada con SII** → opción de solo desvincular (no eliminar).
- Bloquear si el movimiento de entrada ya fue **consumido por otros movimientos posteriores** distintos del consumo inmediato propio → mostrar advertencia y forzar resolución manual.
- Si el pago ya fue parte de una **conciliación bancaria**, advertir y permitir omitir la reversa del pago (queda como saldo a favor del proveedor).

---

## Estilo

Seguir el patrón del Módulo de Costos (instrucción del proyecto):
- Cards `border-l-4 border-l-violet-500` para totales/resúmenes.
- Botón principal `bg-violet-600 hover:bg-violet-700`.
- Badges de estado con la paleta semántica (rojo para destrucción, violeta para confirmaciones).
- Modal de confirmación con `Textarea` para el motivo (patrón Cost/Inventory Descriptions).
- Tipografía y tamaños iguales a `ServiceDeletionTool` y `PaymentReassignmentTool`.

---

## Casos cubiertos

1. **Tu caso actual**: compra a Proveedor A con consumo inmediato → anulación completa → registrar luego compra normal a Proveedor B.
2. Compra a bodega sin consumo inmediato (producto recibido pero erróneo, devuelto antes de usar).
3. Compra duplicada por error de captura.
4. Compra registrada al proveedor equivocado donde es más limpio anular y rehacer que editar.

No cubre: notas de crédito formales del SII (eso requeriría el flujo de Opción 2 de la conversación previa, fuera de alcance).

---

## Resumen de cambios

| Archivo | Tipo |
|---|---|
| `src/components/admin/PurchaseVoidTool.tsx` | Nuevo |
| `src/hooks/admin/usePurchaseVoid.ts` | Nuevo |
| `src/components/admin/AdminEmergencyPanel.tsx` | Editado |
| Migración SQL: tabla `purchase_voids` + RLS + RPC `void_inventory_purchase` | Nuevo |

Cuando apruebes, paso a modo build e implemento la migración primero (con tu confirmación) y luego la UI.