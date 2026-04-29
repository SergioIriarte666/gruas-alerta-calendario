## Diagnóstico

El registro del **Óptico Izquierdo Mack Vision** sí existe, pero el costo principal quedó guardado como:

- `description`: `Implementos S.A.`
- `notes`: contiene `Glosa principal: Optico Izquierdo Mack Vision`
- `supplier_invoice_id`: factura `6475314`
- La factura tiene varios ítems (`Optico Izquierdo`, `Paños`, `LimpiaVidrios`, etc.)
- Los movimientos sí tienen `item_name = Optico Izquierdo Mack Vision`

La búsqueda actual todavía no es lo suficientemente robusta porque prioriza campos del costo y movimientos básicos, pero no indexa correctamente todas las fuentes donde puede vivir el nombre real del producto:

- `supplier_invoice_items.description`
- `supplier_invoice_items.product_name`
- `inventory_items.name`
- términos separados: buscar `optico izquierdo mack` debería coincidir aunque las palabras estén repartidas entre nota, ítem o movimiento.

## Plan de corrección inmediata

### 1. Búsqueda sin tildes y por palabras

Actualizar `search_voidable_inventory_purchases` para:

- Ignorar mayúsculas/minúsculas.
- Ignorar tildes: `óptico`, `optico`, `ÓPTICO` deben ser equivalentes.
- Dividir el texto buscado en palabras.
  - Ejemplo: `Optico Izquierdo Mack` → `optico`, `izquierdo`, `mack`.
- Devolver un costo si **todas las palabras** aparecen en algún texto agregado del registro.

### 2. Construir un “texto de búsqueda” consolidado por costo

Para cada costo anulable, construir internamente un campo virtual con:

- `costs.description`
- `costs.document_number`
- `costs.service_folio`
- `costs.notes`
- nombre del proveedor
- nombres de ítems en `supplier_invoice_items.description`
- `supplier_invoice_items.product_name`
- `inventory_items.name` desde movimientos relacionados
- `inventory_movements.observations`
- `inventory_movements.reference_document`
- `inventory_movements.supplier_name`

Así el costo `Implementos S.A.` aparecerá aunque el producto esté solo dentro de la factura XML o movimientos.

### 3. Mejorar el ranking de resultados

Ordenar resultados por relevancia:

1. Coincidencia exacta por folio/documento.
2. Coincidencia en descripción directa del costo.
3. Coincidencia en ítems de factura o movimiento.
4. Coincidencia en notas/proveedor.
5. Fecha descendente.

Resultado esperado:

- Buscar `optico` → muestra Derecho e Izquierdo.
- Buscar `óptico` → muestra Derecho e Izquierdo.
- Buscar `Optico Izquierdo Mack` → muestra el registro `6475314` aunque su descripción sea `Implementos S.A.`.
- Buscar `6475314` → muestra el registro izquierdo.
- Buscar `6475315` → muestra el registro derecho.

### 4. Ajuste visual mínimo

En la lista de resultados, cuando la descripción del costo sea genérica (`Implementos S.A.`) pero exista un ítem coincidente, mostrar una línea secundaria tipo:

`Ítem encontrado: Optico Izquierdo Mack Vision`

Esto evitará confusión: el usuario sabrá por qué apareció un costo cuyo título principal no contiene el producto.

### 5. Luego abordar anulación parcial de factura multi-ítem

Después de estabilizar la búsqueda, implementar el flujo acordado:

- Si la factura tiene 1 ítem → anulación total.
- Si tiene varios ítems → selector de ítems.
- El ajuste de monto se calcula automáticamente, pero queda editable antes de confirmar.

Este plan separa el problema urgente de búsqueda del flujo más grande de anulación parcial, para evitar mezclar dos fuentes de error.