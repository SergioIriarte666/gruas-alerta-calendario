
Objetivo: corregir el importador de Cotizaciones para que detecte correctamente “Ya asignada” cuando en BD existe `COT-xxxx` y el PDF trae `xxxx` (sin prefijo), evitando falsos “Cot. diferente”.

Diagnóstico confirmado:
- El problema está en `src/hooks/vip/useQuotePDFImport.ts`.
- Hoy se compara con igualdad estricta: `topService.quoteNumber === quote.quoteNumber`.
- En tus casos reales (SRV-6393/SRV-6394), BD guarda `COT-4095` / `COT-4097`, mientras el parser entrega `4095` / `4097`.
- Resultado: el estado cae en `already_has_quote` aunque sea la misma cotización.

Do I know what the issue is?
Sí: la comparación de cotización no está normalizada (prefijo/formato), por eso el matching de estado es demasiado estricto.

Alcance de implementación (1 archivo):
- `src/hooks/vip/useQuotePDFImport.ts`

Cambios propuestos:

1) Agregar normalizador de número de cotización
- Crear helper local similar al estilo de `normalizeOC` del importador de OC.
- Normalización recomendada:
  - trim + uppercase
  - remover prefijo `COT`/`COT-`/variantes con espacios
  - remover separadores no alfanuméricos para comparar de forma estable
- Ejemplos equivalentes tras normalizar:
  - `COT-4095` == `4095`
  - `cot 4095` == `4095`
  - `COT-24-001` == `24-001` (comparación robusta aun con separadores)

2) Usar normalización en la detección de estado
- Reemplazar:
  - `const hasSameQuote = topService.quoteNumber === quote.quoteNumber;`
- Por comparación normalizada:
  - `normalizeQuote(topService.quoteNumber) === normalizeQuote(quote.quoteNumber)`
- Mantener el resto de la lógica de prioridades sin cambios (match por patente, luego estados).

3) Endurecer formateo al aplicar cotización
- En `applyMatches`, evitar doble prefijo o formatos inconsistentes.
- En vez de sólo `startsWith('COT-')`, aplicar normalización y reconstrucción controlada para guardar una sola versión canónica (`COT-...`).
- Esto evita casos como `COT-COT-4095` o variaciones por espacios/mayúsculas.

4) (Opcional recomendado) Mostrar número “normalizado visualmente” en columna “N° Cot. Nueva”
- No es obligatorio para resolver el bug, pero mejora claridad en preview.
- Si se aplica, solo presentación; no cambia lógica base.

Validación funcional (E2E manual):
1. Subir PDF de cotización que entregue `4095`, con servicio existente `COT-4095`:
   - Debe mostrar “Ya asignada” (no “Cot. diferente”).
2. Subir PDF con cotización realmente distinta:
   - Debe seguir mostrando “Cot. diferente”.
3. Aplicar actualización en un caso “matched”:
   - Debe guardar en BD con un único prefijo `COT-...`.
4. Repetir con estado `invoiced` (ya habilitado en filtro):
   - Debe seguir detectando correctamente.

Riesgo y mitigación:
- Riesgo: sobre-normalizar y considerar iguales números que no correspondan.
- Mitigación: normalizar sólo prefijo/separadores, manteniendo núcleo alfanumérico del número; no tocar otras reglas de matching.

Resultado esperado:
- El importador deja de marcar falsos “Cot. diferente” por tema de prefijo.
- Estados más confiables en preview: “Ya asignada” cuando corresponde.
