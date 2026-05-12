## Objetivo
Hacer que el folio del servicio en la tabla de Comisiones sea clickeable y abra el detalle del servicio, igual que en el módulo de Costos.

## Cambios
**`src/components/commissions/CommissionTable.tsx`** (único archivo a tocar)

1. Importar `ServiceDetailsModal` desde `@/components/services/ServiceDetailsModal` y `useState`.
2. Agregar estado local `selectedServiceId` y handler `handleServiceClick(commission)` que setea `commission.service_id`.
3. Reemplazar el render del folio (vista desktop y mobile) por un `<button>` con el mismo estilo violeta que Costos:
   ```
   className="text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 underline cursor-pointer"
   ```
   Solo se hace clickeable cuando `commission.service_id` existe; si no, se muestra como texto plano (caso `service_folio` huérfano).
4. Renderizar `<ServiceDetailsModal serviceId={selectedServiceId} open={!!selectedServiceId} onClose={() => setSelectedServiceId(null)} />` al final del componente.

## Alcance
- Solo UI/presentación. No se toca lógica de negocio, hooks, RPC ni tipos.
- Se respeta el patrón de Costos (mismo color violeta, mismo modal de detalle).
- Aplica tanto a la vista de tabla (desktop) como a las cards (mobile).
