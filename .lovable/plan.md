

## Plan: Reordenar Pasos del Formulario de Nueva Factura

### Objetivo
Cambiar el orden de los pasos en el formulario "Nueva Factura" para que comience con la selección del cierre a facturar, siguiendo la misma lógica que aplicamos al formulario de Cierres.

---

### Orden Actual vs Propuesto

| Actual | Propuesto |
|--------|-----------|
| 1. Estado y Configuración (Estado, N° Fiscal) | 1. Selección de Cierre (Cierre a facturar) |
| 2. Fechas y Condiciones (Emisión, Vencimiento) | 2. Fechas y Condiciones (Emisión, Vencimiento) |
| 3. Selección de Cierre (Cierre a facturar) | 3. Estado y Configuración (Estado, N° Fiscal) |

---

### Justificación

1. **Decisión principal primero**: Lo más importante es elegir qué cierre facturar
2. **Datos derivados**: Una vez seleccionado el cierre, se conoce el cliente y montos
3. **Configuración al final**: El estado y número fiscal son detalles finales antes de guardar
4. **Consistencia con Cierres**: Mismo patrón que aplicamos al formulario de Nuevo Cierre

---

### Cambios a Realizar

#### 1. `src/components/invoices/form/InvoiceFormStepNavigation.tsx`

Reordenar los pasos:

```typescript
export const getInvoiceFormSteps = (): Omit<InvoiceFormStep, 'isCompleted' | 'hasError'>[] => [
  {
    id: 1,
    title: 'Selección de Cierre',      // Antes era paso 3
    description: 'Cierre a facturar',
    icon: <FileCheck className="h-4 w-4" />,
  },
  {
    id: 2,
    title: 'Fechas y Condiciones',     // Se mantiene igual
    description: 'Emisión, vencimiento y pago',
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    id: 3,
    title: 'Estado y Configuración',   // Antes era paso 1
    description: 'Estado y número fiscal',
    icon: <Settings className="h-4 w-4" />,
  },
];
```

---

#### 2. `src/components/invoices/InvoiceForm.tsx`

**a) Ajustar validación de pasos:**

```typescript
const validateStep = (step: number): boolean => {
  switch (step) {
    case 1: return watch('closureId') !== '';  // Cierre primero
    case 2: return watch('issueDate') !== '' && watch('dueDate') !== '';  // Fechas
    case 3: return true;  // Estado siempre válido (tiene default)
    default: return true;
  }
};
```

**b) Reordenar renderizado de pasos:**

```typescript
const renderStepContent = () => {
  switch (currentStep) {
    case 1:
      // Paso 1: Ahora es Selección de Cierre (antes Step3)
      return <InvoiceFormStep3 ... />;
    case 2:
      // Paso 2: Fechas y Condiciones (sin cambios)
      return <InvoiceFormStep2 ... />;
    case 3:
      // Paso 3: Ahora es Estado y Configuración (antes Step1)
      return <InvoiceFormStep1 ... />;
    default: return null;
  }
};
```

---

### Nuevo Flujo Visual

```text
┌─────────────────────────────────────────────────────────────────┐
│                   NUEVO FLUJO DE FACTURA                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PASO 1: SELECCIÓN DE CIERRE                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Ver cierres disponibles para facturar                 │   │
│  │ • Filtrar por cliente, fecha, folio                     │   │
│  │ • Ver resumen de montos (Subtotal, IVA, Total)          │   │
│  │ • Auto-detectar cliente desde cierre                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  PASO 2: FECHAS Y CONDICIONES                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Seleccionar condición de pago (Contado, 30 días, etc) │   │
│  │ • Fecha de emisión (hoy por defecto)                    │   │
│  │ • Fecha de vencimiento (auto-calculada)                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  PASO 3: ESTADO Y CONFIGURACIÓN                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Estado inicial (Borrador por defecto)                 │   │
│  │ • Número fiscal SII (opcional)                          │   │
│  │ • Confirmar y crear factura                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/invoices/form/InvoiceFormStepNavigation.tsx` | Reordenar array de pasos |
| `src/components/invoices/InvoiceForm.tsx` | Ajustar validación y renderizado |

---

### Beneficios

1. **Flujo más intuitivo**: Primero eliges QUÉ facturar, luego CUÁNDO, finalmente CÓMO
2. **Información visible desde el inicio**: Cliente y montos aparecen inmediatamente
3. **Consistencia UX**: Mismo patrón que el formulario de Cierres
4. **Menos fricción**: El cierre es la decisión principal, no un paso final

