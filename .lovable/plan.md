

## Plan: Mostrar Número de Cotización Existente en BatchUpdateModal

### Objetivo
Mostrar en la lista de servicios del modal de actualización por lotes el número de cotización actual (si existe), para que el usuario pueda identificar fácilmente qué servicios ya tienen cotización asignada y evitar sobrescribirlos accidentalmente.

---

### Cambios a Realizar

#### Archivo: `src/components/vip/BatchUpdateModal.tsx`

**Modificar la visualización de cada servicio en la lista (líneas 317-336):**

Agregar debajo del folio y estado, una línea que muestre:
- Número de cotización existente (si tiene)
- Número de orden de compra existente (si tiene)

```tsx
<div className="flex-1 min-w-0">
  <div className="flex items-center gap-2">
    <span className="font-medium text-sm text-foreground truncate">
      {service.folio}
    </span>
    <Badge variant="secondary" className={`text-[10px] ...`}>
      {STATUS_LABELS[String(service.status)] || service.status}
    </Badge>
  </div>
  
  {/* NUEVO: Mostrar COT y OC existentes */}
  {(service.quoteNumber || service.purchaseOrderNumber) && (
    <div className="flex items-center gap-2 mt-1">
      {service.quoteNumber && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-500 border-amber-500/30">
          COT: {service.quoteNumber}
        </Badge>
      )}
      {service.purchaseOrderNumber && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-500 border-green-500/30">
          OC: {service.purchaseOrderNumber}
        </Badge>
      )}
    </div>
  )}
  
  <div className="text-xs text-muted-foreground mt-1 truncate">
    {service.serviceType?.name || 'Sin tipo'} • {format(...)}
  </div>
</div>
```

---

### Vista Previa del Resultado

```text
┌─────────────────────────────────────────────────────────────────┐
│ Servicios                                    │ 5 de 5           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ☑ SRV-0012                    [Cotizado]                       │
│   ┌──────────────────────────────────────┐                     │
│   │ COT: COT-2024001                     │  ← Badge ámbar      │
│   └──────────────────────────────────────┘                     │
│   Rescate • 15/01/26                                           │
│                                                                 │
│ ☑ SRV-0013                    [Con O.C.]                       │
│   ┌──────────────────────────────────────┐                     │
│   │ COT: COT-2024001 │ OC: OC-5501       │  ← Ambos badges     │
│   └──────────────────────────────────────┘                     │
│   Traslado • 16/01/26                                          │
│                                                                 │
│ ☑ SRV-0014                    [Nuevo]                          │
│   Grúa liviana • 17/01/26                   ← Sin badges       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Beneficios

1. **Visibilidad inmediata**: El usuario ve de un vistazo qué servicios ya tienen cotización
2. **Prevención de errores**: Evita sobrescribir accidentalmente números existentes
3. **Información contextual**: Muestra tanto COT como OC cuando corresponde
4. **Consistencia visual**: Usa los mismos colores que el resto del sistema (ámbar para COT, verde para OC)

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/vip/BatchUpdateModal.tsx` | Agregar badges de COT/OC en la lista de servicios |

