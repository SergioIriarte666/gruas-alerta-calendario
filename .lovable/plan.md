
# Auto-detectar cotizaciones existentes en Registro por Lotes

## Problema
Cuando todos los servicios seleccionados ya tienen numero de cotizacion (COT-xxxx), el toggle de "Cotizaciones" aparece activo por defecto. Esto no tiene sentido: si ya tienen COT, lo logico es que el usuario quiera asignar O.C., no volver a cotizar.

## Solucion

### Archivo: `src/components/vip/BatchUpdateModal.tsx`

1. **Auto-detectar al abrir el modal**: Si TODOS los servicios seleccionados ya tienen `quoteNumber`, el toggle de Cotizaciones arranca **desactivado** y el de Ordenes de Compra arranca **activado**.

2. **Sincronizar con `useEffect`**: Cada vez que se abre el modal (`open` cambia a `true`), recalcular si todos tienen cotizacion y ajustar los toggles.

3. **Permitir edicion manual**: El usuario puede reactivar el toggle de Cotizaciones manualmente si necesita editar/sobrescribir los numeros existentes.

### Cambio tecnico

En las lineas 53-56, reemplazar los estados fijos:
```typescript
const [enableQuote, setEnableQuote] = useState(true);
const [enablePurchaseOrder, setEnablePurchaseOrder] = useState(false);
```

Por logica inteligente:
```typescript
const allHaveQuote = useMemo(() =>
  selectedServices.length > 0 && selectedServices.every(s => s.quoteNumber?.trim()),
  [selectedServices]
);

const [enableQuote, setEnableQuote] = useState(!allHaveQuote);
const [enablePurchaseOrder, setEnablePurchaseOrder] = useState(allHaveQuote);

React.useEffect(() => {
  if (open) {
    const allQuoted = selectedServices.length > 0 &&
      selectedServices.every(s => s.quoteNumber?.trim());
    setEnableQuote(!allQuoted);
    setEnablePurchaseOrder(allQuoted);
  }
}, [open, selectedServices]);
```

Esto hace que:
- Si todos tienen COT: abre con COT off, OC on
- Si ninguno o algunos tienen COT: abre con COT on, OC off (comportamiento actual)
- El usuario siempre puede cambiar los toggles manualmente
