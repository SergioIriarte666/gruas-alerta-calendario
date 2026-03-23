

## Plan: Vincular XML a costos existentes (modo "Asociar Factura")

### Problema actual

Cuando se registra un costo manualmente (ej. compra de piezas) y el proveedor envía la factura XML 1-2 días después, no hay forma de vincular esa factura al costo existente. La única opción actual es importar el XML, lo que crea un NUEVO pago + costo duplicado.

### Solución

Agregar un modo **"Asociar a costo existente"** en el importador XML (`XMLDocumentUpload`). El flujo sería:

1. El usuario sube el XML como siempre
2. El sistema detecta automáticamente costos existentes que coincidan (mismo proveedor/RUT + monto similar ±5% + fecha cercana ±7 días)
3. Para cada documento con match, muestra la opción: **"Crear nuevo"** vs **"Vincular a costo existente #X"**
4. Si se vincula, actualiza el costo existente con los datos del XML (folio, fecha exacta, descripción del DTE) y crea/actualiza la factura en `supplier_invoices`

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/suppliers/XMLDocumentUpload.tsx` | Agregar lógica de matching contra costos existentes y opción de vincular vs crear nuevo |
| `src/hooks/useCosts.ts` | Agregar función `linkInvoiceToCost(costId, invoiceData)` que actualiza el costo con datos del XML |
| Nueva migración SQL | Función RPC `find_matching_costs_for_invoice(rut, amount, date_range)` para buscar costos candidatos eficientemente |

### Detalle técnico

**1. Función RPC para buscar costos candidatos:**
```sql
CREATE FUNCTION find_matching_costs_for_invoice(
  p_supplier_rut text,
  p_amount numeric,
  p_date_from date,
  p_date_to date
) RETURNS TABLE (id uuid, description text, amount numeric, date date, ...)
-- Busca costos sin factura vinculada, del mismo proveedor, monto ±5%, fecha en rango
```

**2. En XMLDocumentUpload, después del análisis:**
- Para cada documento parseado, llamar a la RPC para buscar matches
- Mostrar un selector: "Vincular a [Descripción del costo - $Monto - Fecha]" o "Crear nuevo pago"
- Los documentos vinculados actualizan el costo existente en vez de crear uno nuevo

**3. Al vincular un documento XML a un costo existente:**
```typescript
// Actualizar el costo con datos del XML
await supabase.from('costs').update({
  notes: `Factura ${folio} - ${description}`, // enriquecer notas
  updated_at: new Date().toISOString()
}).eq('id', costId);

// Crear la factura en supplier_invoices vinculada al pago existente
await supabase.from('supplier_invoices').insert({
  supplier_id, invoice_number: folio, 
  amount, issue_date, ...
});

// Vincular factura al pago existente
await supabase.from('supplier_payments').update({
  supplier_invoice_id: newInvoice.id,
  reference_number: folio
}).eq('cost_id', costId);
```

### UX en el importador

En la sección de documentos del XML, cada tarjeta mostrará:
- Badge azul "🔗 Costo encontrado" si hay match
- Dropdown para seleccionar cuál costo vincular (puede haber más de uno)
- El comportamiento por defecto será vincular si hay match exacto (mismo monto + mismo RUT)

### Lo que NO se toca

- Flujo de importación XML normal (crear nuevos) sigue funcionando igual
- Triggers de sincronización existentes — la vinculación usa los mismos campos (`supplier_payment_id`, `cost_id`)
- Módulos de Grúas, Bodega, Reportes — no afectados

