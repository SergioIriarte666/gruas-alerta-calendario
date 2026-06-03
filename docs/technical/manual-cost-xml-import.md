# Importacion manual de XML en costos

## Objetivo

Agregar una importacion manual desde la edicion de un costo para cargar una factura XML compatible con el importador existente, previsualizar los cambios, aplicar la actualizacion con auditoria y permitir la reversion posterior.

## Componentes involucrados

- `src/components/costs/CostForm.tsx`
- `src/components/costs/ManualCostXmlImportDialog.tsx`
- `src/services/manualCostXmlImport.ts`
- `src/utils/xmlParser/xmlSupplierParser.ts`
- `src/services/__tests__/manualCostXmlImport.test.ts`

## Flujo funcional

1. El usuario abre un costo existente en modo edicion.
2. Desde el encabezado del formulario usa `Importar XML manual`.
3. El sistema analiza el archivo con `XMLSupplierParser`, la misma base que utiliza el importador XML actual.
4. Se valida que el XML contenga un solo documento utilizable y que incluya folio, fecha de emision, monto total y RUT del proveedor.
5. Se genera una vista previa con:
   - datos detectados del documento
   - conceptos detallados
   - diferencias contra el costo actual
   - conflictos o advertencias
6. El usuario elige el modo:
   - `Complementar`: solo rellena campos vacios
   - `Sobrescribir`: reemplaza valores existentes
7. Si hay conflictos, el usuario debe confirmarlos de forma explicita.
8. Al confirmar, el sistema:
   - verifica permisos (`admin` u `operator`)
   - resuelve o crea el proveedor
   - crea o actualiza la `supplier_invoice`
   - actualiza el costo
   - sincroniza `supplier_payments` si el costo ya tenia un pago relacionado
   - registra snapshot en `cost_change_history`
   - registra evento en `audit_log`
9. El usuario puede revertir la ultima importacion XML manual pendiente desde el mismo dialogo.

## Mapeo de campos XML

| XML | Destino | Regla |
| --- | --- | --- |
| `Folio` / `folio` | `costs.document_number` | Se completa o sobrescribe segun el modo |
| `TipoDTE` / `document_type` | `costs.document_type` | Se almacena como etiqueta del documento |
| `Folio` / `folio` | `costs.service_folio` | Se usa como referencia visible y para compatibilidad con flujos existentes |
| `MntTotal` / `total_amount` | `costs.amount` | Se usa como monto facturado |
| `Detalle[].NmbItem` / items | `costs.description` | Se sintetiza una glosa principal a partir de los conceptos |
| proveedor detectado | `costs.supplier_id` | Se reutiliza o crea en `inventory_suppliers` |
| fecha emision | `supplier_invoices.issue_date` | No reemplaza `costs.date`, porque el costo conserva la fecha original del gasto |
| fecha vencimiento | `supplier_invoices.due_date` | Se usa la fecha del XML o fallback a fecha emision |
| neto | `supplier_invoices.net_amount` | Persistencia de factura vinculada |
| IVA | `supplier_invoices.tax_amount` | Persistencia de factura vinculada |
| total | `supplier_invoices.amount` | Persistencia de factura vinculada |
| descripcion y conceptos | `supplier_invoices.description` y `supplier_invoices.product_service_description` | Resumen de la factura |
| conceptos detallados | `costs.notes` | Se agregan como bloque trazable `[XML IMPORTADO MANUALMENTE]` |

## Compatibilidad con el importador existente

- El parseo reutiliza `XMLSupplierParser`.
- La resolucion de proveedores usa `inventory_suppliers`, igual que los flujos XML actuales.
- La factura vinculada se guarda en `supplier_invoices`.
- Se define `source_module = manual_cost_xml` para coexistir con otros importadores sin colisionar.

## Validaciones y manejo de errores

- XML sin documento valido
- XML con multiples documentos
- ausencia de folio, fecha, monto o RUT
- factura ya vinculada a otro costo
- conflicto entre proveedor del costo y proveedor del XML
- diferencia de monto entre costo registrado y XML
- distancia alta entre fecha del costo y fecha de emision del XML
- costo con otra factura ya vinculada y compartida con otros registros
- usuarios sin permiso de edicion

## Auditoria y trazabilidad

Se registran dos mecanismos:

- `cost_change_history`
  - snapshot con `field_name = manual_xml_import_snapshot:<uuid>`
  - snapshot de reversion con `field_name = manual_xml_import_revert:<uuid>`
  - `change_context` serializa documento XML, modo, factura antes/despues y pago antes/despues
- `audit_log`
  - `operation = MANUAL_XML_IMPORT`
  - `operation = MANUAL_XML_IMPORT_REVERT`

## Reversion

La reversion restaura:

- campos del costo afectados por la importacion
- referencia a la factura vinculada
- pago relacionado, si existia
- eliminacion de la factura creada por la importacion cuando corresponde

## Consideraciones tecnicas

- `costs.date` no se reemplaza con `issue_date`; se preserva la fecha original del gasto.
- La importacion manual se desactiva si el formulario tiene cambios sin guardar para evitar inconsistencias entre el estado local y el snapshot persistido.
- Se corrigio el parseo de fechas `YYYY-MM-DD` en `xmlSupplierParser` para evitar desfases por zona horaria.
