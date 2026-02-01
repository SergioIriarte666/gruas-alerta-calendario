

## Plan: Preservar COT/OC Existentes en Actualización por Lotes

### Problema Actual
Cuando el usuario asigna números de cotización u orden de compra en lote, el sistema sobrescribe TODOS los servicios seleccionados, incluyendo los que ya tienen número asignado. Esto puede causar pérdida accidental de datos.

---

### Solución Propuesta

Implementar lógica de **preservación por defecto**, donde los servicios con datos existentes se excluyen automáticamente de la actualización, con opción de sobrescribir.

---

### Cambios a Realizar

#### 1. Agregar Estado y Toggle para Sobrescribir

```typescript
const [overwriteExisting, setOverwriteExisting] = useState(false);
```

#### 2. Calcular Servicios con Datos Existentes

```typescript
const servicesWithQuote = useMemo(() => 
  selectedServices.filter(s => s.quoteNumber), 
  [selectedServices]
);

const servicesWithPO = useMemo(() => 
  selectedServices.filter(s => s.purchaseOrderNumber), 
  [selectedServices]
);
```

#### 3. Modificar Visualización de Servicios

Mostrar el número existente de forma prominente y con estilo "protegido":

```text
┌─────────────────────────────────────────────────────────────────┐
│ Servicios                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ☑ SRV-0012          [Cotizado]        [COT: 2024001] 🔒        │
│   └─ Rescate • 15/01/26                                        │
│   └─ ⚠️ Ya tiene COT - se mantendrá (o indicar sobrescribirá)  │
│                                                                 │
│ ☑ SRV-0013          [Con O.C.]   [COT: 2024001] [OC: 5501] 🔒  │
│   └─ Traslado • 16/01/26                                       │
│   └─ ⚠️ Ya tiene COT y OC - se mantendrán                      │
│                                                                 │
│ ☑ SRV-0014          [Nuevo]            ← Sin datos existentes  │
│   └─ Grúa liviana • 17/01/26                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 4. Agregar Toggle "Sobrescribir Existentes" en Cards

En cada card (Cotizaciones / Órdenes de Compra), mostrar:

```tsx
{servicesWithQuote.length > 0 && enableQuote && (
  <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span className="text-xs text-amber-500">
          {servicesWithQuote.length} servicio(s) ya tienen COT asignado
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Sobrescribir</Label>
        <Switch 
          checked={overwriteQuote} 
          onCheckedChange={setOverwriteQuote}
          className="scale-75"
        />
      </div>
    </div>
    {!overwriteQuote && (
      <p className="text-[10px] text-muted-foreground mt-1">
        Se mantendrán los números existentes
      </p>
    )}
  </div>
)}
```

#### 5. Modificar Lógica de Envío

Al generar los datos, respetar la configuración de sobrescritura:

```typescript
const services = activeServices.map((service, index) => {
  const serviceData: any = { id: service.id };

  if (enableQuote) {
    // Solo asignar si NO tiene COT o si el usuario eligió sobrescribir
    const shouldAssignQuote = !service.quoteNumber || overwriteQuote;
    if (shouldAssignQuote) {
      serviceData.quote_number = generateQuoteNumber(index);
    }
  }

  if (enablePurchaseOrder) {
    // Solo asignar si NO tiene OC o si el usuario eligió sobrescribir
    const shouldAssignPO = !service.purchaseOrderNumber || overwritePO;
    if (shouldAssignPO) {
      serviceData.purchase_order_number = generatePONumber(index);
    }
  }

  return serviceData;
});
```

---

### Flujo Visual Actualizado

```text
                  ┌──────────────────────────────────────┐
                  │       MODAL BATCH UPDATE             │
                  └──────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │  SRV SIN COT │     │  SRV CON COT │     │  SRV CON OC  │
  │              │     │   (🔒)       │     │   (🔒)       │
  └──────────────┘     └──────────────┘     └──────────────┘
         │                     │                     │
         ▼                     ▼                     ▼
    ┌─────────┐         ┌─────────────────┐    ┌──────────┐
    │ ASIGNAR │         │ ¿Sobrescribir?  │    │ PRESERVAR│
    │ NUEVO   │         │   SI → Asignar  │    │ EXISTENTE│
    └─────────┘         │   NO → Mantener │    └──────────┘
                        └─────────────────┘
```

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/vip/BatchUpdateModal.tsx` | Agregar estados `overwriteQuote`/`overwritePO`, conteo de existentes, toggle en cards, modificar lógica de envío |

---

### Beneficios

1. **Seguridad por defecto**: Los datos existentes se preservan automáticamente
2. **Control explícito**: El usuario debe activar conscientemente la sobrescritura
3. **Visibilidad clara**: Indicadores visuales muestran qué servicios tienen datos
4. **Flexibilidad**: Se puede elegir sobrescribir COT, OC, o ambos independientemente

