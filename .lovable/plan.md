
# Corregir datos obsoletos al re-importar OC desde PDF

## Problema

Cuando el usuario borra una OC de un servicio y luego sube el mismo PDF nuevamente, el importador sigue mostrando que la OC ya esta asignada. Esto ocurre porque el hook `usePurchaseOrderPDFImport` usa el array de `services` que recibe como prop, el cual esta desactualizado (cache del estado anterior).

## Solucion

Antes de ejecutar el matching, hacer un refetch de los servicios del cliente directamente desde la base de datos dentro de `processFiles`, para tener siempre los datos mas recientes.

## Detalle tecnico

### Archivo: `src/hooks/vip/usePurchaseOrderPDFImport.ts`

1. Agregar una consulta directa a Supabase dentro de `processFiles`, justo antes de la fase de matching (linea ~105), para obtener los servicios frescos del cliente en lugar de usar el array `services` del prop.

2. Reemplazar `const clientServices = services.filter(...)` por una consulta fresca:
   - Consultar `supabase.from('services').select(...)` filtrado por `client_id`
   - Transformar los datos al formato `Service[]`
   - Usar estos datos frescos para el matching

3. Alternativa mas simple: pasar una funcion `refetch` como parametro al hook y llamarla antes de matching, luego usar los servicios actualizados.

La opcion mas limpia es recibir la funcion `refetch` del padre y llamarla antes de hacer el matching, ya que reutiliza la logica de transformacion existente.

### Archivo: `src/pages/VipClientPipeline.tsx`

- Pasar la funcion `refetch` del hook `useClientServices` como prop al componente `PurchaseOrderPDFImporter`.

### Archivo: `src/components/vip/PurchaseOrderPDFImporter.tsx`

- Agregar prop `onRefreshServices` que devuelva los servicios frescos.
- Pasarla al hook `usePurchaseOrderPDFImport`.

### Flujo actualizado

```text
1. Usuario sube PDF
2. Se procesan los PDFs con la Edge Function
3. NUEVO: Se refetch de servicios del cliente desde la BD
4. Se ejecuta el matching con datos frescos
5. Se muestra la preview con estados correctos
```
