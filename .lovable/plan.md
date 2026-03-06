

## Plan: Agregar indicador visual de origen (Histórica vs App) en la tabla de facturas

### Cambio

En `HistoricalSalesTable.tsx`, agregar un badge junto al folio de cada factura que indique su origen:

- **Folio con prefijo `HIST-`** → Badge gris/amber con texto "Histórica"
- **Resto** → Badge verde/primary con texto "App" o un ícono de escudo (ShieldCheck)

### Implementación

**Archivo: `src/components/finance/historical/HistoricalSalesTable.tsx`**

En la celda del folio (línea ~181), agregar un badge condicional:

```tsx
<TableCell className="font-medium font-mono text-xs">
  <div className="flex items-center gap-1.5">
    {invoice.folio}
    {invoice.folio.startsWith('HIST-') ? (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] px-1.5 py-0">
        Histórica
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0">
        App
      </Badge>
    )}
  </div>
</TableCell>
```

Un solo archivo modificado, sin cambios en lógica ni datos.

