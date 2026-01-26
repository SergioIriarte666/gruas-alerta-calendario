

## Plan: Reordenar Pasos del Formulario de Nuevo Cierre

### Objetivo
Cambiar el orden de los pasos en el formulario "Nuevo Cierre de Servicios" para que comience con la búsqueda de servicios (actualmente paso 2), haciendo el flujo más rápido e intuitivo.

---

### Nuevo Orden de Pasos

| Antes | Después |
|-------|---------|
| 1. Período (Rango de fechas) | 1. Cliente y Servicios (Buscador) |
| 2. Cliente y Servicios | 2. Período (Rango de fechas) |
| 3. Detalles (OC y estado) | 3. Detalles (OC y estado) |

---

### Archivos a Modificar

#### 1. `src/components/closures/ClosureFormStepNavigation.tsx`

Reordenar los pasos en la función `getClosureFormSteps()`:

```typescript
export const getClosureFormSteps = (): Omit<ClosureFormStep, 'isCompleted' | 'hasError'>[] => [
  {
    id: 1,
    title: 'Cliente y Servicios',  // Antes era paso 2
    description: 'Seleccionar servicios',
    icon: <ListChecks className="h-4 w-4" />,
  },
  {
    id: 2,
    title: 'Período',  // Antes era paso 1
    description: 'Rango de fechas',
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    id: 3,
    title: 'Detalles',
    description: 'OC y estado',
    icon: <FileText className="h-4 w-4" />,
  },
];
```

---

#### 2. `src/components/closures/ClosureForm.tsx`

Ajustar la lógica de validación y renderizado de pasos:

**a) Orden de validación de pasos completados:**
```typescript
// Antes:
const step1Complete = !!formData.dateFrom && !!formData.dateTo;
const step2Complete = formData.serviceIds.length > 0;

// Después:
const step1Complete = formData.serviceIds.length > 0;  // Servicios primero
const step2Complete = !!formData.dateFrom && !!formData.dateTo;  // Fechas segundo
```

**b) Renderizado condicional de pasos:**
```tsx
// Paso 1: Ahora es Cliente y Servicios
{currentStep === 1 && (
  <div className="space-y-4">
    <ColoredSectionCard title="Cliente (Opcional)" ... />
    <ColoredSectionCard title="Servicios Disponibles" ... />
  </div>
)}

// Paso 2: Ahora es Período
{currentStep === 2 && (
  <div className="space-y-4">
    <Alert ... />
    <ColoredSectionCard title="Período del Cierre" ... />
  </div>
)}

// Paso 3: Detalles (sin cambios)
{currentStep === 3 && ( ... )}
```

**c) Ajustar `handleAutoFillDates` para navegar al paso correcto:**
```typescript
const handleAutoFillDates = (dateFrom: Date, dateTo: Date) => {
  setFormData(prev => ({
    ...prev,
    dateFrom,
    dateTo
  }));
  // Navegar al paso 2 (Período) para mostrar las fechas auto-rellenadas
  setCurrentStep(2);  // Antes era 1
};
```

---

### Flujo Mejorado

```text
┌─────────────────────────────────────────────────────────────────┐
│                   NUEVO FLUJO DE CIERRE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PASO 1: CLIENTE Y SERVICIOS                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Búsqueda global activa (últimos 90 días)              │   │
│  │ • Buscar por OC, folio, patente, cliente                │   │
│  │ • Seleccionar servicios a incluir en el cierre          │   │
│  │ • Auto-detectar cliente único                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  PASO 2: PERÍODO                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • Botón "Auto-completar fechas" disponible              │   │
│  │ • Fechas basadas en servicios seleccionados             │   │
│  │ • O selección manual del rango                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│                          ▼                                      │
│  PASO 3: DETALLES                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ • OC auto-detectada de servicios                        │   │
│  │ • Total calculado automáticamente                       │   │
│  │ • Selección de estado                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Beneficios

1. **Flujo más natural**: Primero buscar qué servicios cerrar, luego confirmar fechas
2. **Buscador accesible**: El buscador global está disponible desde el primer momento
3. **Auto-completado inteligente**: Las fechas pueden auto-llenarse basándose en los servicios seleccionados
4. **Menos fricción**: No es necesario definir un rango de fechas antes de buscar

---

### Archivos Afectados

| Archivo | Cambios |
|---------|---------|
| `src/components/closures/ClosureFormStepNavigation.tsx` | Reordenar array de pasos |
| `src/components/closures/ClosureForm.tsx` | Ajustar validación, renderizado y navegación |

