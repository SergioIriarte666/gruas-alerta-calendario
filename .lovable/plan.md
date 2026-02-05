

# Plan: Agregar Opción de Fecha de Pago en Carga XML

## Problema Identificado

Cuando se carga un documento XML, el sistema asume automáticamente que el pago es a **30 días** desde la fecha de emisión. El usuario necesita:

1. **Opción de marcar como "Pagado" (Contado)** - El documento ya fue pagado
2. **Seleccionar días de crédito** (30, 45, 60, 90) - Crédito con vencimiento
3. **Ingresar fecha de pago específica** - Para casos particulares

### Componentes Afectados

| Componente | Estado Actual | Mejora Necesaria |
|------------|---------------|------------------|
| `XMLDocumentUpload` (Proveedores) | Tiene días + fecha individual | Agregar toggle "Pagado/Contado" |
| `XMLCostUpload` (Costos) | Sin fecha de pago | Agregar fecha de pago completa |

---

## Solución para XMLDocumentUpload (Proveedores)

### Cambios en UI

```text
┌─────────────────────────────────────────────────────────────────┐
│ CONDICIONES DE PAGO                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Tipo de pago: ( ) Crédito   (•) Contado/Pagado                 │
│                                                                 │
│ ┌─ Si es Crédito ───────────────────────────────────────────┐  │
│ │ Días de crédito: [30] [45] [60] [90] [Otro: ___]          │  │
│ │ [Aplicar a todos los documentos seleccionados]            │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ┌─ Si es Contado ───────────────────────────────────────────┐  │
│ │ Fecha de pago: [📅 05/02/2026]                             │  │
│ │ [Aplicar a todos los documentos seleccionados]            │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Cambios en Documentos Individuales

```text
┌─────────────────────────────────────────────────────────────────┐
│ [✓] Factura #12345                          $450,000            │
│     Proveedor: Copec S.A.  |  Emisión: 27/01/2026               │
│                                                                 │
│     Estado: [Pendiente ▼]  Vencimiento: [📅 26/02/2026]         │
│                           ó                                     │
│     Estado: [Pagado ▼]     Fecha Pago: [📅 27/01/2026]          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Solución para XMLCostUpload (Costos)

### Agregar Sección de Fecha de Pago

Además de los campos editables actuales (fecha, descripción, monto), agregar:

```text
┌─────────────────────────────────────────────────────────────────┐
│ ACCIONES MASIVAS                                                │
├─────────────────────────────────────────────────────────────────┤
│ Cambiar fecha emisión: [📅 ___]  [Aplicar]                     │
│ Cambiar fecha pago:    [📅 ___]  [Aplicar]                     │
│ Ajustar montos:        [+/- %]   [Aplicar]                     │
│                                                                 │
│ [○ Pagado Inmediato] - Usa la misma fecha de emisión           │
│ [○ A Crédito] - Calcular desde emisión: [30▼] días             │
└─────────────────────────────────────────────────────────────────┘
```

### Columna Adicional en Tabla

```text
│ [✓] │ Emisión 📅 │ Descripción │ Monto │ Categoría │ F.Pago 📅 │
│ [✓] │ 27/01     │ Combustible │ $45K  │ ▼ Cat.    │ 26/02     │
│ [✓] │ 27/01     │ Peajes      │ $12K  │ ▼ Cat.    │ 27/01 ✓   │
```

Donde `✓` indica que es pago inmediato (misma fecha).

---

## Cambios Técnicos

### 1. XMLDocumentUpload.tsx

**Nuevos estados:**
```typescript
const [paymentType, setPaymentType] = useState<'credit' | 'paid'>('credit');
const [paidDateOverrides, setPaidDateOverrides] = useState<Record<string, string>>({});
const [bulkPaidDate, setBulkPaidDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
const [statusOverrides, setStatusOverrides] = useState<Record<string, 'pending' | 'paid'>>({});
```

**Nueva UI:**
- RadioGroup para seleccionar tipo de pago (Crédito/Contado)
- DatePicker para fecha de pago masivo
- Selector de estado individual por documento (Pendiente/Pagado)
- Botón "Aplicar a todos" para fecha de pago

**Modificar función `handleUploadData`:**
```typescript
// Usar statusOverrides para determinar el status del pago
const status = statusOverrides[document.folio] || 
               (paymentType === 'paid' ? 'paid' : 'pending');

// Usar paidDateOverrides para la fecha de pago si es 'paid'
const paymentDate = status === 'paid' 
  ? paidDateOverrides[document.folio] || bulkPaidDate
  : undefined;

await createPayment({
  // ... campos existentes
  status: status,
  payment_date: paymentDate, // Nuevo campo
});
```

### 2. XMLCostUpload.tsx

**Nuevos estados:**
```typescript
const [paymentDateMode, setPaymentDateMode] = useState<'immediate' | 'credit' | 'custom'>('immediate');
const [creditDays, setCreditDays] = useState<number>(30);
const [bulkPaymentDate, setBulkPaymentDate] = useState<string>('');
const [paymentDateOverrides, setPaymentDateOverrides] = useState<Record<number, string>>({});
```

**Nueva UI en acciones masivas:**
- RadioGroup: Pagado Inmediato / A Crédito / Fecha Específica
- Input para días de crédito (si es "A Crédito")
- DatePicker para fecha específica (si es "Fecha Específica")

**Nueva columna en tabla:**
- Columna "F.Pago" editable con DatePickerInput

**Modificar función `handleUploadCosts`:**
```typescript
// Calcular fecha de pago según modo
const getPaymentDate = (index: number, emissionDate: string): string | null => {
  // Si hay override individual, usarlo
  if (paymentDateOverrides[index]) {
    return paymentDateOverrides[index];
  }
  
  // Según modo seleccionado
  if (paymentDateMode === 'immediate') {
    return emissionDate;
  } else if (paymentDateMode === 'credit') {
    const date = new Date(emissionDate);
    date.setDate(date.getDate() + creditDays);
    return format(date, 'yyyy-MM-dd');
  } else if (paymentDateMode === 'custom' && bulkPaymentDate) {
    return bulkPaymentDate;
  }
  
  return null;
};

const costData = {
  // ... campos existentes
  payment_date: getPaymentDate(index, finalDate),
};
```

### 3. Tipos (costs.ts)

Verificar que `payment_date` ya existe en el tipo `CostFormData` (ya confirmado que sí existe en la tabla `costs`).

---

## Archivos a Modificar

| # | Archivo | Cambios |
|---|---------|---------|
| 1 | `src/components/suppliers/XMLDocumentUpload.tsx` | Agregar toggle Crédito/Pagado, fecha de pago, estado individual |
| 2 | `src/components/costs/XMLCostUpload.tsx` | Agregar modo de pago, días crédito, fecha pago masiva, columna F.Pago |
| 3 | `src/hooks/useSupplierPayments.ts` | Verificar que acepta `payment_date` (probablemente ya lo hace) |

---

## Resultado Esperado

### Escenario 1: Cargar facturas ya pagadas
1. Usuario sube XML con 10 facturas
2. Selecciona "Contado/Pagado"
3. Ingresa fecha de pago (o usa la de hoy)
4. Clic en "Aplicar a todos"
5. Las 10 facturas se importan con estado "Pagado" y fecha de pago

### Escenario 2: Cargar facturas a crédito
1. Usuario sube XML con 10 facturas
2. Selecciona "Crédito"
3. Elige 45 días
4. Clic en "Aplicar a todos"
5. Las 10 facturas se importan con vencimiento calculado

### Escenario 3: Mezcla de pagadas y pendientes
1. Usuario sube XML con 10 facturas
2. Cambia estado individualmente en cada documento
3. Para las pagadas, selecciona fecha de pago
4. Importa con estados mixtos

