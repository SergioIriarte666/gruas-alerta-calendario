

# Fix: Agregar prefijo COT- al numero de cotizacion

## Problema
El importador de cotizaciones guarda el numero tal como viene del PDF (ej: "4120") sin agregar el prefijo "COT-". El importador de OC si agrega "OC-" como prefijo. El BatchUpdateModal tambien usa "COT-" como prefijo por defecto.

## Solucion

### Archivo: `src/hooks/vip/useQuotePDFImport.ts` (linea 274-275)

Agregar logica de formato al numero de cotizacion antes de guardarlo, igual que hace el importador de OC:

```typescript
// ANTES:
quoteNumber: match.quoteNumber,

// DESPUES:
const formattedQuote = match.quoteNumber.startsWith('COT-')
  ? match.quoteNumber
  : `COT-${match.quoteNumber}`;
quoteNumber: formattedQuote,
```

Esto asegura que el numero siempre se guarde con el prefijo "COT-" (ej: "COT-4120"), manteniendo consistencia con el BatchUpdateModal y el formato visual del pipeline.

## Archivo a modificar

| Archivo | Cambio |
|---|---|
| `src/hooks/vip/useQuotePDFImport.ts` | Agregar prefijo "COT-" al quoteNumber en applyMatches |

