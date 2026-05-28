
## Enfoque revisado: asociación al momento del XML (sin marcar el costo previamente)

Tu propuesta es mejor por tres razones:
1. **No obliga al usuario a anticipar** si la factura llegará por XML (la mayoría de costos lo son).
2. **No agrega un toggle ni campos al form de costos** — cero fricción operativa diaria.
3. **Aprovecha 100%** lo que ya existe: la RPC `find_matching_costs_for_invoice` y `useLinkInvoiceToCost` ya hacen el trabajo pesado.

El cambio se concentra en **mejorar el panel de asociación del modal `XMLDocumentUpload`** para que sea más inteligente, más visible y más a prueba de duplicados.

## Cambios propuestos (todos en el modal XML)

### 1. Ampliar la búsqueda de costos candidatos
Hoy: RPC busca por `supplier_rut` + monto ±5% en ventana de ±7 días.

Mejoras:
- **Ventana ampliable a ±15 días** (default 7, con botón "Ampliar búsqueda" si no encuentra match).
- **Doble criterio de búsqueda**: primero por `supplier_id` (FK directo, más confiable), y como fallback por `supplier_rut` (texto).
- **Excluir** costos que ya tienen `supplier_invoice_id` (ya facturados) para no contaminar la lista.

### 2. Panel de asociación rediseñado
En el step de matching del wizard (`XMLDocumentUpload.tsx:1360-1390`), para cada documento XML mostrar:

```text
┌────────────────────────────────────────────────────────┐
│  Factura 12345 — Proveedor X — $245.000                │
│  Emisión: 25-may-2026                                   │
│                                                          │
│  💡 Encontramos 2 costos posibles de este proveedor:    │
│                                                          │
│  ◉ Costo del 23-may $245.000 "Repuesto bomba" [✓ exacto]│
│  ○ Costo del 20-may $240.000 "Mantención" [≈ similar]   │
│  ○ Crear nuevo costo (no vincular a ninguno existente)  │
│                                                          │
│  [Ver detalle del costo seleccionado] [Ampliar ±15 días]│
└────────────────────────────────────────────────────────┘
```

Detalles:
- **Auto-seleccionar match exacto** (monto idéntico + mismo proveedor + ≤7 días).
- **Marcar como "exacto" / "similar" / "posible"** con badges del design system (violeta/ámbar).
- Botón **"Ver detalle"** que abre un popover con descripción, categoría, grúa, operador asignados al costo candidato — clave para que el usuario confirme que es el correcto antes de vincular.
- Mostrar **antigüedad** del costo ("hace 3 días") para dar contexto temporal.

### 3. Prevención activa de duplicados
- Si hay **un match exacto único**, mostrar advertencia visual cuando el usuario intente cambiar a "Crear nuevo costo": *"⚠️ Existe un costo idéntico sin factura. ¿Seguro que quieres crear uno nuevo y dejar el otro huérfano?"* (modal de confirmación).
- Al hacer hover sobre cada costo candidato, **resaltar** el monto, fecha y proveedor coincidentes vs el XML (visual diff).

### 4. Hint en el formulario de creación de costos (opcional, mínimo)
Sin agregar campos, solo un texto bajo el botón de guardar:
> *"💡 Si el proveedor enviará factura electrónica después, podrás vincularla automáticamente al subir el XML — solo asegúrate de asignar el proveedor."*

Esto educa sin agregar fricción.

## Lo que NO hacemos (vs el plan anterior)

- ❌ No agregamos columna `invoice_status` ni enum
- ❌ No agregamos toggle "pendiente factura" al CostForm
- ❌ No creamos vista "costos esperando factura"
- ❌ No tocamos triggers ni schema de `costs`

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/suppliers/XMLDocumentUpload.tsx` | Rediseño del panel de matching (líneas ~1360-1390), confirm de duplicado, botón ampliar ventana, panel de detalle del costo candidato |
| `src/components/suppliers/XMLDocumentUpload.tsx` (analyze step, ~529-565) | Llamar a la RPC con búsqueda por `supplier_id` además de `rut`, excluir ya-facturados |
| RPC `find_matching_costs_for_invoice` (migración SQL) | Aceptar parámetro opcional `p_supplier_id`, `p_window_days` (default 7), excluir costos con `supplier_invoice_id IS NOT NULL` |
| `src/components/costs/CostForm.tsx` | Solo agregar el hint informativo (1 línea de texto) |

## Resultado para el usuario

- **Caso "factura llega 3 días después"**: usuario crea costo manualmente con el proveedor asignado. Cuando llega el XML, sube el archivo → el modal muestra el costo pre-seleccionado con badge "✓ exacto" → confirma → queda vinculado. Cero duplicados.
- **Caso "factura llega el mismo día"**: funciona igual que hoy.
- **Caso "factura ya estaba importada"**: el sistema detecta duplicado (ya existe), bloquea import.

Mucho más simple, menos invasivo, y resuelve el problema real.
