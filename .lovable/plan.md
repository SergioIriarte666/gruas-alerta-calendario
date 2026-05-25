## Problema

Al importar Cotizaciones u Órdenes de Compra desde PDF en el pipeline VIP, si una misma patente tiene varios servicios (con distintos folios), el sistema elige automáticamente uno (el primero sin cotización/OC o el más reciente) y no expone los demás. El usuario no puede redirigir la actualización al servicio correcto, y los demás folios quedan "invisibles".

## Solución

En el paso "preview" del importador, cuando una patente tenga 2 o más servicios candidatos del cliente, mostrar un **selector de servicio** dentro de la fila (en la columna "Servicio") con todos los folios candidatos. El usuario podrá:

- Mantener la sugerencia automática (default actual).
- Cambiar el servicio destino a otro folio de la misma patente.
- Ver fecha del servicio y si ya tiene cotización/OC asignada junto al folio en el dropdown.

El badge de estado (Match / Cot. diferente / Ya asignada) se recalcula en vivo según la selección.

## Cambios

### 1. `src/hooks/vip/useQuotePDFImport.ts`
- Extender `MatchedQuoteService` con `candidates: Service[]` (todos los servicios del cliente con la misma patente, ordenados por fecha desc).
- En el matching por patente: además de elegir el "best" actual, adjuntar `candidates` con todos los servicios coincidentes (sin filtrar por `usedServiceIds`, ya que el usuario puede reasignar).
- Exponer una acción `reassignMatch(index, serviceId)` que actualice el `service` del match, recalcule `status` (`matched` si no tiene cotización, `already_has_quote` si tiene una distinta, `same_quote` si coincide) y libere/ocupe IDs en `usedServiceIds`.

### 2. `src/hooks/vip/usePurchaseOrderPDFImport.ts`
- Mismos cambios análogos (campo `candidates`, acción `reassignMatch`, estados equivalentes para OC).

### 3. `src/components/vip/QuotePDFImporter.tsx`
- En la columna "Servicio", si `match.candidates.length > 1`, renderizar un `Select` (shadcn) con cada candidato:
  - Label: `FOLIO (dd/MM) — Cot: COT-XXXX | Sin cotización`.
  - Valor: `service.id`.
- Si solo hay 1 candidato (o ninguno), mantener el botón actual con el folio enlazado al `ServiceDetailsModal`.
- Mantener el botón "ver detalle" como ícono pequeño junto al Select para previsualizar el servicio seleccionado.

### 4. `src/components/vip/PurchaseOrderPDFImporter.tsx`
- Misma adaptación visual para OC.

## Diseño (consistente con Módulo Costos)
- Usar `Select` de `@/components/ui/select` (mismo componente usado en los formularios de costos).
- Texto en `text-xs`, fuente `font-mono` para folios.
- Badges existentes (violeta/ámbar/azul/rojo) se preservan y se recalculan al cambiar la selección.

## Fuera de alcance
- No tocar parsing IA/local del PDF.
- No tocar matching por VIN difuso ni por monto cuando no hay patente.
- No modificar `applyMatches` más allá de leer el `service` ya reasignado.

## Verificación
1. Cliente con patente `VHVV-32` que tenga 3 servicios (SRV-6686, SRV-6700, SRV-6710). Importar cotización: la fila debe mostrar un Select con los 3 folios; default = el primero sin cotización.
2. Cambiar la selección a otro folio → el badge cambia entre `Match` y `Cot. diferente` según el estado del servicio seleccionado.
3. Aplicar → se actualiza el folio seleccionado por el usuario, no la sugerencia inicial.
4. Patente con 1 solo servicio: comportamiento idéntico al actual (sin Select).
5. Repetir flujo equivalente con Importador de OC.
