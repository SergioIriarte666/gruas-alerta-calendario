

## Plan: Prevención de borrado para facturas no históricas

### Problema
Las facturas reales de la app (folio `SRV-*`) se pueden eliminar con un simple `window.confirm`, lo que causó pérdida de cierres y datos asociados.

### Solución
Agregar protección multinivel para facturas no históricas (las que NO tienen folio `HIST-*`):

#### 1. `useInvoiceOperations.ts` — Guard en `deleteInvoice`
Al inicio de la función, verificar si la factura es histórica consultando su folio. Si **no** es histórica, lanzar error con mensaje claro. Agregar un parámetro `force: boolean` que solo se pase cuando el usuario confirme mediante el diálogo de seguridad reforzado.

```typescript
const deleteInvoice = async (id: string, { force = false }: { force?: boolean } = {}) => {
  // Obtener factura para verificar tipo
  const { data: invoice } = await supabase.from('invoices').select('folio').eq('id', id).single();
  const isHistorical = invoice?.folio?.startsWith('HIST-');
  
  if (!isHistorical && !force) {
    throw new Error('PROTECTED_INVOICE'); // señal para UI
  }
  // ... resto del flujo existente
};
```

#### 2. `Invoices.tsx` — Diálogo de confirmación reforzado para facturas de app
Reemplazar el `window.confirm` por un `AlertDialog` con confirmación por texto (similar a `ClosureEmergencyActions`). El usuario debe escribir `ELIMINAR` + folio para confirmar. Para históricas, mantener confirmación simple.

#### 3. `Invoices.tsx` — Batch delete con protección
En `handleBatchDelete`, separar facturas históricas de las de app. Si hay facturas de app en la selección, mostrar el diálogo de confirmación reforzado antes de proceder. Solo las históricas se eliminan con confirmación simple.

#### 4. `InvoiceBatchActions.tsx` — Indicador visual
Mostrar un badge de advertencia cuando la selección incluya facturas no históricas, informando que requieren confirmación adicional.

### Archivos a modificar
- `src/hooks/invoices/useInvoiceOperations.ts` — agregar parámetro `force`
- `src/pages/Invoices.tsx` — AlertDialog de confirmación reforzada + lógica batch
- `src/components/invoices/InvoiceBatchActions.tsx` — badge de advertencia
- `src/hooks/useInvoices.ts` — propagar parámetro `force`

