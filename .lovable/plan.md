Detecté que el problema no es solo visual. El caso real existe en la base de datos:

- Costo: `Implementos S.A. Optico Derecho Mack Vision`
- Folio/documento: `6475315`
- Costo ID: `e39b8184-6eba-49b7-b911-efcc4595abef`
- Está marcado como `immediate_consumption = true`
- Tiene 2 movimientos vinculados: una salida de consumo y una entrada XML

El flujo actual falla por dos causas probables:

1. La búsqueda depende demasiado del cliente y de filtros incompletos; si el costo viene de XML/consumo inmediato, puede quedar fuera o sin datos suficientes.
2. La RPC de anulación asume que `cost.inventory_movement_id` apunta a la entrada, pero en este caso apunta a la salida. Además, al borrar movimientos puede chocar con referencias como `crane_parts.inventory_movement_id`.

Plan de corrección:

1. Crear una RPC de búsqueda segura para compras anulables
   - Nueva función `search_voidable_inventory_purchases(p_search text)` con `SECURITY DEFINER` y validación admin.
   - Buscará por:
     - folio/document_number
     - service_folio
     - descripción
     - notas
     - proveedor registrado en `suppliers`
     - supplier_name/reference_document dentro de `inventory_movements`
   - No dependerá de joins embebidos del frontend ni de filtros RLS ambiguos.
   - Devolverá siempre los costos que tengan relación real con bodega por:
     - `inventory_movements.cost_id = costs.id`
     - `costs.inventory_movement_id`
     - `purchase_quantity`
     - `supplier_invoice_id` con movimientos vinculados

2. Crear una RPC de vista previa de impacto
   - Nueva función `get_purchase_void_impact(p_cost_id uuid)`.
   - Resolverá todos los movimientos relacionados, aunque el vínculo principal sea una salida y no una entrada.
   - Mostrará entrada, salida, ítem, ubicación, grúa, factura/XML, pago y stock proyectado.
   - El cálculo de stock será correcto para consumo inmediato: si se elimina entrada y salida del mismo costo, el stock neto no debería bloquearse falsamente.

3. Reforzar la RPC `void_inventory_purchase`
   - Antes de borrar movimientos:
     - guardar snapshot completo para auditoría
     - limpiar `costs.inventory_movement_id`
     - limpiar `crane_parts.inventory_movement_id` / eliminar piezas generadas por ese costo según corresponda
     - limpiar `inventory_consumptions.movement_id` si existiera
     - limpiar `supplier_invoice_items.movement_id` si corresponde
   - Borrar todos los movimientos relacionados al costo, no solo el `inventory_movement_id` directo.
   - Manejar correctamente compras de consumo inmediato donde hay entrada + salida.
   - Mantener validación admin y auditoría en `purchase_voids`.

4. Actualizar el hook `usePurchaseVoid`
   - Reemplazar la búsqueda actual contra `costs` por llamada a `search_voidable_inventory_purchases`.
   - Reemplazar el cálculo de impacto del frontend por `get_purchase_void_impact`.
   - Mejorar mensajes de error para que si algo falla indique exactamente si fue por permiso, referencia FK, stock o factura/pago vinculado.

5. Actualizar la UI de `PurchaseVoidTool`
   - Mantener estilo del módulo de Costos y el esquema violeta.
   - Mostrar un bloque de diagnóstico cuando no haya resultados:
     - “Prueba con folio/documento exacto”
     - “Solo aparecen compras con vínculo a bodega”
     - botón para recargar
   - Mostrar Folio/Documento de forma separada para evitar confusión.
   - Si se busca `6475315`, debe aparecer el costo identificado.

6. Validación puntual del caso reportado
   - Verificar por SQL que `6475315` aparece en la búsqueda.
   - Verificar que la vista previa incluya sus 2 movimientos.
   - Verificar que la anulación no falle por `crane_parts` ni por stock falso negativo.

Resultado esperado:

- En Configuración → Liberación → Anular Compra, al buscar `6475315` u `Optico`, la compra aparecerá.
- Al seleccionarla, mostrará claramente qué costo, movimientos, pago y factura/XML se anularán.
- Al confirmar con “ANULAR” y motivo, la acción debería completarse y dejar auditoría en `purchase_voids`.