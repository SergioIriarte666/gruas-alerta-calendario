

## Plan: Unificar la UI de pago en ambos importadores XML

### Problema
Los importadores tienen layouts diferentes para la sección de Condición de Pago + Fecha de Vencimiento:
- **Costos**: Layout limpio con Labels, Select con "Sin condición (manual)", y `DatePickerInput` en una fila con `border-t`
- **Proveedores**: Layout compacto inline con Select con "Manual", `Popover+Calendar` en vez de DatePickerInput, badge "Personalizada", todo apretado en una sola línea con el checkbox

### Cambios

| Archivo | Cambio |
|---------|--------|
| `src/components/suppliers/XMLDocumentUpload.tsx` | Reemplazar la sección inline de Select + Popover + Badge (líneas 912-983) por el mismo layout de Costos: una fila separada con `border-t pt-3`, Labels "Condición de Pago" y "Fecha de Vencimiento", Select con placeholder "Sin condición (manual)" y opciones con "(X días)", y `DatePickerInput` en vez de Popover+Calendar. Eliminar badge "Personalizada" y badge document_type de esa línea. |

### UI unificada (idéntica en ambos)

```text
──────────────────────────────────────
Condición de Pago          Fecha de Vencimiento
[▾ Sin condición (manual)] [📅 08/04/2026]
```

- Select: "Sin condición (manual)" + opciones "Nombre (X días)"
- DatePicker: `DatePickerInput` component (no Popover)
- Labels con clase `text-xs text-muted-foreground`
- Contenedor con `flex flex-wrap items-end gap-4 pt-3 border-t`

