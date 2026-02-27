

# Fix: Priorizar matching por patente sobre matching por monto

## Problema
El importador procesa los items del PDF en orden secuencial. Cuando un item SIN patente aparece antes que uno CON patente, el fallback por monto ($15.000) consume el servicio SRV-6463 (VLZF-95). Luego, cuando llega el item con patente VLZF-95, el servicio ya esta usado y aparece "Sin match".

## Solucion

### Archivo: `src/hooks/vip/useQuotePDFImport.ts`

Reordenar los items expandidos para procesar primero los que tienen patente y luego los que no:

Despues de expandir todos los items (linea ~210), antes del loop de matching:

1. Acumular todos los items expandidos de todas las cotizaciones en una lista plana
2. Ordenar: items CON patente primero, items SIN patente despues
3. Ejecutar el matching sobre la lista ordenada

Cambio concreto en el loop de matching (~lineas 198-285):

```typescript
// Collect all expanded items first
const allItems: { item: ParsedQuoteItem; quoteNumber: string; fileName: string }[] = [];

for (const quote of validQuotes) {
  for (const rawItem of quote.items) {
    const patenteRaw = (rawItem.patente || '').trim();
    const multiPatentes = patenteRaw.split(/[\/,]/).map(p => p.trim()).filter(p => p.length > 0);
    
    const expandedItems = multiPatentes.length > 1
      ? multiPatentes.map(p => ({ ...rawItem, patente: p, amount: Math.round(rawItem.amount / multiPatentes.length) }))
      : [rawItem];

    for (const item of expandedItems) {
      allItems.push({ item, quoteNumber: quote.quoteNumber, fileName: quote.fileName });
    }
  }
}

// Sort: items with patente first, without patente last
allItems.sort((a, b) => {
  const aHas = normalizePatente(a.item.patente) ? 0 : 1;
  const bHas = normalizePatente(b.item.patente) ? 0 : 1;
  return aHas - bHas;
});

// Then run matching loop over allItems instead of nested quote/item loops
```

Esto asegura que VLZF-95 se matchea con SRV-6463 por patente antes de que el item sin patente intente consumirlo por monto.

## Resultado esperado
- Items con patente se matchean primero por patente (prioridad)
- Items sin patente usan fallback por monto solo con servicios sobrantes
- VLZF-95 encontrara SRV-6463 correctamente
- El item sin patente se matcheara con otro servicio de $15.000 o quedara "Sin match"
