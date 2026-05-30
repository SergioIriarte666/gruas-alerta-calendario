## Objetivo

En el modal "Importar OC desde PDF", mostrar el número de cotización (`quoteNumber`) junto al folio del servicio para diferenciar servicios de la misma patente. Solo cambio visual; no se altera la lógica de matching ni de aplicación.

## Archivo a modificar

`src/components/vip/PurchaseOrderPDFImporter.tsx` — columna "Servicio" (líneas ~211-263).

## Cambios

1. **Caso múltiples candidatos (`Select` de Radix, líneas 215-247)**: en cada `SelectItem`, después del folio y antes de la fecha, añadir `· Cot: {quoteNumber}` si `cand.quoteNumber` existe. Mantener el resto del formato (`(dd/MM)` y `· OC`/`sin OC`).

2. **Caso un solo candidato (botón con folio, líneas 248-259)**: tras `{match.service.folio}`, si `match.service.quoteNumber` existe, renderizar un pequeño badge/span con estilo del módulo de Costos (`text-[10px] text-muted-foreground` o `Badge variant="outline"` con clases violeta sutiles) que diga `Cot: {quoteNumber}`. Mantener fecha entre paréntesis tal cual.

3. **Popover "Mejores candidatos descartados" (líneas 318-330)**: añadir `quoteNumber` en la línea de datos del candidato (`{c.service.licensePlate || '—'} · Cot: {quoteNumber} · {monto} · {fecha}`) cuando exista, para mantener consistencia.

## Consideraciones

- Usar tokens semánticos (`text-muted-foreground`, `text-violet-600`) — sin colores hardcoded.
- `quoteNumber` ya existe en el tipo `Service` (línea 16 y 71 de `src/types/index.ts`) y en los candidatos, por lo que no hay cambios de tipos ni de hooks.
- Sin tocar `usePurchaseOrderPDFImport`, `reassignMatch`, ni lógica de scoring/aplicación.
