
# Filtrar servicios no completados y abrir modal de detalles desde el importador de OC

## Problema

1. El importador hace match con servicios que aun no estan finalizados (ej: estado "pending" o "in_progress"), lo cual genera confusiones porque pueden ser servicios en curso de la misma patente.
2. No se puede verificar el servicio propuesto antes de aplicar la OC -- el folio no es clickeable.

## Solucion

### 1. Filtrar solo servicios completados (archivo: `usePurchaseOrderPDFImport.ts`)

Agregar un filtro adicional en la linea donde ya se excluyen los facturados. Solo servicios con estado `completed` o `with_purchase_order` seran candidatos para asignar una OC nueva:

```text
// Excluir servicios no finalizados y facturados del matching
clientServices = clientServices.filter(s => 
  s.status !== 'invoiced' && 
  (s.status === 'completed' || s.status === 'with_purchase_order')
);
```

Esto descarta servicios en estados `pending`, `in_progress`, `quoted`, etc.

### 2. Folio clickeable para abrir modal de detalles (archivo: `PurchaseOrderPDFImporter.tsx`)

- Agregar un estado `previewService` para controlar que servicio mostrar en el modal.
- Cambiar el folio de `<span>` a `<button>` con estilo de enlace (subrayado, color primary).
- Importar y renderizar `ServiceDetailsModal` al final del componente.

Cambios puntuales:
- Importar `ServiceDetailsModal` y `useServiceDetails`.
- Estado: `const [previewServiceId, setPreviewServiceId] = useState<string | null>(null)`.
- En la celda del folio: boton clickeable que llama `setPreviewServiceId(match.service.id)`.
- Renderizar el modal condicionalmente al final, usando `useServiceDetails` para obtener datos enriquecidos del servicio.

## Archivos a modificar

- `src/hooks/vip/usePurchaseOrderPDFImport.ts` -- filtro de estado
- `src/components/vip/PurchaseOrderPDFImporter.tsx` -- folio clickeable + modal
